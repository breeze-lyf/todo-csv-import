import { prisma } from './prisma'

interface Event {
    id: string
    userId: string
    date: string // YYYY-MM-DD
    time?: string | null // HH:mm
    label?: string | null
    completed?: boolean
}

/**
 * Generate ReminderJobs for an event based on its label's reminder rule
 * If no rule exists for the label, use default rule (1 day before, 10:00)
 */
export async function generateReminderJobs(event: Event) {
    // Delete existing jobs for this event
    await prisma.reminderJob.deleteMany({
        where: { eventId: event.id },
    })

    // If event is completed, don't generate new jobs
    if (event.completed) {
        return 0
    }

    // If event is completed, don't generate new jobs
    if (event.completed) {
        return 0
    }

    // Find reminder rule for this label
    let rule = null
    if (event.label) {
        rule = await prisma.reminderRule.findFirst({
            where: {
                userId: event.userId,
                label: event.label,
            },
        })
    }

    // Use default rule if no custom rule found
    const offsetsInDays = rule?.offsetsInDays || [1]
    const defaultTime = rule?.defaultTime || '10:00'
    const avoidWeekends = rule?.avoidWeekends || false
    const eventTime = event.time || defaultTime

    // Parse event date
    const eventDate = new Date(`${event.date}T${eventTime}:00+08:00`)

    // Generate jobs for each offset
    const jobs = offsetsInDays.map((offset) => {
        const fireTime = new Date(eventDate)
        fireTime.setDate(fireTime.getDate() - offset)

        // Adjust to Friday if it lands on a weekend and avoidWeekends is on
        if (avoidWeekends) {
            const dayOfWeek = fireTime.getDay() // 0 is Sunday, 6 is Saturday
            if (dayOfWeek === 0) { // Sunday
                fireTime.setDate(fireTime.getDate() - 2) // Move to Friday
            } else if (dayOfWeek === 6) { // Saturday
                fireTime.setDate(fireTime.getDate() - 1) // Move to Friday
            }
        }

        return {
            userId: event.userId,
            eventId: event.id,
            fireTime,
            sent: false,
        }
    })

    // Create all jobs
    if (jobs.length > 0) {
        await prisma.reminderJob.createMany({
            data: jobs,
        })
    }

    return jobs.length
}

/**
 * Get pending reminder jobs (not sent and fireTime <= now)
 */
export async function getPendingReminderJobs() {
    return prisma.reminderJob.findMany({
        where: {
            sent: false,
            fireTime: {
                lte: new Date(),
            },
        },
        include: {
            event: true,
            user: {
                select: {
                    id: true,
                    email: true,
                },
            },
        },
        orderBy: {
            fireTime: 'asc',
        },
    })
}

/**
 * Mark a reminder job as sent
 */
export async function markJobAsSent(jobId: string) {
    return prisma.reminderJob.update({
        where: { id: jobId },
        data: { sent: true },
    })
}
