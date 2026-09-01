import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'

export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    if (session.role !== 'superadmin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

    try {
        const body = await request.json()
        const name = (body.name || '').toString().trim()
        if (!name) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })

        const wabaId = (body.wabaId || '').toString().trim() || null
        const phoneNumberId = (body.phoneNumberId || '').toString().trim() || null
        const systemUserToken = (body.systemUserToken || '').toString().trim() || null
        const metaAppId = (body.metaAppId || '').toString().trim() || null
        const chatwootAccountId = (body.chatwootAccountId || '').toString().trim() || null
        const chatwootInboxId = (body.chatwootInboxId || '').toString().trim() || null
        const active = body.active !== undefined ? !!body.active : true

        const updated = await queryOne(
            `UPDATE clients SET name = $1, waba_id = $2, phone_number_id = $3,
       system_user_token = COALESCE($4, system_user_token), meta_app_id = $5, active = $6,
       chatwoot_account_id = $7, chatwoot_inbox_id = $8
       WHERE id = $9
       RETURNING id, name, slug, waba_id, phone_number_id, meta_app_id, chatwoot_account_id, chatwoot_inbox_id, active, created_at`,
            [name, wabaId, phoneNumberId, systemUserToken, metaAppId, active, chatwootAccountId, chatwootInboxId, params.id]
        )

        if (!updated) return NextResponse.json({ error: 'Espacio de trabajo no encontrado' }, { status: 404 })
        return NextResponse.json({ client: updated })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: { id: string } }
) {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    if (session.role !== 'superadmin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

    await query('UPDATE clients SET active = false WHERE id = $1', [params.id])
    return NextResponse.json({ ok: true })
}
