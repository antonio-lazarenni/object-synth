import { defineConfig } from 'vite'

export default defineConfig({
  base: '/object-synth/',
  build: {
    outDir: 'dist',
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