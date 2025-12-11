import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST as bulkCreate } from '@/app/api/events/bulk-create/route'
import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { generateReminderJobs } from '@/lib/reminder-jobs'

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
    prisma: {
        event: {
            create: vi.fn(),
        },
    },
}))

// Mock Auth
vi.mock('@/lib/auth', () => ({
    verifyToken: vi.fn(),
}))

// Mock Reminder Jobs
vi.mock('@/lib/reminder-jobs', () => ({
    generateReminderJobs: vi.fn(),
}))

describe('Bulk Create Events API', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('should bulk create multiple events', async () => {
        vi.mocked(verifyToken).mockResolvedValue({ userId: 'user1' })

        vi.mocked(prisma.event.create)
            .mockResolvedValueOnce({ id: 'event1', title: 'Event 1' } as any)
            .mockResolvedValueOnce({ id: 'event2', title: 'Event 2' } as any)

        vi.mocked(generateReminderJobs).mockResolvedValue(3)

        const req = new NextRequest('http://localhost/api/events/bulk-create', {
            method: 'POST',
            body: JSON.stringify({
                events: [
                    { title: 'Event 1', date: '2025-06-15', label: 'Contract' },
                    { title: 'Event 2', date: '2025-06-20', label: 'Certificate' },
                ],
            }),
        })
        req.cookies.set('token', 'valid_token')

        const res = await bulkCreate(req)

        expect(res.status).toBe(201)
        const data = await res.json()
        expect(data.created).toBe(2)
        expect(data.failed).toBe(0)
    })

    it('should handle partial failures', async () => {
        vi.mocked(verifyToken).mockResolvedValue({ userId: 'user1' })

        vi.mocked(prisma.event.create)
            .mockResolvedValueOnce({ id: 'event1', title: 'Event 1' } as any)
            .mockRejectedValueOnce(new Error('Database error'))

        vi.mocked(generateReminderJobs).mockResolvedValue(3)

        const req = new NextRequest('http://localhost/api/events/bulk-create', {
            method: 'POST',
            body: JSON.stringify({
                events: [
                    { title: 'Event 1', date: '2025-06-15' },
                    { title: 'Event 2', date: '2025-06-20' },
                ],
            }),
        })
        req.cookies.set('token', 'valid_token')

        const res = await bulkCreate(req)

        expect(res.status).toBe(201)
        const data = await res.json()
        expect(data.created).toBe(1)
        expect(data.failed).toBe(1)
        expect(data.errors).toHaveLength(1)
    })

    it('should return 400 if events array is invalid', async () => {
        vi.mocked(verifyToken).mockResolvedValue({ userId: 'user1' })

        const req = new NextRequest('http://localhost/api/events/bulk-create', {
            method: 'POST',
            body: JSON.stringify({
                events: [{ title: 'Missing date' }], // Invalid: no date
            }),
        })
        req.cookies.set('token', 'valid_token')

        const res = await bulkCreate(req)

        expect(res.status).toBe(400)
    })
})
