// @vitest-environment jsdom
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import CalendarPage from '@/app/calendar/page'
import { vi, describe, it, expect, beforeEach } from 'vitest'
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

    it('renders calendar grid', async () => {
        vi.mocked(global.fetch).mockResolvedValue({
            ok: true,
            json: async () => ({ events: [] }),
        } as Response)

        render(<CalendarPage />)

        // Header should show current month (mocked or dependent on current date, we'll see)
        // For stability, we might need to mock system time in future, but simple render check first.
        await waitFor(() => {
            expect(screen.getByText(/Mon/)).toBeInTheDocument() // Weekday header
            expect(screen.getByText(/Sun/)).toBeInTheDocument()
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

        vi.useRealTimers()
    })
})

