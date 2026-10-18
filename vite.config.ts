import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // changes on every build: makes the service worker replace its old caches
  define: { __BUILD_ID__: JSON.stringify(Date.now().toString(36)) },
  // the tests are about the logic of the app (dates, funnel, matching, parsing): they run in plain Node
  test: { environment: 'node', include: ['src/__tests__/**/*.test.ts'] },
  build: {
    rollupOptions: {
      output: {
        // libraries that rarely change get their own files: after a new version of the app the phone downloads only the app code again
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (/[\/](react|react-dom|react-router|react-router-dom|scheduler|@remix-run)[\/]/.test(id)) return 'vendor-react'
          if (/[\/](@supabase|@tanstack)[\/]/.test(id)) return 'vendor-data'
          return undefined
        },
      },
    },
  },
  server: {
    port: 5173,
  },
})
