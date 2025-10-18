/**
 * Service Worker for Xudoku PWA
 * Provides offline functionality and caching
 */

const CACHE_NAME = 'xudoku-v1.0.1';
const STATIC_CACHE_NAME = 'xudoku-static-v1.0.1';
const DYNAMIC_CACHE_NAME = 'xudoku-dynamic-v1.0.1';

// Files to cache for offline functionality
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/app.js',
    '/manifest.json',
    '/favicon.svg'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing...');
    
    event.waitUntil(
        caches.open(STATIC_CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('Service Worker: Installation complete');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('Service Worker: Installation failed', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== STATIC_CACHE_NAME && 
                            cacheName !== DYNAMIC_CACHE_NAME &&
                            cacheName.startsWith('xudoku-')) {
                            console.log('Service Worker: Deleting old cache', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('Service Worker: Activation complete');
                return self.clients.claim();
            })
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
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
    
    event.respondWith(
        caches.match(request)
            .then((cachedResponse) => {
                // Return cached version if available
                if (cachedResponse) {
                    console.log('Service Worker: Serving from cache', request.url);
                    return cachedResponse;
                }
                
                // Fetch from network
                return fetch(request)
                    .then((networkResponse) => {
                        // Don't cache if not a valid response
                        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                            return networkResponse;
                        }
                        
                        // Clone the response
                        const responseToCache = networkResponse.clone();
                        
                        // Cache dynamic content
                        caches.open(DYNAMIC_CACHE_NAME)
                            .then((cache) => {
                                cache.put(request, responseToCache);
                            });
                        
                        return networkResponse;
                    })
                    .catch((error) => {
                        console.log('Service Worker: Network request failed', request.url, error);
                        
                        // Return offline page for navigation requests
                        if (request.mode === 'navigate') {
                            return caches.match('/index.html');
                        }
                        
                        // Return a basic offline response for other requests
                        return new Response('Offline', {
                            status: 503,
                            statusText: 'Service Unavailable',
                            headers: new Headers({
                                'Content-Type': 'text/plain'
                            })
                        });
                    });
            })
    );
});

// Background sync for game state
self.addEventListener('sync', (event) => {
    if (event.tag === 'background-sync-game-state') {
        console.log('Service Worker: Background sync triggered');
        event.waitUntil(syncGameState());
    }
});

// Push notifications (for future features)
self.addEventListener('push', (event) => {
    if (event.data) {
        const data = event.data.json();
        console.log('Service Worker: Push notification received', data);
        
        const options = {
            body: data.body,
            icon: '/favicon.svg',
            badge: '/favicon.svg',
            vibrate: [100, 50, 100],
            data: {
                dateOfArrival: Date.now(),
                primaryKey: data.primaryKey
            },
            actions: [
                {
                    action: 'explore',
                    title: 'Play Now',
                    icon: '/favicon.svg'
                },
                {
                    action: 'close',
                    title: 'Close',
                    icon: '/favicon.svg'
                }
            ]
        };
        
        event.waitUntil(
            self.registration.showNotification(data.title, options)
        );
    }
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
    console.log('Service Worker: Notification clicked');
    event.notification.close();
    
    if (event.action === 'explore') {
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

// Message handling from main thread
self.addEventListener('message', (event) => {
    const { type, payload } = event.data;
    
    switch (type) {
        case 'SKIP_WAITING':
            self.skipWaiting();
            break;
            
        case 'GET_VERSION':
            event.ports[0].postMessage({ version: CACHE_NAME });
            break;
            
        case 'CACHE_GAME_STATE':
            cacheGameState(payload);
            break;
            
        case 'GET_CACHED_GAME_STATE':
            getCachedGameState(event.ports[0]);
            break;
            
        default:
            console.log('Service Worker: Unknown message type', type);
    }
});

// Helper functions
async function syncGameState() {
    try {
        // Implement game state synchronization
        console.log('Service Worker: Syncing game state...');
        // This would typically sync with a remote server
    } catch (error) {
        console.error('Service Worker: Sync failed', error);
    }
}

async function cacheGameState(gameState) {
    try {
        const cache = await caches.open(DYNAMIC_CACHE_NAME);
        const response = new Response(JSON.stringify(gameState), {
            headers: { 'Content-Type': 'application/json' }
        });
        await cache.put('/game-state', response);
        console.log('Service Worker: Game state cached');
    } catch (error) {
        console.error('Service Worker: Failed to cache game state', error);
    }
}

async function getCachedGameState(port) {
    try {
        const cache = await caches.open(DYNAMIC_CACHE_NAME);
        const response = await cache.match('/game-state');
        
        if (response) {
            const gameState = await response.json();
            port.postMessage({ success: true, data: gameState });
        } else {
            port.postMessage({ success: false, data: null });
        }
    } catch (error) {
        console.error('Service Worker: Failed to get cached game state', error);
        port.postMessage({ success: false, data: null });
    }
}

// Periodic background sync (for future features)
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'periodic-game-sync') {
        console.log('Service Worker: Periodic sync triggered');
        event.waitUntil(syncGameState());
    }
});

// Handle app updates
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// Error handling
self.addEventListener('error', (event) => {
    console.error('Service Worker: Error occurred', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
    console.error('Service Worker: Unhandled promise rejection', event.reason);
});

console.log('Service Worker: Script loaded');
