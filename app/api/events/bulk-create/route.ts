import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { generateReminderJobs } from '@/lib/reminder-jobs'
import { z } from 'zod'

const bulkEventSchema = z.object({
    title: z.string().min(1),
    date: z.string().regex(/^\d{4}[-/]\d{2}[-/]\d{2}$/),
    time: z.string().regex(/^\d{1,2}:\d{2}$/).optional(),
    label: z.string().optional(),
    notes: z.string().optional(),
})

const bulkCreateSchema = z.object({
    events: z.array(bulkEventSchema),
})

export async function POST(req: NextRequest) {
    try {
        console.log('[Bulk Create] Starting bulk event creation...')
        const token = req.cookies.get('token')?.value
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const payload = await verifyToken(token)
        if (!payload?.userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await req.json()
        const result = bulkCreateSchema.safeParse(body)

        if (!result.success) {
            console.warn('[Bulk Create] Validation failed:', result.error)
            return NextResponse.json({ error: 'Invalid input', details: result.error }, { status: 400 })
        }

        const { events } = result.data
        const userId = payload.userId as string
        console.log(`[Bulk Create] User ${userId} is importing ${events.length} events`)

        // Prefetch existing events by title for this user to avoid N+1 and handle updates
        const titles = Array.from(new Set(events.map(e => e.title)))
        let existingEvents: any[] = []
        try {
            existingEvents = await prisma.event.findMany({
                where: {
                    userId,
                    title: { in: titles },
                },
            })
        } catch (fetchErr) {
            console.error('[Bulk Create] Error prefetching events:', fetchErr)
            // Continue with empty existingEvents, treating all as new if prefetch fails
        }

        const existingByTitle = new Map(existingEvents.map(e => [e.title, e]))

        // Prefetch reminder rules for these labels
        const uniqueLabels = Array.from(new Set(events.map(e => e.label).filter(Boolean))) as string[]
        let existingRules: any[] = []
        try {
            existingRules = await prisma.reminderRule.findMany({
                where: { userId, label: { in: uniqueLabels } }
            })
        } catch (ruleErr) {
            console.error('[Bulk Create] Error prefetching rules:', ruleErr)
        }
        const knownLabels = new Set(existingRules.map(r => r.label))

        const createdEvents = []
        const updatedEvents = []
        const errors = []

        for (let i = 0; i < events.length; i++) {
            const eventData = events[i]
            try {
                // Improved normalization: ensure YYYY-MM-DD with padding
                const dateParts = eventData.date.split(/[-/]/)
                if (dateParts.length !== 3) {
                    throw new Error(`Invalid date format: ${eventData.date}`)
                }
                const normalizedDate = `${dateParts[0]}-${dateParts[1].padStart(2, '0')}-${dateParts[2].padStart(2, '0')}`

                const normalizedTime = eventData.time
                    ? eventData.time.replace(/^(\d):/, '0$1:')
                    : undefined

                // Calculate datetime
                const timeStr = normalizedTime || '10:00'
                const datetimeStr = `${normalizedDate}T${timeStr}:00+08:00`
                const datetime = new Date(datetimeStr)

                if (isNaN(datetime.getTime())) {
                    throw new Error(`Invalid datetime generated: ${datetimeStr}`)
                }

                const existing = existingByTitle.get(eventData.title)

                let event: any
                const baseData: any = {
                    title: eventData.title,
                    date: normalizedDate,
                    time: normalizedTime || null,
                    datetime,
                    label: eventData.label || null,
                    notes: eventData.notes || null,
                    completed: false,
                }

                // Resilient DB operation with fallback for Prisma sync issues
                try {
                    const eventDelegate = prisma.event as any
                    if (existing) {
                        event = await eventDelegate.update({
                            where: { id: existing.id },
                            data: baseData,
                        })
                    } else {
                        event = await eventDelegate.create({
                            data: { ...baseData, userId },
                        })
                    }
                } catch (dbErr: any) {
                    const errMsg = dbErr.message || ''
                    if (errMsg.includes('Unknown argument `completed`')) {
                        console.warn('[Bulk Create] Falling back due to "completed" field mismatch')
                        const { completed: _, ...fallbackData } = baseData
                        const eventDelegate = prisma.event as any
                        event = existing
                            ? await eventDelegate.update({
                                where: { id: existing.id },
                                data: fallbackData,
                            })
                            : await eventDelegate.create({
                                data: { ...fallbackData, userId },
                            })
                    } else {
                        throw dbErr
                    }
                }

                // Auto-create Reminder Rule if label is new
                if (eventData.label && !knownLabels.has(eventData.label)) {
                    try {
                        const ruleDelegate = (prisma as any).reminderRule
                        await ruleDelegate.create({
                            data: {
                                userId,
                                label: eventData.label,
                                offsetsInDays: [],
                                defaultTime: '10:00',
                                avoidWeekends: false,
                            }
                        })
                        knownLabels.add(eventData.label)
                    } catch (ruleErr: any) {
                        // Ignore unique constraint errors (label might have been created in a parallel execution)
                        if (!ruleErr.message?.includes('Unique constraint')) {
                            console.error(`[Bulk Create] Rule creation failed for ${eventData.label}:`, ruleErr)
                        }
                        knownLabels.add(eventData.label)
                    }
                }

                // Generate reminder jobs
                try {
                    await generateReminderJobs({
                        id: event.id,
                        userId: event.userId,
                        date: event.date,
                        time: event.time,
                        label: event.label,
                        completed: !!(event as any).completed,
                    })
                } catch (jobError) {
                    console.error(`[Bulk Create] Job generation failed for event ${event.id}:`, jobError)
                }

                if (existing) {
                    updatedEvents.push(event)
                } else {
                    createdEvents.push(event)
                }
            } catch (error: any) {
                console.error(`[Bulk Create] Error at index ${i} (${events[i].title}):`, error)
                errors.push({
                    index: i,
                    title: events[i].title,
                    error: error instanceof Error ? error.message : 'Unknown error',
                })
            }
        }

        console.log(`[Bulk Create] Completed. Success: ${createdEvents.length + updatedEvents.length}, Failed: ${errors.length}`)
        return NextResponse.json({
            success: true,
            created: createdEvents.length + updatedEvents.length,
            updated: updatedEvents.length,
            failed: errors.length,
            errors,
        }, { status: 201 })
    } catch (error: any) {
        console.error('[Bulk Create] Fatal error:', error)
        return NextResponse.json({
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown fatal error'
        }, { status: 500 })
    }
}
