import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const packageVersion = process.env.npm_package_version ?? '0.0.0'

const gitCommit = (() => {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return 'unknown'
  }
})()

const buildTime = new Date().toISOString()

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/object-synth/',
  define: {
    __APP_VERSION__: JSON.stringify(packageVersion),
    __APP_COMMIT__: JSON.stringify(gitCommit),
    __APP_BUILD_TIME__: JSON.stringify(buildTime),
  },
  build: {
    outDir: 'dist',
  },
})