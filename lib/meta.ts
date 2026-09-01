import { queryOne } from './db'
import { getSession } from './auth'

const GRAPH_API = 'https://graph.facebook.com/v21.0'

interface ClientMeta {
  waba_id: string
  phone_number_id: string
  system_user_token: string
}

export async function getClientMeta(): Promise<ClientMeta> {
  const session = await getSession()
  if (!session) throw new Error('No autenticado')

  const client = await queryOne<ClientMeta>(
    'SELECT waba_id, phone_number_id, system_user_token FROM clients WHERE id = $1',
    [session.clientId]
  )

  // Como Tech Provider usamos un único System User token para todos los clientes,
  // salvo que el cliente tenga uno propio guardado (caso excepcional).
  const token = client?.system_user_token || process.env.META_SYSTEM_USER_TOKEN

  if (!client || !client.waba_id || !token) {
    throw new Error('Credenciales de Meta no configuradas para este cliente')
  }

  return { ...client, system_user_token: token }
}

// ─── Templates ───

export async function listTemplates(meta: ClientMeta) {
  const url = `${GRAPH_API}/${meta.waba_id}/message_templates?limit=100&fields=id,name,status,category,language,components,quality_score`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${meta.system_user_token}` },
    cache: 'no-store',
  })

  const data = await res.json()
  if (data.error) throw new Error(data.error.message)
  return data.data || []
}

// El namespace es el que Chatwoot necesita para enviar templates via su API (mismo para todo el WABA)
export async function getWabaNamespace(meta: ClientMeta): Promise<string> {
  const url = `${GRAPH_API}/${meta.waba_id}?fields=message_template_namespace`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${meta.system_user_token}` },
    cache: 'no-store',
  })

  const data = await res.json()
  if (data.error) throw new Error(data.error.message)
  return data.message_template_namespace
}

export async function findApprovedTemplate(meta: ClientMeta, name: string, language: string) {
  const templates = await listTemplates(meta)
  return templates.find((t: any) => t.name === name && t.language === language) || null
}

// Reconstruye el texto final del body reemplazando {{n}} por los valores, para mostrarlo como "content" en Chatwoot
export function renderTemplateBody(components: any[], bodyParams: string[]): string {
  const body = components?.find((c: any) => c.type === 'BODY')
  let text = body?.text || ''
  bodyParams.forEach((value, i) => {
    text = text.replace(`{{${i + 1}}}`, value)
  })
  return text
}

export async function getTemplate(meta: ClientMeta, templateId: string) {
  const url = `${GRAPH_API}/${templateId}?fields=id,name,status,category,language,components`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${meta.system_user_token}` },
    cache: 'no-store',
  })

  const data = await res.json()
  if (data.error) throw new Error(data.error.message)
  return data
}

export async function editTemplate(meta: ClientMeta, templateId: string, components: any[]) {
  const url = `${GRAPH_API}/${templateId}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${meta.system_user_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ components }),
  })

  const data = await res.json()
  if (data.error) throw new Error(data.error.message)
  return data
}

export async function createTemplate(meta: ClientMeta, template: {
  name: string
  language: string
  category: string
  components: any[]
}) {
  const url = `${GRAPH_API}/${meta.waba_id}/message_templates`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${meta.system_user_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(template),
  })

  const data = await res.json()
  if (data.error) throw new Error(data.error.message)
  return data
}

export async function deleteTemplate(meta: ClientMeta, name: string) {
  const url = `${GRAPH_API}/${meta.waba_id}/message_templates?name=${encodeURIComponent(name)}`
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${meta.system_user_token}` },
  })

  const data = await res.json()
  if (data.error) throw new Error(data.error.message)
  return data
}

// ─── Mensajes ───

export async function sendTemplateMessage(
  meta: ClientMeta,
  to: string,
  templateName: string,
  languageCode: string,
  bodyParams?: string[],
  headerParams?: string[]
) {
  const components: any[] = []

  if (headerParams && headerParams.length > 0) {
    components.push({
      type: 'header',
      parameters: headerParams.map(p => ({ type: 'text', text: p })),
    })
  }

  if (bodyParams && bodyParams.length > 0) {
    components.push({
      type: 'body',
      parameters: bodyParams.map(p => ({ type: 'text', text: p })),
    })
  }

  const payload: any = {
    messaging_product: 'whatsapp',
    to: to.replace(/[^\d]/g, ''),
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
    },
  }

  if (components.length > 0) {
    payload.template.components = components
  }

  const url = `${GRAPH_API}/${meta.phone_number_id}/messages`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${meta.system_user_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const data = await res.json()
  if (data.error) throw new Error(data.error.message)
  return data
}
