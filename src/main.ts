import p5 from 'p5';
import { WebMidi, Output } from 'webmidi';
// import Particle from './Particle';
import Vida from './vida';
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
}

const RESIZE_SPEED = 10;

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
  const MIDI_CHANNEL = 1;
  let midiOutputs: Output[] = [];
  // EDIT MODE
  let isDragging = false;
  let draggedZoneIndex: number | null = null;
  let lastDraggedZoneIndex: number | null = null;

  // Add UI elements
  let outputSelects: p5.Element[] = [];
  // let thresholdSlider: p5.Element;
  // let baseNoteSlider: p5.Element;
  // let particles: Particle[] = [];
  let mode: MODE = MODE.EDIT;
  let WebcamCapture: p5.Element;
  let myVida: Vida;
  let activeZonesInput: p5.Element;
  let zones: Zone[] = [];
  // Enable WebMidi at the start
  WebMidi.enable()
    .then(() => {
      console.log('WebMidi enabled!');
      // Update midiOutputs based on initial selection
      updateMidiOutputs();
    })
    .catch((err) => console.error('WebMidi could not be enabled:', err));

  // Add sound library state and types
  let soundLibrary: SoundFile[] = [];
  let soundPlayers: Map<string, HTMLAudioElement> = new Map();
  let backgroundSound: HTMLAudioElement | null = null;
  let backgroundSoundId: string | null = null;

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
      } catch (err) {
        console.error('Error loading audio file:', err);
      }
    } else {
      console.log('Attempted file type:', file.type);
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
          updateVidaActiveZones();
        }
        // Save zones after changing count
        saveZonesToLocalStorage();
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
          updateVidaActiveZones();
        }
      }
    });
    p.createElement('br').parent(controlsDiv);

    const modesRadio = p.createRadio();
    modesRadio.option('edit', 'Edit mode');
    modesRadio.option('performance', 'Performance mode');
    modesRadio.selected('edit');
    modesRadio.parent(controlsDiv);
    modesRadio.changed(() => {
      mode = modesRadio.value() as MODE;
      if (mode === MODE.PERFORMANCE) {
        updateVidaActiveZones();
      }
    });

    // Add sound library section
    p.createSpan('Sound Library').parent(controlsDiv);
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
    const bgSoundSelect = p.createSelect();
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
          backgroundSound.play();
        }
      }
    });
    const bgSoundDescription = p.createSpan('Will play in a loop');
    bgSoundSelect.parent(controlsDiv);
    bgSoundDescription.parent(controlsDiv);
    p.createElement('br').parent(controlsDiv);


    // Add sound type to zone controls
    zones.forEach((zone, index) => {
      const soundSelect = p.createSelect();
      const label = p.createSpan(`Zone ${index}:`);
      const panSlider = p.createSlider(-1, 1, zone.pan || 0, 0.1);
      const panLabel = p.createSpan('Pan: ');

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
      
      label.parent(controlsDiv);
      soundSelect.parent(controlsDiv);
      panLabel.parent(controlsDiv);
      panSlider.parent(controlsDiv);
      p.createElement('br').parent(controlsDiv);
    });
  };

  function initCaptureDevice() {
    try {
      WebcamCapture = p.createCapture('video');
      WebcamCapture.size(640, 480);
      WebcamCapture.hide();
      WebcamCapture.volume(0);

      console.log(
        `[initCaptureDevice] capture ready. Resolution: ${WebcamCapture.width}x${WebcamCapture.height}`
      );
    } catch (_err) {
      console.log(`[initCaptureDevice] capture error: ${_err}`);
    }
  }

  const updateMidiOutputs = () => {
    midiOutputs = outputSelects
      .map((select) =>
        WebMidi.outputs.find((output) => output.name === select.value())
      )
      .filter((output): output is Output => output !== undefined);
    console.log(
      'Updated MIDI outputs:',
      midiOutputs.map((out) => out.name)
    );
  };

  p.setup = async () => {
    p.createCanvas(640, 480);
    zones = loadZonesFromLocalStorage();
    initCaptureDevice();

    try {
      await initDB();
      await loadSoundsFromDB();
    } catch (err) {
      console.error('Failed to load sounds from IndexedDB:', err);
    }

    createUIControls();
    updateSoundLibraryUI();

    myVida = new Vida(p);
    myVida.progressiveBackgroundFlag = true;
    myVida.imageFilterThreshold = 0.2;
    myVida.handleActiveZonesFlag = true;
    myVida.setActiveZonesNormFillThreshold(0.02);
    myVida.handleActiveZonesFlag = true;
    myVida.setActiveZonesNormFillThreshold(0.5);

    p.frameRate(30);
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
    if (mode === MODE.PERFORMANCE) {
      updateVidaActiveZones();
    }
    // Save zones after dragging
    saveZonesToLocalStorage();
  };

  p.draw = () => {
    p.background(220); // Important to be here

    // Display video
    if (mode === MODE.PERFORMANCE) {
      myVida.update(WebcamCapture);
      p.image(myVida.thresholdImage, 0, 0);
      myVida.drawActiveZones(0, 0, p.width, p.height);
    } else {
      // EDIT MODE
      p.image(WebcamCapture, 0, 0, p.width, p.height);

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
  };

  function updateVidaActiveZones() {
    // Clear existing active zones
    myVida.activeZones = [];

    // Add new active zones based on current rectangles
    zones.forEach((zone, index) => {
      // Convert screen coordinates to normalized coordinates (0-1)
      const normX = zone.x / p.width;
      const normY = zone.y / p.height;
      const normW = zone.w / p.width;
      const normH = zone.h / p.height;

      myVida.addActiveZone(
        index, // zone id
        normX, // normalized x
        normY, // normalized y
        normW, // normalized width
        normH, // normalized height
        (zone) => {
          // Callback when zone activity changes
          if (zone.isMovementDetectedFlag) {
            console.log(`Movement detected in zone ${zone.id}`);
            if (zones[zone.id].soundId) {
              playSound(zones[zone.id].soundId!);
            }
            // Here you can add MIDI triggering logic
            console.log(
              `Zone ${zone.id} has soundId: ${zones[zone.id].soundId}`
            );
            if (midiOutputs[zone.id]) {
              midiOutputs[zone.id].send(
                [0x90 + MIDI_CHANNEL, Math.floor(Math.random() * 127), 127],
                { time: 10 }
              );
            }
          }
        }
      );
    });
  }

  // Update keyPressed to save zones after resizing
  p.keyPressed = () => {
    if (lastDraggedZoneIndex !== null) {
      switch (p.keyCode) {
        case p.UP_ARROW:
          zones[lastDraggedZoneIndex].h -= RESIZE_SPEED;
          break;
        case p.DOWN_ARROW:
          zones[lastDraggedZoneIndex].h += RESIZE_SPEED;
          break;
        case p.LEFT_ARROW:
          zones[lastDraggedZoneIndex].w -= RESIZE_SPEED;
          break;
        case p.RIGHT_ARROW:
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
    const bgSoundSelect = document.querySelector('select') as HTMLSelectElement;
    if (bgSoundSelect) {
      // Clear existing options except "None"
      while (bgSoundSelect.options.length > 1) {
        bgSoundSelect.remove(1);
      }
      
      // Add current sound library options
      soundLibrary.forEach(sound => {
        const option = document.createElement('option');
        option.value = sound.id;
        option.textContent = sound.name;
        bgSoundSelect.appendChild(option);
      });
      
      // Restore selection if possible
      if (backgroundSoundId) {
        bgSoundSelect.value = backgroundSoundId;
      }
    }
  };

  // Add sound playback and deletion functions
  const playSound = (soundId: string) => {
    const audio = soundPlayers.get(soundId);
    if (audio && audio.paused) {
      // Find the zone this sound belongs to for panning
      const zone = zones.find(z => z.soundId === soundId);
      if (zone && zone.pan !== undefined) {
        updateAudioPanning(audio, zone.pan);
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
