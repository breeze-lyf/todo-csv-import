import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { generateReminderJobs } from '@/lib/reminder-jobs'
import { z } from 'zod'

const eventSchema = z.object({
    title: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable().or(z.literal('')),
    label: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
})

export async function GET(req: NextRequest) {
    try {
        const token = req.cookies.get('token')?.value
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const payload = await verifyToken(token)
        if (!payload?.userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(req.url)
        const month = searchParams.get('month') // YYYY-MM

        if (!month || !/^\d{4}-\d{2}$/.test(month)) {
            return NextResponse.json({ error: 'Invalid month format (YYYY-MM)' }, { status: 400 })
        }

        // Get all reminder rules for this user
        const reminderRules = await prisma.reminderRule.findMany({
            where: {
                userId: payload.userId as string,
            },
        })

        // Create a map of label -> offsets and avoidWeekends
        const labelSettings = new Map<string, { offsets: number[], avoidWeekends: boolean }>()
        for (const rule of reminderRules) {
            labelSettings.set(rule.label, {
                offsets: rule.offsetsInDays,
                avoidWeekends: rule.avoidWeekends
            })
        }

        // To support reminders landing in the requested month from events in future months,
        // we fetch events starting from this month up to several months ahead.
        // Usually 3 months (90 days) is plenty for "early reminders".
        const events = await prisma.event.findMany({
            where: {
                userId: payload.userId as string,
                date: {
                    gte: `${month}-01`, // From the start of the current month
                },
            },
            orderBy: {
                date: 'asc',
            },
            select: {
                id: true,
                title: true,
                date: true,
                time: true,
                label: true,
                notes: true,
            },
        })

        // Expand events to include reminder dates
        const expandedEvents = []

        for (const event of events) {
            // Add the original event ONLY if it's in the requested month
            if (event.date.startsWith(month)) {
                expandedEvents.push({
                    ...event,
                    isReminder: false,
                    reminderDaysOffset: null,
                    originalEventId: event.id,
                    displayDate: event.date,
                })
            }

            // Add reminder instances
            if (event.label && labelSettings.has(event.label)) {
                const { offsets, avoidWeekends } = labelSettings.get(event.label)!
                const eventDate = new Date(event.date + 'T00:00:00')

                for (const offset of offsets) {
                    const reminderDate = new Date(eventDate)
                    reminderDate.setDate(reminderDate.getDate() - offset)

                    // Adjust to Friday if it lands on a weekend and avoidWeekends is on
                    if (avoidWeekends) {
                        const dayOfWeek = reminderDate.getDay()
                        if (dayOfWeek === 0) { // Sunday
                            reminderDate.setDate(reminderDate.getDate() - 2)
                        } else if (dayOfWeek === 6) { // Saturday
                            reminderDate.setDate(reminderDate.getDate() - 1)
                        }
                    }

                    const reminderDateStr = reminderDate.toISOString().split('T')[0]

                    // INCLUDE this virtual reminder event IF its calculated date is in the requested month
                    if (reminderDateStr.startsWith(month)) {
                        expandedEvents.push({
                            ...event,
                            id: `${event.id}-reminder-${offset}`,
                            isReminder: true,
                            reminderDaysOffset: offset,
                            originalEventId: event.id,
                            displayDate: reminderDateStr,
                        })
                    }
                }
            }
        }

        return NextResponse.json({ events: expandedEvents }, { status: 200 })
    } catch (error) {
        console.error('Get Events error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

export async function POST(req: NextRequest) {
    try {
        const token = req.cookies.get('token')?.value
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const payload = await verifyToken(token)
        if (!payload?.userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await req.json()
        const result = eventSchema.safeParse(body)

        if (!result.success) {
            return NextResponse.json({ error: 'Invalid input', details: result.error }, { status: 400 })
        }

        const { title, date, time, label, notes } = result.data

        // Calculate datetime from date and time
        const timeStr = time || '10:00' // Default to 10:00 if no time specified
        const datetimeStr = `${date}T${timeStr}:00+08:00` // Asia/Shanghai timezone
        const datetime = new Date(datetimeStr)

        const existing = await prisma.event.findFirst({
            where: { userId: payload.userId as string, title },
        })

        const event = existing
            ? await prisma.event.update({
                where: { id: existing.id },
                data: {
                    title,
                    date,
                    time: time || null,
                    datetime,
                    label: label || null,
                    notes: notes || null,
                },
            })
            : await prisma.event.create({
                data: {
                    userId: payload.userId as string,
                    title,
                    date,
                    time: time || null,
                    datetime,
                    label: label || null,
                    notes: notes || null,
                },
            })

        // Generate reminder jobs for this event
        await generateReminderJobs({
            id: event.id,
            userId: event.userId,
            date: event.date,
            time: event.time,
            label: event.label,
        })

        return NextResponse.json({ event, replaced: Boolean(existing) }, { status: existing ? 200 : 201 })
    } catch (error) {
        console.error('Create Event error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
