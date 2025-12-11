import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyToken } from '@/lib/auth'

export async function middleware(request: NextRequest) {
    const token = request.cookies.get('token')?.value
    const { pathname } = request.nextUrl

    // Public paths
    if (pathname.startsWith('/login') || pathname.startsWith('/register') || pathname.startsWith('/api/auth')) {
        if (token && (pathname === '/login' || pathname === '/register')) {
            // If already logged in, redirect to calendar
            // verifying token here might be expensive if we do the full verify, 
            // but typically middleware just checks existence or does a quick local check. 
            // For now, let's just check existence to keep it fast, or rely on API to bounce back.
            // Actually, let's just let them verify in the page or redirect if token exists.
            return NextResponse.redirect(new URL('/calendar', request.url))
        }
        return NextResponse.next()
    }

    // Protected paths
    if (!token) {
        if (pathname.startsWith('/api')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        return NextResponse.redirect(new URL('/login', request.url))
    }

    // Verify token (Optional: doing this in middleware can be slow if it involves async crypto)
    // But jose is edge-compatible.
    // We can skip verification here and rely on valid token presence, 
    // and let the actual page/API do the deep validation. 
    // For better UX, we verify.
    try {
        // Note: middleware runs on Edge, ensure lib/auth is edge compatible
        await verifyToken(token)
        return NextResponse.next()
    } catch (error) {
        // Invalid token
        const response = NextResponse.redirect(new URL('/login', request.url))
        response.cookies.delete('token')
        return response
    }
}

export const config = {
    matcher: ['/calendar/:path*', '/api/events/:path*'],
}
