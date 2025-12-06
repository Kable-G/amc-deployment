// Currency Converter Pro - Service Worker
// Industry-leading PWA implementation with advanced caching strategies

const CACHE_NAME = 'currency-converter-pro-v1.0.0';
const STATIC_CACHE = 'static-v1.0.0';
const DYNAMIC_CACHE = 'dynamic-v1.0.0';
const API_CACHE = 'api-v1.0.0';

// Static assets to cache immediately
const STATIC_ASSETS = [
    './currencyconverter.html',
    './manifest.json',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.2.0/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap'
];

// API endpoints to cache
const API_ENDPOINTS = [
    'https://api.frankfurter.app/currencies',
    'https://api.frankfurter.app/latest'
];

// Cache strategies
const CACHE_STRATEGIES = {
    CACHE_FIRST: 'cache-first',
    NETWORK_FIRST: 'network-first',
    STALE_WHILE_REVALIDATE: 'stale-while-revalidate',
    NETWORK_ONLY: 'network-only',
    CACHE_ONLY: 'cache-only'
};

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing...');
    
    event.waitUntil(
        Promise.all([
            // Cache static assets
            caches.open(STATIC_CACHE).then((cache) => {
                console.log('Service Worker: Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            }),
            
            // Skip waiting to activate immediately
            self.skipWaiting()
        ])
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating...');
    
    event.waitUntil(
        Promise.all([
            // Clean up old caches
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== STATIC_CACHE && 
                            cacheName !== DYNAMIC_CACHE && 
                            cacheName !== API_CACHE) {
                            console.log('Service Worker: Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            }),
            
            // Take control of all clients
            self.clients.claim()
        ])
    );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }
    
    // Handle different types of requests with appropriate strategies
    if (isStaticAsset(url)) {
        event.respondWith(handleStaticAsset(request));
    } else if (isAPIRequest(url)) {
        event.respondWith(handleAPIRequest(request));
    } else if (isFlagImage(url)) {
        event.respondWith(handleFlagImage(request));
    } else {
        event.respondWith(handleDynamicRequest(request));
    }
});

// Check if request is for static assets
function isStaticAsset(url) {
    return STATIC_ASSETS.some(asset => url.href.includes(asset)) ||
           url.pathname.endsWith('.css') ||
           url.pathname.endsWith('.js') ||
           url.pathname.endsWith('.html') ||
           url.hostname === 'fonts.googleapis.com' ||
           url.hostname === 'fonts.gstatic.com' ||
           url.hostname === 'cdnjs.cloudflare.com';
}

// Check if request is for API
function isAPIRequest(url) {
    return url.hostname === 'api.frankfurter.app';
}

// Check if request is for flag images
function isFlagImage(url) {
    return url.hostname === 'flagcdn.com';
}

// Handle static assets with Cache First strategy
async function handleStaticAsset(request) {
    try {
        const cache = await caches.open(STATIC_CACHE);
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
            return cachedResponse;
        }
        
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.error('Static asset fetch failed:', error);
        
        // Return offline fallback if available
        const cache = await caches.open(STATIC_CACHE);
        return cache.match('./currencyconverter.html');
    }
}

// Handle API requests with Network First + Stale While Revalidate
async function handleAPIRequest(request) {
    const cache = await caches.open(API_CACHE);
    
    try {
        // Try network first
        const networkResponse = await Promise.race([
            fetch(request),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Network timeout')), 5000)
            )
        ]);
        
        if (networkResponse.ok) {
            // Cache successful response
            cache.put(request, networkResponse.clone());
            
            // Add timestamp for cache invalidation
            const responseWithTimestamp = new Response(networkResponse.body, {
                status: networkResponse.status,
                statusText: networkResponse.statusText,
                headers: {
                    ...networkResponse.headers,
                    'sw-cache-timestamp': Date.now().toString()
                }
            });
            
            return responseWithTimestamp;
        }
        
        throw new Error(`Network response not ok: ${networkResponse.status}`);
        
    } catch (error) {
        console.warn('API network request failed, trying cache:', error);
        
        // Fallback to cache
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
            // Check if cached response is stale (older than 10 minutes)
            const cacheTimestamp = cachedResponse.headers.get('sw-cache-timestamp');
            const isStale = cacheTimestamp && 
                           (Date.now() - parseInt(cacheTimestamp)) > 10 * 60 * 1000;
            
            if (isStale) {
                // Try to update in background
                fetch(request).then(response => {
                    if (response.ok) {
                        cache.put(request, response.clone());
                    }
                }).catch(() => {
                    // Ignore background update failures
                });
            }
            
            return cachedResponse;
        }
        
        // Return offline response
        return new Response(
            JSON.stringify({
                error: 'Offline - no cached data available',
                offline: true
            }),
            {
                status: 503,
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
}

// Handle flag images with Cache First strategy
async function handleFlagImage(request) {
    try {
        const cache = await caches.open(DYNAMIC_CACHE);
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
            return cachedResponse;
        }
        
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.error('Flag image fetch failed:', error);
        
        // Return placeholder image
        return new Response(
            'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="%23e9ecef"/><text x="20" y="25" text-anchor="middle" fill="%236c757d" font-size="12">?</text></svg>',
            {
                headers: { 'Content-Type': 'image/svg+xml' }
            }
        );
    }
}

// Handle dynamic requests
async function handleDynamicRequest(request) {
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.error('Dynamic request failed:', error);
        
        const cache = await caches.open(DYNAMIC_CACHE);
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Return generic offline page
        return new Response(
            `<!DOCTYPE html>
            <html>
            <head>
                <title>Offline - Currency Converter Pro</title>
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                    .offline-message { color: #666; }
                </style>
            </head>
            <body>
                <h1>You're Offline</h1>
                <p class="offline-message">Please check your internet connection and try again.</p>
                <button onclick="window.location.reload()">Retry</button>
            </body>
            </html>`,
            {
                headers: { 'Content-Type': 'text/html' }
            }
        );
    }
}

