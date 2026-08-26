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
