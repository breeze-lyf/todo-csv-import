import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateReminderJobs, getPendingReminderJobs, markJobAsSent } from '@/lib/reminder-jobs'
import { prisma } from '@/lib/prisma'

vi.mock('@/lib/prisma', () => ({
    prisma: {
        reminderJob: {
            deleteMany: vi.fn(),
            createMany: vi.fn(),
            findMany: vi.fn(),
            update: vi.fn(),
        },
        reminderRule: {
            findFirst: vi.fn(),
        },
    },
}))

describe('Reminder Jobs Logic', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('generateReminderJobs', () => {
        it('should generate jobs based on custom rule', async () => {
            const event = {
                id: 'event1',
                userId: 'user1',
                date: '2025-06-20',
                time: null,
                label: 'Contract',
            }

            const mockRule = {
                id: 'rule1',
                userId: 'user1',
                label: 'Contract',
                offsetsInDays: [7, 3, 1],
                defaultTime: '10:00',
            }

            vi.mocked(prisma.reminderJob.deleteMany).mockResolvedValue({ count: 0 } as any)
            vi.mocked(prisma.reminderRule.findFirst).mockResolvedValue(mockRule as any)
            vi.mocked(prisma.reminderJob.createMany).mockResolvedValue({ count: 3 } as any)

            const count = await generateReminderJobs(event)

            expect(count).toBe(3)
            expect(prisma.reminderJob.deleteMany).toHaveBeenCalledWith({
                where: { eventId: 'event1' },
            })
            expect(prisma.reminderJob.createMany).toHaveBeenCalled()
        })

        it('should use default rule if no custom rule exists', async () => {
            const event = {
                id: 'event2',
                userId: 'user1',
                date: '2025-06-20',
                time: null,
                label: null,
            }

            vi.mocked(prisma.reminderJob.deleteMany).mockResolvedValue({ count: 0 } as any)
            vi.mocked(prisma.reminderRule.findFirst).mockResolvedValue(null)
            vi.mocked(prisma.reminderJob.createMany).mockResolvedValue({ count: 1 } as any)

            const count = await generateReminderJobs(event)

            expect(count).toBe(1) // Default: 1 day before
        })
    })

    describe('getPendingReminderJobs', () => {
        it('should return jobs that are not sent and due', async () => {
            const mockJobs = [
                {
                    id: 'job1',
                    fireTime: new Date('2025-06-19T10:00:00'),
                    sent: false,
                    event: { title: 'Contract Due' },
                },
            ]

            vi.mocked(prisma.reminderJob.findMany).mockResolvedValue(mockJobs as any)

            const jobs = await getPendingReminderJobs()

            expect(jobs).toHaveLength(1)
            expect(prisma.reminderJob.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        sent: false,
                    }),
                })
            )
        })
    })

    describe('markJobAsSent', () => {
        it('should mark a job as sent', async () => {
            vi.mocked(prisma.reminderJob.update).mockResolvedValue({ id: 'job1', sent: true } as any)

            await markJobAsSent('job1')

            expect(prisma.reminderJob.update).toHaveBeenCalledWith({
                where: { id: 'job1' },
                data: { sent: true },
            })
        })
    })
})
