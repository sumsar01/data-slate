const CACHE_NAME = "data-slate-v1"
const STATIC_ASSETS = ["/", "/record"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Network-first: try network, fall back to cache for navigation requests
self.addEventListener("fetch", (event) => {
  const { request } = event
  // Only handle GET requests and same-origin navigation
  if (request.method !== "GET") return
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/").then((r) => r ?? Response.error()))
    )
    return
  }
  // For static assets: cache-first
  if (request.destination === "script" || request.destination === "style" || request.destination === "image") {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((res) => {
          const clone = res.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          return res
        })
      })
    )
  }
})
