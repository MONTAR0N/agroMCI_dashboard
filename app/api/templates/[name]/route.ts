import { NextRequest, NextResponse } from 'next/server'
import { getClientMeta, deleteTemplate } from '@/lib/meta'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    const meta = await getClientMeta()
    const result = await deleteTemplate(meta, params.name)
    return NextResponse.json({ result })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error al eliminar plantilla' },
      { status: 500 }
    )
  }
}
