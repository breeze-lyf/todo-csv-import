'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Papa from 'papaparse'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

interface ParsedEvent {
    title: string
    date: string
    time?: string
    label?: string
    notes?: string
    _error?: string
}

export default function ImportPage() {
    const router = useRouter()
    const [file, setFile] = useState<File | null>(null)
    const [events, setEvents] = useState<ParsedEvent[]>([])
    const [importing, setImporting] = useState(false)
    const [result, setResult] = useState<{ created: number; failed: number } | null>(null)
    const templateUrl = '/templates/events-template.csv'

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0]
        if (selectedFile) {
            setFile(selectedFile)
            parseCSV(selectedFile)
        }
    }

    const parseCSV = (file: File) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const parsed: ParsedEvent[] = results.data.map((row: any, index) => {
                    const rawDate = row.date || row['日期'] || row.Date || ''
                    const normalizedDate = rawDate ? String(rawDate).replace(/\//g, '-') : ''
                    const rawTime = row.time || row['时间'] || row.Time || ''
                    let normalizedTime = rawTime ? String(rawTime) : undefined
                    if (normalizedTime && /^\d:\d{2}$/.test(normalizedTime)) {
                        normalizedTime = `0${normalizedTime}`
                    }

                    const event: ParsedEvent = {
                        title: row.title || row['标题'] || row.Title || '',
                        date: normalizedDate,
                        time: normalizedTime || undefined,
                        label: row.label || row['标签'] || row.Label || undefined,
                        notes: row.notes || row['备注'] || row.Notes || undefined,
                    }

                    // Validate
                    if (!event.title) {
                        event._error = '缺少标题'
                    } else if (!event.date || !/^\d{4}-\d{2}-\d{2}$/.test(event.date)) {
                        event._error = '日期格式错误（需 YYYY-MM-DD 或 YYYY/MM/DD）'
                    }

                    return event
                })

                setEvents(parsed)
            },
            error: (error) => {
                console.error('CSV parse error:', error)
                alert('CSV 解析失败，请检查文件格式')
            },
        })
    }

    const handleImport = async () => {
        const validEvents = events.filter(e => !e._error)

        if (validEvents.length === 0) {
            alert('没有可导入的有效数据')
            return
        }

        setImporting(true)
        try {
            const res = await fetch('/api/events/bulk-create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ events: validEvents }),
            })

            const data = await res.json()

            if (res.ok) {
                setResult({ created: data.created, failed: data.failed })
                setTimeout(() => router.push('/calendar'), 2000)
            } else {
                alert('导入失败：' + data.error)
            }
        } catch (error) {
            console.error('Import error:', error)
            alert('导入失败，请稍后重试')
        } finally {
            setImporting(false)
        }
    }

    return (
        <div className="p-8 min-h-screen bg-gray-50">
            <Card className="max-w-4xl mx-auto shadow-md">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <p className="text-sm text-gray-500 mb-1">批量导入</p>
                        <CardTitle>导入 CSV 日程</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={() => router.push('/calendar')}>
                            返回日历
                        </Button>
                        <Button asChild>
                            <a href={templateUrl} download>
                                下载 CSV 模板
                            </a>
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div>
                        <h3 className="font-semibold mb-2">格式说明</h3>
                        <p className="text-sm text-gray-600 mb-2">
                            必填列：<code className="bg-gray-100 px-1">title</code>（标题），<code className="bg-gray-100 px-1">date</code>（日期，格式 YYYY-MM-DD 或 YYYY/MM/DD）
                        </p>
                        <p className="text-sm text-gray-600">
                            选填列：<code className="bg-gray-100 px-1">time</code>（时间 HH:mm），<code className="bg-gray-100 px-1">label</code>（标签），<code className="bg-gray-100 px-1">notes</code>（备注）
                        </p>
                        <p className="text-xs text-gray-500 mt-2">
                            下载模板 → 填写数据 → 选择文件上传并校验 → 导入成功后自动跳转到日历。
                        </p>
                    </div>

                    <div>
                        <p className="text-sm font-medium mb-2">上传 CSV 文件</p>
                        <Input
                            type="file"
                            accept=".csv"
                            onChange={handleFileChange}
                            disabled={importing}
                        />
                    </div>

                    {events.length > 0 && (
                        <>
                            <div>
                                <h3 className="font-semibold mb-2">数据预览（{events.length} 行）</h3>
                                <div className="border rounded-lg overflow-auto max-h-96 shadow-inner bg-white">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-100 sticky top-0">
                                            <tr>
                                                <th className="p-2 text-left">标题</th>
                                                <th className="p-2 text-left">日期</th>
                                                <th className="p-2 text-left">时间</th>
                                                <th className="p-2 text-left">标签</th>
                                                <th className="p-2 text-left">校验状态</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {events.map((event, index) => (
                                                <tr key={index} className={event._error ? 'bg-red-50' : ''}>
                                                    <td className="p-2">{event.title}</td>
                                                    <td className="p-2">{event.date}</td>
                                                    <td className="p-2">{event.time || '-'}</td>
                                                    <td className="p-2">{event.label || '-'}</td>
                                                    <td className="p-2">
                                                        {event._error ? (
                                                            <span className="text-red-600 text-xs">{event._error}</span>
                                                        ) : (
                                                            <span className="text-green-600 text-xs">✓ 校验通过</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                </div>

                            <div className="flex justify-between items-center">
                                <div className="text-sm text-gray-600">
                                    通过校验：{events.filter(e => !e._error).length} |
                                    未通过：{events.filter(e => e._error).length}
                                </div>
                                <div className="space-x-2">
                                    <Button variant="outline" onClick={() => router.push('/calendar')}>
                                        取消
                                    </Button>
                                    <Button onClick={handleImport} disabled={importing || events.filter(e => !e._error).length === 0}>
                                        {importing ? '导入中...' : '导入'}
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}

                    {result && (
                        <div className="bg-green-50 border border-green-200 rounded p-4">
                            <p className="text-green-800 font-semibold">导入完成！</p>
                            <p className="text-sm text-green-700">
                                成功：{result.created} 条 | 失败：{result.failed} 条
                            </p>
                            <p className="text-sm text-gray-600 mt-2">即将跳转到日历...</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
