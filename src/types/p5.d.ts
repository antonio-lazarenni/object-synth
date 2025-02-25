import 'p5';

declare module 'p5' {
  interface Element {
    option(value: string, text: string): void;
    changed(callback: () => void): void;
    input(callback: () => void): void;
    selected(value: string): void;
    volume(value: number): void;
    loadPixels(): void;
  }
} 