// Background sync for failed requests
self.addEventListener('sync', (event) => {
    if (event.tag === 'background-sync') {
        event.waitUntil(doBackgroundSync());
    }
});

async function doBackgroundSync() {
    console.log('Service Worker: Performing background sync');
    
    // Retry failed API requests
    const cache = await caches.open(API_CACHE);
    const requests = await cache.keys();
    
    for (const request of requests) {
        try {
            const response = await fetch(request);
            if (response.ok) {
                await cache.put(request, response.clone());
            }
        } catch (error) {
            console.warn('Background sync failed for:', request.url);
        }
    }
}

// Push notifications (for future rate alerts)
self.addEventListener('push', (event) => {
    if (event.data) {
        const data = event.data.json();
        
        const options = {
            body: data.body,
            icon: './assets/icons/icon-192x192.png',
            badge: './assets/icons/badge-72x72.png',
            vibrate: [100, 50, 100],
            data: data.data,
            actions: [
                {
                    action: 'view',
                    title: 'View Converter',
                    icon: './assets/icons/action-view.png'
                },
                {
                    action: 'dismiss',
                    title: 'Dismiss',
                    icon: './assets/icons/action-dismiss.png'
                }
            ]
        };
        
        event.waitUntil(
            self.registration.showNotification(data.title, options)
        );
    }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    if (event.action === 'view') {
        event.waitUntil(
            clients.openWindow('./currencyconverter.html')
        );
    }
});

// Periodic background sync (for rate updates)
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'rate-update') {
        event.waitUntil(updateExchangeRates());
    }
});

async function updateExchangeRates() {
    console.log('Service Worker: Updating exchange rates in background');
    
    try {
        const response = await fetch('https://api.frankfurter.app/latest');
        if (response.ok) {
            const cache = await caches.open(API_CACHE);
            await cache.put('https://api.frankfurter.app/latest', response.clone());
        }
    } catch (error) {
        console.warn('Background rate update failed:', error);
    }
}

// Message handling for communication with main thread
self.addEventListener('message', (event) => {
    const { type, payload } = event.data;
    
    switch (type) {
        case 'SKIP_WAITING':
            self.skipWaiting();
            break;
            
        case 'GET_CACHE_SIZE':
            getCacheSize().then(size => {
                event.ports[0].postMessage({ type: 'CACHE_SIZE', payload: size });
            });
            break;
            
        case 'CLEAR_CACHE':
            clearCache(payload.cacheName).then(() => {
                event.ports[0].postMessage({ type: 'CACHE_CLEARED' });
            });
            break;
            
        default:
            console.warn('Unknown message type:', type);
    }
});

// Utility functions
async function getCacheSize() {
    const cacheNames = await caches.keys();
    let totalSize = 0;
    
    for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        const requests = await cache.keys();
        
        for (const request of requests) {
            const response = await cache.match(request);
            if (response) {
                const blob = await response.blob();
                totalSize += blob.size;
            }
        }
    }
    
    return totalSize;
}

async function clearCache(cacheName) {
    if (cacheName) {
        await caches.delete(cacheName);
    } else {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
    }
}

console.log('Service Worker: Loaded successfully');