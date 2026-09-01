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

    return NextResponse.json({ campaign, messageStats: stats })
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

    const { name, templateName, templateLang, variableMapping } = await request.json()
    if (!name || !templateName) {
      return NextResponse.json({ error: 'Nombre y plantilla son requeridos' }, { status: 400 })
    }

    const updated = await queryOne(
      `UPDATE campaigns SET name = $1, template_name = $2, template_lang = $3, template_data = $4
       WHERE id = $5 AND client_id = $6
       RETURNING id`,
      [name, templateName, templateLang || 'es', JSON.stringify({ variableMapping }), params.id, session.clientId]
    )

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
