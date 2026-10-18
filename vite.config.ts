import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // changes on every build: makes the service worker replace its old caches
  define: { __BUILD_ID__: JSON.stringify(Date.now().toString(36)) },
  // the tests are about the logic of the app (dates, funnel, matching, parsing): they run in plain Node
  test: { environment: 'node', include: ['src/__tests__/**/*.test.ts'] },
  server: {
    port: 5173,
  },
})
