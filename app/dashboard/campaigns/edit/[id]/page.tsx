'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Template {
    id: string
    name: string
    status: string
    language: string
    components: any[]
}

interface Contact {
    id: number
    phone: string
    name: string
    extra: Record<string, string>
}

export default function EditCampaignPage({ params }: { params: { id: string } }) {
    const router = useRouter()

    const [name, setName] = useState('')
    const [templates, setTemplates] = useState<Template[]>([])
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
    const [variableMapping, setVariableMapping] = useState<Record<string, string>>({})
    const [contacts, setContacts] = useState<Contact[]>([])
    const [selectedContactIds, setSelectedContactIds] = useState<Set<number>>(new Set())
    const [lockedContactIds, setLockedContactIds] = useState<Set<number>>(new Set())
    const [contactSearch, setContactSearch] = useState('')
    const [contactFields, setContactFields] = useState<string[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        async function load() {
            try {
                const [cRes, tRes, contactsRes] = await Promise.all([
                    fetch(`/api/campaigns/${params.id}`),
                    fetch('/api/templates'),
                    fetch('/api/contacts?limit=10000'),
                ])
                const cData = await cRes.json()
                const tData = await tRes.json()
                const contactsData = await contactsRes.json()

                if (!cRes.ok) throw new Error(cData.error)
                if (cData.campaign.status === 'sending') {
                    setError('No se puede editar una campaña mientras se está enviando')
                }

                const approvedTemplates: Template[] = (tData.templates || []).filter((t: Template) => t.status === 'APPROVED')
                setTemplates(approvedTemplates)

                setName(cData.campaign.name)
                const current = approvedTemplates.find(
                    t => t.name === cData.campaign.template_name && t.language === cData.campaign.template_lang
                )
                setSelectedTemplate(current || null)
                setVariableMapping(cData.campaign.template_data?.variableMapping || {})

                if (contactsRes.ok) {
                    setContacts(contactsData.contacts)
                    // Por defecto se preseleccionan los contactos ya asignados a la campaña
                    setSelectedContactIds(new Set(cData.contactIds || []))
                    // Contactos que ya recibieron/intentaron el mensaje: no se pueden deseleccionar
                    setLockedContactIds(new Set(cData.lockedContactIds || []))
                    if (contactsData.contacts?.length > 0) {
                        const c = contactsData.contacts[0]
                        const fields = ['name']
                        if (c.extra) Object.keys(c.extra).forEach((k: string) => fields.push(k))
                        setContactFields(fields)
                    }
                }
            } catch (err: any) {
                setError(err.message)
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [params.id])

    function toggleContact(id: number) {
        if (lockedContactIds.has(id)) return
        setSelectedContactIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id); else next.add(id)
            return next
        })
    }

    const visibleContacts = contacts.filter(c =>
        !contactSearch || c.name?.toLowerCase().includes(contactSearch.toLowerCase()) || c.phone.includes(contactSearch)
    )

    function selectAllVisible() {
        setSelectedContactIds(prev => {
            const next = new Set(prev)
            visibleContacts.forEach(c => next.add(c.id))
            return next
        })
    }

    function deselectAllVisible() {
        setSelectedContactIds(prev => {
            const next = new Set(prev)
            visibleContacts.forEach(c => { if (!lockedContactIds.has(c.id)) next.delete(c.id) })
            return next
        })
    }

    function getTemplateVars(t: Template): string[] {
        const body = t.components?.find((c: any) => c.type === 'BODY')
        if (!body?.text) return []
        const matches = body.text.match(/\{\{(\d+)\}\}/g) || []
        return matches
            .map((m: string) => m.replace(/[{}]/g, ''))
            .filter((v: string, i: number, arr: string[]) => arr.indexOf(v) === i)
            .sort((a: string, b: string) => Number(a) - Number(b))
    }

    function handleSelectTemplate(name: string) {
        const t = templates.find(t => t.name === name)
        setSelectedTemplate(t || null)
        setVariableMapping({})
    }

    function getBodyPreview(): string {
        if (!selectedTemplate) return ''
        const body = selectedTemplate.components?.find((c: any) => c.type === 'BODY')
        let text = body?.text || ''

        const vars = getTemplateVars(selectedTemplate)
        for (const v of vars) {
            const field = variableMapping[v]
            if (field) text = text.replace(`{{${v}}}`, `[${field}]`)
        }
        return text
    }

    async function handleSave() {
        if (!name) { setError('Nombre de campaña requerido'); return }
        if (!selectedTemplate) { setError('Selecciona una plantilla'); return }
        if (selectedContactIds.size === 0) { setError('Selecciona al menos un contacto'); return }

        setSaving(true)
        setError('')
        try {
            const res = await fetch(`/api/campaigns/${params.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    templateName: selectedTemplate.name,
                    templateLang: selectedTemplate.language,
                    variableMapping,
                    contactIds: [...selectedContactIds],
                }),
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error)

            router.push('/dashboard/campaigns')
        } catch (err: any) {
            setError(err.message)
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="max-w-2xl">
                <div className="card text-center py-16 text-tierra-400">Cargando...</div>
            </div>
        )
    }

    const templateVars = selectedTemplate ? getTemplateVars(selectedTemplate) : []

    return (
        <div className="max-w-2xl">
            <div className="mb-6">
                <button onClick={() => router.back()} className="text-sm text-tierra-400 hover:text-tierra-700 mb-2 inline-flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                    </svg>
                    Volver
                </button>
                <h1 className="text-2xl font-bold text-tierra-900">Editar campaña</h1>
            </div>

            <div className="space-y-6">
                <div className="card space-y-4">
                    <h2 className="text-sm font-semibold text-tierra-700">Nombre de la campaña</h2>
                    <input
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="input-field"
                        placeholder="Promo verano cerezos 2024"
                    />
                </div>

                <div className="card space-y-4">
                    <h2 className="text-sm font-semibold text-tierra-700">Plantilla</h2>
                    {templates.length === 0 ? (
                        <p className="text-sm text-tierra-400">No hay plantillas aprobadas.</p>
                    ) : (
                        <select
                            value={selectedTemplate?.name || ''}
                            onChange={e => handleSelectTemplate(e.target.value)}
                            className="input-field"
                        >
                            <option value="">Seleccionar plantilla...</option>
                            {templates.map(t => (
                                <option key={t.id} value={t.name}>{t.name} ({t.language})</option>
                            ))}
                        </select>
                    )}

                    {selectedTemplate && (
                        <div className="bg-paja-50 rounded-lg p-4">
                            <div className="text-xs text-tierra-400 mb-2">Vista previa del mensaje</div>
                            <div className="text-sm text-tierra-800 whitespace-pre-wrap">{getBodyPreview()}</div>
                        </div>
                    )}
                </div>

                {templateVars.length > 0 && (
                    <div className="card space-y-4">
                        <h2 className="text-sm font-semibold text-tierra-700">Mapeo de variables</h2>
                        <div className="space-y-3">
                            {templateVars.map(v => (
                                <div key={v} className="flex items-center gap-3">
                                    <span className="text-sm font-mono bg-trigo/20 text-trigo-700 px-2 py-1 rounded min-w-[50px] text-center">
                                        {`{{${v}}}`}
                                    </span>
                                    <svg className="w-4 h-4 text-tierra-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                                    </svg>
                                    <select
                                        value={variableMapping[v] || ''}
                                        onChange={e => setVariableMapping({ ...variableMapping, [v]: e.target.value })}
                                        className="input-field flex-1"
                                    >
                                        <option value="">Sin asignar (se deja vacío)</option>
                                        <option value="name">Nombre del contacto</option>
                                        <option value="phone">Teléfono</option>
                                        {contactFields.filter(f => f !== 'name').map(f => (
                                            <option key={f} value={f}>{f}</option>
                                        ))}
                                    </select>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {error && (
                    <div className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</div>
                )}

                <div className="card space-y-3">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-tierra-700">Contactos ({selectedContactIds.size} de {contacts.length} seleccionados)</h2>
                        <div className="flex gap-2">
                            <button type="button" onClick={selectAllVisible} className="text-xs text-verde underline">Seleccionar todos</button>
                            <button type="button" onClick={deselectAllVisible} className="text-xs text-red-500 underline">Quitar todos</button>
                        </div>
                    </div>
                    <input
                        type="text"
                        value={contactSearch}
                        onChange={e => setContactSearch(e.target.value)}
                        className="input-field"
                        placeholder="Buscar por nombre o teléfono..."
                    />
                    <div className="max-h-64 overflow-y-auto divide-y divide-paja-100 border border-paja-100 rounded-lg">
                        {visibleContacts.length === 0 ? (
                            <p className="text-sm text-tierra-400 p-3">Sin contactos</p>
                        ) : (
                            visibleContacts.map(c => {
                                const isLocked = lockedContactIds.has(c.id)
                                return (
                                    <label key={c.id} className={`flex items-center gap-3 px-3 py-2 text-sm ${isLocked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-paja-50'}`}>
                                        <input
                                            type="checkbox"
                                            checked={selectedContactIds.has(c.id)}
                                            disabled={isLocked}
                                            onChange={() => toggleContact(c.id)}
                                        />
                                        <span className="font-medium text-tierra-800">{c.name || 'Sin nombre'}</span>
                                        <span className="font-mono text-tierra-400">{c.phone}</span>
                                        {isLocked && (
                                            <span className="ml-auto text-xs text-tierra-400">Ya enviado</span>
                                        )}
                                    </label>
                                )
                            })
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleSave}
                        disabled={saving || !selectedTemplate || !name}
                        className="btn-primary"
                    >
                        {saving ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                    <button onClick={() => router.back()} className="btn-secondary">Cancelar</button>
                </div>
            </div>
        </div>
    )
}
