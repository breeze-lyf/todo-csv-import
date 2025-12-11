import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { z } from 'zod'

const reminderRuleSchema = z.object({
    label: z.string().min(1),
    offsetsInDays: z.array(z.number().int().nonnegative()),
    defaultTime: z.string().regex(/^\d{2}:\d{2}$/),
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

        const rules = await prisma.reminderRule.findMany({
            where: {
                userId: payload.userId as string,
            },
            orderBy: {
                createdAt: 'desc',
            },
        })

        return NextResponse.json({ rules }, { status: 200 })
    } catch (error) {
        console.error('Get Reminder Rules error:', error)
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
        const result = reminderRuleSchema.safeParse(body)

        if (!result.success) {
            return NextResponse.json({ error: 'Invalid input', details: result.error }, { status: 400 })
        }

        const { label, offsetsInDays, defaultTime } = result.data

        // Check if rule already exists for this label
        const existingRule = await prisma.reminderRule.findFirst({
            where: {
                userId: payload.userId as string,
                label,
            },
        })

        if (existingRule) {
            return NextResponse.json({ error: 'Rule already exists for this label' }, { status: 400 })
        }

        const rule = await prisma.reminderRule.create({
            data: {
                userId: payload.userId as string,
                label,
                offsetsInDays,
                defaultTime,
            },
        })

        return NextResponse.json({ rule }, { status: 201 })
    } catch (error) {
        console.error('Create Reminder Rule error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
