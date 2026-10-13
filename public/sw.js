// Service worker: lets the installed app open without a network connection.
// - the app shell (index.html) is network-first and falls back to the saved copy when offline
// - build files (/assets) and the OCR language files are cached the first time they are used
// - data never goes through here: Supabase / API calls are left alone (data is kept by the app itself)

const BUILD = new URL(self.location.href).searchParams.get('v') || 'dev'
const SHELL = `ami-shell-${BUILD}`
const ASSETS = `ami-assets-${BUILD}`
const OCR = 'ami-ocr-v1' // large and never changes — kept across versions

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((c) => c.addAll(['/', '/manifest.webmanifest', '/favicon.svg', '/icon-192.png']))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== ASSETS && k !== OCR).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const hit = await cache.match(request)
  if (hit) return hit
  const res = await fetch(request)
  if (res.ok) cache.put(request, res.clone())
  return res
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // Supabase, map tiles, CDNs: network only
  if (url.pathname.startsWith('/api/')) return

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) caches.open(SHELL).then((c) => c.put('/', res.clone()))
          return res
        })
        .catch(() => caches.match('/', { cacheName: SHELL }).then((r) => r || Response.error())),
    )
    return
  }

  if (url.pathname.startsWith('/tessdata/')) {
    event.respondWith(cacheFirst(req, OCR))
    return
  }
  if (url.pathname.startsWith('/assets/') || /\.(png|svg|webmanifest|woff2?)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(req, ASSETS).catch(() => caches.match(req)))
  }
})
