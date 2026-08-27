import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
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
        const role = (body.role || 'admin').toString()
        const clientId = parseInt(body.clientId)
        const active = body.active !== undefined ? !!body.active : true
        const password = (body.password || '').toString()

        if (!clientId) return NextResponse.json({ error: 'El espacio de trabajo es obligatorio' }, { status: 400 })
        if (!['superadmin', 'admin', 'user'].includes(role)) {
            return NextResponse.json({ error: 'Rol inválido' }, { status: 400 })
        }

        let updated
        if (password) {
            if (password.length < 8) {
                return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 })
            }
            const passwordHash = await bcrypt.hash(password, 12)
            updated = await queryOne(
                `UPDATE users SET name = $1, role = $2, client_id = $3, active = $4, password_hash = $5
         WHERE id = $6
         RETURNING id, name, email, role, client_id, active`,
                [name, role, clientId, active, passwordHash, params.id]
            )
        } else {
            updated = await queryOne(
                `UPDATE users SET name = $1, role = $2, client_id = $3, active = $4
         WHERE id = $5
         RETURNING id, name, email, role, client_id, active`,
                [name, role, clientId, active, params.id]
            )
        }

        if (!updated) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
        return NextResponse.json({ user: updated })
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

    await query('UPDATE users SET active = false WHERE id = $1', [params.id])
    return NextResponse.json({ ok: true })
}
