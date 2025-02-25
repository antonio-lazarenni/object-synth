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

interface Zone {
  x: number;
  y: number;
  w: number;
  h: number;
  id: number;
  type: ZONE_TYPE;
}

const RESIZE_SPEED = 10;

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

  // p.mousePressed = () => {
  //   if (midiOutputs.length > 0) {
  //     const instrument = p.width / 2 > p.mouseX ? midiOutputs[0] : midiOutputs[1];
  //     const particle = new Particle(p.mouseX, p.mouseY, 10, p, instrument);
  //     particles.push(particle);
  //   }
  // };

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
      console.log('deburger', activeZonesInput.value());
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
};

// Create P5 instance
new p5(sketch);
