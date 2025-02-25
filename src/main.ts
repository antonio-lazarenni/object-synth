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
  file: File;
  url: string;
}

interface Zone {
  x: number;
  y: number;
  w: number;
  h: number;
  id: number;
  type: ZONE_TYPE;
  soundId?: string;
}

const RESIZE_SPEED = 10;

// Add FileSystem API types
declare global {
  interface Window {
    showDirectoryPicker(): Promise<FileSystemDirectoryHandle>;
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
  let video: p5.Element;
  let sections: Array<{
    x: number;
    y: number;
    w: number;
    h: number;
    midiNote: number;
  }> = [];

  const MIDI_CHANNEL = 1;
  let midiOutputs: Output[] = [];
  // EDIT MODE
  let isDragging = false;
  let draggedZoneIndex: number | null = null;
  let lastDraggedZoneIndex: number | null = null;

  // Add UI elements
  let outputSelects: p5.Element[] = [];
  let thresholdSlider: p5.Element;
  let baseNoteSlider: p5.Element;
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

  // Add functions to handle localStorage
  const saveZonesToLocalStorage = () => {
    localStorage.setItem('object-synth-zones', JSON.stringify(zones));
  };

  const loadZonesFromLocalStorage = (): Zone[] => {
    const savedZones = localStorage.getItem('object-synth-zones');
    if (savedZones) {
      return JSON.parse(savedZones);
    }
    return Array.from({ length: Number(activeZonesInput?.value() || 1) }, (_, i) => ({
      id: i,
      x: 0,
      y: 0,
      w: 100,
      h: 100,
      type: ZONE_TYPE.DEFAULT,
    }));
  };

  const createUIControls = () => {
    // Create container div for controls
    const controlsDiv = p.createDiv();
    controlsDiv.style('background', 'rgba(0,0,0,0.7)');
    controlsDiv.style('padding', '10px');
    controlsDiv.style('border-radius', '5px');

    // Create dropdowns for each section

    zones.forEach((zone, index) => {
      p.createSpan(`Zone ${index + 1}: `).parent(controlsDiv);
      const select = p.createSelect();
      select.option('None', '');
      WebMidi.outputs.forEach((output) => {
        select.option(output.name, output.name);
      });
      select.changed(() => updateMidiOutputs());
      select.parent(controlsDiv);
      outputSelects.push(select);
      p.createElement('br').parent(controlsDiv);
    });

    // Add number type input for Active Zones
    p.createSpan('Active Zones: ').parent(controlsDiv);
    activeZonesInput = p.createInput(zones.length.toString()).attribute('type', 'number');
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

    // Add threshold slider
    p.createSpan('Brightness Threshold: ').parent(controlsDiv);
    thresholdSlider = p.createSlider(0, 255, 128);
    thresholdSlider.parent(controlsDiv);
    p.createElement('br').parent(controlsDiv);

    // Add base note slider
    p.createSpan('Base MIDI Note: ').parent(controlsDiv);
    baseNoteSlider = p.createSlider(0, 127, 60);
    baseNoteSlider.parent(controlsDiv);
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
    
    // Create file input for individual sounds
    const fileInput = p.createFileInput(handleFileUpload);
    fileInput.parent(controlsDiv);
    fileInput.attribute('accept', 'audio/*');
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
                .filter(file => file.type.startsWith('audio/'))
                .forEach(handleFileUpload);
            }
          });
          input.click();
        }
      } catch (err) {
        console.error('Error accessing directory:', err);
        alert('Could not access directory. Please try again or use individual file upload.');
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

    // Add sound type to zone controls
    zones.forEach((zone, index) => {
      const soundSelect = p.createSelect();
      soundSelect.option('No Sound', '');
      soundLibrary.forEach(sound => {
        soundSelect.option(sound.name, sound.id);
      });
      if (zone.soundId) {
        soundSelect.selected(zone.soundId);
      }
      soundSelect.changed(() => {
        zones[index].soundId = soundSelect.value() as string;
        saveZonesToLocalStorage();
      });
      soundSelect.parent(controlsDiv);
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

  p.setup = () => {
    p.createCanvas(640, 480);
    // Load zones from localStorage instead of creating new ones
    zones = loadZonesFromLocalStorage();
    // Initialize webcam
    initCaptureDevice();
    // Create UI controls after MIDI is enabled
    createUIControls();

    // Initialize VIDA
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
    // for (let particle of particles) {
    //   let gravity = p.createVector(0, 0.2);
    //   particle.applyForce(gravity);
    //   particle.update();
    //   particle.show();
    //   particle.edges();
    // }
    // for (let i = particles.length - 1; i >= 0; i--) {
    //   if (particles[i].finished()) {
    //     console.log('Particle finished');
    //     particles.splice(i, 1);
    //   }
    // }
    return;

    // Update section analysis with new threshold
    sections.forEach((section, index) => {
      let darkPixelCount = 0;
      let totalPixels = 0;

      // Scan pixels in this section
      for (let x = section.x; x < section.x + section.w; x++) {
        for (let y = section.y; y < section.y + section.h; y++) {
          let idx = (y * p.width + x) * 4;
          let brightness =
            ((video as any).pixels[idx] +
              (video as any).pixels[idx + 1] +
              (video as any).pixels[idx + 2]) /
            3;
          if (brightness < Number(thresholdSlider.value())) {
            darkPixelCount++;
          }
          totalPixels++;
        }
      }

      // Calculate velocity (0-127 for MIDI)
      let velocity = p.map(darkPixelCount / totalPixels, 0, 1, 0, 127);

      // Update MIDI note based on base note
      section.midiNote = Number(baseNoteSlider.value()) + index;

      // Send to specific output if available
      if (midiOutputs[index]) {
        midiOutputs[index].send([
          0x90 + MIDI_CHANNEL,
          section.midiNote,
          Math.floor(velocity),
        ]);
      }

      // Draw section borders and info

      p.noFill();
      p.stroke(255);
      p.rect(section.x, section.y, section.w, section.h);
      p.fill(255);
      p.noStroke();
      p.text(
        `Section ${index + 1}: ${Math.floor(velocity)}`,
        section.x + 10,
        section.y + 20
      );
    });
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
            // Here you can add MIDI triggering logic
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
      soundLibrary.forEach(sound => {
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
  };

  // Add sound playback and deletion functions
  const playSound = (soundId: string) => {
    const audio = soundPlayers.get(soundId);
    if (audio) {
      audio.currentTime = 0; // Reset to start
      audio.play();
    }
  };

  const deleteSound = (soundId: string) => {
    const soundIndex = soundLibrary.findIndex(s => s.id === soundId);
    if (soundIndex !== -1) {
      const sound = soundLibrary[soundIndex];
      URL.revokeObjectURL(sound.url); // Clean up URL
      soundPlayers.get(soundId)?.pause(); // Stop if playing
      soundPlayers.delete(soundId);
      soundLibrary.splice(soundIndex, 1);
      updateSoundLibraryUI();
    }
  };

  // Add function to handle file uploads
  const handleFileUpload = async (file: File | p5.File) => {
    const acceptedAudioTypes = [
      'audio/mpeg',  // .mp3
      'audio/mp3',   // some browsers use this
      'audio/wav',   // .wav
      'audio/ogg',   // .ogg
      'audio/x-m4a', // .m4a
      'audio/aac',   // .aac
      'audio/mp4',   // some .m4a files
      'audio'
    ];

    if (acceptedAudioTypes.includes(file.type) || file.name.toLowerCase().endsWith('.mp3')) {
      const soundId = `sound-${Date.now()}`;
      console.log('Processing file:', file);
      
      try {
        // Handle both p5.File and regular File objects
        const fileData = 'data' in file ? file.data : file;
        const blob = new Blob([fileData], { type: file.type });
        const url = URL.createObjectURL(blob);
        
        // Create and test audio element before adding to library
        const audio = new Audio(url);
        
        // Only add to library if audio loads successfully
        await new Promise((resolve, reject) => {
          audio.addEventListener('loadeddata', resolve);
          audio.addEventListener('error', reject);
        });
        
        const sound: SoundFile = {
          id: soundId,
          name: file.name,
          file: new File([blob], file.name, { type: file.type }),
          url: url
        };
        
        soundLibrary.push(sound);
        soundPlayers.set(soundId, audio);
        
        // Update UI
        updateSoundLibraryUI();
      } catch (err) {
        console.error('Error loading audio file:', err);
        alert('Error loading audio file. Please try a different file.');
      }
    } else {
      alert('Please upload audio files (supported formats: mp3, wav, ogg, m4a, aac)');
      console.log('Attempted file type:', file.type);
    }
  };
};

// Create P5 instance
new p5(sketch);
