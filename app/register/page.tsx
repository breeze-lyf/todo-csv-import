'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import Link from 'next/link'

const registerSchema = z.object({
    email: z.string().email('邮箱格式不正确'),
    password: z.string().min(6, '密码至少 6 位'),
    confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
    message: '两次密码不一致',
    path: ['confirmPassword'],
})

type RegisterFormValues = z.infer<typeof registerSchema>

export default function RegisterPage() {
    const router = useRouter()
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    const form = useForm<RegisterFormValues>({
        resolver: zodResolver(registerSchema),
        defaultValues: {
            email: '',
            password: '',
            confirmPassword: '',
        },
    })

    async function onSubmit(data: RegisterFormValues) {
        setError(null)
        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email: data.email, password: data.password }),
            })

            const json = await res.json()

            if (!res.ok) {
                setError(json.error || '注册失败')
                return
            }

            setSuccess(true)
            // Redirect to login after short delay
            setTimeout(() => router.push('/login'), 1500)
        } catch (err) {
            setError('系统异常，请稍后重试')
        }
    }

    return (
        <div className="flex h-screen items-center justify-center bg-gray-50">
            <Card className="w-[350px]">
                <CardHeader>
                    <CardTitle className="text-center">注册账号</CardTitle>
                </CardHeader>
                <CardContent>
                    {success ? (
                        <div className="text-center text-green-600 space-y-2">
                            <p>注册成功！</p>
                            <p className="text-sm">即将跳转到登录...</p>
                        </div>
                    ) : (
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="email"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>邮箱</FormLabel>
                                            <FormControl>
                                                <Input placeholder="请输入邮箱" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="password"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>密码</FormLabel>
                                            <FormControl>
                                                <Input type="password" placeholder="请设置密码" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="confirmPassword"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>确认密码</FormLabel>
                                            <FormControl>
                                                <Input type="password" placeholder="请再次输入密码" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {error && <div className="text-sm text-red-500">{error}</div>}

                                <Button type="submit" className="w-full">
                                    注册
                                </Button>
                            </form>
                        </Form>
                    )}
                </CardContent>
                <CardFooter className="justify-center">
                    <Link href="/login" className="text-sm text-blue-600 hover:underline">
                        已有账号？去登录
                    </Link>
                </CardFooter>
            </Card>
        </div>
    )
}
