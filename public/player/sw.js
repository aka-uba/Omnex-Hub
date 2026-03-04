/**
 * Omnex Player - Service Worker
 * Handles caching and offline support for PWA Player
 *
 * @version 1.0.0
 */

const CACHE_VERSION = 'v1.2.4';
const CACHE_NAME = `omnex-player-${CACHE_VERSION}`;
const MEDIA_CACHE_NAME = `omnex-player-media-${CACHE_VERSION}`;

// Static assets to cache on install
const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './assets/css/player.css',
    './assets/js/player.js',
    './assets/js/api.js',
    './assets/js/storage.js',
    '../branding/favicon.png',
    '../branding/icon-192.png',
    '../branding/icon-512.png'
];

// API routes that should be network-first
const API_ROUTES = [
    '/api/player/',
    '/api/media/'
];

// Media types to cache
const MEDIA_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.webm', '.m3u8'];

/**
 * ✅ MEMORY LEAK FIX: Prune media cache to prevent unlimited growth
 * @param {number} maxSizeMB - Maximum cache size in megabytes (default: 50MB)
 */
async function pruneMediaCache(maxSizeMB = 50) {
    try {
        const cache = await caches.open(MEDIA_CACHE_NAME);
        const requests = await cache.keys();

        let totalSize = 0;
        const items = [];

        // Calculate sizes and collect items
        for (const request of requests) {
            const response = await cache.match(request);
            if (response) {
                const blob = await response.blob();
                items.push({
                    request,
                    size: blob.size,
                    timestamp: new Date(response.headers.get('date') || Date.now()).getTime()
                });
                totalSize += blob.size;
            }
        }

        // Sort by timestamp (oldest first)
        items.sort((a, b) => a.timestamp - b.timestamp);

        const maxSize = maxSizeMB * 1024 * 1024;
        let deletedCount = 0;

        // Delete oldest items until under limit
        while (totalSize > maxSize && items.length > 0) {
            const item = items.shift();
            await cache.delete(item.request);
            totalSize -= item.size;
            deletedCount++;
        }

        if (deletedCount > 0) {
            console.log(`[SW] Pruned ${deletedCount} items from media cache (${Math.round(totalSize / 1024 / 1024)}MB remaining)`);
        }
    } catch (error) {
        console.error('[SW] Cache pruning failed:', error);
    }
}

/**
 * Install Event - Cache static assets
 */
self.addEventListener('install', (event) => {
    console.log('[SW] Installing Service Worker...');

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('[SW] Static assets cached');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('[SW] Cache install failed:', error);
            })
    );
});

/**
 * Activate Event - Clean old caches
 */
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating Service Worker...');

    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => {
                            return name.startsWith('omnex-player-') &&
                                   name !== CACHE_NAME &&
                                   name !== MEDIA_CACHE_NAME;
                        })
                        .map((name) => {
                            console.log('[SW] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                console.log('[SW] Service Worker activated');
                return self.clients.claim();
            })
    );
});

/**
 * Fetch Event - Handle requests with appropriate strategy
 */
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    // Skip chrome-extension and other non-http(s) requests
    if (!url.protocol.startsWith('http')) {
        return;
    }

    // API requests - Network first, cache fallback
    if (isApiRequest(url.pathname)) {
        event.respondWith(networkFirst(event.request));
        return;
    }

    // HTML/document navigations - always prefer latest network response.
    if (event.request.mode === 'navigate' || event.request.destination === 'document') {
        event.respondWith(documentNetworkFirst(event.request));
        return;
    }

    // Media requests - Cache first, network fallback
    if (isMediaRequest(url.pathname)) {
        event.respondWith(cacheFirstMedia(event.request));
        return;
    }

    // Static assets - Stale while revalidate
    event.respondWith(staleWhileRevalidate(event.request));
});

/**
 * Check if request is an API call
 */
function isApiRequest(pathname) {
    return API_ROUTES.some(route => pathname.includes(route));
}

/**
 * Check if request is for media content
 */
function isMediaRequest(pathname) {
    const lowerPath = pathname.toLowerCase();
    return MEDIA_EXTENSIONS.some(ext => lowerPath.endsWith(ext)) ||
           lowerPath.includes('/storage/') ||
           lowerPath.includes('/media/');
}

/**
 * Network First Strategy
 * Try network, fallback to cache
 */
