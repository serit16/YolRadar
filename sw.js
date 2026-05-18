const CACHE_NAME = 'yolradar-v13';

// Sadece yerel dosyaları cache'le
const LOCAL_ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json'
];

// Install: sadece yerel dosyaları cache'e al
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(LOCAL_ASSETS))
            .then(() => self.skipWaiting())
            .catch(() => self.skipWaiting()) // cache başarısız olsa bile devam et
    );
});

// Activate: eski cache'leri temizle
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

// Fetch: Harici kaynaklar (CDN, tile, API) → HER ZAMAN NETWORK
// Yerel dosyalar → cache-first
self.addEventListener('fetch', event => {
    const url = event.request.url;

    // Harici tüm kaynakları her zaman ağdan al (tile, CDN, Firebase, API)
    const isExternal = !url.startsWith(self.location.origin) ||
        url.includes('cartocdn.com') ||
        url.includes('openstreetmap') ||
        url.includes('unpkg.com') ||
        url.includes('jsdelivr.net') ||
        url.includes('googleapis.com') ||
        url.includes('gstatic.com') ||
        url.includes('firebaseio.com') ||
        url.includes('firebase') ||
        url.includes('nominatim') ||
        url.includes('osrm.org');

    if (isExternal) {
        // Harici → network-only, hata olursa boş yanıt
        event.respondWith(
            fetch(event.request).catch(() => new Response('', { status: 408 }))
        );
        return;
    }

    // Yerel dosyalar → cache-first, sonra network
    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;
            return fetch(event.request).then(response => {
                if (response && response.status === 200) {
                    const toCache = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache));
                }
                return response;
            }).catch(() => {
                if (event.request.destination === 'document') {
                    return caches.match('./index.html');
                }
                return new Response('', { status: 408 });
            });
        })
    );
});
