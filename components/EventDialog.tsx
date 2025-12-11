'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useToast } from '@/hooks/use-toast'

const eventSchema = z.object({
    title: z.string().min(1, 'Title is required'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
    time: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal('')),
    label: z.string().optional(),
    notes: z.string().optional(),
})

type EventFormData = z.infer<typeof eventSchema>

interface EventDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    event?: {
        id: string
        title: string
        date: string
        time?: string | null
        label?: string | null
        notes?: string | null
    }
    defaultDate?: string // 新增：点击空白日期时传入
    onSuccess?: () => void
}

export function EventDialog({ open, onOpenChange, event, defaultDate, onSuccess }: EventDialogProps) {
    const [loading, setLoading] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const { toast } = useToast()

    const { register, handleSubmit, formState: { errors }, reset } = useForm<EventFormData>({
        resolver: zodResolver(eventSchema),
        defaultValues: event ? {
            title: event.title,
            date: event.date,
            time: event.time || '',
            label: event.label || '',
            notes: event.notes || '',
        } : defaultDate ? {
            title: '',
            date: defaultDate,
            time: '',
            label: '',
            notes: '',
        } : undefined,
    })

    // 当 dialog 打开时重置表单
    useEffect(() => {
        if (open) {
            if (event) {
                reset({
                    title: event.title,
                    date: event.date,
                    time: event.time || '',
                    label: event.label || '',
                    notes: event.notes || '',
                })
            } else if (defaultDate) {
                reset({
                    title: '',
                    date: defaultDate,
                    time: '',
                    label: '',
                    notes: '',
                })
            } else {
                reset()
            }
        }
    }, [open, event, defaultDate, reset])

    const onSubmit = async (data: EventFormData) => {
        setLoading(true)

        try {
            const url = event ? `/api/events/${event.id}` : '/api/events'
            const method = event ? 'PUT' : 'POST'

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            })

            if (!res.ok) {
                const json = await res.json()
                throw new Error(json.error || 'Failed to save event')
            }

            toast({
                title: event ? 'Event updated' : 'Event created',
                description: `${data.title} has been ${event ? 'updated' : 'created'} successfully.`,
            })

            reset()
            onOpenChange(false)
            onSuccess?.()
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: err instanceof Error ? err.message : 'Something went wrong',
            })
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async () => {
        if (!event) return
        if (!confirm('Are you sure you want to delete this event?')) return

        setDeleting(true)
        try {
            const res = await fetch(`/api/events/${event.id}`, {
                method: 'DELETE',
            })

            if (!res.ok) {
                throw new Error('Failed to delete event')
            }

            toast({
                title: 'Event deleted',
                description: `${event.title} has been deleted.`,
            })

            onOpenChange(false)
            onSuccess?.()
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: err instanceof Error ? err.message : 'Failed to delete event',
            })
        } finally {
            setDeleting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{event ? 'Edit Event' : 'New Event'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div>
                        <Label htmlFor="title">Title *</Label>
                        <Input id="title" {...register('title')} placeholder="e.g., Contract renewal" />
                        {errors.title && <p className="text-sm text-red-500 mt-1">{errors.title.message}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="date">Date *</Label>
                            <Input id="date" type="date" {...register('date')} />
                            {errors.date && <p className="text-sm text-red-500 mt-1">{errors.date.message}</p>}
                        </div>
                        <div>
                            <Label htmlFor="time">Time (optional)</Label>
                            <Input id="time" type="time" {...register('time')} />
                            {errors.time && <p className="text-sm text-red-500 mt-1">{errors.time.message}</p>}
                        </div>
                    </div>

                    <div>
                        <Label htmlFor="label">Label (optional)</Label>
                        <Input id="label" placeholder="e.g., Contract, Certificate" {...register('label')} />
                    </div>

                    <div>
                        <Label htmlFor="notes">Notes (optional)</Label>
                        <Textarea id="notes" rows={3} {...register('notes')} placeholder="Add any additional notes..." />
                    </div>

                    <DialogFooter className="gap-2">
                        {event && (
                            <Button
                                type="button"
                                variant="destructive"
                                onClick={handleDelete}
                                disabled={loading || deleting}
                                className="mr-auto"
                            >
                                {deleting ? 'Deleting...' : 'Delete'}
                            </Button>
                        )}
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading || deleting}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading || deleting}>
                            {loading ? 'Saving...' : event ? 'Update' : 'Create'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
