'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

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
    onSuccess?: () => void
}

export function EventDialog({ open, onOpenChange, event, onSuccess }: EventDialogProps) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const { register, handleSubmit, formState: { errors }, reset } = useForm<EventFormData>({
        resolver: zodResolver(eventSchema),
        defaultValues: event ? {
            title: event.title,
            date: event.date,
            time: event.time || '',
            label: event.label || '',
            notes: event.notes || '',
        } : undefined,
    })

    const onSubmit = async (data: EventFormData) => {
        setLoading(true)
        setError(null)

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

            reset()
            onOpenChange(false)
            onSuccess?.()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong')
        } finally {
            setLoading(false)
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
                        <Input id="title" {...register('title')} />
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
                        <Textarea id="notes" rows={3} {...register('notes')} />
                    </div>

                    {error && <p className="text-sm text-red-500">{error}</p>}

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? 'Saving...' : event ? 'Update' : 'Create'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
