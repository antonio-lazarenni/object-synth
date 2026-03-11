import p5 from 'p5';
import {
  MODE,
  PROCESS_RESOLUTIONS,
  ZONE_TYPE,
  type DetectionMode,
  type EditorState,
  type SoundFile,
  type Zone,
} from '../editor/types';

const RESIZE_SPEED = 10;
const PIXEL_DIFF_THRESHOLD_SCALE = 100;
const MIN_ACTIVE_FRAMES = 2;
const PERF_DEBUG_STORAGE_KEY = 'object-synth-perf-debug';
const PRESENCE_ENTER_THRESHOLD = 0.08;
const PRESENCE_EXIT_THRESHOLD = 0.04;
const PRESENCE_EMPTY_THRESHOLD = 0.01;
const PRESENCE_EMPTY_FRAMES_TO_UPDATE_BASELINE = 8;
const PRESENCE_BASELINE_BLEND = 0.1;

declare global {
  interface Window {
    showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
    audioContext?: AudioContext;
    webkitAudioContext?: typeof AudioContext;
    __objectSynthDebug?: {
      snapshot: () => {
        fps: number;
        detectMotionMsAvg: number;
        drawMsAvg: number;
        createdObjectUrls: number;
        revokedObjectUrls: number;
        activeZoneAudioPlayers: number;
        baseSoundPlayers: number;
        hasBackgroundSound: boolean;
        streamTrackCount: number;
        presenceActiveZones: number;
        defaultDetectionMode: DetectionMode;
      };
      setMode: (mode: MODE) => void;
      setProcessResolution: (w: number, h: number) => void;
      setActiveZoneCount: (count: number) => void;
      setSelectedVideoDevice: (deviceId: string | null) => Promise<void>;
      setDefaultDetectionMode: (mode: DetectionMode) => void;
      addSyntheticSounds: (count: number) => Promise<void>;
      resetSoundLibrary: () => Promise<void>;
    };
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
  private teardownCurrent: (() => void) | null = null;

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
    defaultDetectionMode:
      localStorage.getItem('default-detection-mode') === 'presence' ? 'presence' : 'motion',
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
  private commandSetDefaultDetectionMode: ((mode: DetectionMode) => void) | null = null;
  private commandSetBackgroundSound: ((soundId: string | null) => void) | null = null;
  private commandSetBackgroundVolume: ((volume: number) => void) | null = null;
  private commandSetZoneSound: ((index: number, soundId: string) => void) | null = null;
  private commandSetZonePan: ((index: number, pan: number) => void) | null = null;
  private commandSetZoneVolume: ((index: number, volume: number) => void) | null = null;
  private commandSetZoneOverdub: ((index: number, overdub: boolean) => void) | null = null;
  private commandSetZoneDetectionMode: ((index: number, mode: DetectionMode | null) => void) | null = null;
  private commandSetZoneStopOnLeave: ((index: number, enabled: boolean) => void) | null = null;
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
      let defaultDetectionMode: DetectionMode = this.state.defaultDetectionMode;

      let prevGray: Uint8Array | null = null;
      let currGray = new Uint8Array(0);
      let zoneActiveCounts = new Uint8Array(0);
      let zoneMovementFlags: boolean[] = [];
      let zoneMotionRatios = new Float32Array(0);
      let zonePresenceFlags: boolean[] = [];
      let zonePresenceRatios = new Float32Array(0);
      let zonePresenceEmptyCounts = new Uint8Array(0);
      let zonePresenceBaselines: Array<Uint8Array | null> = [];

      let soundLibrary: SoundFile[] = [];
      const soundPlayers: Map<string, HTMLAudioElement> = new Map();
      let backgroundSound: HTMLAudioElement | null = null;
      let backgroundSoundId: string | null = null;
      let zoneActiveAudioPlayers: Array<Set<HTMLAudioElement>> = [];
      let zonePlayheadAudio: Array<HTMLAudioElement | null> = [];

      let videoDevices: MediaDeviceInfo[] = [];
      let selectedVideoDeviceId: string | null = this.state.selectedVideoDeviceId;
      let currentStream: MediaStream | null = null;
      let showFpsDisplay = this.state.showFpsDisplay;

      let processWidth = this.state.processWidth;
      let processHeight = this.state.processHeight;
      let processBuffer: p5.Graphics | null = null;

      const DB_NAME = 'soundLibraryDB';
      const DB_VERSION = 1;
      let db: IDBDatabase | null = null;
      let dbInitPromise: Promise<void> | null = null;
      let createdObjectUrls = 0;
      let revokedObjectUrls = 0;
      let detectMotionMsAvg = 0;
      let drawMsAvg = 0;
      let mediaDeviceListenerAttached = false;
      const perfDebugEnabled =
        localStorage.getItem(PERF_DEBUG_STORAGE_KEY) === 'true' ||
        new URLSearchParams(window.location.search).get('perfDebug') === '1';

      const createTrackedObjectUrl = (blob: Blob): string => {
        createdObjectUrls += 1;
        return URL.createObjectURL(blob);
      };

      const revokeTrackedObjectUrl = (url: string | undefined): void => {
        if (!url) return;
        URL.revokeObjectURL(url);
        revokedObjectUrls += 1;
      };

      const disconnectAudioGraph = (audio: HTMLAudioElement): void => {
        try {
          audio.sourceNode?.disconnect();
          audio.pannerNode?.disconnect();
        } catch {
          // no-op: nodes may already be disconnected.
        }
      };

      const clearZoneTransientAudio = () => {
        zoneActiveAudioPlayers.forEach((players) => {
          players.forEach((audio) => {
            audio.pause();
            disconnectAudioGraph(audio);
          });
          players.clear();
        });
        zonePlayheadAudio = zonePlayheadAudio.map(() => null);
      };

      const cleanupAllSounds = () => {
        clearZoneTransientAudio();
        if (backgroundSound) {
          backgroundSound.pause();
          disconnectAudioGraph(backgroundSound);
          backgroundSound = null;
        }
        soundLibrary.forEach((sound) => revokeTrackedObjectUrl(sound.url));
        soundPlayers.forEach((audio) => {
          audio.pause();
          disconnectAudioGraph(audio);
        });
        soundPlayers.clear();
        soundLibrary = [];
        backgroundSoundId = null;
      };

      const normalizeZone = (zone: Zone, index: number): Zone => ({
        ...zone,
        id: index,
        overdub: zone.overdub ?? true,
        stopOnLeave: zone.stopOnLeave ?? false,
      });

      const saveZonesToLocalStorage = () => {
        localStorage.setItem('object-synth-zones', JSON.stringify(zones));
        this.emitState({ zones: [...zones] });
      };

      const loadZonesFromLocalStorage = (): Zone[] => {
        const savedZones = localStorage.getItem('object-synth-zones');
        if (savedZones) {
          return (JSON.parse(savedZones) as Zone[]).map((zone, index) => normalizeZone(zone, index));
        }
        return [normalizeZone({ id: 0, x: 0, y: 0, w: 100, h: 100, type: ZONE_TYPE.DEFAULT }, 0)];
      };

      const syncZoneMotionBuffers = () => {
        if (zoneActiveCounts.length !== zones.length) {
          zoneActiveCounts = new Uint8Array(zones.length);
          zoneMovementFlags = Array(zones.length).fill(false);
          zoneMotionRatios = new Float32Array(zones.length);
          zonePresenceFlags = Array(zones.length).fill(false);
          zonePresenceRatios = new Float32Array(zones.length);
          zonePresenceEmptyCounts = new Uint8Array(zones.length);
          zonePresenceBaselines = Array.from({ length: zones.length }, (_, i) => zonePresenceBaselines[i] ?? null);
          zoneActiveAudioPlayers = Array.from(
            { length: zones.length },
            (_, i) => zoneActiveAudioPlayers[i] ?? new Set()
          );
          zonePlayheadAudio = Array.from({ length: zones.length }, (_, i) => zonePlayheadAudio[i] ?? null);
        }
      };

      const resetZoneMotionState = () => {
        prevGray = null;
        syncZoneMotionBuffers();
        zoneActiveCounts.fill(0);
        zoneMovementFlags.fill(false);
        zoneMotionRatios.fill(0);
        zonePresenceFlags.fill(false);
        zonePresenceRatios.fill(0);
        zonePresenceEmptyCounts.fill(0);
        zonePresenceBaselines = Array.from({ length: zones.length }, () => null);
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

      const ensureDBReady = async (): Promise<void> => {
        if (db) return;
        if (!dbInitPromise) {
          dbInitPromise = initDB().catch((err) => {
            dbInitPromise = null;
            throw err;
          });
        }
        await dbInitPromise;
      };

      const saveSoundToDB = async (sound: SoundFile) => {
        await ensureDBReady();
        if (!db) throw new Error('IndexedDB not initialized');
        const database = db;
        return new Promise((resolve, reject) => {
          const transaction = database.transaction(['sounds'], 'readwrite');
          const store = transaction.objectStore('sounds');
          const request = store.put(sound);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      };

      const deleteSoundFromDB = async (soundId: string) => {
        await ensureDBReady();
        if (!db) throw new Error('IndexedDB not initialized');
        const database = db;
        return new Promise((resolve, reject) => {
          const transaction = database.transaction(['sounds'], 'readwrite');
          const store = transaction.objectStore('sounds');
          const request = store.delete(soundId);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      };

      const deleteAllSoundsFromDB = async () => {
        await ensureDBReady();
        if (!db) throw new Error('IndexedDB not initialized');
        const database = db;
        return new Promise((resolve, reject) => {
          const transaction = database.transaction(['sounds'], 'readwrite');
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

      const stopZoneAudio = (zoneIndex: number) => {
        const zoneAudioPlayers = zoneActiveAudioPlayers[zoneIndex];
        if (!zoneAudioPlayers) return;
        zoneAudioPlayers.forEach((audio) => {
          audio.pause();
          disconnectAudioGraph(audio);
        });
        zoneAudioPlayers.clear();
        zonePlayheadAudio[zoneIndex] = null;
      };

      const resolveZoneDetectionMode = (zone: Zone): DetectionMode =>
        zone.detectionMode ?? defaultDetectionMode;

      const playSound = (soundId: string, zoneIndex?: number) => {
        const baseAudio = soundPlayers.get(soundId);
        if (!baseAudio) return;

        if (zoneIndex !== undefined) {
          const zone = zones[zoneIndex];
          const allowsOverdub = zone?.overdub ?? true;
          const zoneAudioPlayers = zoneActiveAudioPlayers[zoneIndex] ?? new Set<HTMLAudioElement>();
          zoneActiveAudioPlayers[zoneIndex] = zoneAudioPlayers;
          if (!allowsOverdub && zoneAudioPlayers.size > 0) return;
          const audio = new Audio(baseAudio.currentSrc || baseAudio.src);
          zoneAudioPlayers.add(audio);
          zonePlayheadAudio[zoneIndex] = audio;
          if (zone?.volume !== undefined) {
            audio.volume = zone.volume;
          }
          if (zone?.pan !== undefined) {
            updateAudioPanning(audio, zone.pan);
          }
          audio.addEventListener(
            'ended',
            () => {
              zoneAudioPlayers.delete(audio);
              if (zonePlayheadAudio[zoneIndex] === audio) zonePlayheadAudio[zoneIndex] = null;
              try {
                audio.sourceNode?.disconnect();
                audio.pannerNode?.disconnect();
              } catch {
                // no-op: nodes may already be disconnected.
              }
            },
            { once: true }
          );
          audio.play().catch((err) => {
            zoneAudioPlayers.delete(audio);
            if (zonePlayheadAudio[zoneIndex] === audio) zonePlayheadAudio[zoneIndex] = null;
            console.error('Play sound failed:', err);
          });
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
        await ensureDBReady();
        if (!db) throw new Error('IndexedDB not initialized');
        const database = db;
        return new Promise((resolve, reject) => {
          const transaction = database.transaction(['sounds'], 'readonly');
          const store = transaction.objectStore('sounds');
          const request = store.getAll();
          request.onsuccess = async () => {
            const sounds: SoundFile[] = request.result;
            for (const sound of sounds) {
              try {
                const isLegacyArrayBuffer = sound.data instanceof ArrayBuffer;
                const blob = sound.data instanceof Blob ? sound.data : new Blob([sound.data], { type: sound.type });
                const url = createTrackedObjectUrl(blob);
                const audio = new Audio(url);
                await new Promise((audioResolve, audioReject) => {
                  audio.addEventListener('loadeddata', audioResolve, { once: true });
                  audio.addEventListener('error', audioReject, { once: true });
                });
                if (isLegacyArrayBuffer) {
                  // Best-effort lazy migration: rewrite legacy payloads as Blob on successful load.
                  try {
                    await saveSoundToDB({ ...sound, data: blob });
                  } catch (migrateErr) {
                    console.error(`Failed to migrate sound ${sound.name} to Blob:`, migrateErr);
                  }
                }
                soundLibrary.push({ ...sound, data: blob, url });
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
        revokeTrackedObjectUrl(sound.url);
        const existingPlayer = soundPlayers.get(soundId);
        existingPlayer?.pause();
        if (existingPlayer) disconnectAudioGraph(existingPlayer);
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
          const blob = file.slice(0, file.size, file.type);
          const url = createTrackedObjectUrl(blob);
          const audio = new Audio(url);
          await new Promise((resolve, reject) => {
            audio.addEventListener('loadeddata', resolve, { once: true });
            audio.addEventListener('error', reject, { once: true });
          });
          const sound: SoundFile = { id: soundId, name: file.name, type: file.type, data: blob };
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
        if (webcamCapture) {
          try {
            (webcamCapture as any).remove?.();
          } catch {
            // no-op: best-effort cleanup for capture element
          }
          webcamCapture = null;
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

        const pixelCount = processWidth * processHeight;
        if (currGray.length !== pixelCount) {
          currGray = new Uint8Array(pixelCount);
        }
        for (let y = 0; y < processHeight; y++) {
          for (let x = 0; x < processWidth; x++) {
            const idx = (x + y * processWidth) * 4;
            currGray[x + y * processWidth] = (pix[idx] * 30 + pix[idx + 1] * 59 + pix[idx + 2] * 11) / 100;
          }
        }

        if (!prevGray) {
          prevGray = currGray.slice();
        }
        const previousGray = prevGray ?? currGray;

        syncZoneMotionBuffers();
        const pixelDiffThreshold = getPixelDiffThreshold();
        zones.forEach((zone, zoneIndex) => {
          const xStart = Math.max(0, Math.floor((zone.x / p.width) * processWidth));
          const yStart = Math.max(0, Math.floor((zone.y / p.height) * processHeight));
          const xEnd = Math.min(processWidth, Math.ceil(((zone.x + zone.w) / p.width) * processWidth));
          const yEnd = Math.min(processHeight, Math.ceil(((zone.y + zone.h) / p.height) * processHeight));
          const zoneWidth = Math.max(0, xEnd - xStart);
          const zoneHeight = Math.max(0, yEnd - yStart);
          const zonePixelCount = zoneWidth * zoneHeight;
          if (zonePixelCount === 0) {
            zoneMotionRatios[zoneIndex] = 0;
            zonePresenceRatios[zoneIndex] = 0;
            zoneActiveCounts[zoneIndex] = 0;
            zoneMovementFlags[zoneIndex] = false;
            zonePresenceFlags[zoneIndex] = false;
            return;
          }

          const zoneCurrentGray = new Uint8Array(zonePixelCount);
          const baselineGray = zonePresenceBaselines[zoneIndex];
          let motionChanged = 0;
          let presenceChanged = 0;
          let total = 0;
          for (let y = yStart; y < yEnd; y++) {
            for (let x = xStart; x < xEnd; x++) {
              const i = x + y * processWidth;
              const localIndex = total;
              const currentValue = currGray[i];
              zoneCurrentGray[localIndex] = currentValue;
              if (Math.abs(currentValue - previousGray[i]) > pixelDiffThreshold) motionChanged += 1;
              if (baselineGray && baselineGray.length === zonePixelCount) {
                if (Math.abs(currentValue - baselineGray[localIndex]) > pixelDiffThreshold) presenceChanged += 1;
              }
              total += 1;
            }
          }

          const motionRatio = total > 0 ? motionChanged / total : 0;
          zoneMotionRatios[zoneIndex] = motionRatio;

          let presenceRatio = 0;
          if (!baselineGray || baselineGray.length !== zonePixelCount) {
            zonePresenceBaselines[zoneIndex] = zoneCurrentGray.slice();
            zonePresenceEmptyCounts[zoneIndex] = 0;
          } else {
            presenceRatio = total > 0 ? presenceChanged / total : 0;
            if (presenceRatio <= PRESENCE_EMPTY_THRESHOLD) {
              zonePresenceEmptyCounts[zoneIndex] = Math.min(255, zonePresenceEmptyCounts[zoneIndex] + 1);
              if (zonePresenceEmptyCounts[zoneIndex] >= PRESENCE_EMPTY_FRAMES_TO_UPDATE_BASELINE) {
                for (let i = 0; i < zonePixelCount; i++) {
                  baselineGray[i] = Math.round(
                    baselineGray[i] * (1 - PRESENCE_BASELINE_BLEND) + zoneCurrentGray[i] * PRESENCE_BASELINE_BLEND
                  );
                }
              }
            } else {
              zonePresenceEmptyCounts[zoneIndex] = 0;
            }
          }
          zonePresenceRatios[zoneIndex] = presenceRatio;

          const modeForZone = resolveZoneDetectionMode(zone);
          const wasActive = zoneMovementFlags[zoneIndex];
          let isCurrentlyActive = false;

          if (modeForZone === 'presence') {
            const wasPresent = zonePresenceFlags[zoneIndex];
            const isPresent =
              presenceRatio > PRESENCE_ENTER_THRESHOLD ||
              (wasPresent && presenceRatio > PRESENCE_EXIT_THRESHOLD);
            zonePresenceFlags[zoneIndex] = isPresent;
            isCurrentlyActive = isPresent;
          } else {
            zonePresenceFlags[zoneIndex] = false;
            isCurrentlyActive = motionRatio > movementThreshold;
          }

          if (isCurrentlyActive) {
            zoneActiveCounts[zoneIndex] = Math.min(255, zoneActiveCounts[zoneIndex] + 1);
          } else {
            zoneActiveCounts[zoneIndex] = 0;
            zoneMovementFlags[zoneIndex] = false;
          }

          const becameActive = !zoneMovementFlags[zoneIndex] && zoneActiveCounts[zoneIndex] >= MIN_ACTIVE_FRAMES;
          if (becameActive) {
            zoneMovementFlags[zoneIndex] = true;
            if (zone.soundId) playSound(zone.soundId, zoneIndex);
          }

          if (wasActive && !isCurrentlyActive && modeForZone === 'presence' && (zone.stopOnLeave ?? false)) {
            stopZoneAudio(zoneIndex);
          }
        });

        prevGray = currGray.slice();
      };

      const getZonePlayheadProgress = (zoneIndex: number): number => {
        const audio = zonePlayheadAudio[zoneIndex];
        if (!audio) return 0;
        const duration = audio.duration;
        if (!Number.isFinite(duration) || duration <= 0) return 0;
        return Math.min(1, Math.max(0, audio.currentTime / duration));
      };

      const drawZonePlayhead = (zone: Zone, zoneIndex: number) => {
        if (!zone.soundId) return;
        const progress = getZonePlayheadProgress(zoneIndex);
        const barX = zone.x + 4;
        const barY = zone.y + zone.h - 10;
        const barWidth = Math.max(20, zone.w - 8);
        const barHeight = 6;
        p.noStroke();
        p.fill(0, 0, 0, 120);
        p.rect(barX, barY, barWidth, barHeight, 3);
        if (progress > 0) {
          p.fill('#ffd166');
          p.rect(barX, barY, barWidth * progress, barHeight, 3);
        }
      };

      const drawZoneMotionOverlay = () => {

        zones.forEach((zone, zoneIndex) => {
          const modeForZone = resolveZoneDetectionMode(zone);
          const active = zoneMovementFlags[zoneIndex];
          const ratio =
            modeForZone === 'presence'
              ? (zonePresenceRatios[zoneIndex] ?? 0)
              : (zoneMotionRatios[zoneIndex] ?? 0);
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
          p.text(`${modeForZone === 'presence' ? 'P' : 'M'} ${Math.round(ratio * 100)}%`, zone.x + 4, zone.y + 4);

          if (zone.soundId) {
            p.textAlign(p.RIGHT, p.TOP);
            p.textSize(18);
            p.fill('#ffd166');
            p.text('♪', zone.x + zone.w - 6, zone.y + 6);
          }
          drawZonePlayhead(zone, zoneIndex);
        });
      };

      this.commandSetMode = (nextMode) => {
        mode = nextMode;
        if (mode === MODE.PERFORMANCE) {
          isDragging = false;
          draggedZoneIndex = null;
          resetZoneMotionState();
        }
        applyBackgroundSoundMode();
        this.emitState({ mode });
      };

      this.commandSetZones = (nextZones) => {
        zones = nextZones.map((zone, index) => normalizeZone(zone, index));
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
          overdub: true,
          stopOnLeave: false,
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
        if (processBuffer) {
          try {
            (processBuffer as any).remove?.();
          } catch {
            // no-op: depends on p5 version internals.
          }
        }
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

      this.commandSetDefaultDetectionMode = (nextMode) => {
        defaultDetectionMode = nextMode;
        localStorage.setItem('default-detection-mode', nextMode);
        if (mode === MODE.PERFORMANCE) resetZoneMotionState();
        this.emitState({ defaultDetectionMode: nextMode });
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
        zonePlayheadAudio[index] = null;
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

      this.commandSetZoneOverdub = (index, overdub) => {
        if (!zones[index]) return;
        zones[index].overdub = overdub;
        saveZonesToLocalStorage();
      };

      this.commandSetZoneDetectionMode = (index, nextMode) => {
        if (!zones[index]) return;
        zones[index].detectionMode = nextMode ?? undefined;
        if (mode === MODE.PERFORMANCE) resetZoneMotionState();
        saveZonesToLocalStorage();
      };

      this.commandSetZoneStopOnLeave = (index, enabled) => {
        if (!zones[index]) return;
        zones[index].stopOnLeave = enabled;
        saveZonesToLocalStorage();
      };

      this.commandAddSoundFiles = async (files) => {
        await ensureDBReady();
        for (const file of files) {
          await handleFileUpload(file);
        }
      };

      this.commandLoadSoundsFromDirectory = loadSoundsFromDirectory;

      this.commandResetSoundLibrary = async () => {
        await ensureDBReady();
        cleanupAllSounds();
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
          await ensureDBReady();
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
            mediaDeviceListenerAttached = true;
          } else {
            navigator.mediaDevices.ondevicechange = () => {
              refreshVideoDevices();
            };
          }
        }
        if (perfDebugEnabled) {
          window.__objectSynthDebug = {
            snapshot: () => ({
              fps: Number(p.frameRate().toFixed(2)),
              detectMotionMsAvg: Number(detectMotionMsAvg.toFixed(3)),
              drawMsAvg: Number(drawMsAvg.toFixed(3)),
              createdObjectUrls,
              revokedObjectUrls,
              activeZoneAudioPlayers: zoneActiveAudioPlayers.reduce((sum, players) => sum + players.size, 0),
              baseSoundPlayers: soundPlayers.size,
              hasBackgroundSound: Boolean(backgroundSound),
              streamTrackCount: currentStream?.getTracks().length ?? 0,
              presenceActiveZones: zonePresenceFlags.filter(Boolean).length,
              defaultDetectionMode,
            }),
            setMode: (nextMode) => this.setMode(nextMode),
            setProcessResolution: (w, h) => this.setProcessResolution(w, h),
            setActiveZoneCount: (count) => this.setActiveZoneCount(count),
            setSelectedVideoDevice: (deviceId) => this.setSelectedVideoDevice(deviceId),
            setDefaultDetectionMode: (nextMode) => this.setDefaultDetectionMode(nextMode),
            addSyntheticSounds: async (count) => {
              const clampedCount = Math.max(0, Math.floor(count));
              const files: File[] = Array.from({ length: clampedCount }, (_, index) => {
                const sampleRate = 16000;
                const durationSec = 0.15;
                const samples = Math.floor(sampleRate * durationSec);
                const pcm = new Int16Array(samples);
                for (let i = 0; i < samples; i++) {
                  const t = i / sampleRate;
                  pcm[i] = Math.sin(2 * Math.PI * 440 * t) * 32767 * 0.2;
                }
                const wavHeader = new ArrayBuffer(44);
                const view = new DataView(wavHeader);
                const writeStr = (offset: number, value: string) => {
                  for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
                };
                writeStr(0, 'RIFF');
                view.setUint32(4, 36 + pcm.byteLength, true);
                writeStr(8, 'WAVE');
                writeStr(12, 'fmt ');
                view.setUint32(16, 16, true);
                view.setUint16(20, 1, true);
                view.setUint16(22, 1, true);
                view.setUint32(24, sampleRate, true);
                view.setUint32(28, sampleRate * 2, true);
                view.setUint16(32, 2, true);
                view.setUint16(34, 16, true);
                writeStr(36, 'data');
                view.setUint32(40, pcm.byteLength, true);
                const blob = new Blob([wavHeader, pcm.buffer], { type: 'audio/wav' });
                return new File([blob], `synthetic-${Date.now()}-${index}.wav`, { type: 'audio/wav' });
              });
              if (files.length > 0) {
                await this.addSoundFiles(files);
              }
            },
            resetSoundLibrary: async () => this.resetSoundLibrary(),
          };
        }
      };

      p.mousePressed = () => {
        if (mode !== MODE.EDIT) return;
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
        if (mode !== MODE.EDIT) return;
        isDragging = false;
        draggedZoneIndex = null;
        saveZonesToLocalStorage();
      };

      p.keyPressed = () => {
        if (mode !== MODE.EDIT) return;
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
      };

      p.draw = () => {
        const drawStart = performance.now();
        p.background(220);
        if (mode === MODE.PERFORMANCE) {
          if (webcamCapture) {
            p.image(webcamCapture as unknown as p5.Image, 0, 0, p.width, p.height);
            const detectStart = performance.now();
            detectZoneMotion();
            const detectElapsed = performance.now() - detectStart;
            detectMotionMsAvg = detectMotionMsAvg * 0.95 + detectElapsed * 0.05;
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
            if (zone.soundId) {
              p.textAlign(p.RIGHT, p.TOP);
              p.textSize(18);
              p.fill('#ffd166');
              p.text('♪', zone.x + zone.w - 6, zone.y + 6);
            }
            p.noFill();
            drawZonePlayhead(zone, index);
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
        const drawElapsed = performance.now() - drawStart;
        drawMsAvg = drawMsAvg * 0.95 + drawElapsed * 0.05;
      };

      const cleanupSketch = () => {
        if (mediaDeviceListenerAttached && navigator.mediaDevices) {
          try {
            (navigator.mediaDevices as any).removeEventListener?.('devicechange', refreshVideoDevices);
          } catch {
            // no-op: legacy implementations may not support removeEventListener.
          }
          mediaDeviceListenerAttached = false;
        }
        if (navigator.mediaDevices && navigator.mediaDevices.ondevicechange) {
          navigator.mediaDevices.ondevicechange = null;
        }
        stopCurrentStream();
        cleanupAllSounds();
        if (processBuffer) {
          try {
            (processBuffer as any).remove?.();
          } catch {
            // no-op: depends on p5 version internals.
          }
          processBuffer = null;
        }
        if (db) {
          db.close();
          db = null;
          dbInitPromise = null;
        }
        if (window.audioContext && window.audioContext.state !== 'closed') {
          window.audioContext.close().catch(() => undefined);
          window.audioContext = undefined;
        }
        if (window.__objectSynthDebug) {
          delete window.__objectSynthDebug;
        }
      };
      this.teardownCurrent = cleanupSketch;
    };

    this.p5Instance = new p5(sketch, container);
  }

  destroy(): void {
    this.teardownCurrent?.();
    this.teardownCurrent = null;
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
        overdub: true,
        stopOnLeave: false,
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

  setDefaultDetectionMode(mode: DetectionMode): void {
    this.commandSetDefaultDetectionMode?.(mode);
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

  setZoneOverdub(index: number, overdub: boolean): void {
    this.commandSetZoneOverdub?.(index, overdub);
  }

  setZoneDetectionMode(index: number, mode: DetectionMode | null): void {
    this.commandSetZoneDetectionMode?.(index, mode);
  }

  setZoneStopOnLeave(index: number, enabled: boolean): void {
    this.commandSetZoneStopOnLeave?.(index, enabled);
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
