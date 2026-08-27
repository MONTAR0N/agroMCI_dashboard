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
                window.FB.init({ appId: process.env.NEXT_PUBLIC_META_APP_ID, autoLogAppEvents: true, xfbml: true, version: 'v26.0' })
                console.log('[connect-whatsapp] FB SDK inicializado')
                setSdkReady(true)
            }
            const script = document.createElement('script')
            script.src = 'https://connect.facebook.net/en_US/sdk.js'
            script.async = true
            script.defer = true
            script.crossOrigin = 'anonymous'
            document.body.appendChild(script)
        }

        function handleMessage(event: MessageEvent) {
            console.log('[connect-whatsapp] message recibido', { origin: event.origin, data: event.data })
            if (!event.origin.endsWith('facebook.com')) return
            try {
                const data = JSON.parse(event.data)
                console.log('[connect-whatsapp] message parseado', data)
                if (data.type === 'WA_EMBEDDED_SIGNUP') {
                    if (data.event === 'FINISH') {
                        console.log('[connect-whatsapp] FINISH recibido', data.data)
                        setWaData({ wabaId: data.data.waba_id, phoneNumberId: data.data.phone_number_id })
                    } else {
                        console.log('[connect-whatsapp] evento no-FINISH (cancelado o paso intermedio)', data.event, data.data)
                    }
                }
            } catch (e) {
                console.log('[connect-whatsapp] message no era JSON, se ignora', e)
            }
        }
        window.addEventListener('message', handleMessage)
        return () => window.removeEventListener('message', handleMessage)
    }, [])

    // Solo se completa la conexión cuando ya llegaron ambas partes: el code y los datos del WABA
    useEffect(() => {
        console.log('[connect-whatsapp] estado actual', { code, waData })
        if (code && waData) finishConnection(code, waData)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [code, waData])

    function handleConnect() {
        if (!window.FB) return
        setConnecting(true)
        setError('')
        window.FB.login((response: any) => {
            console.log('[connect-whatsapp] FB.login callback', response)
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
            extras: {
                setup: {},
                featureType: '',
                sessionInfoVersion: '3',
            },
        })
    }

    async function finishConnection(c: string, wa: { wabaId: string; phoneNumberId: string }) {
        console.log('[connect-whatsapp] llamando a /api/meta/connect', { c, wa })
        try {
            const res = await fetch('/api/meta/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: c, wabaId: wa.wabaId, phoneNumberId: wa.phoneNumberId }),
            })
            const data = await res.json()
            console.log('[connect-whatsapp] respuesta de /api/meta/connect', res.status, data)
            if (!res.ok) throw new Error(data.error)
            setSuccess(true)
        } catch (err: any) {
            console.log('[connect-whatsapp] error en finishConnection', err)
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
