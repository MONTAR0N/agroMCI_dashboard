'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Client {
    id: number
    name: string
    slug: string
}

interface User {
    id: number
    name: string
    email: string
    role: string
    active: boolean
    client_id: number
    client_name: string
    client_slug: string
    last_login: string | null
}

const ROLE_LABELS: Record<string, string> = {
    superadmin: 'Superadmin',
    admin: 'Administrador',
    user: 'Usuario',
}

const EMPTY_FORM = { name: '', email: '', password: '', role: 'admin', clientId: '' }

export default function AdminUsersPage() {
    const router = useRouter()
    const [checked, setChecked] = useState(false)
    const [users, setUsers] = useState<User[]>([])
    const [clients, setClients] = useState<Client[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [form, setForm] = useState(EMPTY_FORM)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        fetch('/api/auth/me')
            .then(res => res.json())
            .then(data => {
                if (data.user?.role !== 'superadmin') router.push('/dashboard')
                else setChecked(true)
            })
            .catch(() => router.push('/login'))
    }, [router])

    async function loadData() {
        setLoading(true)
        setError('')
        try {
            const [usersRes, clientsRes] = await Promise.all([
                fetch('/api/admin/users'),
                fetch('/api/admin/clients'),
            ])
            const usersData = await usersRes.json()
            const clientsData = await clientsRes.json()
            if (!usersRes.ok) throw new Error(usersData.error)
            if (!clientsRes.ok) throw new Error(clientsData.error)
            setUsers(usersData.users)
            setClients(clientsData.clients)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { if (checked) loadData() }, [checked])

    function openNew() {
        setEditingId(null)
        setForm({ ...EMPTY_FORM, clientId: clients[0] ? String(clients[0].id) : '' })
        setShowForm(true)
    }

    function openEdit(u: User) {
        setEditingId(u.id)
        setForm({ name: u.name, email: u.email, password: '', role: u.role, clientId: String(u.client_id) })
        setShowForm(true)
    }

    function closeForm() {
        setShowForm(false)
        setEditingId(null)
        setForm(EMPTY_FORM)
    }

    async function handleSave() {
        setSaving(true)
        setError('')
        try {
            const url = editingId ? `/api/admin/users/${editingId}` : '/api/admin/users'
            const method = editingId ? 'PUT' : 'POST'
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            closeForm()
            loadData()
        } catch (err: any) {
            setError(err.message)
        } finally {
            setSaving(false)
        }
    }

    async function handleToggleActive(u: User) {
        try {
            const res = await fetch(`/api/admin/users/${u.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: u.name, role: u.role, clientId: u.client_id, active: !u.active }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            loadData()
        } catch (err: any) {
            alert('Error: ' + err.message)
        }
    }

    if (!checked) return <div className="card text-center py-16 text-tierra-400">Cargando...</div>

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-tierra-900">Usuarios</h1>
                    <p className="text-sm text-tierra-400 mt-1">{users.length} usuario{users.length !== 1 ? 's' : ''}</p>
                </div>
                <button onClick={openNew} disabled={clients.length === 0} className="btn-primary">Nuevo usuario</button>
            </div>

            {error && (
                <div className="card border-red-200 bg-red-50 mb-4">
                    <p className="text-sm text-red-700">{error}</p>
                </div>
            )}

            {showForm && (
                <div className="card mb-6 border-verde/30">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-semibold text-tierra-900">
                            {editingId ? 'Editar usuario' : 'Nuevo usuario'}
                        </h2>
                        <button onClick={closeForm} className="text-tierra-400 hover:text-tierra-700 text-sm">Cerrar</button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-tierra-700 mb-1.5">Nombre</label>
                            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                className="input-field" placeholder="Nombre completo" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-tierra-700 mb-1.5">Correo <span className="text-red-500">*</span></label>
                            <input type="email" value={form.email} disabled={!!editingId} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                className="input-field disabled:opacity-60" placeholder="correo@cliente.cl" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-tierra-700 mb-1.5">
                                Contraseña {editingId ? '' : <span className="text-red-500">*</span>}
                            </label>
                            <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                                className="input-field" placeholder={editingId ? 'Dejar vacío para no cambiar' : 'Mínimo 8 caracteres'} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-tierra-700 mb-1.5">Rol</label>
                            <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className="input-field">
                                <option value="admin">Administrador</option>
                                <option value="user">Usuario</option>
                                <option value="superadmin">Superadmin</option>
                            </select>
                        </div>
                        <div className="sm:col-span-2">
                            <label className="block text-sm font-medium text-tierra-700 mb-1.5">Espacio de trabajo <span className="text-red-500">*</span></label>
                            <select value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))} className="input-field">
                                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button onClick={handleSave} disabled={saving || !form.email.trim() || !form.clientId} className="btn-primary">
                            {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear'}
                        </button>
                        <button onClick={closeForm} className="btn-secondary">Cancelar</button>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="card text-center py-16 text-tierra-400">Cargando...</div>
            ) : (
                <div className="card p-0 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-paja-200 bg-paja-50/50">
                                <th className="text-left py-3 px-4 text-tierra-500 font-medium">Nombre</th>
                                <th className="text-left py-3 px-4 text-tierra-500 font-medium">Correo</th>
                                <th className="text-left py-3 px-4 text-tierra-500 font-medium">Espacio de trabajo</th>
                                <th className="text-left py-3 px-4 text-tierra-500 font-medium">Rol</th>
                                <th className="text-left py-3 px-4 text-tierra-500 font-medium">Estado</th>
                                <th className="w-32 py-3 px-3"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(u => (
                                <tr key={u.id} className="border-b border-paja-100 hover:bg-paja-50/30">
                                    <td className="py-2.5 px-4">{u.name || <span className="text-tierra-300">—</span>}</td>
                                    <td className="py-2.5 px-4 font-mono text-xs">{u.email}</td>
                                    <td className="py-2.5 px-4">{u.client_name}</td>
                                    <td className="py-2.5 px-4 text-xs text-tierra-500">{ROLE_LABELS[u.role] || u.role}</td>
                                    <td className="py-2.5 px-4">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${u.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                                            {u.active ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </td>
                                    <td className="py-2.5 px-3 text-right space-x-3">
                                        <button onClick={() => openEdit(u)} className="text-xs text-verde hover:text-verde-700 font-medium">Editar</button>
                                        <button onClick={() => handleToggleActive(u)} className="text-xs text-tierra-400 hover:text-red-500 font-medium">
                                            {u.active ? 'Desactivar' : 'Activar'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
