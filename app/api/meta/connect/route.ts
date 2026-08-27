import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { query } from '@/lib/db'

const GRAPH_API = 'https://graph.facebook.com/v21.0'

export async function POST(request: NextRequest) {
    try {
        const session = await getSession()
        if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

        const { code, wabaId, phoneNumberId } = await request.json()
        if (!code || !wabaId || !phoneNumberId) {
            return NextResponse.json({ error: 'Faltan datos de la conexión con Meta' }, { status: 400 })
        }

        const appId = process.env.NEXT_PUBLIC_META_APP_ID
        const appSecret = process.env.META_APP_SECRET
        const systemUserId = process.env.META_SYSTEM_USER_ID
        if (!appId || !appSecret || !systemUserId) {
            return NextResponse.json({ error: 'Meta no está configurado en el servidor' }, { status: 500 })
        }

        // Token temporal solo para formalizar el handshake del Embedded Signup
        const tokenRes = await fetch(
            `${GRAPH_API}/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&code=${code}`
        )
        const tokenData = await tokenRes.json()
        if (tokenData.error) throw new Error(tokenData.error.message)

        const tempToken = tokenData.access_token as string

        // Asigna tu System User permanente como administrador de este WABA recién conectado
        const assignRes = await fetch(`${GRAPH_API}/${wabaId}/assigned_users`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${tempToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ user: systemUserId, tasks: ['MANAGE'] }),
        })
        const assignData = await assignRes.json()
        if (assignData.error) throw new Error(assignData.error.message)

        // Suscribe la app a los webhooks del WABA
        await fetch(`${GRAPH_API}/${wabaId}/subscribed_apps`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${tempToken}` },
        })

        // Solo guardamos waba_id/phone_number_id: el token de operación es el global (META_SYSTEM_USER_TOKEN)
        await query(
            `UPDATE clients SET waba_id = $1, phone_number_id = $2, meta_app_id = $3
       WHERE id = $4`,
            [wabaId, phoneNumberId, appId, session.clientId]
        )

        return NextResponse.json({ ok: true })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
