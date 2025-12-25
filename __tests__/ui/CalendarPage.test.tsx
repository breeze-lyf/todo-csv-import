// @vitest-environment jsdom
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import CalendarPage from '@/app/calendar/page'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useRouter } from 'next/navigation'

// Mock next/navigation
vi.mock('next/navigation', () => ({
    useRouter: vi.fn(),
}))

// Mock fetch
global.fetch = vi.fn()

describe('CalendarPage', () => {
    const pushMock = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(useRouter).mockReturnValue({ push: pushMock } as any)
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('renders calendar grid', async () => {
        vi.mocked(global.fetch).mockResolvedValue({
            ok: true,
            json: async () => ({ events: [] }),
        } as Response)

        render(<CalendarPage />)

        // Header should show current month (mocked or dependent on current date, we'll see)
        // For stability, we might need to mock system time in future, but simple render check first.
        await waitFor(() => {
            expect(screen.getByText('周一')).toBeInTheDocument()
            expect(screen.getByText('周日')).toBeInTheDocument()
        })
    })

    it('fetches events on load', async () => {
        // Mock system time to 2025-06-01
        vi.useFakeTimers({ toFake: ['Date'] })
        vi.setSystemTime(new Date('2025-06-01'))

        const mockEvents = [
            { id: '1', title: 'Contract Due', date: '2025-06-15', label: 'Contract' }
        ]

        vi.mocked(global.fetch).mockResolvedValue({
            ok: true,
            json: async () => ({ events: mockEvents }),
        } as Response)

        render(<CalendarPage />)

        await waitFor(() => {
            // We only check if it was called with the correct URL, ignoring the second argument if strictly checking
            const url = `/api/events?month=2025-06`
            expect(global.fetch).toHaveBeenCalledWith(url)
            expect(screen.getByText('Contract Due')).toBeInTheDocument()
        })

    })

    it('opens new event dialog with clicked date when cell is empty', async () => {
        vi.useFakeTimers({ toFake: ['Date'] })
        vi.setSystemTime(new Date('2025-06-01'))

        vi.mocked(global.fetch).mockResolvedValue({
            ok: true,
            json: async () => ({ events: [] }),
        } as Response)

        render(<CalendarPage />)

        const targetDay = await screen.findByTestId('calendar-day-2025-06-10')
        fireEvent.click(targetDay)

        await screen.findByText('新建日程')
        expect((screen.getByLabelText('日期 *') as HTMLInputElement).value).toBe('2025-06-10')
        expect(screen.queryByText('删除')).not.toBeInTheDocument()
    })

    it('opens edit dialog with existing event data and delete button', async () => {
        vi.useFakeTimers({ toFake: ['Date'] })
        vi.setSystemTime(new Date('2025-06-01'))

        const mockEvents = [
            {
                id: '1',
                title: 'Contract Due',
                date: '2025-06-15',
                label: 'Contract',
                time: '09:00',
                notes: 'Call vendor',
            },
        ]

        vi.mocked(global.fetch).mockResolvedValue({
            ok: true,
            json: async () => ({ events: mockEvents }),
        } as Response)

        render(<CalendarPage />)

        const eventChip = await screen.findByTestId('calendar-event-1')
        fireEvent.click(eventChip)

        await screen.findByText('编辑日程')
        expect((screen.getByLabelText('标题 *') as HTMLInputElement).value).toBe('Contract Due')
        expect((screen.getByLabelText('日期 *') as HTMLInputElement).value).toBe('2025-06-15')
        expect(screen.getByText('删除')).toBeInTheDocument()
    })
})
