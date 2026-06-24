const CACHE_NAME = 'bmdc-v2.0';
const RUNTIME_CACHE = 'bmdc-runtime-v2.0';
const IMAGE_CACHE = 'bmdc-images-v2.0';

const urlsToCache = [
  '/',
  '/index.html',
  '/offline',
  '/dashboard',
  '/trainees',
  '/items',
  '/lendings',
  '/programs',
  '/reports',
  '/settings',
];

// Install event - cache essential resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache).catch((error) => {
          console.error('Failed to cache some resources:', error);
          // Continue even if some resources fail to cache
        });
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  const currentCaches = [CACHE_NAME, RUNTIME_CACHE, IMAGE_CACHE];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!currentCaches.includes(cacheName)) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - Network First strategy with cache fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }

  // Handle API requests - Network First
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone and cache successful responses
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback to cache if network fails
          return caches.match(request);
        })
    );
    return;
  }

  // Handle images - Cache First
  if (request.destination === 'image') {
    event.respondWith(
      caches.open(IMAGE_CACHE).then((cache) => {
        return cache.match(request).then((response) => {
          return response || fetch(request).then((fetchResponse) => {
            cache.put(request, fetchResponse.clone());
            return fetchResponse;
          });
        });
      })
    );
    return;
  }

  // Handle navigation requests - Network First with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful navigation responses
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // Try cache first
          return caches.match(request).then((response) => {
            // If not in cache, show offline page
            return response || caches.match('/offline');
          });
        })
    );
    return;
  }

  // Default: Cache First with Network Fallback
  event.respondWith(
    caches.match(request)
      .then((response) => {
        if (response) {
          return response;
        }

        return fetch(request).then((response) => {
          // Check if we received a valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone the response
          const responseToCache = response.clone();

          caches.open(RUNTIME_CACHE)
            .then((cache) => {
              cache.put(request, responseToCache);
            });

          return response;
        }).catch(() => {
          // If both cache and network fail, show offline page for navigation
          if (request.mode === 'navigate') {
            return caches.match('/offline');
          }
          return new Response('Network error happened', {
            status: 408,
            headers: { 'Content-Type': 'text/plain' },
          });
        });
      })
  );
});

// Background sync for offline data
self.addEventListener('sync', (event) => {
  console.log('Background sync event:', event.tag);
  
  if (event.tag === 'sync-trainees') {
    event.waitUntil(syncTrainees());
  } else if (event.tag === 'sync-items') {
    event.waitUntil(syncItems());
  } else if (event.tag === 'sync-data') {
    event.waitUntil(syncData());
  } else if (event.tag === 'sync-lendings') {
    event.waitUntil(syncLendings());
  }
});

async function syncData() {
  console.log('Syncing all pending data...');
  try {
    // Get all pending sync items from IndexedDB
    const db = await openDB();
    const tx = db.transaction(['pendingSync'], 'readonly');
    const store = tx.objectStore('pendingSync');
    const allPending = await store.getAll();

    // Sync each pending item
    for (const item of allPending) {
      try {
        const response = await fetch(item.url, {
          method: item.method,
          headers: item.headers,
          body: item.body,
        });

        if (response.ok) {
          // Remove from pending sync
          const deleteTx = db.transaction(['pendingSync'], 'readwrite');
          const deleteStore = deleteTx.objectStore('pendingSync');
          await deleteStore.delete(item.id);
        }
      } catch (error) {
        console.error('Failed to sync item:', error);
      }
    }
  } catch (error) {
    console.error('Sync data error:', error);
  }
}

async function syncTrainees() {
  console.log('Syncing trainees...');
  // Implement trainee-specific sync logic
}

async function syncItems() {
  console.log('Syncing items...');
  // Implement item-specific sync logic
}

async function syncLendings() {
  console.log('Syncing lendings...');
  // Implement lending-specific sync logic
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('BMDC_DB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pendingSync')) {
        db.createObjectStore('pendingSync', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

// Push notifications
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'BMDC Notification';
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [200, 100, 200],
    data: data.data || {},
    actions: [
      {
        action: 'open',
        title: 'Open',
        icon: '/icons/open.png',
      },
      {
        action: 'close',
        title: 'Dismiss',
        icon: '/icons/close.png',
      },
    ],
    tag: data.tag || 'default',
    requireInteraction: data.requireInteraction || false,
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const urlToOpen = event.notification.data.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Check if there's already a window open
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        // If not, open a new window
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Message event - for communication from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(RUNTIME_CACHE).then((cache) => {
        return cache.addAll(event.data.urls);
      })
    );
  }
});

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-data') {
    event.waitUntil(updateData());
  }
});

async function updateData() {
  console.log('Periodic sync: Updating data...');
  // Implement periodic data update logic
}
