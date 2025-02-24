import p5 from 'p5';
import { WebMidi, Output } from 'webmidi';
import Particle from './Particle';
import Vida from './vida';
enum MODE {
  EDIT = 'edit',
  PERFORMANCE = 'performance',
}

interface Zone {
  x: number;
  y: number;
  w: number;
  h: number;
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

  // Add UI elements
  let outputSelects: p5.Element[] = [];
  let thresholdSlider: p5.Element;
  let baseNoteSlider: p5.Element;
  let particles: Particle[] = [];
  let mode: MODE = MODE.EDIT;
  let WebcamCapture: p5.Element;
  let myVida: Vida;
  let activeZonesInput: p5.Element;
  let zones: Zone[] = [];
  // Enable WebMidi at the start
  WebMidi.enable()
    .then(() => {
      console.log('WebMidi enabled!');

      // Create UI controls after MIDI is enabled
      createUIControls();

      // Update midiOutputs based on initial selection
      updateMidiOutputs();
    })
    .catch((err) => console.error('WebMidi could not be enabled:', err));

  const createUIControls = () => {
    // Create container div for controls
    const controlsDiv = p.createDiv();
    controlsDiv.style('background', 'rgba(0,0,0,0.7)');
    controlsDiv.style('padding', '10px');
    controlsDiv.style('border-radius', '5px');

    // Create dropdowns for each section
    for (let i = 0; i < 4; i++) {
      p.createSpan(`Section ${i + 1}: `).parent(controlsDiv);
      const select = p.createSelect();
      select.option('None', '');
      WebMidi.outputs.forEach((output) => {
        select.option(output.name, output.name);
      });
      select.changed(() => updateMidiOutputs());
      select.parent(controlsDiv);
      outputSelects.push(select);
      p.createElement('br').parent(controlsDiv);
    }

    // Add number type input for Active Zones
    p.createSpan('Active Zones: ').parent(controlsDiv);
    activeZonesInput = p.createInput('1').attribute('type', 'number');
    activeZonesInput.parent(controlsDiv);
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
    });
  };

  function initCaptureDevice() {
    try {
      WebcamCapture = p.createCapture(p.VIDEO);
      WebcamCapture.size(640, 480);
      WebcamCapture.hide();
      WebcamCapture.volume(0);
      console.log('deburger', p.VIDEO);
      

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

    // Initialize webcam
    initCaptureDevice();

    // Initialize VIDA
    myVida = new Vida(p); // Create the instance using p5.vida
    myVida.progressiveBackgroundFlag = true;
    myVida.imageFilterThreshold = 0.2;
    myVida.handleActiveZonesFlag = true;
    myVida.setActiveZonesNormFillThreshold(0.02);
    myVida.mirror = myVida.MIRROR_HORIZONTAL;
    myVida.handleActiveZonesFlag = true;
    myVida.setActiveZonesNormFillThreshold(0.5);
    zones = Array.from({ length: Number(activeZonesInput.value()) }, (_, i) => ({
      id: i,
      x: 0,
      y: 0,
      w: 100,
      h: 100,
    }));
    
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
    if (isMouseInsideRect()) {
      isDragging = true;
    }
  };

  p.mouseReleased = () => {
    isDragging = false;
    console.log('deburger', zones);
    
  };
  
  function isMouseInsideRect() {
    return zones.some((zone) => {
      return p.mouseX > zone.x &&
        p.mouseX < zone.x + zone.w &&
        p.mouseY > zone.y &&
        p.mouseY < zone.y + zone.h;
    });
  }

  p.draw = () => {
    p.background(220); // Important to be here

    // Display video
    if (mode === MODE.PERFORMANCE) {
      myVida.update(WebcamCapture);
      p.image(myVida.thresholdImage, 0, 0)
      myVida.drawActiveZones(0, 0, p.width, p.height);
      console.log('deburger', activeZonesInput.value());
    } else {
      // EDIT MODE
      p.image(WebcamCapture, 0, 0, p.width, p.height);
      
      if (isDragging) {
        zones.forEach((zone) => {
          zone.x = p.mouseX - zone.w / 2;
          zone.y = p.mouseY - zone.h / 2;
        });
      }

      p.stroke("red");
      p.noFill();
      zones.forEach((zone) => {
        p.rect(zone.x, zone.y, zone.w, zone.h);
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
};

// Create P5 instance
new p5(sketch);
