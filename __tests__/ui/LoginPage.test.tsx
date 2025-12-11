// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import LoginPage from '@/app/login/page'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useRouter } from 'next/navigation'

// Mock next/navigation
vi.mock('next/navigation', () => ({
    useRouter: vi.fn(),
}))

// Mock fetch
global.fetch = vi.fn()

describe('LoginPage', () => {
    const pushMock = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(useRouter).mockReturnValue({ push: pushMock } as any)
    })

    it('renders login form', () => {
        render(<LoginPage />)
        expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
    })

    it('submits form and redirects on success', async () => {
        vi.mocked(global.fetch).mockResolvedValue({
            ok: true,
            json: async () => ({ success: true }),
        } as Response)

        render(<LoginPage />)

        fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } })
        fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } })
        fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
            }))
            expect(pushMock).toHaveBeenCalledWith('/calendar')
        })
    })

    it('shows error on failure', async () => {
        vi.mocked(global.fetch).mockResolvedValue({
            ok: false,
            json: async () => ({ error: 'Invalid credentials' }),
        } as Response)

        render(<LoginPage />)

        fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'wrong@example.com' } })
        fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrong' } })
        fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

        await waitFor(() => {
            expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument()
        })
    })
})
