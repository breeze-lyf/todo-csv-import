import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET as getEventsHandler } from '@/app/api/events/route'
import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'
import { verifyToken } from '@/lib/auth'

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
    prisma: {
        event: {
            findMany: vi.fn(),
        },
    },
}))

// Mock Auth
vi.mock('@/lib/auth', () => ({
    verifyToken: vi.fn(),
}))

describe('Events API', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('should return 401 if unauthenticated', async () => {
        vi.mocked(verifyToken).mockResolvedValue(null)

        const req = new NextRequest('http://localhost/api/events?month=2025-06')
        // Mock cookies
        req.cookies.set('token', 'invalid')

        const res = await getEventsHandler(req)
        expect(res.status).toBe(401)
    })

    it('should return events for the specified month', async () => {
        vi.mocked(verifyToken).mockResolvedValue({ userId: 'user1' })

        // Mock database response
        const mockEvents = [
            { id: '1', title: 'Event 1', date: '2025-06-01' },
            { id: '2', title: 'Event 2', date: '2025-06-15' },
        ]
        vi.mocked(prisma.event.findMany).mockResolvedValue(mockEvents as any)

        const req = new NextRequest('http://localhost/api/events?month=2025-06')
        req.cookies.set('token', 'valid_token')

        const res = await getEventsHandler(req)
        expect(res.status).toBe(200)

        const data = await res.json()
        expect(data.events).toHaveLength(2)
        expect(prisma.event.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: {
                userId: 'user1',
                date: {
                    startsWith: '2025-06',
                },
            },
            orderBy: { date: 'asc' },
        }))
    })

    it('should require month parameter', async () => {
        vi.mocked(verifyToken).mockResolvedValue({ userId: 'user1' })

        const req = new NextRequest('http://localhost/api/events') // No month param
        req.cookies.set('token', 'valid_token')

        const res = await getEventsHandler(req)
        expect(res.status).toBe(400)
    })
})
