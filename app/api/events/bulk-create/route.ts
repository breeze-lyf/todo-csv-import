import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { generateReminderJobs } from '@/lib/reminder-jobs'
import { z } from 'zod'

const bulkEventSchema = z.object({
    title: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
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

        // Create all events
        const createdEvents = []
        const errors = []

        for (let i = 0; i < events.length; i++) {
            try {
                const eventData = events[i]

                // Calculate datetime
                const timeStr = eventData.time || '10:00'
                const datetimeStr = `${eventData.date}T${timeStr}:00+08:00`
                const datetime = new Date(datetimeStr)

                const event = await prisma.event.create({
                    data: {
                        userId,
                        title: eventData.title,
                        date: eventData.date,
                        time: eventData.time || null,
                        datetime,
                        label: eventData.label || null,
                        notes: eventData.notes || null,
                    },
                })

                // Generate reminder jobs
                await generateReminderJobs({
                    id: event.id,
                    userId: event.userId,
                    date: event.date,
                    time: event.time,
                    label: event.label,
                })

                createdEvents.push(event)
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
            created: createdEvents.length,
            failed: errors.length,
            errors,
        }, { status: 201 })
    } catch (error) {
        console.error('Bulk Create Events error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
