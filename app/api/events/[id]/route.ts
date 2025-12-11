import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { generateReminderJobs } from '@/lib/reminder-jobs'
import { z } from 'zod'

const eventUpdateSchema = z.object({
    title: z.string().min(1).optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    time: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
    label: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
})

export async function PUT(
    req: NextRequest,
    { params }: { params: { id: string } }
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

        const eventId = params.id

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
        const result = eventUpdateSchema.safeParse(body)

        if (!result.success) {
            return NextResponse.json({ error: 'Invalid input', details: result.error }, { status: 400 })
        }

        const updatedEvent = await prisma.event.update({
            where: { id: eventId },
            data: result.data,
        })

        // Regenerate reminder jobs for this event
        await generateReminderJobs({
            id: updatedEvent.id,
            userId: updatedEvent.userId,
            date: updatedEvent.date,
            time: updatedEvent.time,
            label: updatedEvent.label,
        })

        return NextResponse.json({ event: updatedEvent }, { status: 200 })
    } catch (error) {
        console.error('Update Event error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: { id: string } }
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

        const eventId = params.id

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
