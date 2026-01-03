'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'
import {
    Bell,
    Plus,
    Trash2,
    ArrowLeft,
    Clock,
    ShieldAlert,
    CheckCircle2,
    AlertCircle,
    BellRing,
    CalendarDays
} from 'lucide-react'

import { ReminderRuleDialog } from '@/components/ReminderRuleDialog'

interface ReminderRule {
    id: string
    label: string
    offsetsInDays: number[]
    defaultTime: string
    avoidWeekends: boolean
}

export default function SettingsPage() {
    const router = useRouter()
    const { toast } = useToast()
    const [rules, setRules] = useState<ReminderRule[]>([])
    const [loading, setLoading] = useState(true)
    const [notificationStatus, setNotificationStatus] = useState<'unsupported' | 'default' | 'granted' | 'denied'>('default')

    // Dialog state
    const [dialogOpen, setDialogOpen] = useState(false)
    const [selectedRule, setSelectedRule] = useState<ReminderRule | undefined>()

    useEffect(() => {
        fetchRules()
        refreshNotificationStatus()
    }, [])

    const refreshNotificationStatus = () => {
        if (typeof window === 'undefined' || !('Notification' in window)) {
            setNotificationStatus('unsupported')
            return
        }
        const status = Notification.permission as PermissionState
        if (status === 'granted') setNotificationStatus('granted')
        else if (status === 'denied') setNotificationStatus('denied')
        else setNotificationStatus('default')
    }

    const fetchRules = async () => {
        try {
            const res = await fetch('/api/reminder-rules')
            if (res.ok) {
                const data = await res.json()
                setRules(data.rules)
            }
        } catch (error) {
            console.error('Failed to fetch rules:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleDeleteRule = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation()
        if (!confirm('确认删除这条提醒规则？')) return

        try {
            const res = await fetch(`/api/reminder-rules/${id}`, {
                method: 'DELETE',
            })

            if (res.ok) {
                fetchRules()
                toast({ title: '已删除', description: '提醒规则已移除' })
            }
        } catch (error) {
            console.error('Delete rule error:', error)
        }
    }

    const handleEditRule = (rule: ReminderRule) => {
        setSelectedRule(rule)
        setDialogOpen(true)
    }

    const handleAddRule = () => {
        setSelectedRule(undefined)
        setDialogOpen(true)
    }

    const requestNotificationPermission = async () => {
        toast({ title: '正在请求通知权限...', description: '请查看浏览器弹窗并选择“允许”' })

        if (!('Notification' in window)) {
            toast({ variant: 'destructive', title: '不支持通知', description: '当前浏览器不支持原生通知功能' })
            setNotificationStatus('unsupported')
            return
        }
        if (!('serviceWorker' in navigator)) {
            toast({ variant: 'destructive', title: '不支持 Service Worker', description: '当前浏览器环境无法启用消息推送' })
            setNotificationStatus('unsupported')
            return
        }

        if (Notification.permission === 'granted') {
            toast({ title: '权限已授予', description: '正在配置消息推送...' })
            await subscribeToPush()
            return
        }

        if (Notification.permission === 'denied') {
            toast({
                variant: 'destructive',
                title: '通知权限已被拒绝',
                description: '请在浏览器地址栏左侧点击“锁”图标，重置权限后重试。'
            })
            setNotificationStatus('denied')
            return
        }

        try {
            const permission = await Notification.requestPermission()

            if (permission === 'granted') {
                toast({ title: '授权成功', description: '正在完成最后一步配置...' })
                await subscribeToPush()
                setNotificationStatus('granted')
            } else {
                toast({
                    variant: 'destructive',
                    title: '权限未授予',
                    description: `当前状态为: ${permission}`
                })
                setNotificationStatus(permission === 'denied' ? 'denied' : 'default')
            }
        } catch (error) {
            console.error('[Push] Permission request error:', error)
        }
    }

    const subscribeToPush = async () => {
        try {
            const registration = await navigator.serviceWorker.ready
            const keyRes = await fetch('/api/push/vapid-public-key')
            if (!keyRes.ok) {
                const errorData = await keyRes.json()
                throw new Error(errorData.error || '无法获取 VAPID 公钥')
            }

            const { publicKey } = await keyRes.json()
            if (!publicKey) throw new Error('VAPID 公钥配置错误')

            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: publicKey,
            })

            const res = await fetch('/api/push/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(subscription.toJSON()),
            })

            if (res.ok) {
                toast({ title: '通知开启成功', description: '您现在可以接收日程提醒了' })
                setNotificationStatus('granted')
            } else {
                const errorData = await res.json()
                throw new Error(errorData.error || '服务器保存订阅失败')
            }
        } catch (error) {
            console.error('[Push] Subscription error:', error)
            toast({
                variant: 'destructive',
                title: '订阅通知失败',
                description: error instanceof Error ? error.message : '请刷新页面重试'
            })
        }
    }

    const triggerTestNotification = async () => {
        if (typeof window === 'undefined' || !('Notification' in window)) {
            toast({ variant: 'destructive', title: '不支持通知' })
            return
        }
        if (Notification.permission === 'default') {
            await Notification.requestPermission()
            refreshNotificationStatus()
        }
        if (Notification.permission === 'denied') {
            toast({ variant: 'destructive', title: '通知被拒绝' })
            return
        }
        const options: NotificationOptions = {
            body: '这是一个示例提醒',
            tag: 'demo-notification',
            requireInteraction: true,
            icon: '/favicon.ico',
        }
        try {
            const registration = await navigator.serviceWorker.ready
            await registration.showNotification('测试提醒', options)
            toast({ title: '测试提醒已发送' })
        } catch (err) {
            console.error(err)
        }
    }

    return (
        <div className="min-h-screen bg-[#F8FAFC] relative overflow-hidden font-sans selection:bg-blue-100 selection:text-blue-900">
            {/* Dynamic Background */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden isolate">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-400/10 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-400/10 rounded-full blur-[120px] animate-pulse delay-1000" />
                <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-emerald-400/5 rounded-full blur-[120px] animate-pulse delay-700" />
            </div>

            <div className="relative max-w-5xl mx-auto px-6 py-12 space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-10 bg-blue-600 rounded-full shadow-[0_0_20px_rgba(37,99,235,0.3)]" />
                            <h1 className="text-4xl font-black text-gray-900 tracking-tight">提醒设置</h1>
                        </div>
                        <p className="text-gray-400 font-bold uppercase tracking-widest text-[11px] ml-5">Notification & Reminder Rules</p>
                    </div>
                    <Button
                        variant="ghost"
                        onClick={() => router.push('/calendar')}
                        className="rounded-2xl px-6 bg-white shadow-xl shadow-black/5 hover:bg-gray-50 border border-black/5 group transition-all"
                    >
                        <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                        返回日历
                    </Button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    {/* Left Column: Notification Status */}
                    <div className="lg:col-span-5 space-y-6">
                        <Card className="backdrop-blur-3xl bg-white/80 border-white/60 rounded-[2.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.08)] overflow-hidden transition-all hover:shadow-[0_45px_80px_-20px_rgba(0,0,0,0.12)]">
                            <CardHeader className="pb-4">
                                <CardTitle className="text-xl font-black text-gray-900 flex items-center gap-3">
                                    <BellRing className="h-5 w-5 text-blue-600" />
                                    浏览器通知
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="p-5 rounded-3xl bg-black/[0.02] border border-black/[0.03] space-y-3">
                                    <p className="text-sm text-gray-500 font-medium leading-relaxed">
                                        开启浏览器通知，即使关闭网页，系统也会在预定时间向您发送推送提醒。
                                    </p>

                                    <div className="flex items-center gap-2">
                                        {notificationStatus === 'granted' ? (
                                            <div className="flex items-center gap-2 text-emerald-600 font-black text-xs bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100">
                                                <CheckCircle2 className="h-3.5 w-3.5" />
                                                推送功能已激活
                                            </div>
                                        ) : notificationStatus === 'denied' ? (
                                            <div className="flex items-center gap-2 text-red-500 font-black text-xs bg-red-50 px-3 py-1.5 rounded-xl border border-red-100">
                                                <AlertCircle className="h-3.5 w-3.5" />
                                                通知已被屏蔽
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 text-blue-600 font-black text-xs bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100">
                                                <ShieldAlert className="h-3.5 w-3.5" />
                                                尚未开启通知
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex flex-col gap-3">
                                    <Button
                                        onClick={requestNotificationPermission}
                                        disabled={notificationStatus === 'unsupported' || notificationStatus === 'granted'}
                                        className={`rounded-2xl h-14 w-full font-black text-base shadow-lg transition-all active:scale-95 ${notificationStatus === 'granted'
                                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
                                                : 'bg-gray-900 hover:bg-black text-white shadow-black/20'
                                            }`}
                                    >
                                        <Bell className="h-5 w-5 mr-2" />
                                        {notificationStatus === 'unsupported' && '浏览器不支持通知'}
                                        {notificationStatus === 'granted' && '通知已开启'}
                                        {notificationStatus === 'denied' && '重新配置通知权限'}
                                        {notificationStatus === 'default' && '立即开启提醒推送'}
                                    </Button>

                                    <Button
                                        variant="outline"
                                        onClick={triggerTestNotification}
                                        disabled={notificationStatus === 'unsupported'}
                                        className="rounded-2xl h-12 border-black/5 hover:bg-white hover:shadow-md transition-all font-bold text-gray-600"
                                    >
                                        发送测试提醒
                                    </Button>
                                </div>

                                {notificationStatus === 'denied' && (
                                    <p className="text-[10px] text-red-400 font-bold text-center uppercase tracking-widest px-4">
                                        请在浏览器地址栏左侧点击“锁”图标，手动将通知设置为“允许”。
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right Column: Reminder Rules */}
                    <div className="lg:col-span-7 space-y-6">
                        <Card className="backdrop-blur-3xl bg-white/80 border-white/60 rounded-[2.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.08)] min-h-[500px] flex flex-col">
                            <CardHeader className="flex flex-row items-center justify-between pb-6">
                                <CardTitle className="text-xl font-black text-gray-900 flex items-center gap-3">
                                    <CalendarDays className="h-5 w-5 text-blue-600" />
                                    提醒规则
                                </CardTitle>
                                <Button
                                    onClick={handleAddRule}
                                    size="sm"
                                    className="rounded-xl bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20 font-bold px-4 h-9"
                                >
                                    <Plus className="h-4 w-4 mr-1" />
                                    新增规则
                                </Button>
                            </CardHeader>
                            <CardContent className="flex-1 space-y-6">
                                <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100/50">
                                    <p className="text-xs text-blue-700/70 font-bold leading-relaxed">
                                        根据“标签”自动设置规则。导入或创建包含对应标签的日程时，系统会自动生成提前提醒。
                                    </p>
                                </div>

                                {loading ? (
                                    <div className="flex flex-col items-center justify-center py-20 space-y-4">
                                        <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
                                        <p className="text-gray-400 font-bold text-xs uppercase tracking-widest">加载规则中...</p>
                                    </div>
                                ) : rules.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                                        <div className="w-16 h-16 rounded-3xl bg-gray-50 flex items-center justify-center text-gray-200">
                                            <Bell className="h-8 w-8" />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-gray-500 font-bold">暂无自定义规则</p>
                                            <p className="text-[11px] text-gray-400 font-medium">默认：提前 1 天，早上 10:00 提醒</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {rules.map(rule => (
                                            <div
                                                key={rule.id}
                                                onClick={() => handleEditRule(rule)}
                                                className="group relative flex flex-col p-5 bg-white shadow-sm hover:shadow-xl hover:shadow-black/5 rounded-[2rem] border border-black/5 hover:border-blue-400 transition-all cursor-pointer overflow-hidden animate-in fade-in slide-in-from-bottom-4"
                                            >
                                                <div className="flex items-center justify-between mb-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center">
                                                            <span className="text-blue-600 font-black text-sm">{rule.label.charAt(0)}</span>
                                                        </div>
                                                        <div>
                                                            <p className="font-black text-lg text-gray-900">{rule.label}</p>
                                                            {rule.avoidWeekends && (
                                                                <span className="text-[9px] bg-emerald-500 text-white px-2 py-0.5 rounded-full font-black uppercase tracking-tighter">
                                                                    跳过周末
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleEditRule(rule);
                                                            }}
                                                            className="h-9 w-9 rounded-xl text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                                                        >
                                                            <Clock className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={(e) => handleDeleteRule(e, rule.id)}
                                                            className="h-9 w-9 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>

                                                <div className="flex flex-wrap items-center gap-6 pt-4 border-t border-black/[0.03]">
                                                    <div className="space-y-1">
                                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">提前天数</p>
                                                        <p className="text-sm font-black text-blue-600">
                                                            {rule.offsetsInDays.map(d => `${d}天`).join('，')}
                                                        </p>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">提醒时刻</p>
                                                        <p className="text-sm font-black text-gray-700">{rule.defaultTime}</p>
                                                    </div>
                                                </div>

                                                <div className="absolute top-1/2 -right-2 -translate-y-1/2 opacity-0 group-hover:opacity-100 group-hover:right-4 transition-all pointer-events-none">
                                                    <ChevronRight className="h-5 w-5 text-blue-200" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>

            <ReminderRuleDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                rule={selectedRule}
                onSuccess={fetchRules}
            />
        </div>
    )
}

function ChevronRight({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="m9 18 6-6-6-6" />
        </svg>
    )
}
