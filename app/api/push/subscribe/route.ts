import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { z } from 'zod'

const subscriptionSchema = z.object({
    endpoint: z.string().url(),
    keys: z.object({
        p256dh: z.string(),
        auth: z.string(),
    }),
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
        const result = subscriptionSchema.safeParse(body)

        if (!result.success) {
            return NextResponse.json({ error: 'Invalid input', details: result.error }, { status: 400 })
        }

        const { endpoint, keys } = result.data

        // Check if subscription already exists
        const existingSubscription = await prisma.pushSubscription.findFirst({
            where: {
                userId: payload.userId as string,
                endpoint,
            },
        })

        if (existingSubscription) {
            return NextResponse.json({ subscription: existingSubscription }, { status: 200 })
        }

        // Create new subscription
        const subscription = await prisma.pushSubscription.create({
            data: {
                userId: payload.userId as string,
                endpoint,
                p256dh: keys.p256dh,
                auth: keys.auth,
            },
        })

        return NextResponse.json({ subscription }, { status: 201 })
    } catch (error) {
        console.error('Subscribe Push error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

export async function DELETE(req: NextRequest) {
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
        const endpoint = searchParams.get('endpoint')

        if (!endpoint) {
            return NextResponse.json({ error: 'Endpoint required' }, { status: 400 })
        }

        await prisma.pushSubscription.deleteMany({
            where: {
                userId: payload.userId as string,
                endpoint,
            },
        })

        return NextResponse.json({ success: true }, { status: 200 })
    } catch (error) {
        console.error('Unsubscribe Push error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
