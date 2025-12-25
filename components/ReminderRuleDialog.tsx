'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'

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
            // 处理逗号：将中文逗号替换为英文逗号
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
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{rule ? '编辑提醒规则' : '新增提醒规则'}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="label">标签</Label>
                        <Input
                            id="label"
                            placeholder="例：合同、证书"
                            value={formData.label}
                            onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="offsets">提前天数（逗号分隔，支持中英文逗号）</Label>
                        <Input
                            id="offsets"
                            placeholder="例：7,3,1 或 7，3，1"
                            value={formData.offsetsInDays}
                            onChange={(e) => setFormData({ ...formData, offsetsInDays: e.target.value })}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="time">默认时间</Label>
                        <Input
                            id="time"
                            type="time"
                            value={formData.defaultTime}
                            onChange={(e) => setFormData({ ...formData, defaultTime: e.target.value })}
                        />
                    </div>
                    <div className="flex items-center space-x-2 pt-2">
                        <input
                            type="checkbox"
                            id="avoidWeekends"
                            checked={formData.avoidWeekends}
                            onChange={(e) => setFormData({ ...formData, avoidWeekends: e.target.checked })}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 cursor-pointer"
                        />
                        <Label
                            htmlFor="avoidWeekends"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                            自动回避周末（若落在周末则提前到周五）
                        </Label>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        取消
                    </Button>
                    <Button onClick={handleSubmit} disabled={loading || !formData.label}>
                        {loading ? '正在保存...' : '确认'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
