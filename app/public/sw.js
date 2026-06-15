const CACHE_NAME = 'mage-knight-v5'

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS)
    }).then(() => {
      return self.skipWaiting()
    })
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    }).then(() => {
      return self.clients.claim()
    })
  )
})

// Strategy: Network First for HTML navigation, Cache First for static assets (JS/CSS/images/fonts)
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (url.origin !== location.origin) {
    return
  }

  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirstStrategy(request))
    return
  }

  if (/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|webp)$/i.test(url.pathname)) {
    event.respondWith(cacheFirstStrategy(request))
    return
  }

  event.respondWith(networkFirstStrategy(request))
})

function cacheFirstStrategy(request) {
  return caches.match(request).then((cachedResponse) => {
    if (cachedResponse) {
      return cachedResponse
    }
    return fetch(request).then((networkResponse) => {
      if (networkResponse.ok) {
        const cloned = networkResponse.clone()
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, cloned)
        })
      }
      return networkResponse
    }).catch(() => {
      return new Response('Offline', { status: 503, statusText: 'Service Unavailable' })
    })
  })
}

function networkFirstStrategy(request) {
  return fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      const cloned = networkResponse.clone()
      caches.open(CACHE_NAME).then((cache) => {
        cache.put(request, cloned)
      })
    }
    return networkResponse
  }).catch(() => {
    return caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse
      }
      if (request.mode === 'navigate') {
        return caches.match('/index.html')
      }
      return new Response('Offline', { status: 503, statusText: 'Service Unavailable' })
    })
  })
}
