import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { queryOne } from '@/lib/db'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const user = await queryOne<{
    id: number
    name: string
    email: string
    role: string
    client_name: string
    client_slug: string
    waba_id: string | null
  }>(
    `SELECT u.id, u.name, u.email, u.role,
            c.name as client_name, c.slug as client_slug, c.waba_id
     FROM users u
     JOIN clients c ON u.client_id = c.id
     WHERE u.id = $1`,
    [session.userId]
  )

  if (!user) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  }

  return NextResponse.json({ user })
}
