import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const campaign = await queryOne(
      `SELECT * FROM campaigns WHERE id = $1 AND client_id = $2`,
      [params.id, session.clientId]
    )

    if (!campaign) return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 })

    // Resumen de estados de mensajes
    const stats = await query<{ status: string; count: string }>(
      `SELECT status, COUNT(*) as count FROM campaign_messages
       WHERE campaign_id = $1 GROUP BY status`,
      [params.id]
    )

    // Detalle de mensajes fallidos, para poder diagnosticar la causa exacta
    const failedMessages = await query<{ id: number; phone: string; error_message: string | null }>(
      `SELECT id, phone, error_message FROM campaign_messages
       WHERE campaign_id = $1 AND status = 'failed' ORDER BY id`,
      [params.id]
    )

    // Contactos actualmente asignados a la campaña, para poder editarlos
    const contactRows = await query<{ contact_id: number; status: string }>(
      `SELECT contact_id, status FROM campaign_messages WHERE campaign_id = $1 AND contact_id IS NOT NULL`,
      [params.id]
    )
    const contactIds = contactRows.map(r => r.contact_id)
    // Contactos que ya recibieron/intentaron el mensaje (solo informativo, no bloquea la selección)
    const sentContactIds = contactRows.filter(r => r.status !== 'pending').map(r => r.contact_id)

    return NextResponse.json({ campaign, messageStats: stats, failedMessages, contactIds, sentContactIds })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const campaign = await queryOne<{ status: string }>(
      'SELECT status FROM campaigns WHERE id = $1 AND client_id = $2',
      [params.id, session.clientId]
    )
    if (!campaign) return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 })
    if (campaign.status === 'sending') {
      return NextResponse.json({ error: 'No se puede editar una campaña mientras se está enviando' }, { status: 400 })
    }

    const { name, templateName, templateLang, variableMapping, contactIds } = await request.json()
    if (!name || !templateName) {
      return NextResponse.json({ error: 'Nombre y plantilla son requeridos' }, { status: 400 })
    }

    const updated = await queryOne(
      `UPDATE campaigns SET name = $1, template_name = $2, template_lang = $3, template_data = $4
       WHERE id = $5 AND client_id = $6
       RETURNING id`,
      [name, templateName, templateLang || 'es', JSON.stringify({ variableMapping }), params.id, session.clientId]
    )

    if (Array.isArray(contactIds)) {
      // Contactos ya asociados a esta campaña, en cualquier estado (para no reinsertar y duplicar envíos)
      const current = await query<{ contact_id: number }>(
        `SELECT contact_id FROM campaign_messages WHERE campaign_id = $1 AND contact_id IS NOT NULL`,
        [params.id]
      )
      const currentIds = new Set(current.map(r => r.contact_id))
      const nextIds = new Set(contactIds)

      // Deseleccionar quita al contacto de la campaña sin importar su estado, para que no reciba más mensajes
      const toRemove = [...currentIds].filter(id => !nextIds.has(id))
      // Solo se agregan contactos que no estaban ya en la campaña (en ningún estado), para no duplicar envíos
      const toAdd = [...nextIds].filter(id => !currentIds.has(id))

      if (toRemove.length > 0) {
        await query(
          `DELETE FROM campaign_messages WHERE campaign_id = $1 AND contact_id = ANY($2::int[])`,
          [params.id, toRemove]
        )
      }

      if (toAdd.length > 0) {
        const contactsToAdd = await query<{ id: number; phone: string }>(
          `SELECT id, phone FROM contacts WHERE client_id = $1 AND active = true AND id = ANY($2::int[])`,
          [session.clientId, toAdd]
        )
        for (const contact of contactsToAdd) {
          await query(
            `INSERT INTO campaign_messages (campaign_id, contact_id, phone, status)
             VALUES ($1, $2, $3, 'pending')`,
            [params.id, contact.id, contact.phone]
          )
        }
      }

      await query(
        `UPDATE campaigns SET total_contacts = (SELECT COUNT(*) FROM campaign_messages WHERE campaign_id = $1) WHERE id = $1`,
        [params.id]
      )
    }

    return NextResponse.json({ campaign: updated })
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

    await query('DELETE FROM campaign_messages WHERE campaign_id = $1', [params.id])
    await query('DELETE FROM campaigns WHERE id = $1 AND client_id = $2', [params.id, session.clientId])

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
