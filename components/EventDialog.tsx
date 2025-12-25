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
    title: z.string().min(1, '标题必填'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式需为 YYYY-MM-DD'),
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

        // 确保日期格式为 YYYY-MM-DD，即使在某些浏览器环境下显示不同
        const formattedDate = data.date.replace(/\//g, '-')

        // 清理数据：将空字符串转换为 null，确保后端校验通过
        const payloadData = {
            ...data,
            date: formattedDate,
            time: data.time || null,
            label: data.label || null,
            notes: data.notes || null,
        }

        try {
            const url = event ? `/api/events/${event.id}` : '/api/events'
            const method = event ? 'PUT' : 'POST'

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payloadData),
            })

            if (!res.ok) {
                const json = await res.json()
                throw new Error(json.error || 'Failed to save event')
            }

            toast({
                title: event ? '日程已更新' : '日程已创建',
                description: `${data.title} 已${event ? '更新' : '创建'}。`,
            })

            reset()
            onOpenChange(false)
            onSuccess?.()
        } catch (err) {
            toast({
                variant: 'destructive',
                title: '出错了',
                description: err instanceof Error ? err.message : '提交失败，请稍后重试',
            })
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async () => {
        if (!event) return
        if (!confirm('确定要删除这个日程吗？')) return

        setDeleting(true)
        try {
            const res = await fetch(`/api/events/${event.id}`, {
                method: 'DELETE',
            })

            if (!res.ok) {
                throw new Error('Failed to delete event')
            }

            toast({
                title: '日程已删除',
                description: `${event.title} 已删除。`,
            })

            onOpenChange(false)
            onSuccess?.()
        } catch (err) {
            toast({
                variant: 'destructive',
                title: '删除失败',
                description: err instanceof Error ? err.message : '删除日程时出错',
            })
        } finally {
            setDeleting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{event ? '编辑日程' : '新建日程'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div>
                        <Label htmlFor="title">标题 *</Label>
                        <Input id="title" {...register('title')} placeholder="例：合同续签" />
                        {errors.title && <p className="text-sm text-red-500 mt-1">{errors.title.message}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="date">日期 *</Label>
                            <Input id="date" type="date" {...register('date')} />
                            {errors.date && <p className="text-sm text-red-500 mt-1">{errors.date.message}</p>}
                        </div>
                        <div>
                            <Label htmlFor="time">时间（可选）</Label>
                            <Input id="time" type="time" {...register('time')} />
                            {errors.time && <p className="text-sm text-red-500 mt-1">{errors.time.message}</p>}
                        </div>
                    </div>

                    <div>
                        <Label htmlFor="label">标签（可选）</Label>
                        <Input id="label" placeholder="例：合同、证书" {...register('label')} />
                    </div>

                    <div>
                        <Label htmlFor="notes">备注（可选）</Label>
                        <Textarea id="notes" rows={3} {...register('notes')} placeholder="填写额外说明..." />
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
                                {deleting ? '删除中...' : '删除'}
                            </Button>
                        )}
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading || deleting}>
                            取消
                        </Button>
                        <Button type="submit" disabled={loading || deleting}>
                            {loading ? '保存中...' : event ? '保存修改' : '创建'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
