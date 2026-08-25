import { NextRequest, NextResponse } from 'next/server'
import { getClientMeta, getTemplate, editTemplate, deleteTemplate } from '@/lib/meta'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const meta = await getClientMeta()
    const template = await getTemplate(meta, params.id)
    return NextResponse.json({ template })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const meta = await getClientMeta()
    const { components } = await request.json()

    if (!components || !Array.isArray(components)) {
      return NextResponse.json({ error: 'Se requiere el array de components' }, { status: 400 })
    }

    const result = await editTemplate(meta, params.id, components)
    return NextResponse.json({ result })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const meta = await getClientMeta()
    // Para delete Meta necesita el nombre, lo obtenemos primero
    const template = await getTemplate(meta, params.id)
    const result = await deleteTemplate(meta, template.name)
    return NextResponse.json({ result })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
