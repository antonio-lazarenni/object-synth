import p5 from 'p5';
import {
  MODE,
  PROCESS_RESOLUTIONS,
  ZONE_TYPE,
  type EditorState,
  type SoundFile,
  type Zone,
} from '../editor/types';

const RESIZE_SPEED = 10;
const PIXEL_DIFF_THRESHOLD_SCALE = 100;
const MIN_ACTIVE_FRAMES = 2;

declare global {
  interface Window {
    showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
    audioContext?: AudioContext;
    webkitAudioContext?: typeof AudioContext;
  }

  interface HTMLAudioElement {
    sourceNode?: MediaElementAudioSourceNode;
    pannerNode?: StereoPannerNode;
  }
}

interface FileSystemHandle {
  kind: 'file' | 'directory';
  name: string;
}

interface FileSystemFileHandle extends FileSystemHandle {
  kind: 'file';
  getFile(): Promise<File>;
}

interface FileSystemDirectoryHandle extends FileSystemHandle {
  kind: 'directory';
  values(): AsyncIterableIterator<FileSystemHandle>;
}

type EngineCallbacks = {
  onStateChange: (partial: Partial<EditorState>) => void;
};

export class P5EngineAdapter {
  private p5Instance: p5 | null = null;

  private callbacks: EngineCallbacks;

  private state: EditorState = {
    mode: MODE.EDIT,
    zones: [],
    sounds: [],
    videoDevices: [],
    selectedVideoDeviceId: localStorage.getItem('selected-video-device-id'),
    processWidth: Number(localStorage.getItem('process-width') || '320'),
    processHeight: Number(localStorage.getItem('process-height') || '240'),
    showFpsDisplay: localStorage.getItem('show-fps') === 'true',
    imageFilterThreshold: Number(localStorage.getItem('image-filter-threshold') || '0.3'),
    movementThreshold: Number(localStorage.getItem('movement-threshold') || '0.02'),
    backgroundSoundId: null,
    backgroundVolume: Number(localStorage.getItem('background-sound-volume') || '0.5'),
  };

  private commandSetMode: ((mode: MODE) => void) | null = null;
  private commandSetZones: ((zones: Zone[]) => void) | null = null;
  private commandResetZones: (() => void) | null = null;
  private commandSetSelectedVideoDevice: ((deviceId: string | null) => Promise<void>) | null = null;
  private commandSetProcessResolution: ((w: number, h: number) => void) | null = null;
  private commandSetShowFps: ((show: boolean) => void) | null = null;
  private commandSetImageFilterThreshold: ((value: number) => void) | null = null;
  private commandSetMovementThreshold: ((value: number) => void) | null = null;
  private commandSetBackgroundSound: ((soundId: string | null) => void) | null = null;
  private commandSetBackgroundVolume: ((volume: number) => void) | null = null;
  private commandSetZoneSound: ((index: number, soundId: string) => void) | null = null;
  private commandSetZonePan: ((index: number, pan: number) => void) | null = null;
  private commandSetZoneVolume: ((index: number, volume: number) => void) | null = null;
  private commandAddSoundFiles: ((files: File[]) => Promise<void>) | null = null;
  private commandLoadSoundsFromDirectory: ((dirHandle: FileSystemDirectoryHandle) => Promise<void>) | null = null;
  private commandResetSoundLibrary: (() => Promise<void>) | null = null;
  private commandDeleteSound: ((soundId: string) => Promise<void>) | null = null;
  private commandPlaySound: ((soundId: string, zoneIndex?: number) => void) | null = null;

  constructor(callbacks: EngineCallbacks) {
    this.callbacks = callbacks;
  }

  private emitState(partial: Partial<EditorState>): void {
    this.state = { ...this.state, ...partial };
    this.callbacks.onStateChange(partial);
  }

