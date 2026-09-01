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
        if (!appId || !appSecret) {
            return NextResponse.json({ error: 'Meta no está configurado en el servidor' }, { status: 500 })
        }

        // Intercambia el code del Embedded Signup por un access token: esto formaliza
        // que el WABA quede compartido con tu Business Manager (Tech Provider)
        const tokenRes = await fetch(
            `${GRAPH_API}/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&code=${code}`
        )
        const tokenData = await tokenRes.json()
        if (tokenData.error) throw new Error(tokenData.error.message)

        const tempToken = tokenData.access_token as string

        // Suscribe la app a los webhooks del WABA
        await fetch(`${GRAPH_API}/${wabaId}/subscribed_apps`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${tempToken}` },
        })

        // Registra el número en Cloud API: sin este paso el número queda vinculado pero no puede enviar/recibir mensajes.
        // Usamos un PIN fijo (no aleatorio) para que reconexiones futuras del mismo número no generen mismatch de PIN.
        const registerPin = process.env.META_REGISTER_PIN || '204580'
        async function registerPhoneNumber() {
            const res = await fetch(`${GRAPH_API}/${phoneNumberId}/register`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${tempToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ messaging_product: 'whatsapp', pin: registerPin }),
            })
            return res.json()
        }

        let registerData = await registerPhoneNumber()
        if (registerData.error?.code === 133005) {
            // El número ya tenía un PIN distinto de una conexión previa: se fuerza el PIN nuevo (sin necesitar el actual)
            await fetch(`${GRAPH_API}/${phoneNumberId}`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${tempToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ pin: registerPin }),
            })
            registerData = await registerPhoneNumber()
        }
        if (registerData.error && !/already registered/i.test(registerData.error.message || '')) {
            throw new Error(`No se pudo registrar el número en Cloud API: ${registerData.error.message}`)
        }

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
