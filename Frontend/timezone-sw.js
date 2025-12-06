at// AutoMediaCenter Timezone Converter Pro - Service Worker
// Version 1.0.0 - Premium PWA with AI capabilities

const CACHE_NAME = 'timezone-converter-v1.0.0';
const STATIC_CACHE = 'timezone-static-v1';
const DYNAMIC_CACHE = 'timezone-dynamic-v1';

// Critical resources to cache for offline functionality
const STATIC_ASSETS = [
  './timezoneconverter.html',
  './timezone-manifest.json',
  // Core CSS frameworks (CDN fallbacks)
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  // Core JS libraries (CDN fallbacks)
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js',
  // Timezone data (essential for offline functionality)
  'https://worldtimeapi.org/api/timezone',
];

// Dynamic resources that can be cached on demand
const DYNAMIC_ASSETS = [
  'https://worldtimeapi.org/api/timezone/',
  'https://api.exchangerate-api.com/', // For currency-related timezone features
  'https://restcountries.com/v3.1/', // For country/timezone data
];

// Install event - cache static assets
self.addEventListener('install', event => {
  console.log('[SW] Installing Timezone Converter Service Worker v1.0.0');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS.filter(url => !url.includes('api')));
      })
      .then(() => {
        console.log('[SW] Static assets cached successfully');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('[SW] Failed to cache static assets:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('[SW] Activating Timezone Converter Service Worker v1.0.0');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Service Worker activated successfully');
        return self.clients.claim();
      })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Handle different types of requests with appropriate strategies
  if (request.method !== 'GET') {
    return; // Only handle GET requests
  }
  
  // Strategy 1: Cache First (for static assets)
  if (STATIC_ASSETS.some(asset => request.url.includes(asset.split('/').pop()))) {
    event.respondWith(cacheFirst(request));
    return;
  }
  
  // Strategy 2: Network First with fallback (for API calls)
  if (url.hostname.includes('worldtimeapi.org') || 
      url.hostname.includes('api.exchangerate-api.com') ||
      url.hostname.includes('restcountries.com')) {
    event.respondWith(networkFirstWithFallback(request));
    return;
  }
  
  // Strategy 3: Stale While Revalidate (for other resources)
  event.respondWith(staleWhileRevalidate(request));
});

// Cache First Strategy - for static assets
async function cacheFirst(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('[SW] Serving from cache:', request.url);
      return cachedResponse;
    }
    
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
      console.log('[SW] Cached new resource:', request.url);
    }
    return networkResponse;
  } catch (error) {
    console.error('[SW] Cache first failed:', error);
    return new Response('Offline - Resource not available', { 
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Network First with Fallback - for API calls
async function networkFirstWithFallback(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
      console.log('[SW] Updated cache with fresh API data:', request.url);
      return networkResponse;
    }
    throw new Error('Network response not ok');
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('[SW] Serving stale API data from cache');
      return cachedResponse;
    }
    
    // Return offline fallback for timezone API
    if (request.url.includes('worldtimeapi.org')) {
      return new Response(JSON.stringify({
        datetime: new Date().toISOString(),
        timezone: 'UTC',
        utc_offset: '+00:00',
        offline: true,
        message: 'Using local time - API unavailable'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response('Offline - API unavailable', { 
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Stale While Revalidate - for other resources
async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cachedResponse = await cache.match(request);
  
  const fetchPromise = fetch(request).then(networkResponse => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => cachedResponse);
  
  return cachedResponse || fetchPromise;
}

// Background sync for offline actions
self.addEventListener('sync', event => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  if (event.tag === 'timezone-sync') {
    event.waitUntil(syncTimezoneData());
  }
});

// Sync timezone data when back online
async function syncTimezoneData() {
  try {
    console.log('[SW] Syncing timezone data...');
    const response = await fetch('https://worldtimeapi.org/api/timezone');
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put('https://worldtimeapi.org/api/timezone', response.clone());
      console.log('[SW] Timezone data synced successfully');
      
      // Notify all clients about successful sync
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({
          type: 'TIMEZONE_SYNC_SUCCESS',
          timestamp: Date.now()
        });
      });
    }
  } catch (error) {
    console.error('[SW] Failed to sync timezone data:', error);
  }
}

// Push notifications for timezone alerts
self.addEventListener('push', event => {
  console.log('[SW] Push notification received');
  
  const options = {
    body: event.data ? event.data.text() : 'Timezone alert notification',
    icon: './timezone-icon-192.png',
    badge: './timezone-badge-72.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Open Timezone Converter',
        icon: './timezone-action-icon.png'
      },
      {
        action: 'close',
        title: 'Dismiss',
        icon: './close-icon.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('Timezone Converter Pro', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  console.log('[SW] Notification clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('./timezoneconverter.html')
    );
  }
});

// Message handling for client communication
self.addEventListener('message', event => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({
      type: 'VERSION_INFO',
      version: '1.0.0',
      cacheName: CACHE_NAME
    });
  }
});

// Error handling
self.addEventListener('error', event => {
  console.error('[SW] Service Worker error:', event.error);
});

self.addEventListener('unhandledrejection', event => {
  console.error('[SW] Unhandled promise rejection:', event.reason);
});

console.log('[SW] Timezone Converter Pro Service Worker v1.0.0 loaded successfully');