import { NextRequest, NextResponse } from 'next/server'
import { getClientMeta, uploadTemplateMedia } from '@/lib/meta'

// Recibe el archivo de ejemplo desde el navegador y lo sube a Meta para obtener el header_handle
export async function POST(request: NextRequest) {
    try {
        const meta = await getClientMeta()

        const formData = await request.formData()
        const file = formData.get('file')

        if (!file || !(file instanceof File)) {
            return NextResponse.json({ error: 'Falta el archivo a subir' }, { status: 400 })
        }

        const buffer = Buffer.from(await file.arrayBuffer())
        const handle = await uploadTemplateMedia(meta, buffer, file.type)

        return NextResponse.json({ handle })
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || 'Error al subir el archivo' },
            { status: 500 }
        )
    }
}
