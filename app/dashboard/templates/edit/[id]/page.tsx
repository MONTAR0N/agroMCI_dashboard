'use client'

import { useState, useEffect, FormEvent } from 'react'
import { useRouter, useParams } from 'next/navigation'

type HeaderFormat = 'NONE' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT'
type ButtonType = 'URL' | 'PHONE_NUMBER' | 'QUICK_REPLY'

interface ButtonConfig {
  type: ButtonType
  text: string
  url?: string
  phone_number?: string
}

export default function EditTemplatePage() {
  const router = useRouter()
  const params = useParams()
  const templateId = params.id as string

  const [templateName, setTemplateName] = useState('')
  const [category, setCategory] = useState('')
  const [language, setLanguage] = useState('')
  const [status, setStatus] = useState('')
  const [headerFormat, setHeaderFormat] = useState<HeaderFormat>('NONE')
  const [headerText, setHeaderText] = useState('')
  const [headerMediaUrl, setHeaderMediaUrl] = useState('')
  const [body, setBody] = useState('')
  const [footer, setFooter] = useState('')
  const [buttons, setButtons] = useState<ButtonConfig[]>([])
  const [varExamples, setVarExamples] = useState<Record<string, string>>({})
  const [loadingTemplate, setLoadingTemplate] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const detectedVars = (body.match(/\{\{(\d+)\}\}/g) || [])
    .map(v => v.replace(/[{}]/g, ''))
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .sort((a, b) => Number(a) - Number(b))

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/templates/${templateId}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)

        const t = data.template
        setTemplateName(t.name)
        setCategory(t.category)
        setLanguage(t.language)
        setStatus(t.status)

        // Parsear componentes existentes
        for (const comp of t.components || []) {
          if (comp.type === 'HEADER') {
            setHeaderFormat(comp.format || 'NONE')
            if (comp.format === 'TEXT') setHeaderText(comp.text || '')
            else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(comp.format)) {
              setHeaderMediaUrl(comp.example?.header_handle?.[0] || '')
            }
          }
          if (comp.type === 'BODY') setBody(comp.text || '')
          if (comp.type === 'FOOTER') setFooter(comp.text || '')
          if (comp.type === 'BUTTONS') {
            setButtons((comp.buttons || []).map((b: any) => ({
              type: b.type,
              text: b.text,
              url: b.url,
              phone_number: b.phone_number,
            })))
          }
        }
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoadingTemplate(false)
      }
    }
    load()
  }, [templateId])

  function addButton() {
    if (buttons.length >= 3) return
    setButtons([...buttons, { type: 'QUICK_REPLY', text: '' }])
  }

  function updateButton(index: number, updates: Partial<ButtonConfig>) {
    setButtons(buttons.map((b, i) => i === index ? { ...b, ...updates } : b))
  }

  function removeButton(index: number) {
    setButtons(buttons.filter((_, i) => i !== index))
  }

  function buildComponents(): any[] {
    const components: any[] = []

    if (headerFormat === 'TEXT' && headerText) {
      components.push({ type: 'HEADER', format: 'TEXT', text: headerText })
    } else if (headerFormat === 'IMAGE' && headerMediaUrl) {
      components.push({ type: 'HEADER', format: 'IMAGE', example: { header_handle: [headerMediaUrl] } })
    } else if (headerFormat === 'VIDEO' && headerMediaUrl) {
      components.push({ type: 'HEADER', format: 'VIDEO', example: { header_handle: [headerMediaUrl] } })
    } else if (headerFormat === 'DOCUMENT' && headerMediaUrl) {
      components.push({ type: 'HEADER', format: 'DOCUMENT', example: { header_handle: [headerMediaUrl] } })
    }

    if (body) {
      const comp: any = { type: 'BODY', text: body }
      if (detectedVars.length > 0) {
        comp.example = { body_text: [detectedVars.map(v => varExamples[v] || `ejemplo_${v}`)] }
      }
      components.push(comp)
    }

    if (footer) {
      components.push({ type: 'FOOTER', text: footer })
    }

    if (buttons.length > 0) {
      components.push({
        type: 'BUTTONS',
        buttons: buttons.map(b => {
          if (b.type === 'URL') return { type: 'URL', text: b.text, url: b.url }
          if (b.type === 'PHONE_NUMBER') return { type: 'PHONE_NUMBER', text: b.text, phone_number: b.phone_number }
          return { type: 'QUICK_REPLY', text: b.text }
        })
      })
    }

    return components
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (!body) { setError('El cuerpo del mensaje es requerido'); return }

    setLoading(true)
    try {
      const res = await fetch(`/api/templates/${templateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ components: buildComponents() }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      router.push('/dashboard/templates')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function renderBodyPreview() {
    if (!body) return <span className="text-tierra-300">...</span>
    return body.split(/(\{\{\d+\}\})/).map((part, i) =>
      /\{\{\d+\}\}/.test(part)
        ? <span key={i} className="bg-trigo/20 text-trigo-700 px-1 rounded font-mono text-xs">{part}</span>
        : <span key={i}>{part}</span>
    )
  }

  if (loadingTemplate) {
    return (
      <div className="max-w-3xl">
        <div className="card text-center py-16 text-tierra-400">Cargando plantilla...</div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <button onClick={() => router.back()} className="text-sm text-tierra-400 hover:text-tierra-700 mb-2 inline-flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          Volver
        </button>
        <h1 className="text-2xl font-bold text-tierra-900">Editar plantilla</h1>
        <p className="text-sm text-tierra-400 mt-1">
          <span className="font-mono">{templateName}</span> · {category} · {language} · Los cambios vuelven a pasar por revisión de Meta
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header */}
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-tierra-700">Encabezado</h2>
          <div className="flex flex-wrap gap-2">
            {(['NONE', 'TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT'] as HeaderFormat[]).map(fmt => (
              <button
                key={fmt}
                type="button"
                onClick={() => setHeaderFormat(fmt)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                  ${headerFormat === fmt ? 'bg-verde text-white' : 'bg-paja-50 text-tierra-600 hover:bg-paja-100'}`}
              >
                {fmt === 'NONE' && 'Ninguno'}
                {fmt === 'TEXT' && '📝 Texto'}
                {fmt === 'IMAGE' && '🖼️ Imagen'}
                {fmt === 'VIDEO' && '🎬 Video'}
                {fmt === 'DOCUMENT' && '📄 Documento'}
              </button>
            ))}
          </div>

          {headerFormat === 'TEXT' && (
            <input type="text" value={headerText} onChange={e => setHeaderText(e.target.value)}
              className="input-field" placeholder="Texto del encabezado" maxLength={60} />
          )}
          {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerFormat) && (
            <div>
              <input type="url" value={headerMediaUrl} onChange={e => setHeaderMediaUrl(e.target.value)}
                className="input-field" placeholder="https://ejemplo.com/imagen.jpg" />
              <p className="text-xs text-tierra-400 mt-1">URL pública del archivo</p>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-tierra-700">Cuerpo del mensaje</h2>
          <textarea value={body} onChange={e => setBody(e.target.value)}
            className="input-field min-h-[120px] resize-y" maxLength={1024}
            placeholder="Hola {{1}}, tenemos una oferta especial..." />
          <div className="flex justify-between text-xs text-tierra-400">
            <span>Variables: {'{{1}}'}, {'{{2}}'}, {'{{3}}'}</span>
            <span>{body.length}/1024</span>
          </div>
          {body && (
            <div className="bg-paja-50 rounded-lg p-4">
              <div className="text-xs text-tierra-400 mb-2">Vista previa</div>
              <div className="text-sm text-tierra-800 whitespace-pre-wrap">{renderBodyPreview()}</div>
            </div>
          )}

          {detectedVars.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-tierra-500">Ejemplos de variables (para la revisión de Meta)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {detectedVars.map(v => (
                  <div key={v}>
                    <label className="block text-xs text-tierra-500 mb-1">{`{{${v}}}`}</label>
                    <input
                      type="text"
                      value={varExamples[v] || ''}
                      onChange={e => setVarExamples({ ...varExamples, [v]: e.target.value })}
                      className="input-field text-sm"
                      placeholder={`Ej: ${v === '1' ? 'Juan' : v === '2' ? '10:00' : `valor_${v}`}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-tierra-700">Pie de mensaje</h2>
          <input type="text" value={footer} onChange={e => setFooter(e.target.value)}
            className="input-field" placeholder="Responde SALIR para no recibir más mensajes" maxLength={60} />
        </div>

        {/* Buttons */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-tierra-700">Botones</h2>
            {buttons.length < 3 && (
              <button type="button" onClick={addButton} className="text-sm text-verde hover:text-verde-700 font-medium">
                + Agregar botón
              </button>
            )}
          </div>

          {buttons.length === 0 && <p className="text-sm text-tierra-400">Sin botones.</p>}

          {buttons.map((btn, i) => (
            <div key={i} className="bg-paja-50 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-tierra-500">Botón {i + 1}</span>
                <button type="button" onClick={() => removeButton(i)} className="text-xs text-red-500 hover:text-red-700">Eliminar</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-tierra-500 mb-1">Tipo</label>
                  <select value={btn.type} onChange={e => updateButton(i, { type: e.target.value as ButtonType })} className="input-field text-sm">
                    <option value="QUICK_REPLY">Respuesta rápida</option>
                    <option value="URL">Enlace URL</option>
                    <option value="PHONE_NUMBER">Llamar</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-tierra-500 mb-1">Texto del botón</label>
                  <input type="text" value={btn.text} onChange={e => updateButton(i, { text: e.target.value })}
                    className="input-field text-sm" placeholder="Ver oferta" maxLength={25} />
                </div>
              </div>
              {btn.type === 'URL' && (
                <div>
                  <label className="block text-xs text-tierra-500 mb-1">URL</label>
                  <input type="url" value={btn.url || ''} onChange={e => updateButton(i, { url: e.target.value })}
                    className="input-field text-sm" placeholder="https://tusitio.cl/oferta" />
                </div>
              )}
              {btn.type === 'PHONE_NUMBER' && (
                <div>
                  <label className="block text-xs text-tierra-500 mb-1">Número</label>
                  <input type="tel" value={btn.phone_number || ''} onChange={e => updateButton(i, { phone_number: e.target.value })}
                    className="input-field text-sm" placeholder="+56912345678" />
                </div>
              )}
            </div>
          ))}
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</div>
        )}

        <div className="flex items-center gap-3">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Guardando cambios...' : 'Guardar cambios'}
          </button>
          <button type="button" onClick={() => router.back()} className="btn-secondary">Cancelar</button>
        </div>
      </form>
    </div>
  )
}
