import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'

function slugify(text: string): string {
    return text
        .toString().trim().toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
}

export async function GET() {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    if (session.role !== 'superadmin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

    const clients = await query(
        `SELECT id, name, slug, waba_id, phone_number_id, meta_app_id, active, created_at
     FROM clients ORDER BY created_at DESC`
    )
    return NextResponse.json({ clients })
}

export async function POST(request: NextRequest) {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    if (session.role !== 'superadmin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

    try {
        const body = await request.json()
        const name = (body.name || '').toString().trim()
        if (!name) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })

        const slug = slugify(body.slug || name)
        if (!slug) return NextResponse.json({ error: 'Slug inválido' }, { status: 400 })

        const wabaId = (body.wabaId || '').toString().trim() || null
        const phoneNumberId = (body.phoneNumberId || '').toString().trim() || null
        const systemUserToken = (body.systemUserToken || '').toString().trim() || null
        const metaAppId = (body.metaAppId || '').toString().trim() || null

        const created = await queryOne(
            `INSERT INTO clients (name, slug, waba_id, phone_number_id, system_user_token, meta_app_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, slug, waba_id, phone_number_id, meta_app_id, active, created_at`,
            [name, slug, wabaId, phoneNumberId, systemUserToken, metaAppId]
        )
        return NextResponse.json({ client: created })
    } catch (err: any) {
        if (err.code === '23505') {
            return NextResponse.json({ error: 'Ya existe un espacio de trabajo con ese slug' }, { status: 409 })
        }
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
