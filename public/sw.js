/**
 * Omnex Display Hub - Service Worker
 *
 * Development: Completely disabled (network-only, no caching)
 * Production: Smart caching with version control
 *
 * Cache is auto-cleared when build hash changes.
 */

const CACHE_VERSION = 'v12';
const STATIC_CACHE = 'omnex-static-' + CACHE_VERSION;
const DYNAMIC_CACHE = 'omnex-dynamic-' + CACHE_VERSION;

// Detect if running in development (localhost)
const isDevelopment = () => {
    const hostname = self.location.hostname;
    return hostname === 'localhost' ||
           hostname === '127.0.0.1' ||
           hostname.startsWith('192.168.') ||
           hostname.startsWith('10.') ||
           hostname.endsWith('.local');
};

const DEV_MODE = isDevelopment();

// Get base path dynamically from registration scope
const getBasePath = () => {
    try {
        const scopeUrl = new URL(self.registration.scope);
        return scopeUrl.pathname.replace(/\/$/, '');
    } catch (e) {
        return '';
    }
};

const BASE_PATH = getBasePath();
const SW_PUSH_DEDUP_MS = 120000;
const SW_PUSH_SIGNATURES = new Map();

const resolveSwAssetUrl = (assetPath) => {
    const path = String(assetPath || '').trim();
    if (!path) return '';
    if (/^https?:\/\//i.test(path)) return path;
    if (path.startsWith('/')) return path;
    return BASE_PATH + '/' + path.replace(/^\.?\//, '');
};

// Assets to cache only in production
const STATIC_ASSETS = [
    BASE_PATH + '/',
    BASE_PATH + '/index.php',
    BASE_PATH + '/manifest.json',
    BASE_PATH + '/branding/favicon.png',
    BASE_PATH + '/branding/logo.png',
    BASE_PATH + '/branding/logo-dark.jpg',
    BASE_PATH + '/branding/icon-192.png',
    BASE_PATH + '/branding/icon-512.png',
    BASE_PATH + '/branding/pwa.png'
];

// Install event
self.addEventListener('install', event => {
    console.log('[SW] Installing...', DEV_MODE ? '(Development Mode - No Caching)' : '(Production Mode)');

    // Always skip waiting to activate immediately
    self.skipWaiting();

    if (DEV_MODE) {
        // In development, clear all existing caches during install
        event.waitUntil(
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        console.log('[SW] Clearing cache:', cacheName);
                        return caches.delete(cacheName);
                    })
                );
            })
        );
        return;
    }

    // Production: cache static assets
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => {
                return Promise.allSettled(
                    STATIC_ASSETS.map(url =>
                        cache.add(url).catch(err => {
                            console.warn('[SW] Failed to cache:', url);
                            return null;
                        })
                    )
                );
            })
            .catch(() => {})
    );
});

// Activate event
self.addEventListener('activate', event => {
    console.log('[SW] Activating...');

    event.waitUntil(
        Promise.all([
            // Clear old caches
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames
                        .filter(name => {
                            // In dev mode, clear ALL caches
                            if (DEV_MODE) return true;
                            // In production, only clear old versions
                            return !name.endsWith(CACHE_VERSION);
                        })
                        .map(name => {
                            console.log('[SW] Deleting cache:', name);
                            return caches.delete(name);
                        })
                );
            }),
            // Take control of all clients
            self.clients.claim()
        ])
    );
});

// Fetch event
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Skip chrome-extension and other non-http requests
    if (!url.protocol.startsWith('http')) {
        return;
    }

    // ============================================
    // DEVELOPMENT MODE: Always fetch from network
    // ============================================
    if (DEV_MODE) {
        // Add cache-busting header for development
        event.respondWith(
            fetch(request, {
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache'
                }
            }).catch(err => {
                console.warn('[SW] Network failed:', url.pathname);
                // Last resort fallback
                return caches.match(request);
            })
        );
        return;
    }

    // ============================================
    // PRODUCTION MODE: Smart caching strategies
    // ============================================

    // API requests: Always network-first
    if (url.pathname.includes('/api/')) {
        event.respondWith(
            fetch(request)
                .catch(() => {
                    return new Response(
                        JSON.stringify({ error: 'Network error', offline: true }),
                        { headers: { 'Content-Type': 'application/json' } }
                    );
                })
        );
        return;
    }

    // Locale files: Network-first (for quick i18n updates)
    if (url.pathname.includes('/locales/')) {
        event.respondWith(
            fetch(request)
                .then(response => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(DYNAMIC_CACHE)
                            .then(cache => cache.put(request, clone));
                    }
                    return response;
                })
                .catch(() => caches.match(request))
        );
        return;
    }

    // HTML pages: Network-first with cache fallback
    if (request.headers.get('Accept')?.includes('text/html') ||
        url.pathname.endsWith('.php') ||
        url.pathname.endsWith('.html')) {
        event.respondWith(
            fetch(request)
                .then(response => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(DYNAMIC_CACHE)
                            .then(cache => cache.put(request, clone));
                    }
                    return response;
                })
                .catch(() => {
                    return caches.match(request)
                        .then(cached => cached || caches.match(BASE_PATH + '/'));
                })
        );
        return;
    }

    // CSS/JS with version params: Cache with revalidation
    if (isVersionedAsset(url)) {
        event.respondWith(
            fetch(request)
                .then(response => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(STATIC_CACHE)
                            .then(cache => cache.put(request, clone));
                    }
                    return response;
                })
                .catch(() => caches.match(request))
        );
        return;
    }

    // Images and fonts: Cache-first with network fallback
    if (isImmutableAsset(url.pathname)) {
        event.respondWith(
            caches.match(request)
                .then(cached => {
                    if (cached) return cached;
                    return fetch(request)
                        .then(response => {
                            if (response.ok) {
                                const clone = response.clone();
                                caches.open(STATIC_CACHE)
                                    .then(cache => cache.put(request, clone));
                            }
                            return response;
                        });
                })
        );
        return;
    }

    // Default: Network-first
    event.respondWith(
        fetch(request)
            .catch(() => caches.match(request))
    );
});

