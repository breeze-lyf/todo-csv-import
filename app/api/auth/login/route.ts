import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPassword, signToken } from '@/lib/auth'
import { z } from 'zod'

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string(),
})

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const result = loginSchema.safeParse(body)

        if (!result.success) {
            return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
        }

        const { email, password } = result.data

        const user = await prisma.user.findUnique({
            where: { email },
        })

        if (!user) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
        }

        const isValid = await verifyPassword(password, user.password)
        if (!isValid) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
        }

        // Sign Token
        const token = await signToken({ userId: user.id, email: user.email })

        // Create response and set cookie
        const response = NextResponse.json({ success: true, user: { id: user.id, email: user.email } }, { status: 200 })

        // Note: In Next.js App Router, cookies().set() is for Server Actions/Components. 
        // In Route Handlers, use response.cookies.set()
        response.cookies.set('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24, // 1 day
        })

        return response
    } catch (error) {
        console.error('Login error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