  init(container: HTMLElement): void {
    this.destroy();

    const sketch = (p: p5) => {
      let isDragging = false;
      let draggedZoneIndex: number | null = null;
      let lastDraggedZoneIndex: number | null = null;
      let webcamCapture: p5.Element | null = null;
      let zones: Zone[] = [];
      let mode: MODE = MODE.EDIT;
      let imageFilterThreshold = this.state.imageFilterThreshold;
      let movementThreshold = this.state.movementThreshold;

      let prevGray: Uint8Array | null = null;
      let zoneActiveCounts = new Uint8Array(0);
      let zoneMovementFlags: boolean[] = [];
      let zoneMotionRatios = new Float32Array(0);

      let soundLibrary: SoundFile[] = [];
      const soundPlayers: Map<string, HTMLAudioElement> = new Map();
      let backgroundSound: HTMLAudioElement | null = null;
      let backgroundSoundId: string | null = null;

      let videoDevices: MediaDeviceInfo[] = [];
      let selectedVideoDeviceId: string | null = this.state.selectedVideoDeviceId;
      let currentStream: MediaStream | null = null;
      let showFpsDisplay = this.state.showFpsDisplay;

      let processWidth = this.state.processWidth;
      let processHeight = this.state.processHeight;
      let processBuffer: p5.Graphics | null = null;

      const DB_NAME = 'soundLibraryDB';
      const DB_VERSION = 1;
      let db: IDBDatabase;

      const saveZonesToLocalStorage = () => {
        localStorage.setItem('object-synth-zones', JSON.stringify(zones));
        this.emitState({ zones: [...zones] });
      };

      const loadZonesFromLocalStorage = (): Zone[] => {
        const savedZones = localStorage.getItem('object-synth-zones');
        if (savedZones) {
          return JSON.parse(savedZones) as Zone[];
        }
        return [{ id: 0, x: 0, y: 0, w: 100, h: 100, type: ZONE_TYPE.DEFAULT }];
      };

      const syncZoneMotionBuffers = () => {
        if (zoneActiveCounts.length !== zones.length) {
          zoneActiveCounts = new Uint8Array(zones.length);
          zoneMovementFlags = Array(zones.length).fill(false);
          zoneMotionRatios = new Float32Array(zones.length);
        }
      };

      const resetZoneMotionState = () => {
        prevGray = null;
        syncZoneMotionBuffers();
        zoneActiveCounts.fill(0);
        zoneMovementFlags.fill(false);
        zoneMotionRatios.fill(0);
      };

      const initDB = (): Promise<void> => {
        return new Promise((resolve, reject) => {
          const request = indexedDB.open(DB_NAME, DB_VERSION);
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            db = request.result;
            resolve();
          };
          request.onupgradeneeded = (event) => {
            const upgradeDb = (event.target as IDBOpenDBRequest).result;
            if (!upgradeDb.objectStoreNames.contains('sounds')) {
              upgradeDb.createObjectStore('sounds', { keyPath: 'id' });
            }
          };
        });
      };

      const saveSoundToDB = async (sound: SoundFile) => {
        return new Promise((resolve, reject) => {
          const transaction = db.transaction(['sounds'], 'readwrite');
          const store = transaction.objectStore('sounds');
          const request = store.put(sound);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      };

      const deleteSoundFromDB = async (soundId: string) => {
        return new Promise((resolve, reject) => {
          const transaction = db.transaction(['sounds'], 'readwrite');
          const store = transaction.objectStore('sounds');
          const request = store.delete(soundId);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      };

      const deleteAllSoundsFromDB = async () => {
        return new Promise((resolve, reject) => {
          const transaction = db.transaction(['sounds'], 'readwrite');
          const store = transaction.objectStore('sounds');
          const request = store.clear();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      };

      const updateAudioPanning = (audio: HTMLAudioElement, pan: number) => {
        try {
          if (!window.audioContext) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) return;
            window.audioContext = new AudioContextClass();
          }
          if (!audio.pannerNode) {
            if (!audio.sourceNode) {
              audio.sourceNode = window.audioContext.createMediaElementSource(audio);
            }
            audio.pannerNode = window.audioContext.createStereoPanner();
            audio.sourceNode.connect(audio.pannerNode);
            audio.pannerNode.connect(window.audioContext.destination);
          }
          audio.pannerNode.pan.value = pan;
        } catch (err) {
          console.error('Error setting audio panning:', err);
        }
      };

      const playSound = (soundId: string, zoneIndex?: number) => {
        const baseAudio = soundPlayers.get(soundId);
        if (!baseAudio) return;

        if (zoneIndex !== undefined) {
          const zone = zones[zoneIndex];
          const audio = new Audio(baseAudio.currentSrc || baseAudio.src);
          if (zone?.volume !== undefined) {
            audio.volume = zone.volume;
          }
          if (zone?.pan !== undefined) {
            updateAudioPanning(audio, zone.pan);
          }
          audio.addEventListener(
            'ended',
            () => {
              try {
                audio.sourceNode?.disconnect();
                audio.pannerNode?.disconnect();
              } catch {
                // no-op: nodes may already be disconnected.
              }
            },
            { once: true }
          );
          audio.play().catch((err) => console.error('Play sound failed:', err));
          return;
        }

        if (!baseAudio.paused) return;
        baseAudio.play().catch((err) => console.error('Play sound failed:', err));
      };

      const applyBackgroundSoundMode = () => {
        if (!backgroundSoundId) return;
        const audio = soundPlayers.get(backgroundSoundId);
        if (!audio) return;
        if (mode === MODE.PERFORMANCE) {
          backgroundSound = audio;
          backgroundSound.loop = true;
          backgroundSound.volume = this.state.backgroundVolume;
          backgroundSound.play().catch((err) => console.error('Background sound failed:', err));
        } else {
          audio.pause();
        }
      };

      const emitSounds = () => {
        this.emitState({ sounds: [...soundLibrary], backgroundSoundId });
      };

      const loadSoundsFromDB = async () => {
        return new Promise((resolve, reject) => {
          const transaction = db.transaction(['sounds'], 'readonly');
          const store = transaction.objectStore('sounds');
          const request = store.getAll();
          request.onsuccess = async () => {
            const sounds: SoundFile[] = request.result;
            for (const sound of sounds) {
              try {
                const blob = new Blob([sound.data], { type: sound.type });
                const url = URL.createObjectURL(blob);
                const audio = new Audio(url);
                await new Promise((audioResolve, audioReject) => {
                  audio.addEventListener('loadeddata', audioResolve, { once: true });
                  audio.addEventListener('error', audioReject, { once: true });
                });
                soundLibrary.push({ ...sound, url });
                soundPlayers.set(sound.id, audio);
              } catch (err) {
                console.error(`Failed to load sound ${sound.name}:`, err);
              }
            }
            emitSounds();
            resolve(sounds);
          };
          request.onerror = () => reject(request.error);
        });
      };

      const deleteSound = async (soundId: string) => {
        const soundIndex = soundLibrary.findIndex((s) => s.id === soundId);
        if (soundIndex === -1) return;
        const sound = soundLibrary[soundIndex];
        if (sound.url) URL.revokeObjectURL(sound.url);
        soundPlayers.get(soundId)?.pause();
        soundPlayers.delete(soundId);
        soundLibrary.splice(soundIndex, 1);
        await deleteSoundFromDB(soundId);
        zones = zones.map((zone) =>
          zone.soundId === soundId ? { ...zone, soundId: '', pan: 0, volume: 0.5 } : zone
        );
        saveZonesToLocalStorage();
        emitSounds();
      };

      const handleFileUpload = async (file: File) => {
        if (!file.type.startsWith('audio/')) return;
        const soundId = `sound-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        try {
          const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as ArrayBuffer);
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
          });
          const blob = new Blob([arrayBuffer], { type: file.type });
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          await new Promise((resolve, reject) => {
            audio.addEventListener('loadeddata', resolve, { once: true });
            audio.addEventListener('error', reject, { once: true });
          });
          const sound: SoundFile = { id: soundId, name: file.name, type: file.type, data: arrayBuffer };
          await saveSoundToDB(sound);
          soundLibrary.push({ ...sound, url });
          soundPlayers.set(soundId, audio);
          emitSounds();
        } catch (err) {
          console.error('Error loading audio file:', err);
        }
      };

      const loadSoundsFromDirectory = async (dirHandle: FileSystemDirectoryHandle) => {
        try {
          for await (const entry of dirHandle.values()) {
            if (entry.kind === 'file') {
              const file = await (entry as FileSystemFileHandle).getFile();
              if (file.type.startsWith('audio/')) {
                await handleFileUpload(file);
              }
            }
          }
        } catch (err) {
          console.error('Error reading directory:', err);
        }
      };

      const stopCurrentStream = () => {
        if (currentStream) {
          currentStream.getTracks().forEach((track) => track.stop());
          currentStream = null;
        }
      };

      const populateVideoState = () => {
        this.emitState({
          videoDevices: [...videoDevices],
          selectedVideoDeviceId,
        });
      };

      const refreshVideoDevices = async () => {
        if (!navigator.mediaDevices?.enumerateDevices) return;
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          videoDevices = devices.filter((device) => device.kind === 'videoinput');
          populateVideoState();
        } catch (error) {
          console.error('Failed to refresh video devices:', error);
        }
      };

      const initCaptureDevice = async (deviceId?: string): Promise<void> => {
        try {
          stopCurrentStream();
          const constraints: MediaStreamConstraints = {
            video: deviceId ? { deviceId: { exact: deviceId } } : true,
            audio: false,
          };

          await new Promise<void>((resolve, reject) => {
            try {
              const capture = p.createCapture(constraints as MediaStreamConstraints);
              capture.size(640, 480);
              capture.hide();
              if (typeof (capture as any).volume === 'function') {
                (capture as any).volume(0);
              }
              webcamCapture = capture;
              resetZoneMotionState();
              const videoEl = capture.elt as HTMLVideoElement;
              const onReady = () => {
                const stream = videoEl.srcObject as MediaStream | null;
                if (stream) currentStream = stream;
                resolve();
              };
              if (videoEl.readyState >= 1) {
                onReady();
              } else {
                videoEl.addEventListener('loadedmetadata', onReady, { once: true });
                videoEl.addEventListener('error', () => reject(new Error('Video metadata load failed')), {
                  once: true,
                });
              }
            } catch (error) {
              reject(error);
            }
          });

          await refreshVideoDevices();
        } catch (err) {
          console.error(`[initCaptureDevice] capture error: ${err}`);
          if (deviceId) {
            selectedVideoDeviceId = null;
            localStorage.removeItem('selected-video-device-id');
            await initCaptureDevice();
          }
        }
      };

      const getPixelDiffThreshold = () => Math.max(1, Math.floor(imageFilterThreshold * PIXEL_DIFF_THRESHOLD_SCALE));

      const detectZoneMotion = () => {
        if (!webcamCapture || !processBuffer) return;
        processBuffer.image(webcamCapture as unknown as p5.Image, 0, 0, processWidth, processHeight);
        processBuffer.loadPixels();
        const pix = processBuffer.pixels;
        if (!pix || pix.length === 0) return;

        const currGray = new Uint8Array(processWidth * processHeight);
        for (let y = 0; y < processHeight; y++) {
          for (let x = 0; x < processWidth; x++) {
            const idx = (x + y * processWidth) * 4;
            currGray[x + y * processWidth] = (pix[idx] * 30 + pix[idx + 1] * 59 + pix[idx + 2] * 11) / 100;
          }
        }

        if (!prevGray) {
          prevGray = currGray;
          return;
        }
        const previousGray = prevGray;

        syncZoneMotionBuffers();
        const pixelDiffThreshold = getPixelDiffThreshold();
        zones.forEach((zone, zoneIndex) => {
          const xStart = Math.max(0, Math.floor((zone.x / p.width) * processWidth));
          const yStart = Math.max(0, Math.floor((zone.y / p.height) * processHeight));
          const xEnd = Math.min(processWidth, Math.ceil(((zone.x + zone.w) / p.width) * processWidth));
          const yEnd = Math.min(processHeight, Math.ceil(((zone.y + zone.h) / p.height) * processHeight));
          let changed = 0;
          let total = 0;
          for (let y = yStart; y < yEnd; y++) {
            for (let x = xStart; x < xEnd; x++) {
              const i = x + y * processWidth;
              if (Math.abs(currGray[i] - previousGray[i]) > pixelDiffThreshold) changed += 1;
              total += 1;
            }
          }
          const ratio = total > 0 ? changed / total : 0;
          zoneMotionRatios[zoneIndex] = ratio;
          const isCurrentlyActive = ratio > movementThreshold;
          if (isCurrentlyActive) {
            zoneActiveCounts[zoneIndex] = Math.min(255, zoneActiveCounts[zoneIndex] + 1);
          } else {
            zoneActiveCounts[zoneIndex] = 0;
            zoneMovementFlags[zoneIndex] = false;
          }
          const becameActive =
            !zoneMovementFlags[zoneIndex] && zoneActiveCounts[zoneIndex] >= MIN_ACTIVE_FRAMES;
          if (becameActive) {
            zoneMovementFlags[zoneIndex] = true;
            if (zone.soundId) {
              playSound(zone.soundId, zoneIndex);
            }
          }
        });

        prevGray = currGray;
      };

      const drawZoneMotionOverlay = () => {
        zones.forEach((zone, zoneIndex) => {
          const active = zoneMovementFlags[zoneIndex];
          const ratio = zoneMotionRatios[zoneIndex] || 0;
          if (active) {
            p.fill(0, 255, 0, 70);
            p.noStroke();
            p.rect(zone.x, zone.y, zone.w, zone.h);
          }
          p.stroke(active ? '#00ff00' : 'salmon');
          p.strokeWeight(zoneIndex === lastDraggedZoneIndex ? 3 : 2);
          p.noFill();
          p.rect(zone.x, zone.y, zone.w, zone.h);

          p.noStroke();
          p.fill(active ? '#00ff00' : '#ff6666');
          p.textAlign(p.CENTER, p.CENTER);
          p.textSize(18);
          p.text(zoneIndex.toString(), zone.x + zone.w / 2, zone.y + zone.h / 2);

          p.textSize(12);
          p.textAlign(p.LEFT, p.TOP);
          p.text(`${Math.round(ratio * 100)}%`, zone.x + 4, zone.y + 4);
        });
      };

      this.commandSetMode = (nextMode) => {
        mode = nextMode;
        if (mode === MODE.PERFORMANCE) {
          resetZoneMotionState();
        }
        applyBackgroundSoundMode();
        this.emitState({ mode });
      };

      this.commandSetZones = (nextZones) => {
        zones = nextZones.map((zone, index) => ({ ...zone, id: index }));
        saveZonesToLocalStorage();
        if (mode === MODE.PERFORMANCE) resetZoneMotionState();
      };

      this.commandResetZones = () => {
        zones = Array.from({ length: Math.max(1, zones.length) }, (_, i) => ({
          id: i,
          x: 0,
          y: 0,
          w: 100,
          h: 100,
          type: ZONE_TYPE.DEFAULT,
          soundId: '',
          pan: 0,
          volume: 0.5,
        }));
        saveZonesToLocalStorage();
      };

      this.commandSetSelectedVideoDevice = async (deviceId) => {
        selectedVideoDeviceId = deviceId;
        if (deviceId) localStorage.setItem('selected-video-device-id', deviceId);
        else localStorage.removeItem('selected-video-device-id');
        await initCaptureDevice(selectedVideoDeviceId || undefined);
        this.emitState({ selectedVideoDeviceId });
      };

      this.commandSetProcessResolution = (w, h) => {
        processWidth = w;
        processHeight = h;
        localStorage.setItem('process-width', String(w));
        localStorage.setItem('process-height', String(h));
        processBuffer = p.createGraphics(w, h);
        processBuffer.pixelDensity(1);
        if (mode === MODE.PERFORMANCE) resetZoneMotionState();
        this.emitState({ processWidth: w, processHeight: h });
      };

      this.commandSetShowFps = (show) => {
        showFpsDisplay = show;
        localStorage.setItem('show-fps', String(show));
        this.emitState({ showFpsDisplay });
      };

      this.commandSetImageFilterThreshold = (value) => {
        imageFilterThreshold = value;
        localStorage.setItem('image-filter-threshold', value.toString());
        this.emitState({ imageFilterThreshold: value });
      };

      this.commandSetMovementThreshold = (value) => {
        movementThreshold = value;
        localStorage.setItem('movement-threshold', value.toString());
        this.emitState({ movementThreshold: value });
      };

      this.commandSetBackgroundSound = (soundId) => {
        if (backgroundSound) {
          backgroundSound.pause();
          backgroundSound = null;
          backgroundSoundId = null;
        }
        if (soundId) {
          backgroundSoundId = soundId;
          applyBackgroundSoundMode();
        }
        this.emitState({ backgroundSoundId });
      };

      this.commandSetBackgroundVolume = (volume) => {
        localStorage.setItem('background-sound-volume', volume.toString());
        if (backgroundSound) {
          backgroundSound.volume = volume;
        }
        this.emitState({ backgroundVolume: volume });
      };

      this.commandSetZoneSound = (index, soundId) => {
        if (!zones[index]) return;
        zones[index].soundId = soundId;
        saveZonesToLocalStorage();
      };

      this.commandSetZonePan = (index, pan) => {
        if (!zones[index]) return;
        zones[index].pan = pan;
        saveZonesToLocalStorage();
      };

      this.commandSetZoneVolume = (index, volume) => {
        if (!zones[index]) return;
        zones[index].volume = volume;
        saveZonesToLocalStorage();
      };

      this.commandAddSoundFiles = async (files) => {
        for (const file of files) {
          await handleFileUpload(file);
        }
      };

      this.commandLoadSoundsFromDirectory = loadSoundsFromDirectory;

      this.commandResetSoundLibrary = async () => {
        soundLibrary = [];
        soundPlayers.clear();
        await deleteAllSoundsFromDB();
        emitSounds();
      };

      this.commandDeleteSound = deleteSound;
      this.commandPlaySound = playSound;

      p.setup = async () => {
        p.createCanvas(640, 480);
        zones = loadZonesFromLocalStorage();
        this.emitState({ zones: [...zones] });
        await initCaptureDevice(selectedVideoDeviceId || undefined);

        try {
          await initDB();
          await loadSoundsFromDB();
        } catch (err) {
          console.error('Failed to load sounds from IndexedDB:', err);
        }

        await refreshVideoDevices();
        processBuffer = p.createGraphics(processWidth, processHeight);
        processBuffer.pixelDensity(1);
        resetZoneMotionState();
        p.frameRate(30);
        if (navigator.mediaDevices) {
          if (typeof (navigator.mediaDevices as any).addEventListener === 'function') {
            (navigator.mediaDevices as any).addEventListener('devicechange', refreshVideoDevices);
          } else {
            navigator.mediaDevices.ondevicechange = () => {
              refreshVideoDevices();
            };
          }
        }
      };

      p.mousePressed = () => {
        const hoveredIndex = zones.findIndex(
          (zone) =>
            p.mouseX > zone.x &&
            p.mouseX < zone.x + zone.w &&
            p.mouseY > zone.y &&
            p.mouseY < zone.y + zone.h
        );
        if (hoveredIndex !== -1) {
          isDragging = true;
          draggedZoneIndex = hoveredIndex;
          lastDraggedZoneIndex = hoveredIndex;
        }
      };

      p.mouseReleased = () => {
        isDragging = false;
        draggedZoneIndex = null;
        saveZonesToLocalStorage();
      };

      p.keyPressed = () => {
        if (lastDraggedZoneIndex === null) return;
        switch (p.key) {
          case 'ArrowUp':
            zones[lastDraggedZoneIndex].h -= RESIZE_SPEED;
            break;
          case 'ArrowDown':
            zones[lastDraggedZoneIndex].h += RESIZE_SPEED;
            break;
          case 'ArrowLeft':
            zones[lastDraggedZoneIndex].w -= RESIZE_SPEED;
            break;
          case 'ArrowRight':
            zones[lastDraggedZoneIndex].w += RESIZE_SPEED;
            break;
        }
        zones[lastDraggedZoneIndex].w = Math.max(20, zones[lastDraggedZoneIndex].w);
        zones[lastDraggedZoneIndex].h = Math.max(20, zones[lastDraggedZoneIndex].h);
        saveZonesToLocalStorage();
        if (mode === MODE.PERFORMANCE) resetZoneMotionState();
      };

      p.draw = () => {
        p.background(220);
        if (mode === MODE.PERFORMANCE) {
          if (webcamCapture) {
            p.image(webcamCapture as unknown as p5.Image, 0, 0, p.width, p.height);
            detectZoneMotion();
          }
          drawZoneMotionOverlay();
        } else {
          if (webcamCapture) {
            p.image(webcamCapture as unknown as p5.Image, 0, 0, p.width, p.height);
          }
          if (isDragging && draggedZoneIndex !== null) {
            zones[draggedZoneIndex].x = p.mouseX - zones[draggedZoneIndex].w / 2;
            zones[draggedZoneIndex].y = p.mouseY - zones[draggedZoneIndex].h / 2;
          }
          zones.forEach((zone, index) => {
            p.stroke(index === lastDraggedZoneIndex ? '#ADF802' : 'salmon');
            p.strokeWeight(2);
            p.noFill();
            p.rect(zone.x, zone.y, zone.w, zone.h);
            p.fill(index === lastDraggedZoneIndex ? 'green' : 'red');
            p.noStroke();
            p.textAlign(p.CENTER, p.CENTER);
            p.textSize(20);
            p.text(index.toString(), zone.x + zone.w / 2, zone.y + zone.h / 2);
            p.noFill();
          });
        }
        if (showFpsDisplay) {
          p.push();
          p.fill(0, 180);
          p.noStroke();
          p.rect(p.width - 70, 4, 66, 22, 4);
          p.fill(0, 255, 0);
          p.textSize(14);
          p.textAlign(p.RIGHT, p.TOP);
          p.text(`${Math.round(p.frameRate())} FPS`, p.width - 8, 8);
          p.pop();
        }
      };
    };

    this.p5Instance = new p5(sketch, container);
  }

  destroy(): void {
    if (this.p5Instance) {
      this.p5Instance.remove();
      this.p5Instance = null;
    }
  }

  setMode(mode: MODE): void {
    this.commandSetMode?.(mode);
  }

  setActiveZoneCount(count: number): void {
    const zones = this.state.zones;
    const nextZones = Array.from({ length: Math.max(1, count) }, (_, i) => {
      if (i < zones.length) return zones[i];
      return {
        id: i,
        x: Math.random() * 400,
        y: Math.random() * 300,
        w: 100,
        h: 100,
        type: ZONE_TYPE.DEFAULT,
        soundId: '',
        pan: 0,
        volume: 0.5,
      } satisfies Zone;
    });
    this.commandSetZones?.(nextZones);
  }

  resetZones(): void {
    this.commandResetZones?.();
  }

  async setSelectedVideoDevice(deviceId: string | null): Promise<void> {
    await this.commandSetSelectedVideoDevice?.(deviceId);
  }

  setProcessResolution(w: number, h: number): void {
    const isAllowed = PROCESS_RESOLUTIONS.some((res) => res.w === w && res.h === h);
    if (!isAllowed) return;
    this.commandSetProcessResolution?.(w, h);
  }

  setShowFps(show: boolean): void {
    this.commandSetShowFps?.(show);
  }

  setImageFilterThreshold(value: number): void {
    this.commandSetImageFilterThreshold?.(value);
  }

  setMovementThreshold(value: number): void {
    this.commandSetMovementThreshold?.(value);
  }

  setBackgroundSound(soundId: string | null): void {
    this.commandSetBackgroundSound?.(soundId);
  }

  setBackgroundVolume(volume: number): void {
    this.commandSetBackgroundVolume?.(volume);
  }

  setZoneSound(index: number, soundId: string): void {
    this.commandSetZoneSound?.(index, soundId);
  }

  setZonePan(index: number, pan: number): void {
    this.commandSetZonePan?.(index, pan);
  }

  setZoneVolume(index: number, volume: number): void {
    this.commandSetZoneVolume?.(index, volume);
  }

  async addSoundFiles(files: File[]): Promise<void> {
    await this.commandAddSoundFiles?.(files);
  }

  async loadSoundsFromDirectory(): Promise<void> {
    if (!window.showDirectoryPicker || !this.commandLoadSoundsFromDirectory) return;
    const dirHandle = await window.showDirectoryPicker();
    await this.commandLoadSoundsFromDirectory(dirHandle);
  }

  async resetSoundLibrary(): Promise<void> {
    await this.commandResetSoundLibrary?.();
  }

  async deleteSound(soundId: string): Promise<void> {
    await this.commandDeleteSound?.(soundId);
  }

  playSound(soundId: string): void {
    this.commandPlaySound?.(soundId);
  }
}
