'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { LogIn, Mail, Lock, Loader2, Sparkles } from 'lucide-react'
import Link from 'next/link'

const loginSchema = z.object({
    email: z.string().email('邮箱格式不正确'),
    password: z.string().min(1, '密码不能为空'),
})

type LoginFormValues = z.infer<typeof loginSchema>

export default function LoginPage() {
    const router = useRouter()
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    const form = useForm<LoginFormValues>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            email: '',
            password: '',
        },
    })

    async function onSubmit(data: LoginFormValues) {
        setLoading(true)
        setError(null)
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            })

            const json = await res.json()

            if (!res.ok) {
                setError(json.error || '登录失败')
                setLoading(false)
                return
            }

            router.push('/calendar')
        } catch (err) {
            setError('系统异常，请稍后重试')
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-[#F8FAFC] relative overflow-hidden font-sans selection:bg-blue-100 selection:text-blue-900 flex items-center justify-center p-6">
            {/* Dynamic Background */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden isolate">
                <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-blue-400/20 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-indigo-400/20 rounded-full blur-[120px] animate-pulse delay-1000" />
                <div className="absolute top-[20%] right-[10%] w-[40%] h-[40%] bg-emerald-400/10 rounded-full blur-[120px] animate-pulse delay-700" />
            </div>

            <Card className="relative w-full max-w-[420px] backdrop-blur-3xl bg-white/80 border-white/60 rounded-[3rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.12)] overflow-hidden transition-all hover:shadow-[0_45px_80px_-20px_rgba(0,0,0,0.16)] animate-in fade-in zoom-in-95 duration-700">
                <CardHeader className="pt-10 pb-6 text-center space-y-2">
                    <div className="mx-auto w-16 h-16 bg-blue-600 rounded-3xl shadow-xl shadow-blue-500/30 flex items-center justify-center mb-4 transform -rotate-6 hover:rotate-0 transition-all duration-500">
                        <Sparkles className="h-8 w-8 text-white" />
                    </div>
                    <CardTitle className="text-3xl font-black text-gray-900 tracking-tight">欢迎回来</CardTitle>
                    <p className="text-gray-400 font-bold uppercase tracking-widest text-[11px]">Sign in to your account</p>
                </CardHeader>

                <CardContent className="px-8 pb-10">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem className="space-y-1.5">
                                        <FormLabel className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">邮箱地址</FormLabel>
                                        <FormControl>
                                            <div className="relative group">
                                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
                                                <Input
                                                    placeholder="name@example.com"
                                                    className="h-12 pl-11 pr-4 bg-white/50 border-black/5 rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all outline-none"
                                                    {...field}
                                                />
                                            </div>
                                        </FormControl>
                                        <FormMessage className="text-[10px] font-bold" />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="password"
                                render={({ field }) => (
                                    <FormItem className="space-y-1.5">
                                        <FormLabel className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">密码</FormLabel>
                                        <FormControl>
                                            <div className="relative group">
                                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
                                                <Input
                                                    type="password"
                                                    placeholder="••••••••"
                                                    className="h-12 pl-11 pr-4 bg-white/50 border-black/5 rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all outline-none"
                                                    {...field}
                                                />
                                            </div>
                                        </FormControl>
                                        <FormMessage className="text-[10px] font-bold" />
                                    </FormItem>
                                )}
                            />

                            {error && (
                                <div className="p-4 rounded-2xl bg-red-50 border border-red-100 flex items-center gap-3 text-red-600 animate-in fade-in slide-in-from-top-2">
                                    <div className="w-1 h-4 bg-red-500 rounded-full" />
                                    <p className="text-xs font-bold">{error}</p>
                                </div>
                            )}

                            <Button
                                type="submit"
                                disabled={loading}
                                className="w-full h-14 bg-gray-900 hover:bg-black text-white rounded-[1.25rem] font-black text-lg shadow-2xl shadow-black/10 transition-all active:scale-[0.98] group"
                            >
                                {loading ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                    <>
                                        登录
                                        <LogIn className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </Button>
                        </form>
                    </Form>

                    <div className="mt-8 pt-6 border-t border-black/[0.03] text-center">
                        <p className="text-gray-500 text-sm font-medium">
                            还没有账号？{' '}
                            <Link href="/register" className="text-blue-600 font-bold hover:underline underline-offset-4 decoration-2 decoration-blue-600/30 transition-all">
                                立即注册
                            </Link>
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
