import { queryOne } from './db'

export interface ChatwootClient {
    baseUrl: string
    accountId: string
    inboxId: string
    apiToken: string
}

// Si el cliente no tiene Chatwoot configurado, el llamador debe caer de vuelta al envío directo por Meta
export async function getClientChatwoot(clientId: number): Promise<ChatwootClient | null> {
    const baseUrl = process.env.CHATWOOT_BASE_URL
    const apiToken = process.env.CHATWOOT_API_TOKEN
    const client = await queryOne<{
        chatwoot_account_id: string | null
        chatwoot_inbox_id: string | null
    }>(
        'SELECT chatwoot_account_id, chatwoot_inbox_id FROM clients WHERE id = $1',
        [clientId]
    )

    if (!baseUrl || !apiToken || !client?.chatwoot_account_id || !client?.chatwoot_inbox_id) {
        return null
    }

    return {
        baseUrl,
        accountId: client.chatwoot_account_id,
        inboxId: client.chatwoot_inbox_id,
        apiToken,
    }
}

function headers(cw: ChatwootClient) {
    return { 'Content-Type': 'application/json', api_access_token: cw.apiToken }
}

// Normaliza a los mismos dígitos que usa Chatwoot para phone_number (formato E.164)
function toE164(phone: string): string {
    const digits = phone.replace(/[^\d]/g, '')
    return `+${digits}`
}

// Chatwoot no siempre responde { error }: en validaciones devuelve { message, errors }
function extractError(data: any): string {
    if (!data) return 'Error desconocido de Chatwoot'
    if (data.error) return data.error
    if (Array.isArray(data.errors)) return data.errors.map((e: any) => e.message || e).join(', ')
    if (data.errors) return JSON.stringify(data.errors)
    if (data.message) return data.message
    return JSON.stringify(data)
}

export async function findOrCreateContact(cw: ChatwootClient, phone: string, name?: string) {
    const e164 = toE164(phone)

    const searchRes = await fetch(
        `${cw.baseUrl}/api/v1/accounts/${cw.accountId}/contacts/search?q=${encodeURIComponent(e164)}`,
        { headers: headers(cw) }
    )
    const searchData = await searchRes.json()
    const existing = (searchData.payload || []).find((c: any) => c.phone_number === e164)
    if (existing) return { contact: existing, sourceId: findSourceId(existing, cw.inboxId) }

    const createRes = await fetch(`${cw.baseUrl}/api/v1/accounts/${cw.accountId}/contacts`, {
        method: 'POST',
        headers: headers(cw),
        body: JSON.stringify({ inbox_id: Number(cw.inboxId), name: name || e164, phone_number: e164 }),
    })
    const createData = await createRes.json()

    if (!createRes.ok || createData.error) {
        // El contacto puede existir ya con un formato de teléfono distinto (duplicado): reintenta la búsqueda antes de fallar
        const retryRes = await fetch(
            `${cw.baseUrl}/api/v1/accounts/${cw.accountId}/contacts/search?q=${encodeURIComponent(e164)}`,
            { headers: headers(cw) }
        )
        const retryData = await retryRes.json()
        const retryExisting = (retryData.payload || []).find((c: any) => c.phone_number === e164)
        if (retryExisting) return { contact: retryExisting, sourceId: findSourceId(retryExisting, cw.inboxId) }
        throw new Error(`No se pudo crear el contacto en Chatwoot: ${extractError(createData)}`)
    }

    // El source_id real que Chatwoot asigna al contact_inbox no siempre es igual al teléfono en E.164
    const sourceId: string | undefined = createData.payload.contact_inbox?.source_id
    return { contact: createData.payload.contact, sourceId: sourceId || e164 }
}

// Busca el source_id del contact_inbox correspondiente a nuestro inbox (puede no ser el teléfono en E.164)
function findSourceId(contact: any, inboxId: string): string | undefined {
    const match = (contact.contact_inboxes || []).find((ci: any) => ci.inbox?.id === Number(inboxId))
    return match?.source_id
}

export async function findOrCreateConversation(cw: ChatwootClient, contactId: number, sourceId: string) {
    const listRes = await fetch(
        `${cw.baseUrl}/api/v1/accounts/${cw.accountId}/contacts/${contactId}/conversations`,
        { headers: headers(cw) }
    )
    const listData = await listRes.json()
    const existing = (listData.payload || []).find((c: any) => c.inbox_id === Number(cw.inboxId))
    if (existing) return existing.id as number

    const createRes = await fetch(`${cw.baseUrl}/api/v1/accounts/${cw.accountId}/conversations`, {
        method: 'POST',
        headers: headers(cw),
        body: JSON.stringify({ source_id: sourceId, inbox_id: Number(cw.inboxId), contact_id: contactId }),
    })
    const createData = await createRes.json()
    if (!createRes.ok || createData.error) throw new Error(`No se pudo crear la conversación en Chatwoot: ${extractError(createData)}`)
    return createData.id as number
}

export async function sendTemplateViaChatwoot(
    cw: ChatwootClient,
    conversationId: number,
    content: string,
    templateName: string,
    namespace: string,
    language: string,
    bodyParams: string[]
) {
    const processedParams: Record<string, string> = {}
    bodyParams.forEach((p, i) => { processedParams[String(i + 1)] = p })

    const res = await fetch(
        `${cw.baseUrl}/api/v1/accounts/${cw.accountId}/conversations/${conversationId}/messages`,
        {
            method: 'POST',
            headers: headers(cw),
            body: JSON.stringify({
                message_type: 'outgoing',
                content,
                template_params: {
                    name: templateName,
                    namespace,
                    language,
                    processed_params: processedParams,
                },
            }),
        }
    )
    const data = await res.json()
    if (!res.ok || data.error) throw new Error(`No se pudo enviar el mensaje via Chatwoot: ${extractError(data)}`)
    return data
}
