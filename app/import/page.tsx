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
                    const event: ParsedEvent = {
                        title: row.title || row['标题'] || row.Title || '',
                        date: row.date || row['日期'] || row.Date || '',
                        time: row.time || row['时间'] || row.Time || undefined,
                        label: row.label || row['标签'] || row.Label || undefined,
                        notes: row.notes || row['备注'] || row.Notes || undefined,
                    }

                    // Validate
                    if (!event.title) {
                        event._error = 'Missing title'
                    } else if (!event.date || !/^\d{4}-\d{2}-\d{2}$/.test(event.date)) {
                        event._error = 'Invalid date format (YYYY-MM-DD required)'
                    }

                    return event
                })

                setEvents(parsed)
            },
            error: (error) => {
                console.error('CSV parse error:', error)
                alert('Failed to parse CSV file')
            },
        })
    }

    const handleImport = async () => {
        const validEvents = events.filter(e => !e._error)

        if (validEvents.length === 0) {
            alert('No valid events to import')
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
                alert('Import failed: ' + data.error)
            }
        } catch (error) {
            console.error('Import error:', error)
            alert('Import failed')
        } finally {
            setImporting(false)
        }
    }

    return (
        <div className="p-8 min-h-screen bg-gray-50">
            <Card className="max-w-4xl mx-auto">
                <CardHeader>
                    <CardTitle>Import Events from CSV</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div>
                        <h3 className="font-semibold mb-2">CSV Format</h3>
                        <p className="text-sm text-gray-600 mb-2">
                            Required columns: <code className="bg-gray-100 px-1">title</code>, <code className="bg-gray-100 px-1">date</code> (YYYY-MM-DD)
                        </p>
                        <p className="text-sm text-gray-600">
                            Optional columns: <code className="bg-gray-100 px-1">time</code> (HH:mm), <code className="bg-gray-100 px-1">label</code>, <code className="bg-gray-100 px-1">notes</code>
                        </p>
                    </div>

                    <div>
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
                                <h3 className="font-semibold mb-2">Preview ({events.length} rows)</h3>
                                <div className="border rounded-lg overflow-auto max-h-96">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-100 sticky top-0">
                                            <tr>
                                                <th className="p-2 text-left">Title</th>
                                                <th className="p-2 text-left">Date</th>
                                                <th className="p-2 text-left">Time</th>
                                                <th className="p-2 text-left">Label</th>
                                                <th className="p-2 text-left">Status</th>
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
                                                            <span className="text-green-600 text-xs">✓ Valid</span>
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
                                    Valid: {events.filter(e => !e._error).length} |
                                    Invalid: {events.filter(e => e._error).length}
                                </div>
                                <div className="space-x-2">
                                    <Button variant="outline" onClick={() => router.push('/calendar')}>
                                        Cancel
                                    </Button>
                                    <Button onClick={handleImport} disabled={importing || events.filter(e => !e._error).length === 0}>
                                        {importing ? 'Importing...' : 'Import'}
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}

                    {result && (
                        <div className="bg-green-50 border border-green-200 rounded p-4">
                            <p className="text-green-800 font-semibold">Import Complete!</p>
                            <p className="text-sm text-green-700">
                                Created: {result.created} | Failed: {result.failed}
                            </p>
                            <p className="text-sm text-gray-600 mt-2">Redirecting to calendar...</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