// Check if URL has version query param
function isVersionedAsset(url) {
    const hasVersionParam = url.search.includes('v=');
    const isStaticFile = /\.(js|css)$/.test(url.pathname);
    return isStaticFile && hasVersionParam;
}

// Check if asset is typically immutable (images, fonts)
function isImmutableAsset(pathname) {
    return /\.(png|jpg|jpeg|gif|svg|webp|woff2?|ttf|eot|ico)$/.test(pathname);
}

// Handle messages from clients
self.addEventListener('message', event => {
    const { action, data } = event.data || {};

    switch (action) {
        case 'skipWaiting':
            self.skipWaiting();
            break;

        case 'clearCache':
            caches.keys().then(names => {
                Promise.all(names.map(name => {
                    console.log('[SW] Clearing cache (requested):', name);
                    return caches.delete(name);
                })).then(() => {
                    if (event.ports[0]) {
                        event.ports[0].postMessage({ cleared: true, count: names.length });
                    }
                });
            });
            break;

        case 'clearAndReload':
            caches.keys().then(names => {
                Promise.all(names.map(name => caches.delete(name)))
                    .then(() => {
                        // Notify all clients to reload
                        self.clients.matchAll().then(clients => {
                            clients.forEach(client => {
                                client.postMessage({ action: 'reload' });
                            });
                        });
                    });
            });
            break;

        case 'getCacheInfo':
            caches.keys().then(async names => {
                const info = {
                    caches: names,
                    version: CACHE_VERSION,
                    devMode: DEV_MODE,
                    entries: {}
                };

                // Get entry count for each cache
                for (const name of names) {
                    const cache = await caches.open(name);
                    const keys = await cache.keys();
                    info.entries[name] = keys.length;
                }

                if (event.ports[0]) {
                    event.ports[0].postMessage(info);
                }
            });
            break;

        case 'checkVersion':
            if (data && data.buildHash) {
                // Compare with stored version
                const storedVersion = self.buildHash || '';
                if (storedVersion && storedVersion !== data.buildHash) {
                    console.log('[SW] Build hash changed, clearing caches...');
                    caches.keys().then(names => {
                        Promise.all(names.map(name => caches.delete(name)));
                    });
                }
                self.buildHash = data.buildHash;
            }
            break;
    }
});

// Push notification handling
self.addEventListener('push', event => {
    if (!event.data) return;

    event.waitUntil((async () => {
        try {
            const data = event.data.json();
            const targetUrl = data.url || BASE_PATH + '/';
            const title = data.title || 'Omnex Display Hub';
            const body = data.body || '';
            const signature = [title, body, targetUrl].join('|');
            const nowTs = Date.now();

            for (const [key, ts] of SW_PUSH_SIGNATURES.entries()) {
                if ((nowTs - ts) >= SW_PUSH_DEDUP_MS) {
                    SW_PUSH_SIGNATURES.delete(key);
                }
            }

            const lastSeen = Number(SW_PUSH_SIGNATURES.get(signature) || 0);
            if (signature && (nowTs - lastSeen) < SW_PUSH_DEDUP_MS) {
                return;
            }
            if (signature) {
                SW_PUSH_SIGNATURES.set(signature, nowTs);
            }

            const options = {
                body,
                icon: resolveSwAssetUrl(data.icon || (BASE_PATH + '/branding/icon-192.png')),
                badge: resolveSwAssetUrl(data.badge || (BASE_PATH + '/branding/favicon.png')),
                vibrate: [100, 50, 100],
                data: {
                    url: targetUrl
                },
                actions: data.actions || [],
                tag: data.tag || data.id || signature || ('push-' + nowTs)
            };

            const windowClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
            const hasVisibleAppWindow = windowClients.some(client => {
                const sameApp = typeof client.url === 'string' && client.url.includes(BASE_PATH);
                const isVisible = client.visibilityState === 'visible';
                const isFocused = client.focused === true;
                return sameApp && (isVisible || isFocused);
            });
            if (hasVisibleAppWindow) {
                // Uygulama acikken ikinci bir OS-level bildirim olusturma.
                windowClients.forEach(client => {
                    if (typeof client.url === 'string' && client.url.includes(BASE_PATH)) {
                        client.postMessage({
                            type: 'push_received_while_visible',
                            payload: {
                                title: data.title || 'Omnex Display Hub',
                                body: data.body || '',
                                url: targetUrl
                            }
                        });
                    }
                });
                return;
            }

            // Open-app only mode: never show OS-level notification from SW.
            // Desktop notifications are handled centrally by NotificationManager.
        } catch (e) {
            console.error('[SW] Push notification error:', e);
        }
    })());
});

// Notification click handling
self.addEventListener('notificationclick', event => {
    event.notification.close();

    const url = event.notification.data?.url || BASE_PATH + '/';

    event.waitUntil(
        clients.matchAll({ type: 'window' })
            .then(clientList => {
                for (const client of clientList) {
                    if (client.url.includes(BASE_PATH) && 'focus' in client) {
                        client.navigate(url);
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow(url);
                }
            })
    );
});

console.log('[SW] Loaded. Development mode:', DEV_MODE);
