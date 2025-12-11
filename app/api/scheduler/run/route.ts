import { NextRequest, NextResponse } from 'next/server'
import { runReminderScheduler } from '@/lib/scheduler'

/**
 * API endpoint to manually trigger the scheduler
 * In production, this should be called by a cron job or scheduled task
 */
export async function POST(req: NextRequest) {
    try {
        // Optional: Add authentication/authorization here
        // For now, anyone can trigger it (you may want to add a secret token)

        const result = await runReminderScheduler()

        return NextResponse.json({
            success: true,
            ...result,
        }, { status: 200 })
    } catch (error) {
        console.error('Scheduler API error:', error)
        return NextResponse.json({
            success: false,
            error: 'Scheduler failed',
        }, { status: 500 })
    }
}

/**
 * GET endpoint to check scheduler status
 */
export async function GET() {
    return NextResponse.json({
        status: 'ready',
        message: 'Scheduler is available. Use POST to trigger.',
    }, { status: 200 })
}
