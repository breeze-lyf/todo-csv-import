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
            return NextResponse.json({ error: 'Invalid input', details: result.error }, { status: 400 })
        }

        const { events } = result.data
        const userId = payload.userId as string

        // Prefetch existing events by title for this user
        const titles = Array.from(new Set(events.map(e => e.title)))
        const existingEvents = await prisma.event.findMany({
            where: {
                userId,
                title: { in: titles },
            },
        })
        const existingByTitle = new Map(existingEvents.map(e => [e.title, e]))

        // Create all events
        const createdEvents = []
        const updatedEvents = []
        const errors = []

        for (let i = 0; i < events.length; i++) {
            try {
                const eventData = events[i]
                // Improved normalization: ensure YYYY-MM-DD with padding
                const dateParts = eventData.date.split(/[-/]/)
                const normalizedDate = dateParts.length === 3
                    ? `${dateParts[0]}-${dateParts[1].padStart(2, '0')}-${dateParts[2].padStart(2, '0')}`
                    : eventData.date.replace(/\//g, '-')

                const normalizedTime = eventData.time
                    ? eventData.time.replace(/^(\d):/, '0$1:')
                    : undefined

                // Calculate datetime
                const timeStr = normalizedTime || '10:00'
                const datetimeStr = `${normalizedDate}T${timeStr}:00+08:00`
                const datetime = new Date(datetimeStr)

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

                try {
                    event = existing
                        ? await (prisma.event as any).update({
                            where: { id: existing.id },
                            data: baseData,
                        })
                        : await (prisma.event as any).create({
                            data: { ...baseData, userId },
                        })
                } catch (dbErr: any) {
                    if (dbErr.message && dbErr.message.includes('Unknown argument `completed`')) {
                        const { completed: _, ...fallbackData } = baseData
                        event = existing
                            ? await (prisma.event as any).update({
                                where: { id: existing.id },
                                data: fallbackData,
                            })
                            : await (prisma.event as any).create({
                                data: { ...fallbackData, userId },
                            })
                    } else {
                        throw dbErr
                    }
                }

                // Keep map updated so later duplicates in the same import overwrite the latest
                existingByTitle.set(eventData.title, event)

                // Generate reminder jobs
                try {
                    await generateReminderJobs({
                        id: event.id,
                        userId: event.userId,
                        date: event.date,
                        time: event.time,
                        label: event.label,
                        completed: (event as any).completed,
                    })
                } catch (jobError) {
                    console.error(`[Bulk Create] Failed to generate reminder jobs for event ${event.id}:`, jobError)
                }

                if (existing) {
                    updatedEvents.push(event)
                } else {
                    createdEvents.push(event)
                }
            } catch (error) {
                errors.push({
                    index: i,
                    title: events[i].title,
                    error: error instanceof Error ? error.message : 'Unknown error',
                })
            }
        }

        return NextResponse.json({
            success: true,
            created: createdEvents.length + updatedEvents.length, // 表示成功处理的数量
            updated: updatedEvents.length,
            failed: errors.length,
            errors,
        }, { status: 201 })
    } catch (error) {
        console.error('Bulk Create Events error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
