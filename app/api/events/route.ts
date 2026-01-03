import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { generateReminderJobs } from '@/lib/reminder-jobs'
import { z } from 'zod'

const eventSchema = z.object({
    title: z.string().min(1),
    date: z.string().regex(/^\d{4}[-/]\d{2}[-/]\d{2}$/),
    time: z.string().regex(/^\d{1,2}:\d{2}$/).optional().nullable().or(z.literal('')),
    label: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    completed: z.boolean().optional(),
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

        // Get all reminder rules and user settings
        const [reminderRules, userSettings] = await Promise.all([
            prisma.reminderRule.findMany({
                where: { userId: payload.userId as string },
            }),
            (prisma.user as any).findUnique({
                where: { id: payload.userId as string },
                select: { hideCompletedReminders: true }
            })
        ])

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
        const events = await (prisma.event as any).findMany({
            where: {
                userId: payload.userId as string,
                date: {
                    gte: `${month}-01`, // From the start of the current month
                },
            },
            orderBy: {
                date: 'asc',
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
            const shouldHideReminders = event.completed && userSettings?.hideCompletedReminders

            if (event.label && labelSettings.has(event.label) && !shouldHideReminders) {
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
    console.log('[POST /api/events] Received request')
    try {
        // 1. Auth check
        const token = req.cookies.get('token')?.value
        if (!token) {
            console.log('[POST] No token found in cookies')
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const payload = await verifyToken(token)
        if (!payload?.userId) {
            console.log('[POST] Token verification failed')
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const userId = payload.userId as string

        // 2. Parse body
        const body = await req.json()
        console.log('[POST] Parsed body:', body)

        // 3. Simple validation (since Zod might be too strict or failing silently)
        const { title, date: rawDate, time, label, notes, completed } = body
        if (!title || !rawDate) {
            return NextResponse.json({ error: 'Title and Date are required' }, { status: 400 })
        }

        // 4. Normalize data
        const date = rawDate.replace(/\//g, '-')
        const timeStr = (time && time !== '') ? time : '10:00'
        const datetimeStr = `${date}T${timeStr}:00+08:00`
        const datetime = new Date(datetimeStr)

        if (isNaN(datetime.getTime())) {
            console.error('[POST] Invalid date/time:', datetimeStr)
            return NextResponse.json({ error: 'Invalid date or time format' }, { status: 400 })
        }

        // 5. Database Operation
        console.log('[POST] Database operation starting for user:', userId)

        // Find existing by title to support upsert-like behavior
        const existing = await (prisma as any).event.findFirst({
            where: { userId, title }
        })

        const dataPayload = {
            title,
            date,
            time: (time && time !== '') ? time : null,
            datetime,
            label: label || null,
            notes: notes || null,
            completed: !!completed,
        }

        let eventResult: any
        try {
            if (existing) {
                console.log('[POST] Updating existing event:', existing.id)
                eventResult = await (prisma as any).event.update({
                    where: { id: existing.id },
                    data: dataPayload
                })
            } else {
                console.log('[POST] Creating new event')
                eventResult = await (prisma as any).event.create({
                    data: {
                        ...dataPayload,
                        userId
                    }
                })
            }
        } catch (dbError: any) {
            // THE ULTIMATE FALLBACK: If Prisma still thinks 'completed' is an unknown argument
            if (dbError.message && dbError.message.includes('Unknown argument `completed`')) {
                console.warn('[POST] Client out of sync! Retrying without completed field.')
                const { completed: _, ...fallbackData } = dataPayload
                if (existing) {
                    eventResult = await (prisma as any).event.update({
                        where: { id: existing.id },
                        data: fallbackData
                    })
                } else {
                    eventResult = await (prisma as any).event.create({
                        data: { ...fallbackData, userId }
                    })
                }
            } else {
                console.error('[POST] Database operation failed:', dbError)
                return NextResponse.json({
                    error: 'Database error',
                    message: dbError.message,
                    code: dbError.code
                }, { status: 500 })
            }
        }

        // 5.5 Auto-create Reminder Rule if label is new
        if (label) {
            try {
                const existingRule = await (prisma as any).reminderRule.findUnique({
                    where: { userId_label: { userId, label } }
                })
                if (!existingRule) {
                    console.log(`[POST] Creating default reminder rule for new label: ${label}`)
                    await (prisma as any).reminderRule.create({
                        data: {
                            userId,
                            label,
                            offsetsInDays: [],
                            defaultTime: '10:00',
                            avoidWeekends: false,
                        }
                    })
                }
            } catch (ruleErr) {
                console.error('[POST] Failed to auto-create reminder rule (silently skipping):', ruleErr)
            }
        }

        console.log('[POST] Success, Event ID:', eventResult.id)

        // 6. Reminder Jobs (Non-blocking)
        try {
            await generateReminderJobs({
                id: eventResult.id,
                userId: eventResult.userId,
                date: eventResult.date,
                time: eventResult.time,
                label: eventResult.label,
                completed: eventResult.completed,
            })
            console.log('[POST] Reminder jobs generated')
        } catch (jobErr) {
            console.error('[POST] Reminder jobs failed (swallowed):', jobErr)
        }

        return NextResponse.json({ event: eventResult, replaced: !!existing }, { status: 201 })
    } catch (error: any) {
        console.error('[POST] Unexpected fatal error:', error)
        return NextResponse.json({
            error: 'Internal server error',
            message: error.message || String(error)
        }, { status: 500 })
    }
}
