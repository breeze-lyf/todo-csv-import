'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRouter } from 'next/navigation'

interface ReminderRule {
    id: string
    label: string
    offsetsInDays: number[]
    defaultTime: string
}

export default function SettingsPage() {
    const router = useRouter()
    const [rules, setRules] = useState<ReminderRule[]>([])
    const [loading, setLoading] = useState(true)
    const [newRule, setNewRule] = useState({
        label: '',
        offsetsInDays: '7,3,1',
        defaultTime: '10:00',
    })

    useEffect(() => {
        fetchRules()
    }, [])

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

    const handleCreateRule = async () => {
        try {
            const offsetsArray = newRule.offsetsInDays.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n))

            const res = await fetch('/api/reminder-rules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    label: newRule.label,
                    offsetsInDays: offsetsArray,
                    defaultTime: newRule.defaultTime,
                }),
            })

            if (res.ok) {
                setNewRule({ label: '', offsetsInDays: '7,3,1', defaultTime: '10:00' })
                fetchRules()
            } else {
                const data = await res.json()
                alert('Failed to create rule: ' + data.error)
            }
        } catch (error) {
            console.error('Create rule error:', error)
            alert('Failed to create rule')
        }
    }

    const handleDeleteRule = async (id: string) => {
        if (!confirm('Delete this rule?')) return

        try {
            const res = await fetch(`/api/reminder-rules/${id}`, {
                method: 'DELETE',
            })

            if (res.ok) {
                fetchRules()
            }
        } catch (error) {
            console.error('Delete rule error:', error)
        }
    }

    const requestNotificationPermission = async () => {
        if (!('Notification' in window)) {
            alert('This browser does not support notifications')
            return
        }

        const permission = await Notification.requestPermission()

        if (permission === 'granted') {
            // Subscribe to push notifications
            try {
                const registration = await navigator.serviceWorker.ready

                // Get VAPID public key
                const keyRes = await fetch('/api/push/vapid-public-key')
                const { publicKey } = await keyRes.json()

                const subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: publicKey,
                })

                // Send subscription to server
                await fetch('/api/push/subscribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(subscription.toJSON()),
                })

                alert('Push notifications enabled!')
            } catch (error) {
                console.error('Push subscription error:', error)
                alert('Failed to enable push notifications')
            }
        }
    }

    return (
        <div className="p-8 min-h-screen bg-gray-50">
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex justify-between items-center">
                    <h1 className="text-3xl font-bold">Settings</h1>
                    <Button variant="outline" onClick={() => router.push('/calendar')}>
                        Back to Calendar
                    </Button>
                </div>

                {/* Notification Settings */}
                <Card>
                    <CardHeader>
                        <CardTitle>Push Notifications</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-gray-600 mb-4">
                            Enable browser notifications to receive reminders even when the app is closed.
                        </p>
                        <Button onClick={requestNotificationPermission}>
                            Enable Notifications
                        </Button>
                    </CardContent>
                </Card>

                {/* Reminder Rules */}
                <Card>
                    <CardHeader>
                        <CardTitle>Reminder Rules</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div>
                            <p className="text-sm text-gray-600 mb-4">
                                Configure how many days before an event you want to be reminded, based on event labels.
                            </p>

                            {loading ? (
                                <p>Loading...</p>
                            ) : rules.length === 0 ? (
                                <p className="text-sm text-gray-500">No custom rules. Using default: 1 day before at 10:00</p>
                            ) : (
                                <div className="space-y-2">
                                    {rules.map(rule => (
                                        <div key={rule.id} className="flex items-center justify-between p-3 border rounded">
                                            <div>
                                                <p className="font-semibold">{rule.label}</p>
                                                <p className="text-sm text-gray-600">
                                                    Remind {rule.offsetsInDays.join(', ')} days before at {rule.defaultTime}
                                                </p>
                                            </div>
                                            <Button variant="destructive" size="sm" onClick={() => handleDeleteRule(rule.id)}>
                                                Delete
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="border-t pt-4">
                            <h3 className="font-semibold mb-3">Add New Rule</h3>
                            <div className="grid gap-4">
                                <div>
                                    <Label htmlFor="label">Label</Label>
                                    <Input
                                        id="label"
                                        placeholder="e.g., Contract, Certificate"
                                        value={newRule.label}
                                        onChange={(e) => setNewRule({ ...newRule, label: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="offsets">Days Before (comma-separated)</Label>
                                    <Input
                                        id="offsets"
                                        placeholder="e.g., 7,3,1"
                                        value={newRule.offsetsInDays}
                                        onChange={(e) => setNewRule({ ...newRule, offsetsInDays: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="time">Default Time</Label>
                                    <Input
                                        id="time"
                                        type="time"
                                        value={newRule.defaultTime}
                                        onChange={(e) => setNewRule({ ...newRule, defaultTime: e.target.value })}
                                    />
                                </div>
                                <Button onClick={handleCreateRule} disabled={!newRule.label}>
                                    Add Rule
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
