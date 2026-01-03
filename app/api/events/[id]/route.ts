import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { generateReminderJobs } from '@/lib/reminder-jobs'
import { z } from 'zod'

const eventUpdateSchema = z.object({
    title: z.string().min(1).optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    time: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable().or(z.literal('')),
    label: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    completed: z.boolean().optional(),
})

export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const token = req.cookies.get('token')?.value
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const payload = await verifyToken(token)
        if (!payload?.userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { id: eventId } = await params
        if (!eventId) {
            return NextResponse.json({ error: 'Event ID is required' }, { status: 400 })
        }

        // Check if event exists and belongs to user
        const existingEvent = await prisma.event.findUnique({
            where: { id: eventId },
        })

        if (!existingEvent) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 })
        }

        if (existingEvent.userId !== payload.userId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await req.json()
        console.log(`[PUT /api/events/${eventId}] Request body:`, body)

        const result = eventUpdateSchema.safeParse(body)
        if (!result.success) {
            console.error(`[PUT /api/events/${eventId}] Validation failed:`, result.error)
            return NextResponse.json({ error: 'Invalid input', details: result.error }, { status: 400 })
        }

        // Prepare update data
        const updateData: any = { ...result.data }

        // If date or time is being updated, we need to recalculate the datetime field
        if (updateData.date || updateData.time !== undefined) {
            const rawDate = updateData.date || existingEvent.date
            const date = rawDate.replace(/\//g, '-')
            updateData.date = date // Ensure it's stored as YYYY-MM-DD

            const time = updateData.time === undefined ? existingEvent.time : updateData.time
            const timeStr = (time && time !== '') ? time : '10:00'
            const datetimeStr = `${date}T${timeStr}:00+08:00`
            const datetime = new Date(datetimeStr)

            if (isNaN(datetime.getTime())) {
                console.error(`[PUT /api/events/${eventId}] Invalid datetime constructed:`, { date, timeStr, datetimeStr })
                return NextResponse.json({ error: 'Invalid date or time format' }, { status: 400 })
            }
            updateData.datetime = datetime
        }

        const updatedEvent = await (prisma.event as any).update({
            where: { id: eventId },
            data: updateData,
        })

        // Regenerate reminder jobs for this event
        try {
            await generateReminderJobs({
                id: updatedEvent.id,
                userId: updatedEvent.userId,
                date: updatedEvent.date,
                time: updatedEvent.time,
                label: updatedEvent.label,
                completed: updatedEvent.completed,
            })
        } catch (jobError) {
            console.error(`[PUT /api/events/${eventId}] Failed to generate reminder jobs:`, jobError)
        }

        return NextResponse.json({ event: updatedEvent }, { status: 200 })
    } catch (error) {
        console.error('Update Event error detail:', error) // Log full error
        return NextResponse.json({
            error: 'Internal server error',
            message: error instanceof Error ? error.message : String(error)
        }, { status: 500 })
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const token = req.cookies.get('token')?.value
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const payload = await verifyToken(token)
        if (!payload?.userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { id: eventId } = await params
        if (!eventId) {
            return NextResponse.json({ error: 'Event ID is required' }, { status: 400 })
        }

        // Check if event exists and belongs to user
        const existingEvent = await prisma.event.findUnique({
            where: { id: eventId },
        })

        if (!existingEvent) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 })
        }

        if (existingEvent.userId !== payload.userId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        await prisma.event.delete({
            where: { id: eventId },
        })

        return NextResponse.json({ success: true }, { status: 200 })
    } catch (error) {
        console.error('Delete Event error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
