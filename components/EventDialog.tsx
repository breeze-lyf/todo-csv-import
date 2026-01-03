'use client'

import { useState, useEffect } from 'react'
import { Check } from 'lucide-react'
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
    completed: z.boolean().default(false),
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
        completed?: boolean
    }
    defaultDate?: string // 新增：点击空白日期时传入
    onSuccess?: () => void
}

export function EventDialog({ open, onOpenChange, event, defaultDate, onSuccess }: EventDialogProps) {
    const [loading, setLoading] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const { toast } = useToast()

    const { register, handleSubmit, formState: { errors }, reset } = useForm<EventFormData>({
        resolver: zodResolver(eventSchema) as any,
        defaultValues: event ? {
            title: event.title,
            date: event.date,
            time: event.time || '',
            label: event.label || '',
            notes: event.notes || '',
            completed: event.completed || false,
        } : defaultDate ? {
            title: '',
            date: defaultDate,
            time: '',
            label: '',
            notes: '',
            completed: false,
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
                    completed: event.completed || false,
                })
            } else if (defaultDate) {
                reset({
                    title: '',
                    date: defaultDate,
                    time: '',
                    label: '',
                    notes: '',
                    completed: false,
                })
            } else {
                reset({
                    title: '',
                    date: '',
                    time: '',
                    label: '',
                    notes: '',
                    completed: false,
                })
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
                const errorMessage = json.message || json.error || 'Failed to save event'
                throw new Error(errorMessage)
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
            <DialogContent className="sm:max-w-[420px] backdrop-blur-3xl bg-white/95 border-white/40 rounded-[2rem] shadow-2xl p-6 sm:p-7">
                <DialogHeader className="mb-2">
                    <DialogTitle className="text-xl font-black text-gray-900 flex items-center gap-2.5">
                        <div className="w-1.5 h-6 bg-blue-600 rounded-full" />
                        {event ? '编辑日程' : '新建日程'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-1">
                        <Label htmlFor="title" className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">标题 *</Label>
                        <Input
                            id="title"
                            {...register('title')}
                            placeholder="例：合同续签"
                            className="h-10 px-3.5 bg-white/50 border-black/5 rounded-xl focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all text-sm shadow-none"
                        />
                        {errors.title && <p className="text-[10px] text-red-500 font-bold ml-1">{errors.title.message}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <Label htmlFor="date" className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">日期 *</Label>
                            <Input
                                id="date"
                                type="date"
                                {...register('date')}
                                className="h-10 px-3.5 bg-white/50 border-black/5 rounded-xl focus:bg-white transition-all text-sm shadow-none"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="time" className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">时间 (可选)</Label>
                            <Input
                                id="time"
                                type="time"
                                {...register('time')}
                                className="h-10 px-3.5 bg-white/50 border-black/5 rounded-xl focus:bg-white transition-all text-sm shadow-none"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <Label htmlFor="label" className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">标签 (可选)</Label>
                        <Input
                            id="label"
                            placeholder="例：合同、证书"
                            {...register('label')}
                            className="h-10 px-3.5 bg-white/50 border-black/5 rounded-xl focus:bg-white transition-all text-sm shadow-none"
                        />
                    </div>

                    <div className="space-y-1">
                        <Label htmlFor="notes" className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">备注 (可选)</Label>
                        <Textarea
                            id="notes"
                            rows={3}
                            {...register('notes')}
                            placeholder="填写额外说明..."
                            className="p-3 bg-white/50 border-black/5 rounded-xl focus:bg-white transition-all text-sm shadow-none resize-none"
                        />
                    </div>

                    <div className="flex items-center gap-3 py-1 group cursor-pointer">
                        <div className="relative flex items-center">
                            <input
                                type="checkbox"
                                id="completed"
                                {...register('completed')}
                                className="peer h-6 w-6 rounded-lg border-2 border-blue-100 text-blue-600 focus:ring-0 cursor-pointer appearance-none transition-all checked:bg-blue-600 checked:border-blue-600"
                            />
                            <Check className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none stroke-[4]" />
                        </div>
                        <Label htmlFor="completed" className="font-bold cursor-pointer text-blue-600 text-sm select-none">
                            标记为已完成
                        </Label>
                    </div>

                    <DialogFooter className="gap-3 pt-6 sm:justify-end border-t border-black/[0.03] -mx-8 px-8">
                        {event && (
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={handleDelete}
                                disabled={loading || deleting}
                                className="text-red-500 hover:text-red-600 hover:bg-red-50 rounded-2xl px-6 transition-all"
                            >
                                {deleting ? '删除中...' : '删除'}
                            </Button>
                        )}
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            className="rounded-2xl border-black/5 hover:bg-gray-50 px-6 transition-all"
                            disabled={loading || deleting}
                        >
                            取消
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading || deleting}
                            className="rounded-2xl bg-blue-600 hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/30 hover:-translate-y-0.5 px-8 transition-all"
                        >
                            {loading ? '保存中...' : event ? '保存修改' : '创建日程'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
