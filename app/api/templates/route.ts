import { NextRequest, NextResponse } from 'next/server'
import { getClientMeta, listTemplates, createTemplate } from '@/lib/meta'

export async function GET() {
  try {
    const meta = await getClientMeta()
    const templates = await listTemplates(meta)
    return NextResponse.json({ templates })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error al obtener plantillas' },
      { status: error.message?.includes('No autenticado') ? 401 : 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const meta = await getClientMeta()
    const body = await request.json()

    const { name, language, category, components } = body

    if (!name || !language || !category || !components) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: name, language, category, components' },
        { status: 400 }
      )
    }

    // Validar nombre: solo minúsculas, números y guiones bajos
    if (!/^[a-z0-9_]+$/.test(name)) {
      return NextResponse.json(
        { error: 'El nombre solo puede contener letras minúsculas, números y guiones bajos' },
        { status: 400 }
      )
    }

    const result = await createTemplate(meta, { name, language, category, components })
    return NextResponse.json({ result })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error al crear plantilla' },
      { status: 500 }
    )
  }
}
