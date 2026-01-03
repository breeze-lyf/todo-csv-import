'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Papa from 'papaparse'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Download, FileUp, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

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
                    let normalizedDate = ''
                    if (rawDate) {
                        const parts = String(rawDate).split(/[/-]/)
                        if (parts.length === 3) {
                            const [y, m, d] = parts
                            normalizedDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
                        }
                    }
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
        <div className="relative min-h-screen w-full overflow-x-hidden bg-[#f8fafc] flex flex-col items-center py-12 px-4">
            {/* Dynamic Background */}
            <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-400/10 blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-400/10 blur-[120px] animate-pulse delay-700" />
            </div>

            <Card className="relative z-10 w-full max-w-4xl backdrop-blur-3xl bg-white/80 border-white/60 rounded-[2.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.08)] overflow-hidden border">
                <CardHeader className="px-10 pt-10 pb-6 flex flex-row items-center justify-between border-b border-black/[0.03]">
                    <div>
                        <div className="flex items-center gap-2 mb-1.5">
                            <div className="w-1.5 h-4 bg-blue-600 rounded-full" />
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Bulk Import</p>
                        </div>
                        <CardTitle className="text-3xl font-black text-gray-900 tracking-tight">导入 CSV 日程</CardTitle>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            onClick={() => router.push('/calendar')}
                            className="rounded-2xl px-6 hover:bg-black/5 transition-all text-gray-500 font-bold"
                        >
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            返回日历
                        </Button>
                        <Button
                            asChild
                            className="rounded-2xl px-6 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all font-bold"
                        >
                            <a href={templateUrl} download>
                                <Download className="h-4 w-4 mr-2" />
                                下载模板
                            </a>
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="px-10 py-10 space-y-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div className="space-y-4">
                            <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                                <span className="w-1 h-1 bg-blue-500 rounded-full" />
                                格式说明
                            </h3>
                            <div className="space-y-3">
                                <div className="p-4 rounded-2xl bg-black/[0.02] border border-black/[0.03] space-y-2">
                                    <p className="text-sm text-gray-600 leading-relaxed font-medium">
                                        必填列：<code className="bg-white/80 px-1.5 py-0.5 rounded border border-black/5 text-blue-600 font-bold">title</code>，
                                        <code className="bg-white/80 px-1.5 py-0.5 rounded border border-black/5 text-blue-600 font-bold">date</code> (YYYY-MM-DD)
                                    </p>
                                    <p className="text-sm text-gray-600 leading-relaxed font-medium">
                                        选填列：<code className="bg-white/80 px-1.5 py-0.5 rounded border border-black/5 text-gray-500 font-bold">time</code>，
                                        <code className="bg-white/80 px-1.5 py-0.5 rounded border border-black/5 text-gray-500 font-bold">label</code>，
                                        <code className="bg-white/80 px-1.5 py-0.5 rounded border border-black/5 text-gray-500 font-bold">notes</code>
                                    </p>
                                </div>
                                <p className="text-xs text-gray-400 font-medium leading-relaxed italic">
                                    说明：下载模板 → 填写数据 → 选择文件上传 → 校验通过后即可导入。
                                </p>
                            </div>
                        </div>

                        <div className="space-y-4 flex flex-col justify-center">
                            <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                                <span className="w-1 h-1 bg-blue-500 rounded-full" />
                                上传文件
                            </h3>
                            <div className="relative group">
                                <Input
                                    type="file"
                                    accept=".csv"
                                    onChange={handleFileChange}
                                    disabled={importing}
                                    className="h-20 px-6 bg-white/50 border-2 border-dashed border-black/5 rounded-3xl cursor-pointer hover:border-blue-400/50 transition-all flex items-center pt-7 text-gray-500 font-medium shadow-none"
                                />
                                <div className="absolute inset-x-0 top-3 pointer-events-none flex flex-col items-center justify-center text-gray-400 group-hover:text-blue-500 transition-colors">
                                    <FileUp className="h-6 w-6 mb-1 opacity-20" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">选择或拖拽 CSV 文件</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {events.length > 0 && (
                        <div className="space-y-6 pt-6 border-t border-black/[0.03] animate-in fade-in slide-in-from-bottom-5 duration-500">
                            <div className="space-y-3">
                                <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="w-1 h-1 bg-blue-500 rounded-full" />
                                        数据预览
                                    </div>
                                    <span className="text-[10px] text-gray-400 normal-case">{events.length} 条记录</span>
                                </h3>
                                <div className="border border-black/5 rounded-3xl overflow-hidden bg-white/40 backdrop-blur-md shadow-inner h-[400px]">
                                    <div className="overflow-auto h-full custom-scrollbar">
                                        <table className="w-full text-sm border-separate border-spacing-0">
                                            <thead className="bg-white/80 sticky top-0 z-10 backdrop-blur-sm">
                                                <tr>
                                                    <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-black/[0.03]">标题</th>
                                                    <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-black/[0.03]">日期</th>
                                                    <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-black/[0.03]">时间</th>
                                                    <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-black/[0.03]">校验结果</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-black/[0.02]">
                                                {events.map((event, index) => (
                                                    <tr key={index} className={`group transition-colors ${event._error ? 'bg-red-500/5' : 'hover:bg-blue-500/[0.02]'}`}>
                                                        <td className="px-6 py-4">
                                                            <p className={`font-bold transition-all ${event._error ? 'text-red-900' : 'text-gray-700'}`}>{event.title}</p>
                                                            {event.label && <span className="text-[10px] font-black text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded mt-1 inline-block uppercase tracking-wider">{event.label}</span>}
                                                        </td>
                                                        <td className="px-6 py-4 text-gray-500 font-medium">{event.date}</td>
                                                        <td className="px-6 py-4 text-gray-500 font-medium">{event.time || '-'}</td>
                                                        <td className="px-6 py-4">
                                                            {event._error ? (
                                                                <div className="flex items-center text-red-500 gap-1.5 font-bold text-xs bg-red-50 px-3 py-1.5 rounded-xl w-fit">
                                                                    <AlertCircle className="h-3.5 w-3.5" />
                                                                    {event._error}
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center text-emerald-600 gap-1.5 font-bold text-xs bg-emerald-50 px-3 py-1.5 rounded-xl w-fit">
                                                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                                                    校验通过
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-between items-center bg-black/[0.02] p-6 rounded-[2rem] border border-black/[0.03]">
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-black text-gray-700">导入准备就绪</span>
                                        <div className="h-1 w-24 bg-gray-200 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-emerald-500 transition-all duration-700"
                                                style={{ width: `${(events.filter(e => !e._error).length / events.length) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest">
                                        有效记录: {events.filter(e => !e._error).length} / 总计: {events.length}
                                    </p>
                                </div>
                                <div className="flex gap-3">
                                    <Button
                                        variant="ghost"
                                        onClick={() => setEvents([])}
                                        className="rounded-2xl px-6 hover:bg-black/5 font-bold text-gray-400 hover:text-gray-600"
                                    >
                                        重置
                                    </Button>
                                    <Button
                                        onClick={handleImport}
                                        disabled={importing || events.filter(e => !e._error).length === 0}
                                        className="rounded-2xl px-10 bg-gray-900 hover:bg-black text-white shadow-xl transition-all font-black"
                                    >
                                        {importing ? (
                                            <>
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                导入中...
                                            </>
                                        ) : '开始导入'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {result && (
                        <div className="bg-emerald-50 border border-emerald-100/50 rounded-3xl p-6 flex items-center justify-between animate-in zoom-in-95 duration-500">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
                                    <CheckCircle2 className="h-6 w-6" />
                                </div>
                                <div>
                                    <p className="text-emerald-900 font-black text-lg">导入成功！</p>
                                    <p className="text-sm text-emerald-700 font-medium">
                                        已成功创建 {result.created} 条日程记录 | 即将返回日历
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
