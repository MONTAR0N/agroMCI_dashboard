'use client'

import { useEffect, useState, useRef } from 'react'

interface Contact {
  id: number
  phone: string
  name: string
  extra: Record<string, string>
  created_at: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  pages: number
}

interface ImportResult {
  imported: number
  duplicates: number
  errors: number
  total: number
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, pages: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [csvData, setCsvData] = useState<Record<string, string>[]>([])
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [phoneCol, setPhoneCol] = useState('')
  const [nameCol, setNameCol] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [showForm, setShowForm] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [formPhone, setFormPhone] = useState('')
  const [formName, setFormName] = useState('')
  const [formExtra, setFormExtra] = useState<{ key: string; value: string }[]>([])
  const [formError, setFormError] = useState('')
  const [savingForm, setSavingForm] = useState(false)

  async function loadContacts(page = 1) {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' })
      if (search) params.set('search', search)
      const res = await fetch(`/api/contacts?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setContacts(data.contacts)
      setPagination(data.pagination)
      setSelected(new Set())
    } catch (err: any) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadContacts() }, [])

  function handleSearch() { loadContacts(1) }

  // ─── Manual create / edit ───

  function openNewContact() {
    setEditingContact(null)
    setFormPhone('')
    setFormName('')
    setFormExtra([])
    setFormError('')
    setShowForm(true)
  }

  function openEditContact(c: Contact) {
    setEditingContact(c)
    setFormPhone(c.phone)
    setFormName(c.name || '')
    setFormExtra(Object.entries(c.extra || {}).map(([key, value]) => ({ key, value: String(value) })))
    setFormError('')
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingContact(null)
    setFormPhone('')
    setFormName('')
    setFormExtra([])
    setFormError('')
  }

  function addExtraField() {
    setFormExtra(prev => [...prev, { key: '', value: '' }])
  }

  function updateExtraField(index: number, field: 'key' | 'value', value: string) {
    setFormExtra(prev => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)))
  }

  function removeExtraField(index: number) {
    setFormExtra(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSaveContact() {
    const phone = formPhone.trim()
    if (!phone) { setFormError('El teléfono es obligatorio'); return }

    const extra: Record<string, string> = {}
    for (const { key, value } of formExtra) {
      if (key.trim()) extra[key.trim()] = value
    }

    setSavingForm(true)
    setFormError('')
    try {
      if (editingContact) {
        const res = await fetch(`/api/contacts/${editingContact.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, name: formName.trim(), extra }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
      } else {
        const res = await fetch('/api/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contacts: [{ phone, name: formName.trim(), ...extra }] }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
      }
      closeForm()
      loadContacts(pagination.page)
    } catch (err: any) {
      setFormError(err.message)
    } finally {
      setSavingForm(false)
    }
  }

  // ─── File handling ───

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const isExcel = file.name.match(/\.xlsx?$/i)

    if (isExcel) {
      const reader = new FileReader()
      reader.onload = async (event) => {
        const data = event.target?.result
        const XLSX = await import('xlsx')
        const workbook = XLSX.read(data, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' })
        if (rows.length === 0) return
        const headers = Object.keys(rows[0])
        const stringRows = rows.map(row => {
          const obj: Record<string, string> = {}
          headers.forEach(h => { obj[h] = String(row[h] ?? '') })
          return obj
        })
        applyParsedData(headers, stringRows)
      }
      reader.readAsArrayBuffer(file)
    } else {
      const reader = new FileReader()
      reader.onload = (event) => {
        const text = event.target?.result as string
        parseCSV(text)
      }
      reader.readAsText(file)
    }
  }

  function applyParsedData(headers: string[], rows: Record<string, string>[]) {
    setCsvHeaders(headers)
    setCsvData(rows)
    setShowUpload(true)
    setImportResult(null)
    const phoneLike = headers.find(h => /tel[eé]fono|phone|celular|m[oó]vil|whatsapp|numero|número/i.test(h))
    const nameLike = headers.find(h => /nombre|name|cliente|contacto/i.test(h))
    if (phoneLike) setPhoneCol(phoneLike)
    if (nameLike) setNameCol(nameLike)
  }

