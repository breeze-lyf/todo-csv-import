'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { Check } from 'lucide-react'

interface ReminderRule {
    id: string
    label: string
    offsetsInDays: number[]
    defaultTime: string
    avoidWeekends: boolean
}

interface ReminderRuleDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    rule?: ReminderRule
    onSuccess: () => void
}

export function ReminderRuleDialog({ open, onOpenChange, rule, onSuccess }: ReminderRuleDialogProps) {
    const [loading, setLoading] = useState(false)
    const { toast } = useToast()
    const [formData, setFormData] = useState({
        label: '',
        offsetsInDays: '7,3,1',
        defaultTime: '10:00',
        avoidWeekends: false,
    })

    useEffect(() => {
        if (open) {
            if (rule) {
                setFormData({
                    label: rule.label,
                    offsetsInDays: rule.offsetsInDays.join(','),
                    defaultTime: rule.defaultTime,
                    avoidWeekends: rule.avoidWeekends || false,
                })
            } else {
                setFormData({
                    label: '',
                    offsetsInDays: '7,3,1',
                    defaultTime: '10:00',
                    avoidWeekends: false,
                })
            }
        }
    }, [open, rule])

    const handleSubmit = async () => {
        if (!formData.label.trim()) {
            toast({
                variant: 'destructive',
                title: '提交失败',
                description: '标签不能为空',
            })
            return
        }

        setLoading(true)
        try {
            const processedOffsets = formData.offsetsInDays.replace(/，/g, ',')
            const offsetsArray = processedOffsets
                .split(',')
                .map(n => parseInt(n.trim()))
                .filter(n => !isNaN(n))

            const url = rule ? `/api/reminder-rules/${rule.id}` : '/api/reminder-rules'
            const method = rule ? 'PUT' : 'POST'

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    label: formData.label,
                    offsetsInDays: offsetsArray,
                    defaultTime: formData.defaultTime,
                    avoidWeekends: formData.avoidWeekends,
                }),
            })

            if (res.ok) {
                toast({
                    title: rule ? '规则已更新' : '规则已创建',
                    description: `标签 "${formData.label}" 的提醒规则已保存`,
                })
                onOpenChange(false)
                onSuccess()
            } else {
                const data = await res.json()
                throw new Error(data.error || '保存失败')
            }
        } catch (error) {
            console.error('Save rule error:', error)
            toast({
                variant: 'destructive',
                title: '保存失败',
                description: error instanceof Error ? error.message : '请稍后重试',
            })
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[420px] backdrop-blur-3xl bg-white/95 border-white/40 rounded-[2.5rem] shadow-2xl p-6 sm:p-7">
                <DialogHeader className="mb-2">
                    <DialogTitle className="text-xl font-black text-gray-900 flex items-center gap-2.5">
                        <div className="w-1.5 h-6 bg-blue-600 rounded-full" />
                        {rule ? '编辑规则' : '新增规则'}
                    </DialogTitle>
                    <DialogDescription className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-4">
                        Custom Reminder Logic
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="space-y-1">
                        <Label htmlFor="label" className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">标签名称</Label>
                        <Input
                            id="label"
                            placeholder="例：合同、证书"
                            value={formData.label}
                            onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                            className="h-10 px-3.5 bg-white/50 border-black/5 rounded-xl focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all text-sm shadow-none"
                        />
                    </div>

                    <div className="space-y-1">
                        <Label htmlFor="offsets" className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">提前天数 (逗号分隔)</Label>
                        <Input
                            id="offsets"
                            placeholder="例：7,3,1"
                            value={formData.offsetsInDays}
                            onChange={(e) => setFormData({ ...formData, offsetsInDays: e.target.value })}
                            className="h-10 px-3.5 bg-white/50 border-black/5 rounded-xl focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all text-sm shadow-none"
                        />
                    </div>

                    <div className="space-y-1">
                        <Label htmlFor="time" className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">默认提醒时间</Label>
                        <Input
                            id="time"
                            type="time"
                            value={formData.defaultTime}
                            onChange={(e) => setFormData({ ...formData, defaultTime: e.target.value })}
                            className="h-10 px-3.5 bg-white/50 border-black/5 rounded-xl focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all text-sm shadow-none"
                        />
                    </div>

                    <div
                        className="flex items-center gap-3 py-2 px-3 bg-black/[0.02] border border-black/[0.03] rounded-2xl group cursor-pointer transition-colors hover:bg-black/[0.04]"
                        onClick={() => setFormData({ ...formData, avoidWeekends: !formData.avoidWeekends })}
                    >
                        <div className="relative flex items-center">
                            <div className={`h-5 w-5 rounded-lg border-2 transition-all flex items-center justify-center ${formData.avoidWeekends
                                    ? 'bg-blue-600 border-blue-600 shadow-lg shadow-blue-500/20'
                                    : 'border-gray-200 bg-white group-hover:border-blue-300'
                                }`}>
                                {formData.avoidWeekends && <Check className="h-3 w-3 text-white stroke-[3px]" />}
                            </div>
                        </div>
                        <div className="space-y-0.5">
                            <Label
                                htmlFor="avoidWeekends"
                                className="text-sm font-bold text-gray-700 cursor-pointer block"
                            >
                                自动回避周末
                            </Label>
                            <p className="text-[10px] text-gray-400 font-medium leading-none">
                                若提醒落在周末，则自动提前到周五
                            </p>
                        </div>
                    </div>
                </div>

                <DialogFooter className="gap-2 pt-4 border-t border-black/[0.03] -mx-6 sm:-mx-7 px-6 sm:px-7 mt-2">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={loading}
                        className="rounded-xl border-black/5 hover:bg-gray-50 flex-1 sm:flex-none transition-all"
                    >
                        取消
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={loading || !formData.label}
                        className="rounded-xl bg-blue-600 hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/25 hover:-translate-y-0.5 flex-1 sm:flex-none transition-all font-bold px-8"
                    >
                        {loading ? '正在保存...' : '确认'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
