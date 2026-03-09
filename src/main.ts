import p5 from 'p5';
// import { WebMidi, Output } from 'webmidi';
// import Particle from './Particle';
enum MODE {
  EDIT = 'edit',
  PERFORMANCE = 'performance',
}

enum ZONE_TYPE {
  DEFAULT = 'default',
  MIDI = 'midi',
  SOUND = 'sound',
}

interface SoundFile {
  id: string;
  name: string;
  type: string;
  data: ArrayBuffer; // Store the actual audio data instead of File and url
  url?: string; // Optional URL for runtime use
}

interface Zone {
  x: number;
  y: number;
  w: number;
  h: number;
  id: number;
  type: ZONE_TYPE;
  soundId?: string;
  pan?: number; // Add panning property
  volume?: number; // Add volume property
}

const RESIZE_SPEED = 10;
const PIXEL_DIFF_THRESHOLD_SCALE = 100;
const MIN_ACTIVE_FRAMES = 2;

// Processing resolution presets (lower = faster, fewer pixels)
const PROCESS_RESOLUTIONS: { w: number; h: number; label: string }[] = [
  { w: 640, h: 480, label: '640×480 (full)' },
  { w: 320, h: 240, label: '320×240 (2× faster)' },
  { w: 160, h: 120, label: '160×120 (4× faster)' },
];

