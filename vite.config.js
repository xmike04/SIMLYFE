import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { buildInfoPlugin } from './scripts/build-info.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), buildInfoPlugin()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/tests/setup.js'],
    exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**'],
    coverage: {
      reporter: ['text', 'html'],
      include: ['src/engine/**', 'src/config/**'],
      exclude: ['src/config/firebase.js'],
    },
  },
})
