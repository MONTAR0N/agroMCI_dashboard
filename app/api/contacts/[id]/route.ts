import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await request.json()
    let phone = (body.phone || '').toString().trim()
    const name = (body.name || '').toString().trim()
    const extra = body.extra && typeof body.extra === 'object' ? body.extra : {}

    // Limpiar teléfono: solo dígitos y +
    phone = phone.replace(/[^\d+]/g, '')
    if (phone && !phone.startsWith('+') && phone.length > 8) {
      phone = '+' + phone
    }

    if (!phone || phone.length < 8) {
      return NextResponse.json({ error: 'Teléfono inválido' }, { status: 400 })
    }

    try {
      const updated = await queryOne(
        `UPDATE contacts SET phone = $1, name = $2, extra = $3
         WHERE id = $4 AND client_id = $5
         RETURNING id, phone, name, extra, created_at`,
        [phone, name, JSON.stringify(extra), params.id, session.clientId]
      )

      if (!updated) return NextResponse.json({ error: 'Contacto no encontrado' }, { status: 404 })

      return NextResponse.json({ contact: updated })
    } catch (err: any) {
      if (err.code === '23505') {
        return NextResponse.json({ error: 'Ya existe un contacto con ese teléfono' }, { status: 409 })
      }
      throw err
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    await query(
      'UPDATE contacts SET active = false WHERE id = $1 AND client_id = $2',
      [params.id, session.clientId]
    )

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