  function parseCSV(text: string) {
    const firstLine = text.split('\n')[0]
    const separator = firstLine.includes(';') ? ';' : ','
    const lines = text.split('\n').map(line =>
      line.split(separator).map(cell => cell.trim().replace(/^["']|["']$/g, ''))
    ).filter(line => line.some(cell => cell))
    if (lines.length < 2) return
    const headers = lines[0]
    const rows = lines.slice(1).map(row => {
      const obj: Record<string, string> = {}
      headers.forEach((h, i) => { obj[h] = row[i] || '' })
      return obj
    }).filter(row => Object.values(row).some(v => v))
    applyParsedData(headers, rows)
  }

  async function handleImport() {
    if (!phoneCol) return
    setImporting(true)
    try {
      const contacts = csvData.map(row => {
        const contact: Record<string, string> = { phone: row[phoneCol] || '', name: nameCol ? row[nameCol] || '' : '' }
        for (const [key, value] of Object.entries(row)) {
          if (key !== phoneCol && key !== nameCol && value) contact[key] = value
        }
        return contact
      }).filter(c => c.phone)

      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setImportResult(data)
      loadContacts(1)
    } catch (err: any) {
      alert('Error: ' + err.message)
    } finally { setImporting(false) }
  }

  function closeUpload() {
    setShowUpload(false)
    setCsvData([])
    setCsvHeaders([])
    setPhoneCol('')
    setNameCol('')
    setImportResult(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  // ─── Selection & Delete ───

  function toggleSelect(id: number) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selected.size === contacts.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(contacts.map(c => c.id)))
    }
  }

  async function handleDeleteSelected() {
    if (selected.size === 0) return
    if (!confirm(`¿Eliminar ${selected.size} contacto${selected.size > 1 ? 's' : ''}?`)) return
    setDeleting(true)
    try {
      const res = await fetch('/api/contacts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected) }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      loadContacts(pagination.page)
    } catch (err: any) {
      alert('Error: ' + err.message)
    } finally { setDeleting(false) }
  }

  async function handleDeleteAll() {
    if (!confirm(`¿Eliminar TODOS los ${pagination.total} contactos? Esta acción no se puede deshacer.`)) return
    setDeleting(true)
    try {
      const res = await fetch('/api/contacts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      loadContacts(1)
    } catch (err: any) {
      alert('Error: ' + err.message)
    } finally { setDeleting(false) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-tierra-900">Contactos</h1>
          <p className="text-sm text-tierra-400 mt-1">{pagination.total} contacto{pagination.total !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          {pagination.total > 0 && (
            <button onClick={handleDeleteAll} disabled={deleting}
              className="text-sm text-red-500 hover:text-red-700 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50">
              Borrar todos
            </button>
          )}
          <button onClick={openNewContact} className="btn-secondary">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Nuevo contacto
          </button>
          <input type="file" ref={fileRef} accept=".csv,.txt,.xlsx,.xls" onChange={handleFileSelect} className="hidden" />
          <button onClick={() => fileRef.current?.click()} className="btn-primary">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
            </svg>
            Subir CSV
          </button>
        </div>
      </div>

      {/* Contact form modal */}
      {showForm && (
        <div className="card mb-6 border-verde/30">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-tierra-900">
              {editingContact ? 'Editar contacto' : 'Nuevo contacto'}
            </h2>
            <button onClick={closeForm} className="text-tierra-400 hover:text-tierra-700 text-sm">Cerrar</button>
          </div>

          {formError && (
            <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3 mb-4">{formError}</div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-tierra-700 mb-1.5">Teléfono <span className="text-red-500">*</span></label>
              <input type="text" value={formPhone} onChange={e => setFormPhone(e.target.value)}
                className="input-field" placeholder="+56912345678" />
            </div>
            <div>
              <label className="block text-sm font-medium text-tierra-700 mb-1.5">Nombre</label>
              <input type="text" value={formName} onChange={e => setFormName(e.target.value)}
                className="input-field" placeholder="Nombre del contacto" />
            </div>
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-tierra-700">Datos extra</label>
              <button onClick={addExtraField} type="button" className="text-xs text-verde hover:text-verde-700 font-medium">
                + Agregar campo
              </button>
            </div>
            {formExtra.length === 0 ? (
              <p className="text-xs text-tierra-400">Sin campos extra.</p>
            ) : (
              <div className="space-y-2">
                {formExtra.map((pair, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input type="text" value={pair.key} onChange={e => updateExtraField(i, 'key', e.target.value)}
                      className="input-field" placeholder="Campo" />
                    <input type="text" value={pair.value} onChange={e => updateExtraField(i, 'value', e.target.value)}
                      className="input-field" placeholder="Valor" />
                    <button onClick={() => removeExtraField(i)} type="button"
                      className="text-tierra-400 hover:text-red-500 px-2">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button onClick={handleSaveContact} disabled={savingForm || !formPhone.trim()} className="btn-primary">
              {savingForm ? 'Guardando...' : editingContact ? 'Guardar cambios' : 'Crear contacto'}
            </button>
            <button onClick={closeForm} className="btn-secondary">Cancelar</button>
          </div>
        </div>
      )}

      {/* Upload modal */}
      {showUpload && (
        <div className="card mb-6 border-verde/30">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-tierra-900">Importar contactos</h2>
            <button onClick={closeUpload} className="text-tierra-400 hover:text-tierra-700 text-sm">Cerrar</button>
          </div>
          {importResult ? (
            <div className="space-y-2">
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-sm text-green-800 font-medium">Importación completa</p>
                <p className="text-sm text-green-700 mt-1">
                  {importResult.imported} nuevos · {importResult.duplicates} actualizados · {importResult.errors} con error · {importResult.total} total
                </p>
              </div>
              <button onClick={closeUpload} className="btn-secondary text-sm">Cerrar</button>
            </div>
          ) : (
            <>
              <p className="text-sm text-tierra-500 mb-4">{csvData.length} filas encontradas.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-tierra-700 mb-1.5">Columna de teléfono <span className="text-red-500">*</span></label>
                  <select value={phoneCol} onChange={e => setPhoneCol(e.target.value)} className="input-field">
                    <option value="">Seleccionar...</option>
                    {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-tierra-700 mb-1.5">Columna de nombre</label>
                  <select value={nameCol} onChange={e => setNameCol(e.target.value)} className="input-field">
                    <option value="">Ninguna</option>
                    {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              </div>
              {phoneCol && (
                <div className="mb-4">
                  <p className="text-xs text-tierra-400 mb-2">Vista previa (primeros 5)</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-paja-200">
                        <th className="text-left py-2 px-3 text-tierra-500 font-medium">Teléfono</th>
                        <th className="text-left py-2 px-3 text-tierra-500 font-medium">Nombre</th>
                      </tr></thead>
                      <tbody>
                        {csvData.slice(0, 5).map((row, i) => (
                          <tr key={i} className="border-b border-paja-100">
                            <td className="py-2 px-3 font-mono text-xs">{row[phoneCol]}</td>
                            <td className="py-2 px-3">{nameCol ? row[nameCol] : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <button onClick={handleImport} disabled={!phoneCol || importing} className="btn-primary">
                  {importing ? 'Importando...' : `Importar ${csvData.length} contactos`}
                </button>
                <button onClick={closeUpload} className="btn-secondary">Cancelar</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Selection bar */}
      {selected.size > 0 && (
        <div className="bg-verde/10 border border-verde/20 rounded-lg px-4 py-3 mb-4 flex items-center justify-between">
          <span className="text-sm text-verde-700 font-medium">
            {selected.size} contacto{selected.size > 1 ? 's' : ''} seleccionado{selected.size > 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => setSelected(new Set())} className="text-sm text-tierra-500 hover:text-tierra-700">
              Deseleccionar
            </button>
            <button onClick={handleDeleteSelected} disabled={deleting}
              className="text-sm text-red-600 hover:text-red-800 font-medium disabled:opacity-50">
              {deleting ? 'Eliminando...' : 'Eliminar seleccionados'}
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="flex gap-2 mb-4">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          className="input-field max-w-sm" placeholder="Buscar por teléfono o nombre..." />
        <button onClick={handleSearch} className="btn-secondary">Buscar</button>
      </div>

      {/* Contacts table */}
      {loading ? (
        <div className="card text-center py-16 text-tierra-400">Cargando contactos...</div>
      ) : contacts.length === 0 ? (
        <div className="card text-center py-16">
          <svg className="w-12 h-12 text-tierra-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
          </svg>
          <h3 className="text-sm font-semibold text-tierra-700 mb-1">Sin contactos</h3>
          <p className="text-sm text-tierra-400 mb-4">Sube un archivo CSV o Excel con los teléfonos de tus clientes.</p>
          <button onClick={() => fileRef.current?.click()} className="btn-primary">Subir archivo</button>
        </div>
      ) : (
        <>
          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-paja-200 bg-paja-50/50">
                  <th className="w-10 py-3 px-3">
                    <input type="checkbox"
                      checked={selected.size === contacts.length && contacts.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-tierra-300 text-verde focus:ring-verde/30"
                    />
                  </th>
                  <th className="text-left py-3 px-4 text-tierra-500 font-medium">Teléfono</th>
                  <th className="text-left py-3 px-4 text-tierra-500 font-medium">Nombre</th>
                  <th className="text-left py-3 px-4 text-tierra-500 font-medium hidden sm:table-cell">Datos extra</th>
                  <th className="w-20 py-3 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {contacts.map(c => (
                  <tr key={c.id} className={`border-b border-paja-100 hover:bg-paja-50/30 ${selected.has(c.id) ? 'bg-verde/5' : ''}`}>
                    <td className="py-2.5 px-3">
                      <input type="checkbox"
                        checked={selected.has(c.id)}
                        onChange={() => toggleSelect(c.id)}
                        className="rounded border-tierra-300 text-verde focus:ring-verde/30"
                      />
                    </td>
                    <td className="py-2.5 px-4 font-mono text-xs">{c.phone}</td>
                    <td className="py-2.5 px-4">{c.name || <span className="text-tierra-300">—</span>}</td>
                    <td className="py-2.5 px-4 hidden sm:table-cell">
                      {c.extra && Object.keys(c.extra).length > 0 ? (
                        <span className="text-xs text-tierra-400">
                          {Object.entries(c.extra).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                        </span>
                      ) : <span className="text-tierra-300">—</span>}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button onClick={() => openEditContact(c)} className="text-xs text-verde hover:text-verde-700 font-medium">
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination.pages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-tierra-400">Página {pagination.page} de {pagination.pages}</p>
              <div className="flex gap-2">
                <button onClick={() => loadContacts(pagination.page - 1)}
                  disabled={pagination.page <= 1} className="btn-secondary text-sm disabled:opacity-30">Anterior</button>
                <button onClick={() => loadContacts(pagination.page + 1)}
                  disabled={pagination.page >= pagination.pages} className="btn-secondary text-sm disabled:opacity-30">Siguiente</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
