import p5 from 'p5';
import { Output, Note } from 'webmidi';

class Particle {
  pos: p5.Vector;
  vel: p5.Vector;
  acc: p5.Vector;
  mass: number;
  r: number;
  lifetime: number;
  p: p5;
  midiNote: Note;
  isPlaying: boolean;
  output: Output;
  private lastPitchBendTime: number = 0;
  private pitchBendInterval: number = 50; // ms between pitch bend updates
  constructor(x: number, y: number, mass: number, p: p5, output: Output) {
    this.p = p;
    this.pos = p.createVector(x, y);
    this.vel = p5.Vector.random2D();
    this.vel.mult(p.random(1, 5));
    this.acc = p.createVector(0, 0);
    this.r = 5;
    this.mass = mass;
    this.lifetime = 255;
    this.midiNote = new Note(Math.floor(p.map(y, 0, p.height, 60, 72))); // Map Y position to MIDI note (C4 to C5)
    this.isPlaying = false;
    this.output = output;
  }

  finished() {
    return this.lifetime < 0;
  }

  edges() {
    if (this.pos.y >= this.p.height) {
      this.pos.y = this.p.height;
      this.vel.y *= -1;
    }
  }

  applyForce(force: p5.Vector) {
    this.acc.add(force);
  }

  update() {
    this.vel.add(this.acc);
    this.pos.add(this.vel);
    this.acc.set(0, 0);
    this.lifetime -= 1;

    // Rate limit pitch bend messages
    // const currentTime = Date.now();
    // if (currentTime - this.lastPitchBendTime >= this.pitchBendInterval) {
    //   const pitchBend = this.p.constrain(
    //     this.p.map(this.pos.y, 0, this.p.height, 1, -1),
    //     -1,
    //     1
    //   );

    //   try {
    //     if (this.output) {
    //       this.output.sendPitchBend(pitchBend);
    //       this.lastPitchBendTime = currentTime;
    //     }
    //   } catch (error) {
    //     console.error('Error sending pitch bend:', pitchBend);
    //   }
    // }

    if (this.output) {
      this.midiNote.duration = 15;
    }

    if (this.lifetime > 0 && !this.isPlaying) {
      this.startNote();
    } else if (this.lifetime <= 0 && this.isPlaying) {
      this.stopNote();
    }
  }

  show() {
    this.p.fill(255, this.lifetime);
    this.p.circle(this.pos.x, this.pos.y, this.r);
  }

  startNote() {
    if (this.output) {
      this.output.playNote(this.midiNote);
      this.isPlaying = true;
    }
  }

  stopNote() {
    if (this.output && this.isPlaying) {
      try {
        this.output.stopNote(this.midiNote);
      } catch (error) {
        console.error('Error stopping note:', error);
      }
      this.isPlaying = false;
    }
  }
}

export default Particle;