// Add FileSystem API types
declare global {
  interface Window {
    showDirectoryPicker(): Promise<FileSystemDirectoryHandle>;
    audioContext?: AudioContext;
    webkitAudioContext?: typeof AudioContext;
  }
  
  // Extend HTMLAudioElement with our custom properties
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

const sketch = (p: p5) => {
  // const MIDI_CHANNEL = 1;
  // let midiOutputs: Output[] = [];
  // EDIT MODE
  let isDragging = false;
  let draggedZoneIndex: number | null = null;
  let lastDraggedZoneIndex: number | null = null;

  // Add UI elements
  // let outputSelects: p5.Element[] = [];
  // let thresholdSlider: p5.Element;
  // let baseNoteSlider: p5.Element;
  // let particles: Particle[] = [];
  let mode: MODE = MODE.EDIT;
  let WebcamCapture: p5.Element | null = null;
  let myVidaThreshold: number = parseFloat(localStorage.getItem('movement-threshold') || '0.02');
  let imageFilterThreshold: number = parseFloat(localStorage.getItem('image-filter-threshold') || '0.3');
  let activeZonesInput: p5.Element;
  let zones: Zone[] = [];

  let prevGray: Uint8Array | null = null;
  let zoneActiveCounts = new Uint8Array(0);
  let zoneMovementFlags: boolean[] = [];
  let zoneMotionRatios = new Float32Array(0);
  // Enable WebMidi at the start
  // WebMidi.enable()
  //   .then(() => {
  //     console.log('WebMidi enabled!');
  //     // Update midiOutputs based on initial selection
  //     updateMidiOutputs();
  //   })
  //   .catch((err) => console.error('WebMidi could not be enabled:', err));

  // Add sound library state and types
  let soundLibrary: SoundFile[] = [];
  let soundPlayers: Map<string, HTMLAudioElement> = new Map();
  let backgroundSound: HTMLAudioElement | null = null;
  let backgroundSoundId: string | null = null;

  let zoneSoundSelects: p5.Element[] = [];

  let videoDevices: MediaDeviceInfo[] = [];
  let webcamSelect: p5.Element | null = null;
  let selectedVideoDeviceId: string | null = localStorage.getItem('selected-video-device-id');
  let currentStream: MediaStream | null = null;

  // Processing resolution for motion detection (lower = faster)
  let processWidth = parseInt(localStorage.getItem('process-width') || '320', 10);
  let processHeight = parseInt(localStorage.getItem('process-height') || '240', 10);
  let processBuffer: p5.Graphics | null = null;

  // Optional FPS display for performance tuning
  let showFpsDisplay = localStorage.getItem('show-fps') === 'true';

  // Add IndexedDB setup
  const DB_NAME = 'soundLibraryDB';
  const DB_VERSION = 1;
  let db: IDBDatabase;

  // Initialize IndexedDB
  const initDB = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('sounds')) {
          db.createObjectStore('sounds', { keyPath: 'id' });
        }
      };
    });
  };

  // Save sound to IndexedDB
  const saveSoundToDB = async (sound: SoundFile) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['sounds'], 'readwrite');
      const store = transaction.objectStore('sounds');
      const request = store.put(sound);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  };

  // Load sounds from IndexedDB
  const loadSoundsFromDB = async () => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['sounds'], 'readonly');
      const store = transaction.objectStore('sounds');
      const request = store.getAll();

      request.onsuccess = async () => {
        const sounds: SoundFile[] = request.result;
        for (const sound of sounds) {
          try {
            // Create blob from stored data
            const blob = new Blob([sound.data], { type: sound.type });
            const url = URL.createObjectURL(blob);

            // Create and test audio element
            const audio = new Audio(url);
            await new Promise((resolve, reject) => {
              audio.addEventListener('loadeddata', resolve);
              audio.addEventListener('error', reject);
            });

            const soundWithUrl = {
              ...sound,
              url,
            };

            soundLibrary.push(soundWithUrl);
            soundPlayers.set(sound.id, audio);
          } catch (err) {
            console.error(`Failed to load sound ${sound.name}:`, err);
          }
        }
        updateSoundLibraryUI();
        resolve(sounds);
      };

      request.onerror = () => reject(request.error);
    });
  };

  // Delete sound from IndexedDB
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

  // Update deleteSound function to also remove from IndexedDB
  const deleteSound = async (soundId: string) => {
    const soundIndex = soundLibrary.findIndex((s) => s.id === soundId);
    if (soundIndex !== -1) {
      const sound = soundLibrary[soundIndex];
      if (sound.url) {
        URL.revokeObjectURL(sound.url);
      }
      soundPlayers.get(soundId)?.pause();
      soundPlayers.delete(soundId);
      soundLibrary.splice(soundIndex, 1);
      await deleteSoundFromDB(soundId);
      rerenderUIControls();
      updateSoundLibraryUI();
    }
  };

  // Update handleFileUpload to store ArrayBuffer
  const handleFileUpload = async (file: File | p5.File) => {
    const acceptedAudioTypes = [
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/ogg',
      'audio/x-m4a',
      'audio/aac',
      'audio/mp4',
      'audio',
    ];

    if (
      acceptedAudioTypes.includes(file.type) ||
      file.name.toLowerCase().endsWith('.mp3')
    ) {
      const soundId = `sound-${Date.now()}`;
      console.log('Processing file:', file);

      try {
        const fileData = 'data' in file ? file.data : file;

        // Read file data as ArrayBuffer
        const arrayBuffer = await new Promise<ArrayBuffer>(
          (resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as ArrayBuffer);
            reader.onerror = reject;
            reader.readAsArrayBuffer(fileData);
          }
        );

        // Create blob for immediate playback
        const blob = new Blob([arrayBuffer], { type: file.type });
        const url = URL.createObjectURL(blob);

        const audio = new Audio(url);

        await new Promise((resolve, reject) => {
          audio.addEventListener('loadeddata', resolve);
          audio.addEventListener('error', reject);
        });

        const sound: SoundFile = {
          id: soundId,
          name: file.name,
          type: file.type,
          data: arrayBuffer,
        };

        await saveSoundToDB(sound);
        soundLibrary.push({
          ...sound,
          url, // Add URL for audio element
        });
        soundPlayers.set(soundId, audio);
        updateSoundLibraryUI();
        rerenderUIControls();
      } catch (err) {
        console.error('Error loading audio file:', err);
      }
    } else {
      console.log('Attempted file type:', file.type);
    }
  };

  const rerenderUIControls = () => {
    const controlsDiv = p.select('.controls-div');
    if (controlsDiv) {
      controlsDiv.remove();
      createUIControls();
    }
  };

  let rerenderDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  const debouncedRerenderUIControls = () => {
    if (rerenderDebounceTimer) clearTimeout(rerenderDebounceTimer);
    rerenderDebounceTimer = setTimeout(() => {
      rerenderDebounceTimer = null;
      rerenderUIControls();
    }, 100);
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

  const getPixelDiffThreshold = () => {
    return Math.max(
      1,
      Math.floor(imageFilterThreshold * PIXEL_DIFF_THRESHOLD_SCALE)
    );
  };

  const detectZoneMotion = () => {
    if (!WebcamCapture || !processBuffer) {
      return;
    }

    processBuffer.image(WebcamCapture as any, 0, 0, processWidth, processHeight);
    processBuffer.loadPixels();
    const pix = processBuffer.pixels;
    if (!pix || pix.length === 0) {
      return;
    }

    const currGray = new Uint8Array(processWidth * processHeight);
    for (let y = 0; y < processHeight; y++) {
      for (let x = 0; x < processWidth; x++) {
        const idx = y * processWidth + x;
        const pi = idx * 4;
        const r = pix[pi];
        const g = pix[pi + 1];
        const b = pix[pi + 2];
        currGray[idx] = (0.299 * r + 0.587 * g + 0.114 * b) | 0;
      }
    }

    if (!prevGray) {
      prevGray = currGray;
      return;
    }
    const prevFrame = prevGray;

    syncZoneMotionBuffers();
    const pixelDiffThreshold = getPixelDiffThreshold();

    zones.forEach((zone, index) => {
      const x0 = Math.max(
        0,
        Math.min(processWidth, Math.floor((zone.x / p.width) * processWidth))
      );
      const y0 = Math.max(
        0,
        Math.min(processHeight, Math.floor((zone.y / p.height) * processHeight))
      );
      const x1 = Math.max(
        0,
        Math.min(
          processWidth,
          Math.ceil(((zone.x + zone.w) / p.width) * processWidth)
        )
      );
      const y1 = Math.max(
        0,
        Math.min(
          processHeight,
          Math.ceil(((zone.y + zone.h) / p.height) * processHeight)
        )
      );

      const zoneWidth = x1 - x0;
      const zoneHeight = y1 - y0;
      if (zoneWidth <= 0 || zoneHeight <= 0) {
        zoneMotionRatios[index] = 0;
        zoneActiveCounts[index] = 0;
        zoneMovementFlags[index] = false;
        return;
      }

      let changedPixels = 0;
      const zoneArea = zoneWidth * zoneHeight;
      for (let py = y0; py < y1; py++) {
        for (let px = x0; px < x1; px++) {
          const pixelIndex = py * processWidth + px;
          const diff = Math.abs(currGray[pixelIndex] - prevFrame[pixelIndex]);
          if (diff > pixelDiffThreshold) {
            changedPixels += 1;
          }
        }
      }

      const ratio = changedPixels / zoneArea;
      zoneMotionRatios[index] = ratio;
      const isMotionNow = ratio >= myVidaThreshold;
      zoneActiveCounts[index] = isMotionNow
        ? Math.min(255, zoneActiveCounts[index] + 1)
        : 0;
      const isActive = zoneActiveCounts[index] >= MIN_ACTIVE_FRAMES;

      if (isActive && !zoneMovementFlags[index]) {
        console.log(`Movement detected in zone ${zone.id}`);
        if (zone.soundId) {
          playSound(zone.soundId);
        }
        console.log(`Zone ${zone.id} has soundId: ${zone.soundId}`);
      }

      zoneMovementFlags[index] = isActive;
    });

    prevGray = currGray;
  };

  const drawZoneMotionOverlay = () => {
    syncZoneMotionBuffers();
    zones.forEach((zone, index) => {
      const isActive = zoneMovementFlags[index];
      if (isActive) {
        p.fill(255, 60, 60, 90);
        p.stroke(255, 80, 80);
      } else {
        p.fill(0, 255, 0, 30);
        p.stroke(120, 255, 120);
      }
      p.strokeWeight(2);
      p.rect(zone.x, zone.y, zone.w, zone.h);
    });
  };

  const stopCurrentStream = () => {
    if (WebcamCapture) {
      const videoEl = WebcamCapture.elt as HTMLVideoElement;
      const stream =
        (videoEl.srcObject as MediaStream | null) || currentStream;
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      WebcamCapture.remove();
      WebcamCapture = null;
    }
    currentStream = null;
  };

  const populateWebcamSelectOptions = () => {
    if (!webcamSelect) {
      return;
    }

    const selectEl = webcamSelect.elt as HTMLSelectElement;
    selectEl.innerHTML = '';

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'System Default';
    selectEl.appendChild(defaultOption);

    videoDevices.forEach((device, index) => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.textContent = device.label || `Camera ${index + 1}`;
      selectEl.appendChild(option);
    });

    const targetValue =
      selectedVideoDeviceId &&
      videoDevices.some((device) => device.deviceId === selectedVideoDeviceId)
        ? selectedVideoDeviceId
        : '';

    selectEl.value = targetValue;

    if (!targetValue && selectedVideoDeviceId && videoDevices.length > 0) {
      selectedVideoDeviceId = null;
      localStorage.removeItem('selected-video-device-id');
    }
  };

  const refreshVideoDevices = async () => {
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.enumerateDevices
    ) {
      return;
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      videoDevices = devices.filter((device) => device.kind === 'videoinput');
      populateWebcamSelectOptions();
    } catch (error) {
      console.error('Failed to refresh video devices:', error);
    }
  };

  const createUIControls = () => {
    // Create container div for controls
    const controlsDiv = p.createDiv();
    controlsDiv.class('controls-div');

    // Add number type input for Active Zones
    p.createSpan('Active Zones: ').parent(controlsDiv);
    activeZonesInput = p
      .createInput(zones.length.toString())
      .attribute('type', 'number');
    activeZonesInput.parent(controlsDiv);
    activeZonesInput.input(() => {
      const newCount = Number(activeZonesInput.value());
      if (newCount > 0) {
        const existingZones = [...zones];
        zones = Array.from({ length: newCount }, (_, i) => {
          if (i < existingZones.length) {
            return existingZones[i];
          }
          return {
            id: i,
            x: p.random(0, p.width - 100),
            y: p.random(0, p.height - 100),
            w: 100,
            h: 100,
            type: ZONE_TYPE.DEFAULT,
          };
        });
        if (mode === MODE.PERFORMANCE) {
          resetZoneMotionState();
        }
        // Save zones after changing count
        saveZonesToLocalStorage();
        debouncedRerenderUIControls();
      }
    });
    p.createElement('br').parent(controlsDiv);

    // // Create dropdowns for each section
    // zones.forEach((_zone, index) => {
    //   p.createSpan(`Zone ${index + 1}: `).parent(controlsDiv);
    //   const select = p.createSelect();
    //   select.option('None', '');
    //   WebMidi.outputs.forEach((output) => {
    //     select.option(output.name, output.name);
    //   });
    //   select.changed(() => updateMidiOutputs());
    //   select.parent(controlsDiv);
    //   outputSelects.push(select);
    //   p.createElement('br').parent(controlsDiv);
    // });

    // Add reset button
    const resetButton = p.createButton('Reset Zones');
    resetButton.parent(controlsDiv);
    resetButton.style('margin', '10px 0');
    resetButton.style('padding', '5px 10px');
    resetButton.style('background-color', '#ff4444');
    resetButton.style('color', 'white');
    resetButton.style('border', 'none');
    resetButton.style('border-radius', '3px');
    resetButton.style('cursor', 'pointer');
    resetButton.mousePressed(() => {
      if (confirm('Are you sure you want to reset all zones to default?')) {
        localStorage.removeItem('object-synth-zones');
        zones = Array.from(
          { length: Number(activeZonesInput.value()) },
          (_, i) => ({
            id: i,
            x: 0,
            y: 0,
            w: 100,
            h: 100,
            type: ZONE_TYPE.DEFAULT,
          })
        );
        if (mode === MODE.PERFORMANCE) {
          resetZoneMotionState();
        }
      }
    });
    p.createElement('br').parent(controlsDiv);

    const webcamLabel = p.createSpan('Webcam: ');
    webcamLabel.parent(controlsDiv);
    webcamSelect = p.createSelect();
    webcamSelect.parent(controlsDiv);
    populateWebcamSelectOptions();
    webcamSelect.changed(async () => {
      const deviceId = (webcamSelect as any).value() as string;
      selectedVideoDeviceId = deviceId || null;
      if (selectedVideoDeviceId) {
        localStorage.setItem('selected-video-device-id', selectedVideoDeviceId);
      } else {
        localStorage.removeItem('selected-video-device-id');
      }
      await initCaptureDevice(selectedVideoDeviceId || undefined);
    });
    p.createElement('br').parent(controlsDiv);

    const modesRadio = p.createRadio() as any;
    modesRadio.option('edit', 'Edit mode');
    modesRadio.option('performance', 'Performance mode');
    modesRadio.selected('edit');
    modesRadio.parent(controlsDiv);
    modesRadio.changed(() => {
      mode = modesRadio.value() as MODE;
      if (mode === MODE.PERFORMANCE) {
        resetZoneMotionState();
      }
    });
    p.createElement('br').parent(controlsDiv);

    // Processing resolution for performance mode (lower = faster)
    p.createSpan('Process resolution: ').parent(controlsDiv);
    const processResSelect = p.createSelect() as any;
    PROCESS_RESOLUTIONS.forEach((res) => {
      processResSelect.option(res.label, `${res.w}x${res.h}`);
    });
    const currentResKey = `${processWidth}x${processHeight}`;
    const matchingOpt = PROCESS_RESOLUTIONS.find((r) => `${r.w}x${r.h}` === currentResKey);
    processResSelect.selected(matchingOpt ? matchingOpt.label : '320×240 (2× faster)');
    processResSelect.parent(controlsDiv);
    processResSelect.changed(() => {
      const val = (processResSelect as any).value() as string;
      const [w, h] = val.split('x').map(Number);
      processWidth = w;
      processHeight = h;
      localStorage.setItem('process-width', String(w));
      localStorage.setItem('process-height', String(h));
      // Recreate buffer (p5.Graphics has no reliable resize)
      processBuffer = p.createGraphics(w, h);
      processBuffer.pixelDensity(1);
      if (mode === MODE.PERFORMANCE) {
        resetZoneMotionState();
      }
    });
    p.createElement('br').parent(controlsDiv);

    // FPS display toggle for performance tuning
    const fpsCheckbox = p.createCheckbox('Show FPS', showFpsDisplay);
    fpsCheckbox.parent(controlsDiv);
    fpsCheckbox.changed(() => {
      showFpsDisplay = (fpsCheckbox as any).checked();
      localStorage.setItem('show-fps', String(showFpsDisplay));
    });

    // Add sound library section
    p.createSpan('Sound Library').parent(controlsDiv);
    p.createElement('br').parent(controlsDiv);
    p.createSpan('Total sounds: ' + soundLibrary.length).parent(controlsDiv);
    p.createElement('br').parent(controlsDiv);

    // Add directory selection button
    const dirButton = p.createButton('Select Sounds Directory');
    dirButton.parent(controlsDiv);
    dirButton.style('margin', '10px 0');
    dirButton.style('padding', '5px 10px');
    dirButton.style('background-color', '#4CAF50');
    dirButton.style('color', 'white');
    dirButton.style('border', 'none');
    dirButton.style('border-radius', '3px');
    dirButton.style('cursor', 'pointer');
    dirButton.mousePressed(async () => {
      try {
        if ('showDirectoryPicker' in window) {
          const dirHandle = await window.showDirectoryPicker();
          loadSoundsFromDirectory(dirHandle);
        } else {
          // Fallback for browsers that don't support directory picker
          const input = document.createElement('input');
          input.type = 'file';
          input.multiple = true;
          input.webkitdirectory = true;
          input.addEventListener('change', (e) => {
            const files = (e.target as HTMLInputElement).files;
            if (files) {
              Array.from(files)
                .filter((file) => file.type.startsWith('audio/'))
                .forEach(handleFileUpload);
            }
          });
          input.click();
        }
      } catch (err) {
        console.error('Error accessing directory:', err);
        alert(
          'Could not access directory. Please try again or use individual file upload.'
        );
      }
    });

    const resetSoundButton = p.createButton('Reset Sound Library');
    resetSoundButton.parent(controlsDiv);
    resetSoundButton.style('margin', '10px 0');
    resetSoundButton.style('padding', '5px 10px');
    resetSoundButton.style('background-color', 'red');
    resetSoundButton.style('color', 'white');
    resetSoundButton.style('border', 'none');
    resetSoundButton.style('border-radius', '3px');
    resetSoundButton.style('cursor', 'pointer');
    resetSoundButton.mousePressed(async () => {
      try {
        soundLibrary = [];
        soundPlayers.clear();
        await deleteAllSoundsFromDB();
        updateSoundLibraryUI();
        rerenderUIControls();
      } catch (err) {
        console.error('Error resetting sound library:', err);
      }
    });

    // Create sound library container
    const soundLibraryDiv = p.createDiv();
    soundLibraryDiv.id('sound-library');
    soundLibraryDiv.parent(controlsDiv);
    soundLibraryDiv.style('max-height', '200px');
    soundLibraryDiv.style('overflow-y', 'auto');
    soundLibraryDiv.style('margin', '10px 0');
    soundLibraryDiv.style('padding', '5px');
    soundLibraryDiv.style('background', 'rgba(255,255,255,0.1)');

    // Add background sound selector
    const bgSoundLabel = p.createSpan('Background Sound: ');
    bgSoundLabel.parent(controlsDiv);
    const bgSoundSelect = p.createSelect() as any;
    bgSoundSelect.id('background-sound-select');
    bgSoundSelect.option('None', '');
    soundLibrary.forEach((sound) => {
      bgSoundSelect.option(sound.name, sound.id);
    });
    if (backgroundSoundId) {
      bgSoundSelect.selected(backgroundSoundId);
    }
    bgSoundSelect.changed(() => {
      const soundId = bgSoundSelect.value() as string;
      if (backgroundSound) {
        backgroundSound.pause();
        backgroundSound = null;
        backgroundSoundId = null;
      }
      if (soundId) {
        backgroundSoundId = soundId;
        const audio = soundPlayers.get(soundId);
        if (audio && mode === MODE.PERFORMANCE) {
          backgroundSound = audio;
          backgroundSound.loop = true;
          // Apply saved volume if available
          if (localStorage.getItem('background-sound-volume')) {
            backgroundSound.volume = parseFloat(localStorage.getItem('background-sound-volume') || '0.5');
            bgVolumeSlider.value(backgroundSound.volume);
          }
          backgroundSound.play();
        }
      }
    });
    
    // Add volume control for background sound
    const bgVolumeLabel = p.createSpan('Background Volume: ');
    const bgVolumeSlider = p.createSlider(0, 1, 0.5, 0.01);
    
    // Initialize with saved value if available
    if (localStorage.getItem('background-sound-volume')) {
      bgVolumeSlider.value(parseFloat(localStorage.getItem('background-sound-volume') || '0.5'));
    }
    
    bgVolumeSlider.input(() => {
      const volume = bgVolumeSlider.value() as number;
      localStorage.setItem('background-sound-volume', volume.toString());
      if (backgroundSound) {
        backgroundSound.volume = volume;
      }
    });
    
    bgSoundSelect.parent(controlsDiv);
    bgVolumeLabel.parent(controlsDiv);
    bgVolumeSlider.parent(controlsDiv);
    p.createElement('br').parent(controlsDiv);
    p.createElement('br').parent(controlsDiv);
    
    // Add sound type to zone controls
    zoneSoundSelects = [];
    zones.forEach((zone, index) => {
      const soundSelect = p.createSelect() as any;
      const label = p.createSpan(`Zone ${index}:`);
      const panSlider = p.createSlider(-1, 1, zone.pan || 0, 0.1);
      const panLabel = p.createSpan('Pan: ');
      const volumeSlider = p.createSlider(0, 1, zone.volume || 0.5, 0.01);
      const volumeLabel = p.createSpan('Volume: ');

      soundSelect.option('No Sound', '');
      soundLibrary.forEach((sound) => {
        soundSelect.option(sound.name, sound.id);
      });
      if (zone.soundId) {
        soundSelect.selected(zone.soundId);
      }
      soundSelect.changed(() => {
        zones[index].soundId = soundSelect.value() as string;
        saveZonesToLocalStorage();
      });
      
      panSlider.input(() => {
        zones[index].pan = panSlider.value() as number;
        // Update panning for currently playing sound if applicable
        if (zones[index].soundId) {
          const audio = soundPlayers.get(zones[index].soundId);
          if (audio) {
            updateAudioPanning(audio, zones[index].pan);
          }
        }
        saveZonesToLocalStorage();
      });
      
      volumeSlider.input(() => {
        zones[index].volume = volumeSlider.value() as number;
        // Update volume for currently playing sound if applicable
        if (zones[index].soundId) {
          const audio = soundPlayers.get(zones[index].soundId);
          if (audio) {
            audio.volume = zones[index].volume;
          }
        }
        saveZonesToLocalStorage();
      });
      
      label.parent(controlsDiv);
      soundSelect.parent(controlsDiv);
      panLabel.parent(controlsDiv);
      panSlider.parent(controlsDiv);
      volumeLabel.parent(controlsDiv);
      volumeSlider.parent(controlsDiv);
      p.createElement('br').parent(controlsDiv);
      zoneSoundSelects.push(soundSelect);
    });

    // Add sliders for VIDA thresholds
    p.createSpan('Image Filter Threshold: ').parent(controlsDiv);
    const imageFilterSlider = p.createSlider(0, 1, imageFilterThreshold, 0.01);
    imageFilterSlider.parent(controlsDiv);
    imageFilterSlider.input(() => {
      imageFilterThreshold = imageFilterSlider.value() as number;
      localStorage.setItem('image-filter-threshold', imageFilterThreshold.toString());
    });
    p.createElement('br').parent(controlsDiv);

    p.createSpan('Movement Threshold: ').parent(controlsDiv);
    const movementThresholdSlider = p.createSlider(0, 1, myVidaThreshold, 0.01);
    movementThresholdSlider.parent(controlsDiv);
    movementThresholdSlider.input(() => {
      myVidaThreshold = movementThresholdSlider.value() as number;
      localStorage.setItem('movement-threshold', myVidaThreshold.toString());
    });
    p.createElement('br').parent(controlsDiv);
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
          const capture = p.createCapture(constraints as any);

          capture.size(640, 480);
          capture.hide();
          if (typeof (capture as any).volume === 'function') {
            (capture as any).volume(0);
          }

          WebcamCapture = capture;
          resetZoneMotionState();

          const videoEl = capture.elt as HTMLVideoElement;
          const onReady = () => {
            const stream = videoEl.srcObject as MediaStream | null;
            if (stream) {
              currentStream = stream;
            }
            console.log(
              `[initCaptureDevice] capture ready. Resolution: ${capture.width}x${capture.height}`
            );
            resolve();
          };

          if (videoEl.readyState >= 1) {
            onReady();
          } else {
            videoEl.addEventListener('loadedmetadata', onReady, { once: true });
            videoEl.addEventListener(
              'error',
              () => reject(new Error('Video metadata load failed')),
              { once: true }
            );
          }
        } catch (error) {
          reject(error);
        }
      });

      await refreshVideoDevices();
    } catch (err) {
      console.log(`[initCaptureDevice] capture error: ${err}`);
      if (deviceId) {
        selectedVideoDeviceId = null;
        localStorage.removeItem('selected-video-device-id');
        await initCaptureDevice();
      }
    }
  };

  // const updateMidiOutputs = () => {
  //   midiOutputs = outputSelects
  //     .map((select) =>
  //       WebMidi.outputs.find((output) => output.name === select.value())
  //     )
  //     .filter((output): output is Output => output !== undefined);
  //   console.log(
  //     'Updated MIDI outputs:',
  //     midiOutputs.map((out) => out.name)
  //   );
  // };

  p.setup = async () => {
    p.createCanvas(640, 480);
    zones = loadZonesFromLocalStorage();
    createUIControls();
    await initCaptureDevice(selectedVideoDeviceId || undefined);

    try {
      await initDB();
      await loadSoundsFromDB();
    } catch (err) {
      console.error('Failed to load sounds from IndexedDB:', err);
    }

    await refreshVideoDevices();
    // Rerender controls to populate zone selects with loaded sounds
    rerenderUIControls();
    // Update sound library UI after controls are recreated
    updateSoundLibraryUI();

    // Create processing buffer for lower-res motion detection
    processBuffer = p.createGraphics(processWidth, processHeight);
    processBuffer.pixelDensity(1);
    resetZoneMotionState();

    p.frameRate(30);

    if (
      typeof navigator !== 'undefined' &&
      navigator.mediaDevices
    ) {
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
    // Save zones after dragging
    saveZonesToLocalStorage();
  };

  p.draw = () => {
    p.background(220); // Important to be here

    // Display video
    if (mode === MODE.PERFORMANCE) {
      if (WebcamCapture) {
        p.image(WebcamCapture, 0, 0, p.width, p.height);
        detectZoneMotion();
      }
      drawZoneMotionOverlay();
    } else {
      // EDIT MODE
      if (WebcamCapture) {
        p.image(WebcamCapture, 0, 0, p.width, p.height);
      }

      if (isDragging && draggedZoneIndex !== null) {
        zones[draggedZoneIndex].x = p.mouseX - zones[draggedZoneIndex].w / 2;
        zones[draggedZoneIndex].y = p.mouseY - zones[draggedZoneIndex].h / 2;
      }

      zones.forEach((zone, index) => {
        // Change stroke color based on whether this was the last dragged zone
        if (index === lastDraggedZoneIndex) {
          p.stroke('#ADF802');
        } else {
          p.stroke('salmon');
        }
        p.strokeWeight(2);
        p.noFill();
        p.rect(zone.x, zone.y, zone.w, zone.h);

        // Add text for ID
        p.fill(index === lastDraggedZoneIndex ? 'green' : 'red');
        p.noStroke();
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(20);
        p.text(index.toString(), zone.x + zone.w / 2, zone.y + zone.h / 2);
        p.noFill(); // Reset fill for next rectangle
      });
    }

    // Optional FPS display (top-right corner)
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

  // Update keyPressed to save zones after resizing
  p.keyPressed = () => {
    if (lastDraggedZoneIndex !== null) {
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
      // Ensure minimum size
      zones[lastDraggedZoneIndex].w = Math.max(
        20,
        zones[lastDraggedZoneIndex].w
      );
      zones[lastDraggedZoneIndex].h = Math.max(
        20,
        zones[lastDraggedZoneIndex].h
      );
      // Save zones after resizing
      saveZonesToLocalStorage();
      if (mode === MODE.PERFORMANCE) {
        resetZoneMotionState();
      }
    }
  };

  // Add function to load sounds from directory
  async function loadSoundsFromDirectory(dirHandle: FileSystemDirectoryHandle) {
    try {
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file') {
          const fileHandle = entry as FileSystemFileHandle;
          const file = await fileHandle.getFile();
          if (file.type.startsWith('audio/')) {
            handleFileUpload(file);
          }
        }
      }
    } catch (err) {
      console.error('Error reading directory:', err);
      alert('Error reading directory. Some files may not have been loaded.');
    }
  }

  // Add function to update sound library UI
  const updateSoundLibraryUI = () => {
    const container = document.getElementById('sound-library');
    if (container) {
      container.innerHTML = '';
      soundLibrary.forEach((sound) => {
        const div = document.createElement('div');
        div.className = 'sound-item';

        const nameSpan = document.createElement('span');
        nameSpan.textContent = sound.name;

        const playButton = document.createElement('button');
        playButton.textContent = 'Play';
        playButton.addEventListener('click', () => playSound(sound.id));

        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.addEventListener('click', () => deleteSound(sound.id));

        div.appendChild(nameSpan);
        div.appendChild(playButton);
        div.appendChild(deleteButton);
        container.appendChild(div);
      });
    }

    // Update background sound selector
    const bgSoundSelect = document.getElementById('background-sound-select') as HTMLSelectElement | null;
    if (bgSoundSelect) {
      while (bgSoundSelect.options.length > 1) {
        bgSoundSelect.remove(1);
      }
      
      soundLibrary.forEach(sound => {
        const option = document.createElement('option');
        option.value = sound.id;
        option.textContent = sound.name;
        bgSoundSelect.appendChild(option);
      });
      
      if (backgroundSoundId) {
        bgSoundSelect.value = backgroundSoundId;
      }
    }

    // Update zone sound selects
    zoneSoundSelects.forEach((selectEl, index) => {
      const selectDom = selectEl.elt as HTMLSelectElement;
      const currentValue = zones[index]?.soundId || '';

      while (selectDom.options.length > 1) {
        selectDom.remove(1);
      }

      soundLibrary.forEach(sound => {
        const option = document.createElement('option');
        option.value = sound.id;
        option.textContent = sound.name;
        selectDom.appendChild(option);
      });

      selectDom.value = currentValue;
    });
  };

  // Add sound playback and deletion functions
  const playSound = (soundId: string) => {
    const audio = soundPlayers.get(soundId);
    if (audio && audio.paused) {
      // Find the zone this sound belongs to for panning
      const zone = zones.find(z => z.soundId === soundId);
      if (zone) {
        if (zone.pan !== undefined) {
          updateAudioPanning(audio, zone.pan);
        }
        if (zone.volume !== undefined) {
          audio.volume = zone.volume;
        }
      }
      audio.play();
      // Add event listener to reset when finished
      audio.onended = () => {
        console.log(`Sound ${soundId} finished playing`);
      };
    }
  };

  // Helper function to update audio panning
  const updateAudioPanning = (audio: HTMLAudioElement, pan: number) => {
    try {
      // Create audio context if needed
      if (!window.audioContext) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          window.audioContext = new AudioContextClass();
        } else {
          console.error('AudioContext not supported in this browser');
          return;
        }
      }
      
      // Create or get audio source and panner
      if (!audio.pannerNode) {
        // Create media element source if needed
        if (!audio.sourceNode) {
          audio.sourceNode = window.audioContext.createMediaElementSource(audio);
        }
        
        // Create panner node
        audio.pannerNode = window.audioContext.createStereoPanner();
        
        // Connect nodes: source -> panner -> destination
        audio.sourceNode.connect(audio.pannerNode);
        audio.pannerNode.connect(window.audioContext.destination);
      }
      
      // Set pan value (-1 = left, 0 = center, 1 = right)
      audio.pannerNode.pan.value = pan;
    } catch (err) {
      console.error('Error setting audio panning:', err);
    }
  };

  // Add functions to handle localStorage
  const saveZonesToLocalStorage = () => {
    localStorage.setItem('object-synth-zones', JSON.stringify(zones));
  };

  const loadZonesFromLocalStorage = (): Zone[] => {
    const savedZones = localStorage.getItem('object-synth-zones');
    if (savedZones) {
      return JSON.parse(savedZones);
    }
    return Array.from(
      { length: Number(activeZonesInput?.value() || 1) },
      (_, i) => ({
        id: i,
        x: 0,
        y: 0,
        w: 100,
        h: 100,
        type: ZONE_TYPE.DEFAULT,
      })
    );
  };

};

// Create P5 instance
new p5(sketch);
