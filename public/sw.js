// Service worker: lets the installed app open without a network connection.
// - the app shell (index.html) is network-first and falls back to the saved copy when offline
// - the files of the build are saved when the worker installs (the list is precache.json, made by the build), the OCR language files the first time they are used
// - data never goes through here: Supabase / API calls are left alone (data is kept by the app itself)

const BUILD = new URL(self.location.href).searchParams.get('v') || 'dev'
const SHELL = `ami-shell-${BUILD}`
const ASSETS = `ami-assets-${BUILD}`
const OCR = 'ami-ocr-v1' // large and never changes — kept across versions

async function precacheBuild() {
  try {
    const res = await fetch('/precache.json', { cache: 'no-store' })
    if (!res.ok) return
    const files = await res.json()
    const cache = await caches.open(ASSETS)
    await Promise.allSettled(files.map((f) => cache.add(f)))
  } catch {
    /* no list (an old build or no network): the files are saved when first used */
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((c) => c.addAll(['/', '/manifest.webmanifest', '/favicon.svg', '/icon-192.png']))
      // every file of the app (the list is made by the build): a page that was never opened still opens without a network.
      // A failure here never stops the installation: what is missing is saved when it is first used.
      .then(precacheBuild)
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

// a task reminder arriving from the server, even with the app closed
self.addEventListener('push', (event) => {
  let data = { title: 'תזכורת', body: '' }
  try {
    data = event.data.json()
  } catch {
    /* no payload or not JSON: show the generic title */
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'תזכורת', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      dir: 'rtl',
      data: { taskId: data.taskId || null },
    }),
  )
})

// tapping the notification: focus an already-open tab if there is one, otherwise open a new one, both landing on the task
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.taskId ? `/tasks?open=${event.notification.data.taskId}` : '/tasks'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if ('focus' in c) {
          c.navigate(url)
          return c.focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
