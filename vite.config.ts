import { defineConfig } from 'vitest/config'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// the files of the build that the service worker saves when it installs, so that every page of the app opens without a network
// (not only the ones visited before). Big files that are rarely used (the PDF reader) are left out: they are saved when first used.
const PRECACHE_MAX_BYTES = 800 * 1024
const precacheList = (): Plugin => ({
  name: 'precache-list',
  apply: 'build',
  generateBundle(_options, bundle) {
    const files = Object.values(bundle)
      .filter((f) => /\.(js|css|woff2?)$/.test(f.fileName))
      .filter((f) => (f.type === 'chunk' ? f.code.length : String(f.source).length) <= PRECACHE_MAX_BYTES)
      .map((f) => '/' + f.fileName)
    this.emitFile({ type: 'asset', fileName: 'precache.json', source: JSON.stringify(files) })
  },
})

export default defineConfig({
  plugins: [react(), precacheList()],
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
