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

  if (!client || !client.waba_id || !client.system_user_token) {
    throw new Error('Credenciales de Meta no configuradas para este cliente')
  }

  return client
}

// ─── Templates ───

export async function listTemplates(meta: ClientMeta) {
  const url = `${GRAPH_API}/${meta.waba_id}/message_templates?limit=100&fields=name,status,category,language,components,quality_score`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${meta.system_user_token}` },
    cache: 'no-store',
  })

  const data = await res.json()
  if (data.error) throw new Error(data.error.message)
  return data.data || []
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
