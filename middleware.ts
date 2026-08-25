import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const PUBLIC_PATHS = ['/login', '/api/auth/login']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Rutas públicas: no requieren auth
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Todo lo demás bajo /dashboard o /api (excepto auth) requiere sesión
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/api')) {
    const token = request.cookies.get('mci_session')?.value

    if (!token) {
      if (pathname.startsWith('/api')) {
        return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
      }
      return NextResponse.redirect(new URL('/login', request.url))
    }

    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET)
      await jwtVerify(token, secret)
      return NextResponse.next()
    } catch {
      if (pathname.startsWith('/api')) {
        return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 })
      }
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*', '/login'],
}
