'use client'

import { useState, useEffect } from 'react'
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, format, addMonths, subMonths, isSameMonth, isSameDay, parseISO } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useRouter } from 'next/navigation'
import { EventDialog } from '@/components/EventDialog'
import { NotificationPermissionPrompt } from '@/components/NotificationPermissionPrompt'

interface Event {
    id: string
    title: string
    date: string
    label?: string
    time?: string | null
}

export default function CalendarPage() {
    const router = useRouter()
    const [currentDate, setCurrentDate] = useState(new Date())
    const [events, setEvents] = useState<Event[]>([])
    const [loading, setLoading] = useState(false)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [selectedEvent, setSelectedEvent] = useState<Event | undefined>()
    const [defaultDate, setDefaultDate] = useState<string | undefined>()

    const fetchEvents = async (date: Date) => {
        setLoading(true)
        const monthStr = format(date, 'yyyy-MM')
        try {
            const res = await fetch(`/api/events?month=${monthStr}`)
            if (res.status === 401) {
                router.push('/login')
                return
            }
            const data = await res.json()
            if (res.ok) {
                setEvents(data.events || [])
            }
        } catch (error) {
            console.error('Failed to fetch events', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchEvents(currentDate)
    }, [currentDate])

    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1))
    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1))

    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(monthStart)
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }) // Monday start
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 })

    const calendarDays = eachDayOfInterval({
        start: startDate,
        end: endDate,
    })

    const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

    const handleDayClick = (day: Date) => {
        const dateStr = format(day, 'yyyy-MM-dd')
        setDefaultDate(dateStr)
        setSelectedEvent(undefined)
        setDialogOpen(true)
    }

    const handleEventClick = (event: Event, e: React.MouseEvent) => {
        e.stopPropagation()
        setSelectedEvent(event)
        setDefaultDate(undefined)
        setDialogOpen(true)
    }

    const handleDeleteEvent = async (eventId: string) => {
        if (!confirm('Delete this event?')) return

        try {
            const res = await fetch(`/api/events/${eventId}`, {
                method: 'DELETE',
            })

            if (res.ok) {
                fetchEvents(currentDate)
            }
        } catch (error) {
            console.error('Delete error:', error)
        }
    }

    return (
        <div className="p-4 md:p-8 min-h-screen bg-gray-50">
            <Card className="max-w-6xl mx-auto shadow-md">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                    <CardTitle className="text-2xl font-bold">
                        {format(currentDate, 'MMMM yyyy')}
                    </CardTitle>
                    <div className="flex space-x-2">
                        <Button variant="outline" onClick={prevMonth}>Previous</Button>
                        <Button variant="outline" onClick={nextMonth}>Next</Button>
                        <Button onClick={() => router.push('/import')}>Import CSV</Button>
                        <Button variant="outline" onClick={() => router.push('/settings')}>Settings</Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Weekday Headers */}
                    <div className="grid grid-cols-7 mb-2 text-center text-sm font-semibold text-gray-500">
                        {weekDays.map((day) => (
                            <div key={day} className="py-2">{day}</div>
                        ))}
                    </div>

                    {/* Days Grid */}
                    <div className="grid grid-cols-7 gap-px bg-gray-200 border border-gray-200">
                        {calendarDays.map((day) => {
                            const dateKey = format(day, 'yyyy-MM-dd')
                            const dayEvents = events.filter(e => e.date === dateKey)
                            const isCurrentMonth = isSameMonth(day, currentDate)

                            return (
                                <div
                                    key={day.toString()}
                                    className={`min-h-[120px] bg-white p-2 ${!isCurrentMonth ? 'text-gray-300 bg-gray-50' : ''} hover:bg-blue-50 transition-colors cursor-pointer`}
                                    onClick={() => handleDayClick(day)}
                                >
                                    <div className="flex justify-between items-start">
                                        <span className={`text-sm font-medium ${isSameDay(day, new Date()) ? 'bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center' : ''}`}>
                                            {format(day, 'd')}
                                        </span>
                                    </div>
                                    <div className="mt-2 space-y-1">
                                        {dayEvents.slice(0, 3).map(event => (
                                            <div
                                                key={event.id}
                                                className="text-xs p-1 rounded bg-blue-100 text-blue-800 truncate cursor-pointer hover:bg-blue-200"
                                                title={event.title}
                                                onClick={(e) => handleEventClick(event, e)}
                                            >
                                                {event.label && <span className="font-semibold">[{event.label}]</span>} {event.title}
                                            </div>
                                        ))}
                                        {dayEvents.length > 3 && (
                                            <div className="text-xs text-gray-500 font-medium pl-1">
                                                +{dayEvents.length - 3} more
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </CardContent>
            </Card>

            <NotificationPermissionPrompt />

            <EventDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                event={selectedEvent}
                defaultDate={defaultDate}
                onSuccess={() => fetchEvents(currentDate)}
            />
        </div>
    )
}
