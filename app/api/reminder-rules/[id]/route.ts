import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { z } from 'zod'

const reminderRuleUpdateSchema = z.object({
    label: z.string().min(1).optional(),
    offsetsInDays: z.array(z.number().int().nonnegative()).optional(),
    defaultTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    avoidWeekends: z.boolean().optional(),
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

        const { id: ruleId } = await params
        if (!ruleId) {
            return NextResponse.json({ error: 'Rule ID is required' }, { status: 400 })
        }

        // Check if rule exists and belongs to user
        const existingRule = await prisma.reminderRule.findUnique({
            where: { id: ruleId },
        })

        if (!existingRule) {
            return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
        }

        if (existingRule.userId !== payload.userId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await req.json()
        const result = reminderRuleUpdateSchema.safeParse(body)

        if (!result.success) {
            return NextResponse.json({ error: 'Invalid input', details: result.error }, { status: 400 })
        }

        const updatedRule = await prisma.reminderRule.update({
            where: { id: ruleId },
            data: result.data,
        })

        // Sync events with the affected label(s)
        const { generateReminderJobs } = await import('@/lib/reminder-jobs')

        // If label changed, sync both old and new labels
        const labelsToSync = [existingRule.label]
        if (result.data.label && result.data.label !== existingRule.label) {
            labelsToSync.push(result.data.label)
        }

        const events = await prisma.event.findMany({
            where: {
                userId: payload.userId as string,
                label: { in: labelsToSync },
            },
        })

        for (const event of events) {
            await generateReminderJobs({
                id: event.id,
                userId: event.userId,
                date: event.date,
                time: event.time,
                label: event.label,
            })
        }

        return NextResponse.json({ rule: updatedRule }, { status: 200 })
    } catch (error) {
        console.error('Update Reminder Rule error:', error)
        return NextResponse.json({
            error: 'Internal server error',
            details: error instanceof Error ? error.message : String(error)
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

        const { id: ruleId } = await params
        if (!ruleId) {
            return NextResponse.json({ error: 'Rule ID is required' }, { status: 400 })
        }

        // Check if rule exists and belongs to user
        const existingRule = await prisma.reminderRule.findUnique({
            where: { id: ruleId },
        })

        if (!existingRule) {
            return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
        }

        if (existingRule.userId !== payload.userId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const labelToSync = existingRule.label

        await prisma.reminderRule.delete({
            where: { id: ruleId },
        })

        // After deleting, existing events with this label will fall back to default rules
        const { generateReminderJobs } = await import('@/lib/reminder-jobs')
        const events = await prisma.event.findMany({
            where: {
                userId: payload.userId as string,
                label: labelToSync,
            },
        })

        for (const event of events) {
            await generateReminderJobs({
                id: event.id,
                userId: event.userId,
                date: event.date,
                time: event.time,
                label: event.label,
            })
        }

        return NextResponse.json({ success: true }, { status: 200 })
    } catch (error) {
        console.error('Delete Reminder Rule error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
