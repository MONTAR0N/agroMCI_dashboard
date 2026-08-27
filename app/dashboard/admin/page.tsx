'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function AdminPage() {
    const router = useRouter()
    const [allowed, setAllowed] = useState(false)
    const [checking, setChecking] = useState(true)

    useEffect(() => {
        fetch('/api/auth/me')
            .then(res => res.json())
            .then(data => {
                if (data.user?.role !== 'superadmin') {
                    router.push('/dashboard')
                } else {
                    setAllowed(true)
                }
            })
            .catch(() => router.push('/login'))
            .finally(() => setChecking(false))
    }, [router])

    if (checking || !allowed) {
        return <div className="card text-center py-16 text-tierra-400">Cargando...</div>
    }

    return (
        <div>
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-tierra-900">Administración</h1>
                <p className="text-sm text-tierra-400 mt-1">Gestiona los espacios de trabajo y quién tiene acceso a cada uno.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Link href="/dashboard/admin/clients" className="card hover:shadow-sm transition-shadow">
                    <h3 className="text-sm font-semibold text-tierra-900 mb-1">Espacios de trabajo</h3>
                    <p className="text-sm text-tierra-400">Crea y edita clientes, y sus credenciales de WhatsApp/Meta.</p>
                </Link>
                <Link href="/dashboard/admin/users" className="card hover:shadow-sm transition-shadow">
                    <h3 className="text-sm font-semibold text-tierra-900 mb-1">Usuarios</h3>
                    <p className="text-sm text-tierra-400">Crea usuarios y elige a qué espacio de trabajo tiene acceso cada uno.</p>
                </Link>
            </div>
        </div>
    )
}
