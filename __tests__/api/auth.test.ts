import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST as registerHandler } from '@/app/api/auth/register/route'
import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
    prisma: {
        user: {
            findUnique: vi.fn(),
            create: vi.fn(),
        },
    },
}))

describe('Auth API', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('should register a new user', async () => {
        const body = {
            email: 'test@example.com',
            password: 'password123',
        }

        // Mock user not existing
        vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
        // Mock user creation
        vi.mocked(prisma.user.create).mockResolvedValue({
            id: '1',
            email: body.email,
            createdAt: new Date(),
        } as any)

        const req = new NextRequest('http://localhost/api/auth/register', {
            method: 'POST',
            body: JSON.stringify(body),
        })

        const res = await registerHandler(req)
        expect(res.status).toBe(201)

        const data = await res.json()
        expect(data.user.email).toBe(body.email)
        expect(data.user).not.toHaveProperty('password')
    })

    it('should return 400 if user already exists', async () => {
        const body = {
            email: 'existing@example.com',
            password: 'password123',
        }

        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            id: '1',
            email: body.email,
        } as any)

        const req = new NextRequest('http://localhost/api/auth/register', {
            method: 'POST',
            body: JSON.stringify(body),
        })

        const res = await registerHandler(req)
        expect(res.status).toBe(400)
    })

    it('should login successfully', async () => {
        const body = {
            email: 'test@example.com',
            password: 'password123',
        }

        // Mock user found
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            id: '1',
            email: body.email,
            password: await import('@/lib/auth').then(m => m.hashPassword(body.password)),
        } as any)

        // Dynamic import to mock request for Login
        const { POST: loginHandler } = await import('@/app/api/auth/login/route')

        const req = new NextRequest('http://localhost/api/auth/login', {
            method: 'POST',
            body: JSON.stringify(body),
        })

        const res = await loginHandler(req)
        expect(res.status).toBe(200)

        const cookies = res.cookies.getAll()
        expect(cookies.find((c: any) => c.name === 'token')).toBeDefined()
    })

    it('should logout successfully', async () => {
        // Dynamic import to mock request for Logout
        const { POST: logoutHandler } = await import('@/app/api/auth/logout/route')

        const req = new NextRequest('http://localhost/api/auth/logout', {
            method: 'POST',
        })

        const res = await logoutHandler(req)
        expect(res.status).toBe(200)

        const cookies = res.cookies.getAll()
        const tokenCookie = cookies.find((c: any) => c.name === 'token')
        expect(tokenCookie).toBeDefined()
        expect(tokenCookie.value).toBe('')
        expect(tokenCookie.maxAge).toBe(0)
    })
})
