import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

export async function GET(req: NextRequest) {
    try {
        const token = req.cookies.get('token')?.value
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const payload = await verifyToken(token)
        if (!payload?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const user = await prisma.user.findUnique({
            where: { id: payload.userId as string },
            select: { hideCompletedReminders: true }
        })

        return NextResponse.json(user)
    } catch (error) {
        console.error('[Settings GET] Error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

export async function PUT(req: NextRequest) {
    try {
        const token = req.cookies.get('token')?.value
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const payload = await verifyToken(token)
        if (!payload?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { hideCompletedReminders } = await req.json()

        // Use any cast to bypass temporary client sync issues
        const user = await (prisma.user as any).update({
            where: { id: payload.userId as string },
            data: { hideCompletedReminders }
        })

        return NextResponse.json({ success: true, hideCompletedReminders: user.hideCompletedReminders })
    } catch (error: any) {
        console.error('[Settings PUT] Error:', error)
        return NextResponse.json({
            error: 'Internal server error',
            message: error.message
        }, { status: 500 })
    }
}
