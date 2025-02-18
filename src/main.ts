import p5 from 'p5';
import { WebMidi, Output } from 'webmidi';

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
  
  // Add UI elements
  let outputSelects: p5.Element[] = [];
  let thresholdSlider: p5.Element;
  let baseNoteSlider: p5.Element;

  // Enable WebMidi at the start
  WebMidi.enable()
    .then(() => {
      console.log('WebMidi enabled!');
      
      // Create UI controls after MIDI is enabled
      createUIControls();
      
      // Update midiOutputs based on initial selection
      updateMidiOutputs();
    })
    .catch(err => console.error('WebMidi could not be enabled:', err));

  const createUIControls = () => {
    // Create container div for controls
    const controlsDiv = p.createDiv();
    controlsDiv.style('position', 'absolute');
    controlsDiv.style('top', '10px');
    controlsDiv.style('left', '10px');
    controlsDiv.style('background', 'rgba(0,0,0,0.7)');
    controlsDiv.style('padding', '10px');
    controlsDiv.style('border-radius', '5px');

    // Create dropdowns for each section
    for (let i = 0; i < 4; i++) {
      p.createSpan(`Section ${i + 1}: `).parent(controlsDiv);
      const select = p.createSelect();
      select.option('None', '');
      WebMidi.outputs.forEach(output => {
        select.option(output.name, output.name);
      });
      select.changed(() => updateMidiOutputs());
      select.parent(controlsDiv);
      outputSelects.push(select);
      p.createElement('br').parent(controlsDiv);
    }

    // Add threshold slider
    p.createSpan('Brightness Threshold: ').parent(controlsDiv);
    thresholdSlider = p.createSlider(0, 255, 128);
    thresholdSlider.parent(controlsDiv);
    p.createElement('br').parent(controlsDiv);

    // Add base note slider
    p.createSpan('Base MIDI Note: ').parent(controlsDiv);
    baseNoteSlider = p.createSlider(0, 127, 60);
    baseNoteSlider.parent(controlsDiv);
  };

  const updateMidiOutputs = () => {
    midiOutputs = outputSelects
      .map(select => WebMidi.outputs.find(output => output.name === select.value()))
      .filter((output): output is Output => output !== undefined);
    console.log('Updated MIDI outputs:', midiOutputs.map(out => out.name));
  };

  p.setup = () => {
    p.createCanvas(640, 480);

    // Initialize webcam
    video = p.createCapture(p5.VIDEO);
    video.size(640, 480);
    video.hide();

    // Create 4 sections
    for (let i = 0; i < 4; i++) {
      sections.push({
        x: ((i % 2) * p.width) / 2,
        y: (Math.floor(i / 2) * p.height) / 2,
        w: p.width / 2,
        h: p.height / 2,
        midiNote: 60 + i,
      });
    }
  };

  p.draw = () => {
    // Display video
    p.image(video as any, 0, 0, p.width, p.height);

    // Load pixels for analysis
    (video as any).loadPixels();

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
          if (brightness < thresholdSlider.value()) {
            darkPixelCount++;
          }
          totalPixels++;
        }
      }

      // Calculate velocity (0-127 for MIDI)
      let velocity = p.map(darkPixelCount / totalPixels, 0, 1, 0, 127);

      // Update MIDI note based on base note
      section.midiNote = baseNoteSlider.value() + index;

      // Send to specific output if available
      if (midiOutputs[index]) {
        midiOutputs[index].send([
          0x90 + MIDI_CHANNEL, 
          section.midiNote, 
          Math.floor(velocity)
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
