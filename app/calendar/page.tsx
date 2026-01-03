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
import { Search, X, LogOut, User, Check, ChevronRight } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

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
    const [dayDetailEvents, setDayDetailEvents] = useState<Event[]>([])
    const [dayDetailOpen, setDayDetailOpen] = useState(false)
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

    const handleToggleComplete = async (event: Event, e?: React.MouseEvent) => {
        e?.stopPropagation()
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

    const handleEventClick = (event: Event, e?: React.MouseEvent) => {
        e?.stopPropagation()

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
        <div className="relative min-h-screen p-4 md:p-8 bg-[#f8fafc]">
            {/* Background Decorative Elements - iOS style Mesh Gradient */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-5%] left-[-5%] w-[40%] h-[40%] rounded-full bg-blue-400/10 blur-[100px]" />
                <div className="absolute bottom-[0] right-[-5%] w-[35%] h-[35%] rounded-full bg-indigo-400/10 blur-[100px]" />
            </div>

            <Card className="relative z-10 w-full max-w-[1400px] mx-auto backdrop-blur-3xl bg-white/80 border-white/60 shadow-[0_30px_60px_-12px_rgba(0,0,0,0.06)] overflow-hidden rounded-[2.5rem] flex flex-col">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 py-5 px-8 flex-shrink-0 border-b border-black/[0.03]">
                    <CardTitle className="text-2xl font-bold">
                        {format(currentDate, 'yyyy年M月')}
                    </CardTitle>
                    <div className="flex p-1 rounded-2xl backdrop-blur-md border border-black/[0.03] bg-white/20 shadow-sm">
                        <Button variant="ghost" size="sm" onClick={prevMonth} className="rounded-xl transition-all duration-300 hover:text-blue-600 hover:bg-blue-50/50 hover:shadow-[0_0_15px_rgba(59,130,246,0.2)] active:scale-95">上个月</Button>
                        <Button variant="ghost" size="sm" onClick={nextMonth} className="rounded-xl transition-all duration-300 hover:text-blue-600 hover:bg-blue-50/50 hover:shadow-[0_0_15px_rgba(59,130,246,0.2)] active:scale-95">下个月</Button>
                        <div className="w-px h-4 bg-gray-300/40 self-center mx-1.5" />
                        <Button variant="ghost" size="sm" onClick={() => router.push('/import')} className="rounded-xl transition-all duration-300 hover:text-blue-600 hover:bg-blue-50/50 hover:shadow-[0_0_15px_rgba(59,130,246,0.2)] active:scale-95">导入 CSV</Button>
                        <Button variant="ghost" size="sm" onClick={() => router.push('/settings')} className="rounded-xl transition-all duration-300 hover:text-blue-600 hover:bg-blue-50/50 hover:shadow-[0_0_15px_rgba(59,130,246,0.2)] active:scale-95">提醒设置</Button>
                        <Button variant="ghost" size="sm" onClick={handleLogout} className="rounded-xl text-red-500 transition-all duration-300 hover:bg-red-50 hover:shadow-[0_0_15px_rgba(239,68,68,0.2)] active:scale-95">
                            <LogOut className="h-4 w-4 mr-1.5" />
                            退出
                        </Button>
                    </div>
                </CardHeader>

                {/* Compact Search and Filter Section */}
                <div className="px-8 py-3 space-y-2 flex-shrink-0 bg-white/40 border-b border-black/[0.02]">
                    <div className="flex items-center gap-6">
                        {/* Search Bar */}
                        <div className="relative group max-w-sm flex-1">
                            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                            <Input
                                placeholder="搜索日程..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="h-9 pl-10 bg-white/60 border-black/5 rounded-xl focus:bg-white transition-all shadow-none text-sm"
                            />
                        </div>

                        {/* Label Filter Container */}
                        <div className="flex flex-wrap gap-1.5 items-center flex-1">
                            {availableLabels.map(label => (
                                <Badge
                                    key={label}
                                    variant={selectedLabels.includes(label) ? 'default' : 'outline'}
                                    className={`cursor-pointer px-2.5 py-0.5 rounded-lg text-xs transition-all border-black/5 ${selectedLabels.includes(label)
                                        ? 'bg-blue-600 text-white shadow-md'
                                        : 'bg-white hover:bg-gray-50'
                                        }`}
                                    onClick={() => toggleLabel(label)}
                                >
                                    {label}
                                </Badge>
                            ))}
                            {(searchQuery || selectedLabels.length > 0) && (
                                <button onClick={clearFilters} className="text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-blue-500 transition-colors ml-2">
                                    清空重置
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <CardContent className="flex-1 flex flex-col px-8 pb-8 pt-0 overflow-hidden">
                    {/* Weekday Headers */}
                    <div className="grid grid-cols-7 mb-1 text-center text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                        {weekDays.map((day) => (
                            <div key={day} className="py-2">{day}</div>
                        ))}
                    </div>

                    {/* Days Grid - Removed grid-rows-6 to fix bottom empty space */}
                    <div className="flex-1 grid grid-cols-7 gap-px border border-black/5 rounded-[1.5rem] overflow-hidden shadow-inner bg-black/[0.02]">
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
                            const hasHiddenEvents = allDayEvents.length > dayEvents.length
                            const isDragOver = dragOverDate === dateKey

                            return (
                                <div
                                    key={day.toString()}
                                    data-testid={`calendar-day-${dateKey}`}
                                    className={`relative flex flex-col p-2.5 min-h-[140px] transition-all duration-300 cursor-pointer border-[0.5px] border-black/5 ${!isCurrentMonth
                                        ? 'bg-[#fafbfc] text-gray-300'
                                        : 'bg-white shadow-[inset_0_0_20px_rgba(0,0,0,0.01)]'
                                        } ${isDragOver ? 'bg-blue-50/50' : 'hover:bg-white hover:z-20 hover:shadow-2xl hover:border-blue-400 hover:ring-2 hover:ring-blue-400/20'}`}
                                    onClick={(e) => handleDayClickWrapper(day, e)}
                                    onContextMenu={(e) => handleDayContextMenu(day, e)}
                                    onTouchStart={(e) => handleTouchStart(day, e)}
                                    onTouchEnd={handleTouchEnd}
                                    onTouchCancel={handleTouchEnd}
                                    onDragOver={(e) => handleDragOver(dateKey, e)}
                                    onDragLeave={handleDragLeave}
                                    onDrop={(e) => handleDrop(dateKey, e)}
                                >
                                    <div className="flex justify-between items-start mb-2 h-6">
                                        <span className={`text-[13px] font-black w-7 h-7 flex items-center justify-center transition-all ${isSameDay(day, new Date())
                                            ? 'bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-500/30 font-bold'
                                            : !isCurrentMonth ? 'opacity-40' : 'text-gray-900'
                                            }`}>
                                            {format(day, 'd')}
                                        </span>
                                        {dayEvents.length > 2 && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setDayDetailEvents(dayEvents);
                                                    setDayDetailOpen(true);
                                                }}
                                                className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg shadow-blue-500/30 hover:bg-blue-700 hover:scale-110 transition-all z-30"
                                            >
                                                +{dayEvents.length - 2} Items
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex-1 space-y-1.5">
                                        {dayEvents.slice(0, 2).map(event => {
                                            const isReminder = event.isReminder
                                            const isCompleted = event.completed
                                            return (
                                                <div
                                                    key={event.id}
                                                    data-testid={`calendar-event-${event.id}`}
                                                    draggable={!isReminder && !isCompleted}
                                                    onDragStart={(e) => !isReminder && !isCompleted && handleDragStart(event, e)}
                                                    onDragEnd={handleDragEnd}
                                                    className={`group relative text-[11px] p-1.5 rounded-xl truncate transition-all duration-300 border shadow-sm ${isReminder
                                                        ? 'bg-emerald-400/10 text-emerald-800 border-emerald-200/50 backdrop-blur-md'
                                                        : isCompleted
                                                            ? 'bg-gray-100/50 text-gray-400 border-gray-200/50 line-through backdrop-blur-sm'
                                                            : 'bg-white/80 text-gray-800 border-white/60 hover:border-blue-300/50 hover:shadow-lg hover:-translate-y-0.5 cursor-move backdrop-blur-md'
                                                        } ${draggedEvent?.id === event.id ? 'opacity-50 scale-95' : ''}`}
                                                    title={`${event.title}${isCompleted ? ' (已完成)' : ''}`}
                                                    onClick={(e) => handleEventClick(event, e)}
                                                >
                                                    <div className="flex items-center gap-2 overflow-hidden">
                                                        {!isReminder && (
                                                            <button
                                                                onClick={(e) => handleToggleComplete(event, e)}
                                                                className={`flex-shrink-0 w-4 h-4 rounded-full border-2 transition-all duration-300 flex items-center justify-center ${isCompleted
                                                                    ? 'bg-blue-500 border-blue-500 text-white shadow-inner'
                                                                    : 'border-blue-200 bg-white/50 hover:border-blue-400'
                                                                    }`}
                                                            >
                                                                {isCompleted && (
                                                                    <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 20 20">
                                                                        <path d="M0 11l2-2 5 5L18 3l2 2L7 18z" />
                                                                    </svg>
                                                                )}
                                                            </button>
                                                        )}

                                                        {isReminder ? (
                                                            <div className={`flex items-center gap-1 min-w-0 ${isCompleted ? 'opacity-50' : ''}`}>
                                                                <span className="scale-75 opacity-70">🔔</span>
                                                                <span className="font-black text-[9px] text-emerald-600 bg-emerald-500/10 px-1 rounded flex-shrink-0">
                                                                    [-{event.reminderDaysOffset}D]
                                                                </span>
                                                                <span className="truncate font-medium ml-0.5">{event.title}</span>
                                                            </div>
                                                        ) : (
                                                            <div className="truncate flex items-center gap-1.5">
                                                                {event.label && (
                                                                    <span className="font-bold text-blue-600 bg-blue-100/50 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide opacity-80 flex-shrink-0">
                                                                        {event.label}
                                                                    </span>
                                                                )}
                                                                <span className="truncate font-medium text-gray-700">{event.title}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        })}
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

            {/* Day Detail Dialog - Shows all events for a day when +N is clicked */}
            <Dialog open={dayDetailOpen} onOpenChange={setDayDetailOpen}>
                <DialogContent className="max-w-md backdrop-blur-2xl bg-white/90 border-white/40 rounded-[1.5rem] shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            <span className="w-2 h-6 bg-blue-600 rounded-full" />
                            {dayDetailEvents.length > 0 && format(new Date(dayDetailEvents[0].displayDate || dayDetailEvents[0].date), 'yyyy年M月d日')}
                        </DialogTitle>
                        <DialogDescription>当日共有 {dayDetailEvents.length} 条日程</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 max-h-[60vh] overflow-y-auto px-1 py-1 mt-4 custom-scrollbar">
                        {dayDetailEvents.map(event => {
                            const isReminder = event.isReminder;
                            const isCompleted = event.completed;
                            return (
                                <div
                                    key={`detail-${event.id}`}
                                    onClick={() => {
                                        setDayDetailOpen(false);
                                        handleEventClick(event);
                                    }}
                                    className={`p-2.5 rounded-2xl border transition-all cursor-pointer flex items-center gap-3 ${isReminder
                                        ? 'bg-emerald-50/40 border-emerald-100/40 hover:border-emerald-300'
                                        : isCompleted
                                            ? 'bg-gray-50/40 border-gray-100/40 opacity-50'
                                            : 'bg-white/60 border-black/[0.03] hover:border-blue-300 hover:shadow-lg hover:-translate-y-0.5'
                                        }`}
                                >
                                    {isReminder ? (
                                        <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-lg">🔔</div>
                                    ) : (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleToggleComplete(event);
                                                setDayDetailEvents(prev => prev.map(ev => ev.id === event.id ? { ...ev, completed: !ev.completed } : ev));
                                            }}
                                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${isCompleted
                                                ? 'bg-blue-600 border-blue-600 text-white shadow-inner'
                                                : 'border-blue-100 bg-white/50 hover:border-blue-400'
                                                }`}
                                        >
                                            {isCompleted && <Check className="h-3 w-3 stroke-[3]" />}
                                        </button>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            {event.label && (
                                                <Badge variant="secondary" className="bg-blue-100/50 text-blue-700 hover:bg-blue-100/50 text-[10px] px-1.5 py-0 border-none uppercase font-black">
                                                    {event.label}
                                                </Badge>
                                            )}
                                            {event.time && <span className="text-[10px] font-bold text-gray-400">{event.time}</span>}
                                        </div>
                                        <div className={`font-semibold truncate ${isCompleted ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                                            {event.title}
                                            {event.isReminder && event.reminderDaysOffset != null && (
                                                <span className="ml-1.5 font-black text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-lg border border-emerald-100">
                                                    [-{event.reminderDaysOffset}D]
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-gray-300" />
                                </div>
                            );
                        })}
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
                        <Button
                            variant="outline"
                            className="rounded-xl border-gray-200 hover:bg-gray-50"
                            onClick={() => setDayDetailOpen(false)}
                        >
                            关闭
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
