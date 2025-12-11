import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { generateReminderJobs } from '@/lib/reminder-jobs'
import { z } from 'zod'

const eventSchema = z.object({
    title: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    label: z.string().optional(),
    notes: z.string().optional(),
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

        const events = await prisma.event.findMany({
            where: {
                userId: payload.userId as string,
                date: {
                    startsWith: month,
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

        return NextResponse.json({ events }, { status: 200 })
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

        const event = await prisma.event.create({
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

        return NextResponse.json({ event }, { status: 201 })
    } catch (error) {
        console.error('Create Event error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
