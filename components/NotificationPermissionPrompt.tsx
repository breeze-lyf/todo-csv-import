'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function NotificationPermissionPrompt() {
    const router = useRouter()

    useEffect(() => {
        // Only run in browser
        if (typeof window === 'undefined') return

        // Check if we should prompt
        const hasPrompted = localStorage.getItem('notification-prompted')
        if (hasPrompted) return

        // Check browser support
        if (!('Notification' in window) || !('serviceWorker' in navigator)) {
            console.log('[Notification] Browser does not support notifications')
            return
        }

        // Check current permission
        if (Notification.permission !== 'default') {
            // Already granted or denied, mark as prompted
            localStorage.setItem('notification-prompted', 'true')
            return
        }

        // Wait a bit for better UX (let user see the calendar first)
        const timer = setTimeout(async () => {
            try {
                console.log('[Notification] Auto-requesting permission after login...')
                const permission = await Notification.requestPermission()
                console.log('[Notification] Permission result:', permission)

                localStorage.setItem('notification-prompted', 'true')

                if (permission === 'granted') {
                    // Subscribe to push
                    await subscribeToPush()
                }
            } catch (error) {
                console.error('[Notification] Auto-request error:', error)
            }
        }, 2000) // Wait 2 seconds after page load

        return () => clearTimeout(timer)
    }, [])

    const subscribeToPush = async () => {
        try {
            const registration = await navigator.serviceWorker.ready
            const keyRes = await fetch('/api/push/vapid-public-key')
            if (!keyRes.ok) return

            const { publicKey } = await keyRes.json()
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: publicKey,
            })

            await fetch('/api/push/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(subscription.toJSON()),
            })

            console.log('[Notification] Auto-subscribed successfully')
        } catch (error) {
            console.error('[Notification] Auto-subscribe error:', error)
        }
    }

    return null
}
