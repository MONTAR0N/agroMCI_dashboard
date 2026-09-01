'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Campaign {
  id: number
  name: string
  template_name: string
  status: string
  total_contacts: number
  sent_count: number
  delivered_count: number
  read_count: number
  failed_count: number
  created_at: string
  started_at: string | null
  completed_at: string | null
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: 'Borrador', color: 'bg-gray-100 text-gray-600' },
  sending: { label: 'Enviando', color: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Completada', color: 'bg-green-100 text-green-800' },
  paused: { label: 'Pausada', color: 'bg-yellow-100 text-yellow-800' },
  failed: { label: 'Fallida', color: 'bg-red-100 text-red-800' },
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState<number | null>(null)
  const [progress, setProgress] = useState<Record<number, { sent: number; total: number; failed: number }>>({})

  async function loadCampaigns() {
    setLoading(true)
    try {
      const res = await fetch('/api/campaigns')
      const data = await res.json()
      if (res.ok) setCampaigns(data.campaigns)
    } catch { } finally { setLoading(false) }
  }

  useEffect(() => { loadCampaigns() }, [])

  async function handleSend(id: number, relaunch?: 'failed' | 'all') {
    setSending(id)
    let done = false
    let first = true

    while (!done) {
      try {
        const res = await fetch(`/api/campaigns/${id}/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(first ? { relaunch } : {}),
        })
        first = false
        const data = await res.json()
        if (!res.ok) { alert('Error: ' + data.error); break }

        setProgress(prev => ({ ...prev, [id]: { sent: data.sent, total: data.total, failed: data.failed } }))
        done = data.done

        // Actualizar la campaña en la lista
        setCampaigns(prev => prev.map(c =>
          c.id === id ? { ...c, sent_count: data.sent, failed_count: data.failed, status: data.status } : c
        ))
      } catch (err: any) {
        alert('Error de conexión: ' + err.message)
        break
      }
    }

    setSending(null)
    loadCampaigns()
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar esta campaña y todos sus registros de envío?')) return
    try {
      await fetch(`/api/campaigns/${id}`, { method: 'DELETE' })
      setCampaigns(prev => prev.filter(c => c.id !== id))
    } catch { }
  }

  function formatDate(d: string | null) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  if (loading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-tierra-900">Campañas</h1>
        </div>
        <div className="card text-center py-16 text-tierra-400">Cargando...</div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-tierra-900">Campañas</h1>
          <p className="text-sm text-tierra-400 mt-1">{campaigns.length} campaña{campaigns.length !== 1 ? 's' : ''}</p>
        </div>
        <Link href="/dashboard/campaigns/new" className="btn-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nueva campaña
        </Link>
      </div>

      {campaigns.length === 0 ? (
        <div className="card text-center py-16">
          <svg className="w-12 h-12 text-tierra-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
          </svg>
          <h3 className="text-sm font-semibold text-tierra-700 mb-1">Sin campañas</h3>
          <p className="text-sm text-tierra-400 mb-4">Necesitas al menos una plantilla aprobada y contactos.</p>
          <Link href="/dashboard/campaigns/new" className="btn-primary">Crear campaña</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map(c => {
            const status = STATUS_LABELS[c.status] || { label: c.status, color: 'bg-gray-100 text-gray-600' }
            const isSending = sending === c.id
            const prog = progress[c.id]
            const pct = c.total_contacts > 0 ? Math.round(((c.sent_count + c.failed_count) / c.total_contacts) * 100) : 0

            return (
              <div key={c.id} className="card">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-tierra-900">{c.name}</h3>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                        {status.label}
                      </span>
                    </div>
                    <p className="text-xs text-tierra-400 mb-2">
                      Plantilla: <span className="font-mono">{c.template_name}</span> · Creada: {formatDate(c.created_at)}
                    </p>

                    {/* Progress bar */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-paja-100 rounded-full h-2 max-w-xs">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${c.failed_count > 0 ? 'bg-trigo' : 'bg-verde'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-tierra-500 whitespace-nowrap">
                        {c.sent_count} enviados · {c.failed_count} fallidos · {c.total_contacts} total
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {(c.status === 'draft' || c.status === 'paused') && (
                      <button
                        onClick={() => handleSend(c.id)}
                        disabled={isSending}
                        className="btn-primary text-xs py-1.5 px-3"
                      >
                        {isSending ? (
                          <span>Enviando {prog ? `${prog.sent}/${prog.total}` : '...'}...</span>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                            </svg>
                            Enviar
                          </>
                        )}
                      </button>
                    )}
                    {(c.status === 'completed' || c.status === 'failed') && (
                      <>
                        {c.failed_count > 0 && (
                          <button
                            onClick={() => handleSend(c.id, 'failed')}
                            disabled={isSending}
                            className="btn-secondary text-xs py-1.5 px-3"
                          >
                            {isSending ? `Enviando ${prog ? `${prog.sent}/${prog.total}` : '...'}...` : 'Reintentar fallidos'}
                          </button>
                        )}
                        <button
                          onClick={() => { if (confirm('¿Reenviar la campaña a todos los contactos de nuevo?')) handleSend(c.id, 'all') }}
                          disabled={isSending}
                          className="btn-primary text-xs py-1.5 px-3"
                        >
                          {isSending ? `Enviando ${prog ? `${prog.sent}/${prog.total}` : '...'}...` : 'Reenviar a todos'}
                        </button>
                      </>
                    )}
                    {c.status !== 'sending' && (
                      <Link
                        href={`/dashboard/campaigns/edit/${c.id}`}
                        className="p-2 rounded-lg text-tierra-300 hover:text-verde hover:bg-verde/10 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                        </svg>
                      </Link>
                    )}
                    <button
                      onClick={() => handleDelete(c.id)}
                      disabled={isSending}
                      className="p-2 rounded-lg text-tierra-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
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
