'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

type HeaderFormat = 'NONE' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT'
type ButtonType = 'URL' | 'PHONE_NUMBER' | 'QUICK_REPLY'

interface ButtonConfig {
  type: ButtonType
  text: string
  url?: string
  phone_number?: string
}

export default function NewTemplatePage() {
  const router = useRouter()

  const [name, setName] = useState('')
  const [category, setCategory] = useState('MARKETING')
  const [language, setLanguage] = useState('es')
  const [headerFormat, setHeaderFormat] = useState<HeaderFormat>('NONE')
  const [headerText, setHeaderText] = useState('')
  const [headerMediaUrl, setHeaderMediaUrl] = useState('')
  const [body, setBody] = useState('')
  const [footer, setFooter] = useState('')
  const [buttons, setButtons] = useState<ButtonConfig[]>([])
  const [varExamples, setVarExamples] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Detectar variables del body
  const detectedVars = (body.match(/\{\{(\d+)\}\}/g) || [])
    .map(v => v.replace(/[{}]/g, ''))
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .sort((a, b) => Number(a) - Number(b))

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

    // Header
    if (headerFormat === 'TEXT' && headerText) {
      components.push({ type: 'HEADER', format: 'TEXT', text: headerText })
    } else if (headerFormat === 'IMAGE' && headerMediaUrl) {
      components.push({
        type: 'HEADER',
        format: 'IMAGE',
        example: { header_handle: [headerMediaUrl] },
      })
    } else if (headerFormat === 'VIDEO' && headerMediaUrl) {
      components.push({
        type: 'HEADER',
        format: 'VIDEO',
        example: { header_handle: [headerMediaUrl] },
      })
    } else if (headerFormat === 'DOCUMENT' && headerMediaUrl) {
      components.push({
        type: 'HEADER',
        format: 'DOCUMENT',
        example: { header_handle: [headerMediaUrl] },
      })
    }

    // Body (requerido)
    if (body) {
      const comp: any = { type: 'BODY', text: body }
      if (detectedVars.length > 0) {
        comp.example = {
          body_text: [detectedVars.map(v => varExamples[v] || `ejemplo_${v}`)]
        }
      }
      components.push(comp)
    }

    // Footer
    if (footer) {
      components.push({ type: 'FOOTER', text: footer })
    }

    // Buttons
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

    if (!name) { setError('El nombre es requerido'); return }
    if (!body) { setError('El cuerpo del mensaje es requerido'); return }

    setLoading(true)
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          language,
          category,
          components: buildComponents(),
        }),
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

  // Preview del cuerpo con variables resaltadas
  function renderBodyPreview() {
    if (!body) return <span className="text-tierra-300">Escribe el cuerpo del mensaje...</span>
    return body.split(/(\{\{\d+\}\})/).map((part, i) =>
      /\{\{\d+\}\}/.test(part)
        ? <span key={i} className="bg-trigo/20 text-trigo-700 px-1 rounded font-mono text-xs">{part}</span>
        : <span key={i}>{part}</span>
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
        <h1 className="text-2xl font-bold text-tierra-900">Nueva plantilla</h1>
        <p className="text-sm text-tierra-400 mt-1">Se enviará a Meta para aprobación</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Nombre y categoría */}
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-tierra-700">Información básica</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-tierra-700 mb-1.5">Nombre</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                className="input-field font-mono"
                placeholder="promo_verano_2024"
              />
              <p className="text-xs text-tierra-400 mt-1">Solo minúsculas, números y guiones bajos</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-tierra-700 mb-1.5">Categoría</label>
              <select value={category} onChange={e => setCategory(e.target.value)} className="input-field">
                <option value="MARKETING">Marketing</option>
                <option value="UTILITY">Utilidad</option>
                <option value="AUTHENTICATION">Autenticación</option>
              </select>
            </div>
          </div>

          <div className="w-full sm:w-1/2">
            <label className="block text-sm font-medium text-tierra-700 mb-1.5">Idioma</label>
            <select value={language} onChange={e => setLanguage(e.target.value)} className="input-field">
              <option value="es">Español</option>
              <option value="es_AR">Español (Argentina)</option>
              <option value="es_MX">Español (México)</option>
              <option value="en_US">Inglés (US)</option>
              <option value="pt_BR">Portugués (Brasil)</option>
            </select>
          </div>
        </div>

        {/* Header */}
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-tierra-700">Encabezado (opcional)</h2>

          <div className="flex flex-wrap gap-2">
            {(['NONE', 'TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT'] as HeaderFormat[]).map(fmt => (
              <button
                key={fmt}
                type="button"
                onClick={() => setHeaderFormat(fmt)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                  ${headerFormat === fmt
                    ? 'bg-verde text-white'
                    : 'bg-paja-50 text-tierra-600 hover:bg-paja-100'}`}
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
            <input
              type="text"
              value={headerText}
              onChange={e => setHeaderText(e.target.value)}
              className="input-field"
              placeholder="Texto del encabezado"
              maxLength={60}
            />
          )}

          {(headerFormat === 'IMAGE' || headerFormat === 'VIDEO' || headerFormat === 'DOCUMENT') && (
            <div>
              <input
                type="url"
                value={headerMediaUrl}
                onChange={e => setHeaderMediaUrl(e.target.value)}
                className="input-field"
                placeholder="https://ejemplo.com/imagen.jpg"
              />
              <p className="text-xs text-tierra-400 mt-1">URL pública del archivo (se usa como ejemplo para la revisión de Meta)</p>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-tierra-700">Cuerpo del mensaje</h2>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            className="input-field min-h-[120px] resize-y"
            placeholder={"Hola {{1}}, tenemos una oferta especial en {{2}} para ti.\n\nUsa las variables {{1}}, {{2}}, etc. para personalizar."}
            maxLength={1024}
          />
          <div className="flex justify-between text-xs text-tierra-400">
            <span>Variables: {'{{1}}'}, {'{{2}}'}, {'{{3}}'} — se reemplazan al enviar</span>
            <span>{body.length}/1024</span>
          </div>

          {/* Preview */}
          {body && (
            <div className="bg-paja-50 rounded-lg p-4">
              <div className="text-xs text-tierra-400 mb-2">Vista previa</div>
              <div className="text-sm text-tierra-800 whitespace-pre-wrap">{renderBodyPreview()}</div>
            </div>
          )}

          {/* Variable examples */}
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
          <h2 className="text-sm font-semibold text-tierra-700">Pie de mensaje (opcional)</h2>
          <input
            type="text"
            value={footer}
            onChange={e => setFooter(e.target.value)}
            className="input-field"
            placeholder="Responde SALIR para no recibir más mensajes"
            maxLength={60}
          />
        </div>

        {/* Buttons */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-tierra-700">Botones (opcional)</h2>
            {buttons.length < 3 && (
              <button type="button" onClick={addButton} className="text-sm text-verde hover:text-verde-700 font-medium">
                + Agregar botón
              </button>
            )}
          </div>

          {buttons.length === 0 && (
            <p className="text-sm text-tierra-400">Sin botones. Puedes agregar hasta 3.</p>
          )}

          {buttons.map((btn, i) => (
            <div key={i} className="bg-paja-50 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-tierra-500">Botón {i + 1}</span>
                <button type="button" onClick={() => removeButton(i)} className="text-xs text-red-500 hover:text-red-700">
                  Eliminar
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-tierra-500 mb-1">Tipo</label>
                  <select
                    value={btn.type}
                    onChange={e => updateButton(i, { type: e.target.value as ButtonType })}
                    className="input-field text-sm"
                  >
                    <option value="QUICK_REPLY">Respuesta rápida</option>
                    <option value="URL">Enlace URL</option>
                    <option value="PHONE_NUMBER">Llamar</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-tierra-500 mb-1">Texto del botón</label>
                  <input
                    type="text"
                    value={btn.text}
                    onChange={e => updateButton(i, { text: e.target.value })}
                    className="input-field text-sm"
                    placeholder="Ver oferta"
                    maxLength={25}
                  />
                </div>
              </div>

              {btn.type === 'URL' && (
                <div>
                  <label className="block text-xs text-tierra-500 mb-1">URL</label>
                  <input
                    type="url"
                    value={btn.url || ''}
                    onChange={e => updateButton(i, { url: e.target.value })}
                    className="input-field text-sm"
                    placeholder="https://tusitio.cl/oferta"
                  />
                </div>
              )}

              {btn.type === 'PHONE_NUMBER' && (
                <div>
                  <label className="block text-xs text-tierra-500 mb-1">Número de teléfono</label>
                  <input
                    type="tel"
                    value={btn.phone_number || ''}
                    onChange={e => updateButton(i, { phone_number: e.target.value })}
                    className="input-field text-sm"
                    placeholder="+56912345678"
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {/* Submit */}
        <div className="flex items-center gap-3">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Enviando a Meta...' : 'Crear plantilla'}
          </button>
          <button type="button" onClick={() => router.back()} className="btn-secondary">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