async function networkFirst(request) {
    try {
        const networkResponse = await fetch(request);

        // Cache successful responses
        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }

        return networkResponse;
    } catch (error) {
        console.log('[SW] Network failed, trying cache:', request.url);

        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }

        // Return offline response for API
        return new Response(
            JSON.stringify({
                success: false,
                offline: true,
                message: 'Offline - cached data not available'
            }),
            {
                status: 503,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
}

/**
 * Network First strategy for HTML/documents
 * Keeps PWA pages fresh while still allowing offline fallback.
 */
async function documentNetworkFirst(request) {
    try {
        const networkResponse = await fetch(request);

        if (networkResponse && networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }

        return networkResponse;
    } catch (error) {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }

        const fallback = await caches.match('./index.html');
        if (fallback) {
            return fallback;
        }

        return new Response('Offline', { status: 503 });
    }
}

/**
 * Cache First Strategy for Media
 * Check cache first, then network
 */
async function cacheFirstMedia(request) {
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
        // Revalidate in background
        fetchAndCache(request, MEDIA_CACHE_NAME);
        return cachedResponse;
    }

    // Not in cache, fetch and cache
    try {
        const networkResponse = await fetch(request);

        // Only cache complete responses (200 OK)
        // Skip partial responses (206) which happen with video streaming
        if (networkResponse.ok && networkResponse.status === 200) {
            const cache = await caches.open(MEDIA_CACHE_NAME);
            await cache.put(request, networkResponse.clone());
            // ✅ MEMORY LEAK FIX: Prune cache after adding new items
            pruneMediaCache(50).catch(() => {}); // Non-blocking
        }

        return networkResponse;
    } catch (error) {
        console.error('[SW] Media fetch failed:', request.url);
        return new Response('Media not available', { status: 404 });
    }
}

/**
 * Stale While Revalidate Strategy
 * Return cached if available, update cache in background
 */
async function staleWhileRevalidate(request) {
    const cachedResponse = await caches.match(request);

    // Start network fetch in background
    const fetchPromise = fetch(request.clone())
        .then(async (networkResponse) => {
            if (networkResponse.ok) {
                try {
                    const cache = await caches.open(CACHE_NAME);
                    // Clone before caching since we might return this response
                    await cache.put(request, networkResponse.clone());
                } catch (e) {
                    // Cache put failed, ignore
                }
            }
            return networkResponse;
        })
        .catch(() => null);

    // If we have cached response, return it immediately
    // Network fetch will update cache in background
    if (cachedResponse) {
        // Don't await fetchPromise, let it run in background
        fetchPromise.catch(() => {}); // Prevent unhandled rejection
        return cachedResponse;
    }

    // No cache, wait for network
    return fetchPromise;
}

/**
 * Fetch and cache in background
 */
async function fetchAndCache(request, cacheName) {
    try {
        const networkResponse = await fetch(request);
        // Only cache complete responses (200 OK)
        // Skip partial responses (206) which happen with video streaming
        if (networkResponse.ok && networkResponse.status === 200) {
            const cache = await caches.open(cacheName);
            cache.put(request, networkResponse.clone());
        }
    } catch (error) {
        // Silent fail for background updates
    }
}

/**
 * Message Handler - Communication with main thread
 */
self.addEventListener('message', (event) => {
    const { type, data } = event.data;

    switch (type) {
        case 'SKIP_WAITING':
            self.skipWaiting();
            break;

        case 'CACHE_MEDIA':
            cacheMediaList(data.urls);
            break;

        case 'PRUNE_MEDIA_CACHE':
            pruneMediaCache(data.keepUrls);
            break;

        case 'CLEAR_MEDIA_CACHE':
            clearMediaCache();
            break;

        case 'GET_CACHE_SIZE':
            getCacheSize().then((size) => {
                event.ports[0].postMessage({ size });
            });
            break;
    }
});

/**
 * Validate URL before caching - reject non-media URLs
 */
