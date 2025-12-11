'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegistration() {
    useEffect(() => {
        if (typeof window === 'undefined') return

        console.log('[SW] Checking Service Worker support...')

        if ('serviceWorker' in navigator) {
            console.log('[SW] Service Worker supported, registering...')

            navigator.serviceWorker
                .register('/sw.js')
                .then((registration) => {
                    console.log('[SW] Service Worker registered successfully:', registration.scope)
                    console.log('[SW] Registration state:', registration.active?.state)
                })
                .catch((error) => {
                    console.error('[SW] Service Worker registration failed:', error)
                })
        } else {
            console.warn('[SW] Service Worker not supported in this browser')
        }
    }, [])

    return null
}
