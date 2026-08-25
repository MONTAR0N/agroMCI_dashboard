'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Template {
  id: string
  name: string
  status: string
  category: string
  language: string
  components: any[]
  quality_score?: { score: string }
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  APPROVED: { label: 'Aprobada', color: 'bg-green-100 text-green-800' },
  PENDING: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' },
  REJECTED: { label: 'Rechazada', color: 'bg-red-100 text-red-800' },
  PAUSED: { label: 'Pausada', color: 'bg-gray-100 text-gray-600' },
  DISABLED: { label: 'Desactivada', color: 'bg-gray-100 text-gray-600' },
}

const CATEGORY_LABELS: Record<string, string> = {
  MARKETING: 'Marketing',
  UTILITY: 'Utilidad',
  AUTHENTICATION: 'Autenticación',
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

  async function loadTemplates() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/templates')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setTemplates(data.templates)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadTemplates() }, [])

  async function handleDelete(t: Template) {
    if (!confirm(`¿Eliminar la plantilla "${t.name}"? Esta acción no se puede deshacer.`)) return
    setDeleting(t.id)
    try {
      const res = await fetch(`/api/templates/${t.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setTemplates(prev => prev.filter(x => x.id !== t.id))
    } catch (err: any) {
      alert('Error al eliminar: ' + err.message)
    } finally {
      setDeleting(null)
    }
  }

  function getBodyPreview(t: Template): string {
    const body = t.components?.find((c: any) => c.type === 'BODY')
    return body?.text?.substring(0, 100) || '—'
  }

  function getHeaderType(t: Template): string | null {
    const header = t.components?.find((c: any) => c.type === 'HEADER')
    if (!header) return null
    return header.format
  }

  function hasButtons(t: Template): boolean {
    return t.components?.some((c: any) => c.type === 'BUTTONS') || false
  }

  function hasCarousel(t: Template): boolean {
    return t.components?.some((c: any) => c.type === 'CAROUSEL') || false
  }

  function canEdit(t: Template): boolean {
    return ['APPROVED', 'REJECTED', 'PAUSED'].includes(t.status)
  }

  if (loading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-tierra-900">Plantillas</h1>
        </div>
        <div className="card text-center py-16 text-tierra-400">Cargando plantillas desde Meta...</div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-tierra-900">Plantillas</h1>
          <p className="text-sm text-tierra-400 mt-1">{templates.length} plantilla{templates.length !== 1 ? 's' : ''}</p>
        </div>
        <Link href="/dashboard/templates/new" className="btn-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nueva plantilla
        </Link>
      </div>

      {error && (
        <div className="card border-red-200 bg-red-50 mb-4">
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={loadTemplates} className="text-sm text-red-600 underline mt-1">Reintentar</button>
        </div>
      )}

      {templates.length === 0 && !error ? (
        <div className="card text-center py-16">
          <svg className="w-12 h-12 text-tierra-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
          <h3 className="text-sm font-semibold text-tierra-700 mb-1">Sin plantillas</h3>
          <p className="text-sm text-tierra-400 mb-4">Crea tu primera plantilla de WhatsApp.</p>
          <Link href="/dashboard/templates/new" className="btn-primary">Crear plantilla</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map(t => {
            const status = STATUS_LABELS[t.status] || { label: t.status, color: 'bg-gray-100 text-gray-600' }
            const headerType = getHeaderType(t)
            return (
              <div key={t.id} className="card hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-tierra-900 font-mono">{t.name}</h3>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                        {status.label}
                      </span>
                      <span className="text-xs text-tierra-400">
                        {CATEGORY_LABELS[t.category] || t.category}
                      </span>
                    </div>
                    <p className="text-sm text-tierra-600 mb-2">{getBodyPreview(t)}</p>
                    <div className="flex items-center gap-2">
                      {headerType && (
                        <span className="inline-flex items-center gap-1 text-xs text-tierra-400">
                          {headerType === 'IMAGE' && '🖼️ Imagen'}
                          {headerType === 'VIDEO' && '🎬 Video'}
                          {headerType === 'DOCUMENT' && '📄 Documento'}
                          {headerType === 'TEXT' && '📝 Encabezado'}
                        </span>
                      )}
                      {hasButtons(t) && (
                        <span className="text-xs text-tierra-400">🔘 Botones</span>
                      )}
                      {hasCarousel(t) && (
                        <span className="text-xs text-tierra-400">🎠 Carrusel</span>
                      )}
                      <span className="text-xs text-tierra-300">·</span>
                      <span className="text-xs text-tierra-400">{t.language}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {canEdit(t) && (
                      <Link
                        href={`/dashboard/templates/edit/${t.id}`}
                        className="p-2 rounded-lg text-tierra-300 hover:text-verde hover:bg-verde/10 transition-colors"
                        title="Editar plantilla"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                        </svg>
                      </Link>
                    )}
                    <button
                      onClick={() => handleDelete(t)}
                      disabled={deleting === t.id}
                      className="p-2 rounded-lg text-tierra-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                      title="Eliminar plantilla"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
