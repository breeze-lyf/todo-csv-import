import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET as getRules, POST as createRule } from '@/app/api/reminder-rules/route'
import { PUT as updateRule, DELETE as deleteRule } from '@/app/api/reminder-rules/[id]/route'
import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'
import { verifyToken } from '@/lib/auth'

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
    prisma: {
        reminderRule: {
            findMany: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
            findUnique: vi.fn(),
            findFirst: vi.fn(),
        },
    },
}))

// Mock Auth
vi.mock('@/lib/auth', () => ({
    verifyToken: vi.fn(),
}))

describe('Reminder Rules API', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('GET /api/reminder-rules', () => {
        it('should return all rules for user', async () => {
            vi.mocked(verifyToken).mockResolvedValue({ userId: 'user1' })

            const mockRules = [
                { id: 'rule1', userId: 'user1', label: 'Contract', offsetsInDays: [7, 3, 1], defaultTime: '10:00' },
                { id: 'rule2', userId: 'user1', label: 'Certificate', offsetsInDays: [30, 7], defaultTime: '10:00' },
            ]

            vi.mocked(prisma.reminderRule.findMany).mockResolvedValue(mockRules as any)

            const req = new NextRequest('http://localhost/api/reminder-rules')
            req.cookies.set('token', 'valid_token')

            const res = await getRules(req)

            expect(res.status).toBe(200)
            const data = await res.json()
            expect(data.rules).toHaveLength(2)
        })
    })

    describe('POST /api/reminder-rules', () => {
        it('should create a new rule', async () => {
            vi.mocked(verifyToken).mockResolvedValue({ userId: 'user1' })
            vi.mocked(prisma.reminderRule.findFirst).mockResolvedValue(null)

            const mockRule = {
                id: 'rule1',
                userId: 'user1',
                label: 'Contract',
                offsetsInDays: [7, 3, 1],
                defaultTime: '10:00',
            }

            vi.mocked(prisma.reminderRule.create).mockResolvedValue(mockRule as any)

            const req = new NextRequest('http://localhost/api/reminder-rules', {
                method: 'POST',
                body: JSON.stringify({
                    label: 'Contract',
                    offsetsInDays: [7, 3, 1],
                    defaultTime: '10:00',
                }),
            })
            req.cookies.set('token', 'valid_token')

            const res = await createRule(req)

            expect(res.status).toBe(201)
            const data = await res.json()
            expect(data.rule.label).toBe('Contract')
        })

        it('should return 400 if rule already exists for label', async () => {
            vi.mocked(verifyToken).mockResolvedValue({ userId: 'user1' })
            vi.mocked(prisma.reminderRule.findFirst).mockResolvedValue({ id: 'existing' } as any)

            const req = new NextRequest('http://localhost/api/reminder-rules', {
                method: 'POST',
                body: JSON.stringify({
                    label: 'Contract',
                    offsetsInDays: [7, 3, 1],
                    defaultTime: '10:00',
                }),
            })
            req.cookies.set('token', 'valid_token')

            const res = await createRule(req)

            expect(res.status).toBe(400)
        })
    })

    describe('PUT /api/reminder-rules/[id]', () => {
        it('should update a rule', async () => {
            vi.mocked(verifyToken).mockResolvedValue({ userId: 'user1' })

            vi.mocked(prisma.reminderRule.findUnique).mockResolvedValue({
                id: 'rule1',
                userId: 'user1',
            } as any)

            vi.mocked(prisma.reminderRule.update).mockResolvedValue({
                id: 'rule1',
                offsetsInDays: [14, 7, 3],
            } as any)

            const req = new NextRequest('http://localhost/api/reminder-rules/rule1', {
                method: 'PUT',
                body: JSON.stringify({ offsetsInDays: [14, 7, 3] }),
            })
            req.cookies.set('token', 'valid_token')

            const res = await updateRule(req, { params: Promise.resolve({ id: 'rule1' }) })

            expect(res.status).toBe(200)
        })
    })

    describe('DELETE /api/reminder-rules/[id]', () => {
        it('should delete a rule', async () => {
            vi.mocked(verifyToken).mockResolvedValue({ userId: 'user1' })

            vi.mocked(prisma.reminderRule.findUnique).mockResolvedValue({
                id: 'rule1',
                userId: 'user1',
            } as any)

            vi.mocked(prisma.reminderRule.delete).mockResolvedValue({} as any)

            const req = new NextRequest('http://localhost/api/reminder-rules/rule1', {
                method: 'DELETE',
            })
            req.cookies.set('token', 'valid_token')

            const res = await deleteRule(req, { params: Promise.resolve({ id: 'rule1' }) })

            expect(res.status).toBe(200)
        })
    })
})
