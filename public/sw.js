js
const CACHE = "licence-pwa-v1";
const FALLBACK_PATH = new URL("index.html", self.registration.scope).pathname;


self.addEventListener("install", (event) => {
event.waitUntil(caches.open(CACHE));
self.skipWaiting();
});
self.addEventListener("activate", (event) => {
event.waitUntil(
caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
);
self.clients.claim();
});
self.addEventListener("fetch", (event) => {
const { request } = event;
if (request.mode === "navigate") {
event.respondWith(fetch(request).catch(() => caches.match(FALLBACK_PATH)));
return;
}
event.respondWith(
caches.match(request).then(
(hit) =>
hit ||
fetch(request).then((resp) => {
const copy = resp.clone();
caches.open(CACHE).then((c) => c.put(request, copy));
return resp;
})
)
);
});