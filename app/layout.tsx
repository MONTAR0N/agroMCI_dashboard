import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MCI Dashboard',
  description: 'Gestión de campañas WhatsApp — Agrícola MCI',
  icons: {
    icon: 'https://res.cloudinary.com/dyra9pwvm/image/upload/v1787859590/mci-logo-1024-verde_awjgnc.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
