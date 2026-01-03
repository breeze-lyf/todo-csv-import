import { prisma } from './prisma'
import { sendPushNotification } from './web-push'
import { getPendingReminderJobs, markJobAsSent } from './reminder-jobs'

/**
 * Scheduler that runs periodically to send pending reminder notifications
 */
export async function runReminderScheduler() {
    console.log('[Scheduler] Running reminder scheduler...')

    try {
        // Get all pending jobs
        const pendingJobs = await getPendingReminderJobs()

        console.log(`[Scheduler] Found ${pendingJobs.length} pending jobs`)

        for (const job of pendingJobs) {
            try {
                // Skip if the event is already marked as completed
                if ((job.event as any).completed) {
                    console.log(`[Scheduler] Event ${job.event.id} for job ${job.id} is already completed. Marking job as sent and skipping notification.`)
                    await markJobAsSent(job.id)
                    continue
                }

                // Get user's push subscriptions
                const subscriptions = await prisma.pushSubscription.findMany({
                    where: {
                        userId: job.userId,
                    },
                })

                if (subscriptions.length === 0) {
                    console.log(`[Scheduler] No subscriptions for user ${job.userId}, marking job as sent`)
                    await markJobAsSent(job.id)
                    continue
                }

                // Prepare notification payload
                const payload = {
                    title: '提醒：事件即将到期',
                    body: `${job.event.title} - ${job.event.date}`,
                    data: {
                        eventId: job.event.id,
                        url: `/calendar?event=${job.event.id}`,
                    },
                }

                // Send to all user's subscriptions
                let sentCount = 0
                for (const subscription of subscriptions) {
                    const result = await sendPushNotification(
                        {
                            endpoint: subscription.endpoint,
                            keys: {
                                p256dh: subscription.p256dh,
                                auth: subscription.auth,
                            },
                        },
                        payload
                    )

                    if (result.success) {
                        sentCount++
                    } else {
                        console.error(`[Scheduler] Failed to send to ${subscription.endpoint}:`, result.error)

                        // If subscription is invalid (410 Gone), delete it
                        if ((result.error as any)?.statusCode === 410) {
                            await prisma.pushSubscription.delete({
                                where: { id: subscription.id },
                            })
                            console.log(`[Scheduler] Deleted invalid subscription ${subscription.id}`)
                        }
                    }
                }

                // Mark job as sent
                await markJobAsSent(job.id)
                console.log(`[Scheduler] Sent notification for job ${job.id} to ${sentCount} subscriptions`)
            } catch (error) {
                console.error(`[Scheduler] Error processing job ${job.id}:`, error)
            }
        }

        console.log('[Scheduler] Scheduler run completed')
        return { processed: pendingJobs.length }
    } catch (error) {
        console.error('[Scheduler] Scheduler error:', error)
        throw error
    }
}
