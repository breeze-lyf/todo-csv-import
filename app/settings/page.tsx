'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'

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
        e.stopPropagation() // Prevent opening the dialog
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

    // ... (keep requestNotificationPermission, subscribeToPush, triggerTestNotification unchanged)
    const requestNotificationPermission = async () => {
        // ... (existing code)
        console.log('[Push] Button clicked - starting permission request...')
        if (!('Notification' in window)) {
            alert('❌ 当前浏览器不支持通知')
            setNotificationStatus('unsupported')
            return
        }
        if (!('serviceWorker' in navigator)) {
            alert('❌ 当前浏览器不支持 Service Worker')
            setNotificationStatus('unsupported')
            return
        }
        if (Notification.permission === 'granted') {
            await subscribeToPush()
            return
        }
        if (Notification.permission === 'denied') {
            alert('❌ 通知被阻止，请在浏览器设置中开启')
            return
        }
        try {
            const permission = await Notification.requestPermission()
            if (permission === 'granted') {
                await subscribeToPush()
                setNotificationStatus('granted')
            } else {
                setNotificationStatus('denied')
            }
        } catch (error) {
            console.error('[Push] Permission request error:', error)
        }
    }

    const subscribeToPush = async () => {
        try {
            const registration = await navigator.serviceWorker.ready
            const keyRes = await fetch('/api/push/vapid-public-key')
            const { publicKey } = await keyRes.json()
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: publicKey,
            })
            await fetch('/api/push/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(subscription.toJSON()),
            })
            setNotificationStatus('granted')
        } catch (error) {
            console.error('[Push] Subscription error:', error)
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
        <div className="p-8 min-h-screen bg-gray-50">
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex justify-between items-center">
                    <h1 className="text-3xl font-bold">提醍设置</h1>
                    <Button variant="outline" onClick={() => router.push('/calendar')}>
                        返回日历
                    </Button>
                </div>

                {/* Notification Settings */}
                <Card>
                    <CardHeader>
                        <CardTitle>浏览器通知</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-gray-600 mb-4">
                            开启浏览器通知，关闭页面也能收到提醒。
                        </p>
                        <div className="flex gap-3 flex-wrap">
                            <Button
                                onClick={requestNotificationPermission}
                                variant={notificationStatus === 'granted' ? 'secondary' : 'default'}
                                disabled={notificationStatus === 'unsupported' || notificationStatus === 'granted'}
                            >
                                {notificationStatus === 'unsupported' && '浏览器不支持'}
                                {notificationStatus === 'granted' && '已开启通知'}
                                {notificationStatus === 'denied' && '已被拒绝，去浏览器设置开启'}
                                {notificationStatus === 'default' && '开启通知'}
                            </Button>
                            <Button
                                variant="outline"
                                onClick={triggerTestNotification}
                                disabled={notificationStatus === 'unsupported'}
                            >
                                测试提醒
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Reminder Rules */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0">
                        <CardTitle>提醒规则</CardTitle>
                        <Button onClick={handleAddRule} size="sm">新增规则</Button>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-gray-600 mb-4">
                            可按标签设置提前多少天提醒，以及默认提醒时间。点击条目可修改。
                        </p>

                        {loading ? (
                            <p>加载中...</p>
                        ) : rules.length === 0 ? (
                            <p className="text-sm text-gray-500">暂无自定义规则。默认：提前 1 天，时间 10:00。</p>
                        ) : (
                            <div className="space-y-3">
                                {rules.map(rule => (
                                    <div
                                        key={rule.id}
                                        onClick={() => handleEditRule(rule)}
                                        className="flex items-center justify-between p-4 bg-white border rounded-lg hover:border-blue-400 hover:shadow-sm transition-all cursor-pointer group"
                                    >
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <p className="font-bold text-lg">{rule.label}</p>
                                                {rule.avoidWeekends && (
                                                    <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium">跳过周末</span>
                                                )}
                                                <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded uppercase font-medium opacity-0 group-hover:opacity-100 transition-opacity">点击修改</span>
                                            </div>
                                            <p className="text-sm text-gray-500 font-medium">
                                                提前 <span className="text-blue-600">{rule.offsetsInDays.join(', ')}</span> 天，提醒时间 <span className="text-blue-600">{rule.defaultTime}</span>
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleEditRule(rule);
                                                }}
                                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                修改
                                            </Button>
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={(e) => handleDeleteRule(e, rule.id)}
                                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                删除
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
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
