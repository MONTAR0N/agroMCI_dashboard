'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Stats {
  templates: { approved: number; pending: number; rejected: number }
  contacts: number
  campaigns: { total: number; active: number }
}

export default function DashboardHome() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    async function loadStats() {
      const [contactsRes, campaignsRes, templatesRes] = await Promise.allSettled([
        fetch('/api/contacts?page=1&limit=1').then(r => r.json()),
        fetch('/api/campaigns').then(r => r.json()),
        fetch('/api/templates').then(r => r.json()),
      ])

      const contacts = contactsRes.status === 'fulfilled' ? (contactsRes.value.pagination?.total ?? 0) : 0

      const campaignsList = campaignsRes.status === 'fulfilled' ? (campaignsRes.value.campaigns ?? []) : []
      const campaigns = {
        total: campaignsList.length,
        active: campaignsList.filter((c: any) => c.status === 'sending').length,
      }

      const templatesList = templatesRes.status === 'fulfilled' ? (templatesRes.value.templates ?? []) : []
      const templates = {
        approved: templatesList.filter((t: any) => t.status === 'APPROVED').length,
        pending: templatesList.filter((t: any) => t.status === 'PENDING').length,
        rejected: templatesList.filter((t: any) => t.status === 'REJECTED').length,
      }

      setStats({ templates, contacts, campaigns })
    }
    loadStats()
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-bold text-tierra-900 mb-6">Panel de control</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatCard
          title="Plantillas aprobadas"
          value={stats?.templates.approved ?? '—'}
          subtitle={stats ? `${stats.templates.pending} pendientes` : ''}
          href="/dashboard/templates"
          color="verde"
        />
        <StatCard
          title="Contactos"
          value={stats?.contacts ?? '—'}
          subtitle="Total en base de datos"
          href="/dashboard/contacts"
          color="trigo"
        />
        <StatCard
          title="Campañas"
          value={stats?.campaigns.total ?? '—'}
          subtitle={stats ? `${stats.campaigns.active} activas` : ''}
          href="/dashboard/campaigns"
          color="tierra"
        />
      </div>

      {/* Quick Actions */}
      <h2 className="text-lg font-semibold text-tierra-900 mb-3">Acciones rápidas</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <QuickAction
          href="/dashboard/templates"
          title="Crear plantilla"
          description="Diseña un mensaje nuevo para enviar a tus contactos"
        />
        <QuickAction
          href="/dashboard/contacts"
          title="Subir contactos"
          description="Importa un archivo CSV con tu base de datos"
        />
        <QuickAction
          href="/dashboard/campaigns"
          title="Nueva campaña"
          description="Envía un mensaje a un grupo de contactos"
        />
      </div>
    </div>
  )
}

function StatCard({
  title, value, subtitle, href, color
}: {
  title: string; value: number | string; subtitle: string; href: string
  color: 'verde' | 'trigo' | 'tierra'
}) {
  const accents = {
    verde: 'border-l-verde',
    trigo: 'border-l-trigo',
    tierra: 'border-l-tierra-700',
  }

  return (
    <Link
      href={href}
      className={`card border-l-4 ${accents[color]} hover:shadow-md transition-shadow`}
    >
      <div className="text-sm text-tierra-500 mb-1">{title}</div>
      <div className="text-3xl font-bold text-tierra-900">{value}</div>
      {subtitle && <div className="text-xs text-tierra-400 mt-1">{subtitle}</div>}
    </Link>
  )
}

function QuickAction({
  href, title, description
}: {
  href: string; title: string; description: string
}) {
  return (
    <Link
      href={href}
      className="card group hover:border-verde/40 hover:shadow-sm transition-all"
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-tierra-900 group-hover:text-verde transition-colors">
            {title}
          </div>
          <div className="text-xs text-tierra-400 mt-0.5">{description}</div>
        </div>
        <svg className="w-5 h-5 text-tierra-300 group-hover:text-verde transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
      </div>
    </Link>
  )
}
