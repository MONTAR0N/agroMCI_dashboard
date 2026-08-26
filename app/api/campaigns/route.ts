import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const campaigns = await query(
      `SELECT id, name, template_name, template_lang, status,
              total_contacts, sent_count, delivered_count, read_count, failed_count,
              created_at, started_at, completed_at
       FROM campaigns WHERE client_id = $1
       ORDER BY created_at DESC`,
      [session.clientId]
    )

    return NextResponse.json({ campaigns })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { name, templateName, templateLang, variableMapping } = await request.json()

    if (!name || !templateName) {
      return NextResponse.json({ error: 'Nombre y plantilla son requeridos' }, { status: 400 })
    }

    // Obtener contactos activos del cliente
    const contacts = await query<{ id: number; phone: string; name: string; extra: Record<string, string> }>(
      'SELECT id, phone, name, extra FROM contacts WHERE client_id = $1 AND active = true',
      [session.clientId]
    )

    if (contacts.length === 0) {
      return NextResponse.json({ error: 'No hay contactos para enviar' }, { status: 400 })
    }

    // Crear campaña
    const campaign = await queryOne<{ id: number }>(
      `INSERT INTO campaigns (client_id, name, template_name, template_lang, template_data, total_contacts, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'draft')
       RETURNING id`,
      [session.clientId, name, templateName, templateLang || 'es', JSON.stringify({ variableMapping }), contacts.length]
    )

    if (!campaign) throw new Error('Error al crear campaña')

    // Crear registros de mensajes individuales
    for (const contact of contacts) {
      await query(
        `INSERT INTO campaign_messages (campaign_id, contact_id, phone, status)
         VALUES ($1, $2, $3, 'pending')`,
        [campaign.id, contact.id, contact.phone]
      )
    }

    return NextResponse.json({ campaign: { id: campaign.id, total: contacts.length } })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
