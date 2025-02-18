import { defineConfig } from 'vite'

export default defineConfig({
  // ... existing code ...
  build: {
    rollupOptions: {
      external: ['p5'],
      output: {
        globals: {
          p5: 'p5'
        }
      }
    }
  },
  optimizeDeps: {
    include: ['p5']
  }
}) 