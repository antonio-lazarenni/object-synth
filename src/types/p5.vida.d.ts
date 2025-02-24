declare module 'p5.vida' {
  class Vida {
    constructor(p5Instance: any);
    // Add other Vida methods and properties as needed
  }
  
  global {
    interface Window {
      Vida: typeof Vida;
    }
  }
} 