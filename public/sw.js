// Service Worker for Web Push Notifications
self.addEventListener('install', (event) => {
    console.log('[SW] Service Worker installing...')
    self.skipWaiting()
})

self.addEventListener('activate', (event) => {
    console.log('[SW] Service Worker activating...')
    event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
    console.log('[SW] Push notification received:', event)

    let data = {
        title: 'Reminder',
        body: 'You have a reminder',
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        data: {}
    }

    if (event.data) {
        try {
            const payload = event.data.json()
            data = {
                title: payload.title || data.title,
                body: payload.body || data.body,
                icon: payload.icon || data.icon,
                badge: payload.badge || data.badge,
                data: payload.data || data.data,
            }
        } catch (e) {
            console.error('[SW] Failed to parse push data:', e)
        }
    }

    const promiseChain = self.registration.showNotification(data.title, {
        body: data.body,
        icon: data.icon,
        badge: data.badge,
        data: data.data,
        vibrate: [200, 100, 200],
        tag: 'reminder-notification',
        requireInteraction: true,
    })

    event.waitUntil(promiseChain)
})

self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification clicked:', event)

    event.notification.close()

    const urlToOpen = event.notification.data?.url || '/calendar'

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // Check if there's already a window open
                for (const client of clientList) {
                    if (client.url.includes(urlToOpen) && 'focus' in client) {
                        return client.focus()
                    }
                }
                // If not, open a new window
                if (self.clients.openWindow) {
                    return self.clients.openWindow(urlToOpen)
                }
            })
    )
})

self.addEventListener('notificationclose', (event) => {
    console.log('[SW] Notification closed:', event)
})
