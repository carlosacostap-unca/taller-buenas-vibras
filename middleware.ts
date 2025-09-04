import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  // Verificar si la ruta es la API de chat
  if (req.nextUrl.pathname.startsWith('/api/chat')) {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    // Si no hay sesión, devolver error 401
    if (!session) {
      return new NextResponse(
        JSON.stringify({ error: 'No autorizado. Debes iniciar sesión.' }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    }
  }

  return res
}

export const config = {
  matcher: [
    '/api/chat/:path*',
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}