function isValidCacheableUrl(urlString) {
    if (!urlString || typeof urlString !== 'string') return false;

    // Reject data URIs (cannot be fetched by SW)
    if (urlString.startsWith('data:')) return false;

    // Reject hash routes (e.g. http://example.com/#/dashboard)
    if (urlString.includes('#/')) return false;

    try {
        const url = new URL(urlString);

        // Only allow http/https protocols
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;

        // Reject mixed content: HTTP URL on HTTPS origin
        if (self.location.protocol === 'https:' && url.protocol === 'http:') return false;

        // Reject URLs with unresolved template variables ({, })
        if (url.pathname.includes('%7B') || url.pathname.includes('%7D') ||
            url.pathname.includes('{') || url.pathname.includes('}')) return false;

        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Cache a list of media URLs
 */
async function cacheMediaList(urls) {
    if (!Array.isArray(urls) || urls.length === 0) return;

    const cache = await caches.open(MEDIA_CACHE_NAME);
    let cached = 0, skipped = 0, failed = 0, alreadyCached = 0;

    for (const url of urls) {
        // Validate URL before attempting fetch
        if (!isValidCacheableUrl(url)) {
            skipped++;
            continue;
        }

        try {
            // Skip URLs already in cache to avoid unnecessary network usage
            const existing = await cache.match(url);
            if (existing) {
                alreadyCached++;
                continue;
            }

            const response = await fetch(url);
            // Only cache complete responses (200 OK)
            // Skip partial responses (206) which happen with video streaming
            if (response.ok && response.status === 200) {
                await cache.put(url, response);
                cached++;
                console.log('[SW] Cached media:', url);

                // Throttle: wait 500ms between fetches to avoid saturating
                // bandwidth and starving ExoPlayer preload buffer.
                // Without this, serial fetch of all playlist URLs caused
                // every ~6th video transition to be slow.
                await new Promise(r => setTimeout(r, 500));
            } else {
                failed++;
            }
        } catch (error) {
            failed++;
            console.error('[SW] Failed to cache:', url);
        }
    }

    console.log('[SW] Media cache results:', { cached, skipped, failed, alreadyCached, total: urls.length });

    // Notify clients
    const clients = await self.clients.matchAll();
    clients.forEach((client) => {
        client.postMessage({
            type: 'CACHE_COMPLETE',
            data: { urls }
        });
    });
}

/**
 * Prune stale media cache entries.
 * Keeps only currently referenced playlist media URLs.
 */
async function pruneMediaCache(keepUrls) {
    const keepSet = new Set(
        (Array.isArray(keepUrls) ? keepUrls : [])
            .filter(Boolean)
            .map((value) => normalizeCacheUrl(value))
    );
    const cache = await caches.open(MEDIA_CACHE_NAME);
    const requests = await cache.keys();
    let removed = 0;

    for (const request of requests) {
        const normalizedRequestUrl = normalizeCacheUrl(request.url);
        if (!keepSet.has(normalizedRequestUrl)) {
            await cache.delete(request);
            removed += 1;
        }
    }

    console.log('[SW] Media cache prune complete:', { removed, kept: keepSet.size, total: requests.length });
}

function normalizeCacheUrl(value) {
    try {
        const resolved = new URL(value, self.location.origin);
        resolved.hash = '';
        return resolved.toString();
    } catch (error) {
        return String(value || '');
    }
}

/**
 * Clear media cache
 */
async function clearMediaCache() {
    await caches.delete(MEDIA_CACHE_NAME);
    console.log('[SW] Media cache cleared');
}

/**
 * Get total cache size
 */
async function getCacheSize() {
    let totalSize = 0;
    const cacheNames = await caches.keys();

    for (const name of cacheNames) {
        if (!name.startsWith('omnex-player-')) continue;

        const cache = await caches.open(name);
        const keys = await cache.keys();

        for (const request of keys) {
            const response = await cache.match(request);
            if (response) {
                const blob = await response.blob();
                totalSize += blob.size;
            }
        }
    }

    return totalSize;
}

/**
 * Periodic sync for background updates (if supported)
 */
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'content-sync') {
        event.waitUntil(syncContent());
    }
});

/**
 * Sync content in background
 */
async function syncContent() {
    try {
        // Get stored device token
        const db = await openIndexedDB();
        const config = await db.get('config', 'device');

        if (!config || !config.token) return;

        // Check for updates
        const response = await fetch('/api/player/sync', {
            headers: {
                'X-DEVICE-TOKEN': config.token
            }
        });

        if (response.ok) {
            const data = await response.json();

            if (data.hasUpdates) {
                // Notify clients about updates
                const clients = await self.clients.matchAll();
                clients.forEach((client) => {
                    client.postMessage({
                        type: 'CONTENT_UPDATE',
                        data: data
                    });
                });
            }
        }
    } catch (error) {
        console.error('[SW] Background sync failed:', error);
    }
}

/**
 * Open IndexedDB (simplified)
 */
function openIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('omnex-player', 1);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const db = request.result;
            resolve({
                get: (store, key) => {
                    return new Promise((res, rej) => {
                        const tx = db.transaction(store, 'readonly');
                        const req = tx.objectStore(store).get(key);
                        req.onsuccess = () => res(req.result);
                        req.onerror = () => rej(req.error);
                    });
                }
            });
        };
    });
}

console.log('[SW] Omnex Player Service Worker loaded');
