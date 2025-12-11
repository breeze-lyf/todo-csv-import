import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST as createEvent, PUT as updateEvent, DELETE as deleteEvent } from '@/app/api/events/[id]/route'
import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'
import { verifyToken } from '@/lib/auth'

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
    prisma: {
        event: {
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
            findUnique: vi.fn(),
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

describe('Event CRUD API', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('POST /api/events (Create)', () => {
        it('should create a new event', async () => {
            vi.mocked(verifyToken).mockResolvedValue({ userId: 'user1' })

            const mockEvent = {
                id: 'event1',
                userId: 'user1',
                title: 'Contract Renewal',
                date: '2025-06-15',
                time: null,
                label: 'Contract',
                notes: 'Important',
                createdAt: new Date(),
            }

            vi.mocked(prisma.event.create).mockResolvedValue(mockEvent as any)

            const req = new NextRequest('http://localhost/api/events', {
                method: 'POST',
                body: JSON.stringify({
                    title: 'Contract Renewal',
                    date: '2025-06-15',
                    label: 'Contract',
                    notes: 'Important',
                }),
            })
            req.cookies.set('token', 'valid_token')

            const { POST } = await import('@/app/api/events/route')
            const res = await POST(req)

            expect(res.status).toBe(201)
            const data = await res.json()
            expect(data.event.title).toBe('Contract Renewal')
        })

        it('should return 400 if required fields missing', async () => {
            vi.mocked(verifyToken).mockResolvedValue({ userId: 'user1' })

            const req = new NextRequest('http://localhost/api/events', {
                method: 'POST',
                body: JSON.stringify({ title: 'Test' }), // missing date
            })
            req.cookies.set('token', 'valid_token')

            const { POST } = await import('@/app/api/events/route')
            const res = await POST(req)

            expect(res.status).toBe(400)
        })
    })

    describe('PUT /api/events/[id] (Update)', () => {
        it('should update an existing event', async () => {
            vi.mocked(verifyToken).mockResolvedValue({ userId: 'user1' })

            vi.mocked(prisma.event.findUnique).mockResolvedValue({
                id: 'event1',
                userId: 'user1',
            } as any)

            vi.mocked(prisma.event.update).mockResolvedValue({
                id: 'event1',
                title: 'Updated Title',
            } as any)

            const req = new NextRequest('http://localhost/api/events/event1', {
                method: 'PUT',
                body: JSON.stringify({ title: 'Updated Title' }),
            })
            req.cookies.set('token', 'valid_token')

            const res = await updateEvent(req, { params: { id: 'event1' } })

            expect(res.status).toBe(200)
        })

        it('should return 404 if event not found', async () => {
            vi.mocked(verifyToken).mockResolvedValue({ userId: 'user1' })
            vi.mocked(prisma.event.findUnique).mockResolvedValue(null)

            const req = new NextRequest('http://localhost/api/events/nonexistent', {
                method: 'PUT',
                body: JSON.stringify({ title: 'Test' }),
            })
            req.cookies.set('token', 'valid_token')

            const res = await updateEvent(req, { params: { id: 'nonexistent' } })

            expect(res.status).toBe(404)
        })
    })

    describe('DELETE /api/events/[id]', () => {
        it('should delete an event', async () => {
            vi.mocked(verifyToken).mockResolvedValue({ userId: 'user1' })

            vi.mocked(prisma.event.findUnique).mockResolvedValue({
                id: 'event1',
                userId: 'user1',
            } as any)

            vi.mocked(prisma.event.delete).mockResolvedValue({} as any)

            const req = new NextRequest('http://localhost/api/events/event1', {
                method: 'DELETE',
            })
            req.cookies.set('token', 'valid_token')

            const res = await deleteEvent(req, { params: { id: 'event1' } })

            expect(res.status).toBe(200)
        })

        it('should return 403 if user does not own the event', async () => {
            vi.mocked(verifyToken).mockResolvedValue({ userId: 'user1' })

            vi.mocked(prisma.event.findUnique).mockResolvedValue({
                id: 'event1',
                userId: 'user2', // different user
            } as any)

            const req = new NextRequest('http://localhost/api/events/event1', {
                method: 'DELETE',
            })
            req.cookies.set('token', 'valid_token')

            const res = await deleteEvent(req, { params: { id: 'event1' } })

            expect(res.status).toBe(403)
        })
    })
})
