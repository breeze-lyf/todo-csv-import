import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { z } from 'zod'

const reminderRuleUpdateSchema = z.object({
    label: z.string().min(1).optional(),
    offsetsInDays: z.array(z.number().int().nonnegative()).optional(),
    defaultTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
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

        const ruleId = params.id

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

        return NextResponse.json({ rule: updatedRule }, { status: 200 })
    } catch (error) {
        console.error('Update Reminder Rule error:', error)
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

        const ruleId = params.id

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

        await prisma.reminderRule.delete({
            where: { id: ruleId },
        })

        return NextResponse.json({ success: true }, { status: 200 })
    } catch (error) {
        console.error('Delete Reminder Rule error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
