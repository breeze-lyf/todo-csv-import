import { NextRequest, NextResponse } from 'next/server'
import { runReminderScheduler } from '@/lib/scheduler'

/**
 * API endpoint to manually trigger the scheduler
 * In production, this should be called by a cron job or scheduled task
 */
export async function POST(req: NextRequest) {
    try {
        const cronSecret = process.env.CRON_SECRET
        if (cronSecret) {
            const authHeader = req.headers.get('authorization')
            if (authHeader !== `Bearer ${cronSecret}`) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
            }
        }

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

export async function GET(req: NextRequest) {
    try {
        const cronSecret = process.env.CRON_SECRET
        if (cronSecret) {
            const authHeader = req.headers.get('authorization')
            if (authHeader !== `Bearer ${cronSecret}`) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
            }
        }

        const result = await runReminderScheduler()

        return NextResponse.json({
            success: true,
            status: 'executed',
            ...result,
        }, { status: 200 })
    } catch (error) {
        console.error('Scheduler GET error:', error)
        return NextResponse.json({
            success: false,
            error: 'Scheduler failed',
        }, { status: 500 })
    }
}
