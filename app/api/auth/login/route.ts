import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { queryOne, query } from '@/lib/db'
import { createSession } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Correo y contraseña son requeridos' },
        { status: 400 }
      )
    }

    // Buscar usuario con su cliente asociado
    const user = await queryOne<{
      id: number
      email: string
      password_hash: string
      name: string
      role: string
      active: boolean
      client_id: number
      client_name: string
      client_slug: string
      client_active: boolean
    }>(
      `SELECT u.id, u.email, u.password_hash, u.name, u.role, u.active,
              c.id as client_id, c.name as client_name, c.slug as client_slug, c.active as client_active
       FROM users u
       JOIN clients c ON u.client_id = c.id
       WHERE LOWER(u.email) = LOWER($1)`,
      [email]
    )

    if (!user) {
      return NextResponse.json(
        { error: 'Credenciales incorrectas' },
        { status: 401 }
      )
    }

    if (!user.active || !user.client_active) {
      return NextResponse.json(
        { error: 'Cuenta desactivada. Contacta a soporte.' },
        { status: 403 }
      )
    }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      return NextResponse.json(
        { error: 'Credenciales incorrectas' },
        { status: 401 }
      )
    }

    // Crear sesión JWT
    await createSession({
      userId: user.id,
      clientId: user.client_id,
      role: user.role,
      email: user.email,
      clientSlug: user.client_slug,
    })

    // Actualizar último login
    await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id])

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        client: {
          id: user.client_id,
          name: user.client_name,
          slug: user.client_slug,
        },
      },
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
