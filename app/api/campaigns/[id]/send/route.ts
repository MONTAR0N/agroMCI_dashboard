import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'
import { getClientMeta, sendTemplateMessage } from '@/lib/meta'

const BATCH_SIZE = 10

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const meta = await getClientMeta()

    // Obtener campaña
    const campaign = await queryOne<{
      id: number; template_name: string; template_lang: string;
      template_data: { variableMapping?: Record<string, string> };
      status: string; total_contacts: number
    }>(
      'SELECT * FROM campaigns WHERE id = $1 AND client_id = $2',
      [params.id, session.clientId]
    )

    if (!campaign) return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 })

    // Marcar como sending si es la primera vez
    if (campaign.status === 'draft') {
      await query(
        "UPDATE campaigns SET status = 'sending', started_at = NOW() WHERE id = $1",
        [campaign.id]
      )
    }

    // Obtener siguiente lote de mensajes pendientes
    const pendingMessages = await query<{
      id: number; contact_id: number; phone: string
    }>(
      `SELECT cm.id, cm.contact_id, cm.phone
       FROM campaign_messages cm
       WHERE cm.campaign_id = $1 AND cm.status = 'pending'
       ORDER BY cm.id
       LIMIT $2`,
      [campaign.id, BATCH_SIZE]
    )

    if (pendingMessages.length === 0) {
      // Campaña terminada
      await query(
        "UPDATE campaigns SET status = 'completed', completed_at = NOW() WHERE id = $1",
        [campaign.id]
      )

      const stats = await getCampaignStats(campaign.id)
      return NextResponse.json({ ...stats, done: true })
    }

    const variableMapping = campaign.template_data?.variableMapping || {}
    let batchSent = 0
    let batchFailed = 0

    for (const msg of pendingMessages) {
      try {
        // Obtener datos del contacto para las variables
        const contact = await queryOne<{ name: string; extra: Record<string, string> }>(
          'SELECT name, extra FROM contacts WHERE id = $1',
          [msg.contact_id]
        )

        // Construir parámetros del body
        const bodyParams: string[] = []
        const varKeys = Object.keys(variableMapping).sort((a, b) => Number(a) - Number(b))

        for (const varNum of varKeys) {
          const field = variableMapping[varNum]
          let value = ''
          if (field === 'name') value = contact?.name || ''
          else if (field === 'phone') value = msg.phone
          else if (contact?.extra && contact.extra[field]) value = contact.extra[field]
          bodyParams.push(value || `{{${varNum}}}`)
        }

        // Enviar mensaje
        const result = await sendTemplateMessage(
          meta,
          msg.phone,
          campaign.template_name,
          campaign.template_lang,
          bodyParams.length > 0 ? bodyParams : undefined
        )

        const wamid = result?.messages?.[0]?.id || null

        await query(
          `UPDATE campaign_messages
           SET status = 'sent', wamid = $2, sent_at = NOW()
           WHERE id = $1`,
          [msg.id, wamid]
        )

        batchSent++
      } catch (err: any) {
        await query(
          `UPDATE campaign_messages
           SET status = 'failed', error_message = $2
           WHERE id = $1`,
          [msg.id, err.message?.substring(0, 500)]
        )
        batchFailed++
      }

      // Pequeña pausa entre mensajes para no saturar la API
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    // Actualizar contadores de la campaña
    await query(
      `UPDATE campaigns SET
         sent_count = (SELECT COUNT(*) FROM campaign_messages WHERE campaign_id = $1 AND status = 'sent'),
         failed_count = (SELECT COUNT(*) FROM campaign_messages WHERE campaign_id = $1 AND status = 'failed')
       WHERE id = $1`,
      [campaign.id]
    )

    const stats = await getCampaignStats(campaign.id)
    return NextResponse.json({ ...stats, batchSent, batchFailed, done: false })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

async function getCampaignStats(campaignId: number) {
  const campaign = await queryOne<{
    total_contacts: number; sent_count: number; failed_count: number; status: string
  }>(
    'SELECT total_contacts, sent_count, failed_count, status FROM campaigns WHERE id = $1',
    [campaignId]
  )

  const pending = await queryOne<{ count: string }>(
    "SELECT COUNT(*) as count FROM campaign_messages WHERE campaign_id = $1 AND status = 'pending'",
    [campaignId]
  )

  return {
    total: campaign?.total_contacts || 0,
    sent: campaign?.sent_count || 0,
    failed: campaign?.failed_count || 0,
    pending: parseInt(pending?.count || '0'),
    status: campaign?.status || 'unknown',
  }
}
