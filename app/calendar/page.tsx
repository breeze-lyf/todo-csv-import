'use client'

import { useState, useEffect, useRef } from 'react'
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, format, addMonths, subMonths, isSameMonth, isSameDay, parseISO } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useRouter } from 'next/navigation'
import { EventDialog } from '@/components/EventDialog'
import { NotificationPermissionPrompt } from '@/components/NotificationPermissionPrompt'
import { Search, X, LogOut, User } from 'lucide-react'

interface Event {
    id: string
    title: string
    date: string
    label?: string | null
    time?: string | null
    notes?: string | null
    completed?: boolean
    isReminder?: boolean
    reminderDaysOffset?: number | null
    originalEventId?: string
    displayDate?: string
}

export default function CalendarPage() {
    const router = useRouter()
    const [currentDate, setCurrentDate] = useState(new Date())
    const [events, setEvents] = useState<Event[]>([])
    const [loading, setLoading] = useState(false)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [selectedEvent, setSelectedEvent] = useState<Event | undefined>()
    const [defaultDate, setDefaultDate] = useState<string | undefined>()
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedLabels, setSelectedLabels] = useState<string[]>([])
    const [availableLabels, setAvailableLabels] = useState<string[]>([])
    const [draggedEvent, setDraggedEvent] = useState<Event | null>(null)
    const [dragOverDate, setDragOverDate] = useState<string | null>(null)

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
                const fetchedEvents = data.events || []
                setEvents(fetchedEvents)

                // Extract unique labels
                const labels: string[] = Array.from(
                    new Set(
                        fetchedEvents
                            .map((e: Event) => e.label)
                            .filter((label: string | null | undefined): label is string => !!label)
                    )
                )
                setAvailableLabels(labels)
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

    const weekDays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

    const handleDayClick = (day: Date) => {
        const dateStr = format(day, 'yyyy-MM-dd')
        setDefaultDate(dateStr)
        setSelectedEvent(undefined)
        setDialogOpen(true)
    }

    const handleToggleComplete = async (event: Event, e: React.MouseEvent) => {
        e.stopPropagation()
        if (event.isReminder) return // Reminders are virtual

        try {
            const res = await fetch(`/api/events/${event.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ completed: !event.completed }),
            })
            if (res.ok) {
                fetchEvents(currentDate)
            }
        } catch (error) {
            console.error('Failed to toggle completion', error)
        }
    }

    const handleEventClick = (event: Event, e: React.MouseEvent) => {
        e.stopPropagation()

        // If it's a reminder, find the original event from our list to ensure we have correct data
        if (event.isReminder && event.originalEventId) {
            const originalEvent = events.find(e => e.id === event.originalEventId && !e.isReminder)
            if (originalEvent) {
                setSelectedEvent(originalEvent)
            } else {
                // Fallback: use the event object itself but restore original id
                setSelectedEvent({ ...event, id: event.originalEventId })
            }
        } else {
            setSelectedEvent(event)
        }

        setDefaultDate(undefined)
        setDialogOpen(true)
    }

    const handleLogout = async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' })
            router.push('/login')
        } catch (error) {
            console.error('Logout failed', error)
        }
    }

    const handleDialogOpenChange = (open: boolean) => {
        setDialogOpen(open)
        if (!open) {
            setSelectedEvent(undefined)
            setDefaultDate(undefined)
        }
    }

    const handleDeleteEvent = async (eventId: string) => {
        if (!confirm('确认删除这个日程吗？')) return

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

    // Long press and right-click handlers
    const handleDayContextMenu = (day: Date, e: React.MouseEvent) => {
        e.preventDefault()
        const dateStr = format(day, 'yyyy-MM-dd')
        setDefaultDate(dateStr)
        setSelectedEvent(undefined)
        setDialogOpen(true)
    }

    // Long press detection using useRef to persist timer across renders
    const longPressTimer = useRef<NodeJS.Timeout | null>(null)
    const touchHandled = useRef(false) // Flag to prevent click after touch

    const handleTouchStart = (day: Date, e: React.TouchEvent) => {
        touchHandled.current = false
        longPressTimer.current = setTimeout(() => {
            touchHandled.current = true
            const dateStr = format(day, 'yyyy-MM-dd')
            setDefaultDate(dateStr)
            setSelectedEvent(undefined)
            setDialogOpen(true)
        }, 500) // 500ms for long press
    }

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current)
            longPressTimer.current = null
        }
        // If long press was triggered, prevent the subsequent click event
        if (touchHandled.current) {
            e.preventDefault()
        }
    }

    const handleDayClickWrapper = (day: Date, e: React.MouseEvent) => {
        // Prevent click if it was triggered by touch
        if (touchHandled.current) {
            touchHandled.current = false
            return
        }
        handleDayClick(day)
    }

    // Drag and drop handlers
    const handleDragStart = (event: Event, e: React.DragEvent) => {
        e.stopPropagation()
        setDraggedEvent(event)
        e.dataTransfer.effectAllowed = 'move'
    }

    const handleDragEnd = () => {
        setDraggedEvent(null)
        setDragOverDate(null)
    }

    const handleDragOver = (dateStr: string, e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        e.dataTransfer.dropEffect = 'move'
        setDragOverDate(dateStr)
    }

    const handleDragLeave = () => {
        setDragOverDate(null)
    }

    const handleDrop = async (newDateStr: string, e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()

        if (!draggedEvent || draggedEvent.date === newDateStr) {
            setDraggedEvent(null)
            setDragOverDate(null)
            return
        }

        const confirmed = confirm(`确认将"${draggedEvent.title}"从 ${draggedEvent.date} 移动到 ${newDateStr} 吗？`)

        if (!confirmed) {
            setDraggedEvent(null)
            setDragOverDate(null)
            return
        }

        try {
            const res = await fetch(`/api/events/${draggedEvent.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...draggedEvent,
                    date: newDateStr,
                }),
            })

            if (res.ok) {
                fetchEvents(currentDate)
            } else {
                alert('移动失败，请重试')
            }
        } catch (error) {
            console.error('Drag drop error:', error)
            alert('移动失败，请重试')
        } finally {
            setDraggedEvent(null)
            setDragOverDate(null)
        }
    }

    useEffect(() => {
        // Simple client-side scheduler trigger so reminders发送不会因缺少后端定时任务而停滞
        const triggerScheduler = async () => {
            try {
                await fetch('/api/scheduler/run', { method: 'POST' })
            } catch (err) {
                console.error('Scheduler trigger failed', err)
            }
        }

        triggerScheduler()
        const interval = setInterval(triggerScheduler, 60_000) // every minute
        return () => clearInterval(interval)
    }, [])

    // Filter events based on search and labels
    const filteredEvents = events.filter(event => {
        // Search filter
        const matchesSearch = !searchQuery ||
            event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (event.notes && event.notes.toLowerCase().includes(searchQuery.toLowerCase()))

        // Label filter
        const matchesLabel = selectedLabels.length === 0 ||
            (event.label && selectedLabels.includes(event.label))

        return matchesSearch && matchesLabel
    })

    const toggleLabel = (label: string) => {
        setSelectedLabels(prev =>
            prev.includes(label)
                ? prev.filter(l => l !== label)
                : [...prev, label]
        )
    }

    const clearFilters = () => {
        setSearchQuery('')
        setSelectedLabels([])
    }

    return (
        <div className="p-4 md:p-8 min-h-screen bg-gray-50">
            <Card className="max-w-6xl mx-auto shadow-md">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                    <CardTitle className="text-2xl font-bold">
                        {format(currentDate, 'yyyy年M月')}
                    </CardTitle>
                    <div className="flex space-x-2">
                        <Button variant="outline" size="sm" onClick={prevMonth}>上个月</Button>
                        <Button variant="outline" size="sm" onClick={nextMonth}>下个月</Button>
                        <Button size="sm" onClick={() => router.push('/import')}>导入 CSV</Button>
                        <Button variant="outline" size="sm" onClick={() => router.push('/settings')}>提醒设置</Button>
                        <Button variant="ghost" size="sm" onClick={handleLogout} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                            <LogOut className="h-4 w-4 mr-1" />
                            退出
                        </Button>
                    </div>
                </CardHeader>

                {/* Search and Filter Section */}
                <div className="px-6 pb-4 space-y-3">
                    {/* Search Bar */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            placeholder="搜索事件标题或备注..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 pr-10"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>

                    {/* Label Filter */}
                    {availableLabels.length > 0 && (
                        <div className="flex flex-wrap gap-2 items-center">
                            <span className="text-sm text-gray-600 font-medium">标签筛选:</span>
                            {availableLabels.map(label => (
                                <Badge
                                    key={label}
                                    variant={selectedLabels.includes(label) ? "default" : "outline"}
                                    className="cursor-pointer"
                                    onClick={() => toggleLabel(label)}
                                >
                                    {label}
                                </Badge>
                            ))}
                            {(searchQuery || selectedLabels.length > 0) && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={clearFilters}
                                    className="h-6 text-xs"
                                >
                                    清除筛选
                                </Button>
                            )}
                        </div>
                    )}

                    {/* Filter Status */}
                    {(searchQuery || selectedLabels.length > 0) && (
                        <div className="text-sm text-gray-600">
                            找到 <span className="font-semibold text-blue-600">{filteredEvents.length}</span> 个事件
                            {searchQuery && <span> (搜索: "{searchQuery}")</span>}
                            {selectedLabels.length > 0 && <span> (标签: {selectedLabels.join(', ')})</span>}
                        </div>
                    )}
                </div>

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
                            // Filter events based on displayDate (which handles both real date and reminder date)
                            const dayEvents = filteredEvents
                                .filter(e => (e.displayDate || e.date) === dateKey)
                                .sort((a, b) => {
                                    // 1. Sort by completion status (uncompleted first)
                                    if (!!a.completed !== !!b.completed) {
                                        return a.completed ? 1 : -1
                                    }
                                    // 2. Sort by time if available
                                    const timeA = a.time || '99:99'
                                    const timeB = b.time || '99:99'
                                    return timeA.localeCompare(timeB)
                                })
                            const allDayEvents = events.filter(e => (e.displayDate || e.date) === dateKey)
                            const isCurrentMonth = isSameMonth(day, currentDate)
                            const hasFilteredEvents = dayEvents.length > 0
                            const hasHiddenEvents = allDayEvents.length > dayEvents.length
                            const isDragOver = dragOverDate === dateKey

                            return (
                                <div
                                    key={day.toString()}
                                    data-testid={`calendar-day-${dateKey}`}
                                    className={`min-h-[120px] bg-white p-2 ${!isCurrentMonth ? 'text-gray-300 bg-gray-50' : ''} ${hasFilteredEvents ? 'ring-2 ring-blue-300' : ''} ${isDragOver ? 'bg-green-50 ring-2 ring-green-400' : ''} hover:bg-blue-50 transition-colors cursor-pointer`}
                                    onClick={(e) => handleDayClickWrapper(day, e)}
                                    onContextMenu={(e) => handleDayContextMenu(day, e)}
                                    onTouchStart={(e) => handleTouchStart(day, e)}
                                    onTouchEnd={handleTouchEnd}
                                    onTouchCancel={handleTouchEnd}
                                    onDragOver={(e) => handleDragOver(dateKey, e)}
                                    onDragLeave={handleDragLeave}
                                    onDrop={(e) => handleDrop(dateKey, e)}
                                >
                                    <div className="flex justify-between items-start">
                                        <span className={`text-sm font-medium ${isSameDay(day, new Date()) ? 'bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center' : ''}`}>
                                            {format(day, 'd')}
                                        </span>
                                        {hasHiddenEvents && (
                                            <span className="text-xs text-gray-400" title={`${allDayEvents.length - dayEvents.length} 个事件被筛选隐藏`}>
                                                +{allDayEvents.length - dayEvents.length}
                                            </span>
                                        )}
                                    </div>
                                    <div className="mt-2 space-y-1">
                                        {dayEvents.slice(0, 3).map(event => {
                                            const isReminder = event.isReminder
                                            const isCompleted = event.completed
                                            return (
                                                <div
                                                    key={event.id}
                                                    data-testid={`calendar-event-${event.id}`}
                                                    draggable={!isReminder && !isCompleted}
                                                    onDragStart={(e) => !isReminder && !isCompleted && handleDragStart(event, e)}
                                                    onDragEnd={handleDragEnd}
                                                    className={`group relative text-xs p-1.5 rounded-md truncate transition-all duration-200 border shadow-sm ${isReminder
                                                        ? 'bg-emerald-50 text-emerald-800 border-emerald-100'
                                                        : isCompleted
                                                            ? 'bg-gray-50 text-gray-400 border-gray-200 line-through'
                                                            : 'bg-white text-blue-800 border-blue-100 hover:border-blue-300 hover:shadow-md cursor-move'
                                                        } ${draggedEvent?.id === event.id ? 'opacity-50 scale-95' : ''}`}
                                                    title={`${event.title}${isReminder ? ` (提前${event.reminderDaysOffset}天提醒)` : ''}${isCompleted ? ' (已完成)' : ''}`}
                                                    onClick={(e) => handleEventClick(event, e)}
                                                >
                                                    <div className="flex items-center gap-1.5 overflow-hidden">
                                                        {!isReminder && (
                                                            <button
                                                                onClick={(e) => handleToggleComplete(event, e)}
                                                                className={`flex-shrink-0 w-3.5 h-3.5 rounded-full border transition-colors flex items-center justify-center ${isCompleted
                                                                    ? 'bg-blue-600 border-blue-600 text-white'
                                                                    : 'border-gray-300 hover:border-blue-500 bg-white'
                                                                    }`}
                                                            >
                                                                {isCompleted && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                                            </button>
                                                        )}

                                                        {isReminder ? (
                                                            <div className={`flex items-center gap-1 min-w-0 ${isCompleted ? 'opacity-50' : ''}`}>
                                                                <span className="scale-75 opacity-70">🔔</span>
                                                                <span className="font-bold text-[9px] bg-emerald-200 px-1 rounded-sm flex-shrink-0">
                                                                    -{event.reminderDaysOffset}D
                                                                </span>
                                                                <span className="truncate">{event.title}</span>
                                                            </div>
                                                        ) : (
                                                            <div className="truncate flex items-center gap-1">
                                                                {event.label && <span className="font-bold text-blue-600 opacity-80 flex-shrink-0">[{event.label}]</span>}
                                                                <span className="truncate">{event.title}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                        {dayEvents.length > 3 && (
                                            <div className="text-xs text-gray-500 font-medium pl-1">
                                                +{dayEvents.length - 3} 条更多
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
                onOpenChange={handleDialogOpenChange}
                event={selectedEvent}
                defaultDate={defaultDate}
                onSuccess={() => fetchEvents(currentDate)}
            />
        </div>
    )
}
