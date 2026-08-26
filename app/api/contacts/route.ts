import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const search = searchParams.get('search') || ''
    const offset = (page - 1) * limit

    let contacts
    let countResult

    if (search) {
      contacts = await query(
        `SELECT id, phone, name, extra, created_at FROM contacts
         WHERE client_id = $1 AND active = true
         AND (phone ILIKE $4 OR name ILIKE $4)
         ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [session.clientId, limit, offset, `%${search}%`]
      )
      countResult = await queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM contacts
         WHERE client_id = $1 AND active = true
         AND (phone ILIKE $2 OR name ILIKE $2)`,
        [session.clientId, `%${search}%`]
      )
    } else {
      contacts = await query(
        `SELECT id, phone, name, extra, created_at FROM contacts
         WHERE client_id = $1 AND active = true
         ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [session.clientId, limit, offset]
      )
      countResult = await queryOne<{ count: string }>(
        'SELECT COUNT(*) as count FROM contacts WHERE client_id = $1 AND active = true',
        [session.clientId]
      )
    }

    const total = parseInt(countResult?.count || '0')

    return NextResponse.json({
      contacts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { contacts } = await request.json()

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return NextResponse.json({ error: 'Se requiere un array de contactos' }, { status: 400 })
    }

    if (contacts.length > 10000) {
      return NextResponse.json({ error: 'Máximo 10.000 contactos por importación' }, { status: 400 })
    }

    let imported = 0
    let duplicates = 0
    let errors = 0

    for (const contact of contacts) {
      let phone = (contact.phone || '').toString().trim()
      const name = (contact.name || '').toString().trim()

      // Limpiar teléfono: solo dígitos y +
      phone = phone.replace(/[^\d+]/g, '')

      // Agregar + si no lo tiene y tiene código de país
      if (phone && !phone.startsWith('+') && phone.length > 8) {
        phone = '+' + phone
      }

      if (!phone || phone.length < 8) {
        errors++
        continue
      }

      // Extraer campos extra (todo lo que no sea phone o name)
      const extra: Record<string, string> = {}
      for (const [key, value] of Object.entries(contact)) {
        if (key !== 'phone' && key !== 'name' && value) {
          extra[key] = String(value)
        }
      }

      try {
        const result = await query(
          `INSERT INTO contacts (client_id, phone, name, extra)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (client_id, phone)
           DO UPDATE SET name = COALESCE(NULLIF($3, ''), contacts.name),
                         extra = contacts.extra || $4
           RETURNING (xmax = 0) as is_new`,
          [session.clientId, phone, name, JSON.stringify(extra)]
        )

        if (result[0]?.is_new) {
          imported++
        } else {
          duplicates++
        }
      } catch {
        errors++
      }
    }

    return NextResponse.json({
      imported,
      duplicates,
      errors,
      total: contacts.length,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { ids, all } = await request.json()

    if (all) {
      // Borrar todos los contactos del cliente
      const result = await query(
        'DELETE FROM contacts WHERE client_id = $1',
        [session.clientId]
      )
      return NextResponse.json({ deleted: result.length >= 0 ? 'all' : 0 })
    }

    if (ids && Array.isArray(ids) && ids.length > 0) {
      // Borrar seleccionados
      await query(
        'DELETE FROM contacts WHERE id = ANY($1::int[]) AND client_id = $2',
        [ids, session.clientId]
      )
      return NextResponse.json({ deleted: ids.length })
    }

    return NextResponse.json({ error: 'Se requiere ids o all' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
