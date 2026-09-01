'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Client {
    id: number
    name: string
    slug: string
    waba_id: string | null
    phone_number_id: string | null
    meta_app_id: string | null
    chatwoot_account_id: string | null
    chatwoot_inbox_id: string | null
    active: boolean
    created_at: string
}

const EMPTY_FORM = {
    name: '', slug: '', wabaId: '', phoneNumberId: '', systemUserToken: '', metaAppId: '',
    chatwootAccountId: '', chatwootInboxId: '',
}

export default function AdminClientsPage() {
    const router = useRouter()
    const [checked, setChecked] = useState(false)
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

    async function loadClients() {
        setLoading(true)
        setError('')
        try {
            const res = await fetch('/api/admin/clients')
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setClients(data.clients)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { if (checked) loadClients() }, [checked])

    function openNew() {
        setEditingId(null)
        setForm(EMPTY_FORM)
        setShowForm(true)
    }

    function openEdit(c: Client) {
        setEditingId(c.id)
        setForm({
            name: c.name, slug: c.slug,
            wabaId: c.waba_id || '', phoneNumberId: c.phone_number_id || '',
            systemUserToken: '', metaAppId: c.meta_app_id || '',
            chatwootAccountId: c.chatwoot_account_id || '', chatwootInboxId: c.chatwoot_inbox_id || '',
        })
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
            const url = editingId ? `/api/admin/clients/${editingId}` : '/api/admin/clients'
            const method = editingId ? 'PUT' : 'POST'
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            closeForm()
            loadClients()
        } catch (err: any) {
            setError(err.message)
        } finally {
            setSaving(false)
        }
    }

    async function handleToggleActive(c: Client) {
        try {
            const res = await fetch(`/api/admin/clients/${c.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: c.name, wabaId: c.waba_id, phoneNumberId: c.phone_number_id,
                    metaAppId: c.meta_app_id, active: !c.active,
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            loadClients()
        } catch (err: any) {
            alert('Error: ' + err.message)
        }
    }

    if (!checked) return <div className="card text-center py-16 text-tierra-400">Cargando...</div>

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-tierra-900">Espacios de trabajo</h1>
                    <p className="text-sm text-tierra-400 mt-1">{clients.length} cliente{clients.length !== 1 ? 's' : ''}</p>
                </div>
                <button onClick={openNew} className="btn-primary">Nuevo espacio de trabajo</button>
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
                            {editingId ? 'Editar espacio de trabajo' : 'Nuevo espacio de trabajo'}
                        </h2>
                        <button onClick={closeForm} className="text-tierra-400 hover:text-tierra-700 text-sm">Cerrar</button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-tierra-700 mb-1.5">Nombre <span className="text-red-500">*</span></label>
                            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                className="input-field" placeholder="Compo Expert" />
                        </div>
                        {!editingId && (
                            <div>
                                <label className="block text-sm font-medium text-tierra-700 mb-1.5">Slug</label>
                                <input type="text" value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                                    className="input-field" placeholder="se genera del nombre si se deja vacío" />
                            </div>
                        )}
                        <div>
                            <label className="block text-sm font-medium text-tierra-700 mb-1.5">WABA ID</label>
                            <input type="text" value={form.wabaId} onChange={e => setForm(f => ({ ...f, wabaId: e.target.value }))}
                                className="input-field" placeholder="WhatsApp Business Account ID" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-tierra-700 mb-1.5">Phone Number ID</label>
                            <input type="text" value={form.phoneNumberId} onChange={e => setForm(f => ({ ...f, phoneNumberId: e.target.value }))}
                                className="input-field" placeholder="Phone Number ID" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-tierra-700 mb-1.5">Meta App ID</label>
                            <input type="text" value={form.metaAppId} onChange={e => setForm(f => ({ ...f, metaAppId: e.target.value }))}
                                className="input-field" placeholder="App ID en Meta" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-tierra-700 mb-1.5">System User Token</label>
                            <input type="password" value={form.systemUserToken} onChange={e => setForm(f => ({ ...f, systemUserToken: e.target.value }))}
                                className="input-field" placeholder={editingId ? 'Dejar vacío para no cambiar' : 'Token del system user'} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-tierra-700 mb-1.5">Chatwoot Account ID</label>
                            <input type="text" value={form.chatwootAccountId} onChange={e => setForm(f => ({ ...f, chatwootAccountId: e.target.value }))}
                                className="input-field" placeholder="Cuenta del cliente en Chatwoot" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-tierra-700 mb-1.5">Chatwoot Inbox ID</label>
                            <input type="text" value={form.chatwootInboxId} onChange={e => setForm(f => ({ ...f, chatwootInboxId: e.target.value }))}
                                className="input-field" placeholder="Inbox de WhatsApp Cloud API" />
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button onClick={handleSave} disabled={saving || !form.name.trim()} className="btn-primary">
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
                                <th className="text-left py-3 px-4 text-tierra-500 font-medium">Slug</th>
                                <th className="text-left py-3 px-4 text-tierra-500 font-medium hidden sm:table-cell">WABA / Phone ID</th>
                                <th className="text-left py-3 px-4 text-tierra-500 font-medium">Estado</th>
                                <th className="w-32 py-3 px-3"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {clients.map(c => (
                                <tr key={c.id} className="border-b border-paja-100 hover:bg-paja-50/30">
                                    <td className="py-2.5 px-4">{c.name}</td>
                                    <td className="py-2.5 px-4 font-mono text-xs text-tierra-500">{c.slug}</td>
                                    <td className="py-2.5 px-4 hidden sm:table-cell text-xs text-tierra-400">
                                        {c.waba_id || '—'} / {c.phone_number_id || '—'}
                                    </td>
                                    <td className="py-2.5 px-4">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                                            {c.active ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </td>
                                    <td className="py-2.5 px-3 text-right space-x-3">
                                        <button onClick={() => openEdit(c)} className="text-xs text-verde hover:text-verde-700 font-medium">Editar</button>
                                        <button onClick={() => handleToggleActive(c)} className="text-xs text-tierra-400 hover:text-red-500 font-medium">
                                            {c.active ? 'Desactivar' : 'Activar'}
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
