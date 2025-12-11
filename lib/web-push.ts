import webpush from 'web-push'

// Initialize VAPID keys (these should be stored in environment variables)
// Generate keys using: npx web-push generate-vapid-keys
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || ''
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com'

if (vapidPublicKey && vapidPrivateKey) {
    webpush.setVapidDetails(
        vapidSubject,
        vapidPublicKey,
        vapidPrivateKey
    )
}

export interface PushSubscriptionData {
    endpoint: string
    keys: {
        p256dh: string
        auth: string
    }
}

/**
 * Send a push notification to a subscription
 */
export async function sendPushNotification(
    subscription: PushSubscriptionData,
    payload: {
        title: string
        body: string
        data?: any
    }
) {
    try {
        await webpush.sendNotification(
            subscription as any,
            JSON.stringify(payload)
        )
        return { success: true }
    } catch (error) {
        console.error('Push notification error:', error)
        return { success: false, error }
    }
}

/**
 * Get VAPID public key for client-side subscription
 */
export function getVapidPublicKey() {
    return vapidPublicKey
}
