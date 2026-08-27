'use client'

import { useEffect, useState } from 'react'

declare global {
    interface Window {
        fbAsyncInit?: () => void
        FB?: any
    }
}

export default function ConnectWhatsAppPage() {
    const [sdkReady, setSdkReady] = useState(false)
    const [connecting, setConnecting] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)
    const [waData, setWaData] = useState<{ wabaId: string; phoneNumberId: string } | null>(null)
    const [code, setCode] = useState<string | null>(null)

    useEffect(() => {
        if (window.FB) {
            setSdkReady(true)
        } else {
            window.fbAsyncInit = () => {
                window.FB.init({ appId: process.env.NEXT_PUBLIC_META_APP_ID, xfbml: true, version: 'v21.0' })
                setSdkReady(true)
            }
            const script = document.createElement('script')
            script.src = 'https://connect.facebook.net/es_LA/sdk.js'
            script.async = true
            document.body.appendChild(script)
        }

        function handleMessage(event: MessageEvent) {
            if (!event.origin.endsWith('facebook.com')) return
            try {
                const data = JSON.parse(event.data)
                if (data.type === 'WA_EMBEDDED_SIGNUP' && data.event === 'FINISH') {
                    setWaData({ wabaId: data.data.waba_id, phoneNumberId: data.data.phone_number_id })
                }
            } catch {
                // mensajes de Facebook que no son JSON (heartbeats, etc.) se ignoran
            }
        }
        window.addEventListener('message', handleMessage)
        return () => window.removeEventListener('message', handleMessage)
    }, [])

    // Solo se completa la conexión cuando ya llegaron ambas partes: el code y los datos del WABA
    useEffect(() => {
        if (code && waData) finishConnection(code, waData)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [code, waData])

    function handleConnect() {
        if (!window.FB) return
        setConnecting(true)
        setError('')
        window.FB.login((response: any) => {
            if (response.authResponse?.code) {
                setCode(response.authResponse.code)
            } else {
                setConnecting(false)
                setError('No se completó la conexión con Meta')
            }
        }, {
            config_id: process.env.NEXT_PUBLIC_META_CONFIG_ID,
            response_type: 'code',
            override_default_response_type: true,
        })
    }

    async function finishConnection(c: string, wa: { wabaId: string; phoneNumberId: string }) {
        try {
            const res = await fetch('/api/meta/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: c, wabaId: wa.wabaId, phoneNumberId: wa.phoneNumberId }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setSuccess(true)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setConnecting(false)
        }
    }

    return (
        <div>
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-tierra-900">Conectar WhatsApp</h1>
                <p className="text-sm text-tierra-400 mt-1">Vincula tu cuenta de WhatsApp Business con este dashboard.</p>
            </div>

            {success ? (
                <div className="card border-green-200 bg-green-50">
                    <p className="text-sm text-green-800">
                        Tu cuenta de WhatsApp quedó conectada. Ya puedes crear plantillas y campañas.
                    </p>
                </div>
            ) : (
                <div className="card">
                    {error && <p className="text-sm text-red-700 mb-4">{error}</p>}
                    <button onClick={handleConnect} disabled={!sdkReady || connecting} className="btn-primary">
                        {connecting ? 'Conectando...' : 'Conectar con WhatsApp Business'}
                    </button>
                </div>
            )}
        </div>
    )
}
