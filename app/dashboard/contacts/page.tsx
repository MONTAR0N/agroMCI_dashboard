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
  const fileRef = useRef<HTMLInputElement>(null)

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
    } catch (err: any) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadContacts() }, [])

  function handleSearch() {
    loadContacts(1)
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      parseCSV(text)
    }
    reader.readAsText(file)
  }

  function parseCSV(text: string) {
    // Detectar separador
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

    setCsvHeaders(headers)
    setCsvData(rows)
    setShowUpload(true)
    setImportResult(null)

    // Auto-detectar columnas
    const phoneLike = headers.find(h => /tel[eé]fono|phone|celular|m[oó]vil|whatsapp|numero|número/i.test(h))
    const nameLike = headers.find(h => /nombre|name|cliente|contacto/i.test(h))
    if (phoneLike) setPhoneCol(phoneLike)
    if (nameLike) setNameCol(nameLike)
  }

  async function handleImport() {
    if (!phoneCol) return

    setImporting(true)
    try {
      const contacts = csvData.map(row => {
        const contact: Record<string, string> = {
          phone: row[phoneCol] || '',
          name: nameCol ? row[nameCol] || '' : '',
        }
        // Agregar columnas extra
        for (const [key, value] of Object.entries(row)) {
          if (key !== phoneCol && key !== nameCol && value) {
            contact[key] = value
          }
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
    } finally {
      setImporting(false)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar este contacto?')) return
    try {
      await fetch(`/api/contacts/${id}`, { method: 'DELETE' })
      setContacts(prev => prev.filter(c => c.id !== id))
      setPagination(prev => ({ ...prev, total: prev.total - 1 }))
    } catch { }
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-tierra-900">Contactos</h1>
          <p className="text-sm text-tierra-400 mt-1">{pagination.total} contacto{pagination.total !== 1 ? 's' : ''}</p>
        </div>
        <div>
          <input type="file" ref={fileRef} accept=".csv,.txt" onChange={handleFileSelect} className="hidden" />
          <button onClick={() => fileRef.current?.click()} className="btn-primary">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
            </svg>
            Subir CSV
          </button>
        </div>
      </div>

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
              <p className="text-sm text-tierra-500 mb-4">
                {csvData.length} filas encontradas. Selecciona qué columna corresponde a cada campo.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-tierra-700 mb-1.5">
                    Columna de teléfono <span className="text-red-500">*</span>
                  </label>
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

              {/* Preview */}
              {phoneCol && (
                <div className="mb-4">
                  <p className="text-xs text-tierra-400 mb-2">Vista previa (primeros 5)</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-paja-200">
                          <th className="text-left py-2 px-3 text-tierra-500 font-medium">Teléfono</th>
                          <th className="text-left py-2 px-3 text-tierra-500 font-medium">Nombre</th>
                          {csvHeaders.filter(h => h !== phoneCol && h !== nameCol).slice(0, 3).map(h => (
                            <th key={h} className="text-left py-2 px-3 text-tierra-500 font-medium">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csvData.slice(0, 5).map((row, i) => (
                          <tr key={i} className="border-b border-paja-100">
                            <td className="py-2 px-3 font-mono text-xs">{row[phoneCol]}</td>
                            <td className="py-2 px-3">{nameCol ? row[nameCol] : '—'}</td>
                            {csvHeaders.filter(h => h !== phoneCol && h !== nameCol).slice(0, 3).map(h => (
                              <td key={h} className="py-2 px-3 text-tierra-400">{row[h]}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  onClick={handleImport}
                  disabled={!phoneCol || importing}
                  className="btn-primary"
                >
                  {importing ? 'Importando...' : `Importar ${csvData.length} contactos`}
                </button>
                <button onClick={closeUpload} className="btn-secondary">Cancelar</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Search */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          className="input-field max-w-sm"
          placeholder="Buscar por teléfono o nombre..."
        />
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
          <p className="text-sm text-tierra-400 mb-4">Sube un archivo CSV con los teléfonos de tus clientes.</p>
          <button onClick={() => fileRef.current?.click()} className="btn-primary">Subir CSV</button>
        </div>
      ) : (
        <>
          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-paja-200 bg-paja-50/50">
                  <th className="text-left py-3 px-4 text-tierra-500 font-medium">Teléfono</th>
                  <th className="text-left py-3 px-4 text-tierra-500 font-medium">Nombre</th>
                  <th className="text-left py-3 px-4 text-tierra-500 font-medium hidden sm:table-cell">Datos extra</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {contacts.map(c => (
                  <tr key={c.id} className="border-b border-paja-100 hover:bg-paja-50/30">
                    <td className="py-2.5 px-4 font-mono text-xs">{c.phone}</td>
                    <td className="py-2.5 px-4">{c.name || <span className="text-tierra-300">—</span>}</td>
                    <td className="py-2.5 px-4 hidden sm:table-cell">
                      {c.extra && Object.keys(c.extra).length > 0 ? (
                        <span className="text-xs text-tierra-400">
                          {Object.entries(c.extra).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                        </span>
                      ) : (
                        <span className="text-tierra-300">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-2">
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="p-1.5 rounded text-tierra-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-tierra-400">
                Página {pagination.page} de {pagination.pages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => loadContacts(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="btn-secondary text-sm disabled:opacity-30"
                >
                  Anterior
                </button>
                <button
                  onClick={() => loadContacts(pagination.page + 1)}
                  disabled={pagination.page >= pagination.pages}
                  className="btn-secondary text-sm disabled:opacity-30"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
