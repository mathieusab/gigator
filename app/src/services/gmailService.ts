export type GmailThreadSummary = {
  id: string
  snippet?: string
}

export type GmailThreadMessage = {
  id: string
  snippet?: string
  internalDate?: string
  headers: Record<string, string>
}

export type GmailThreadDetail = {
  id: string
  messages: GmailThreadMessage[]
}

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1'

function normalizeGmailError(status: number, bodyText: string): Error {
  if (status === 401) {
    return new Error('Token Gmail manquant/expiré. Reconnecte-toi avec Google.')
  }
  if (status === 403) {
    return new Error(
      "Accès Gmail refusé (scopes insuffisants ou API non autorisée). Reconnecte-toi en acceptant l’accès Gmail."
    )
  }
  if (status === 429) {
    return new Error('Quota Gmail atteint (trop de requêtes). Réessaie dans quelques instants.')
  }
  const trimmed = bodyText.trim()
  return new Error(trimmed ? `Erreur Gmail (${status}): ${trimmed}` : `Erreur Gmail (${status}).`)
}

async function gmailFetchJSON<T>(
  providerToken: string,
  path: string,
  params?: Record<string, string | undefined>,
): Promise<T> {
  const url = new URL(`${GMAIL_API_BASE}${path}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined) continue
      url.searchParams.set(k, v)
    }
  }

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${providerToken}`,
    },
  })

  if (!res.ok) {
    const bodyText = await res.text().catch(() => '')
    throw normalizeGmailError(res.status, bodyText)
  }

  return (await res.json()) as T
}

export async function listGmailThreadsByContactEmail(
  providerToken: string,
  contactEmail: string,
  maxResults = 10,
): Promise<GmailThreadSummary[]> {
  const email = contactEmail.trim()
  if (!email) return []

  const q = `(from:${email} OR to:${email})`

  const data = await gmailFetchJSON<{ threads?: Array<{ id: string; snippet?: string }> }>(
    providerToken,
    '/users/me/threads',
    {
      q,
      maxResults: String(maxResults),
    },
  )

  return (data.threads ?? []).map((t) => ({ id: t.id, snippet: t.snippet }))
}

function headersArrayToRecord(
  headers: Array<{ name?: string; value?: string }> | undefined,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const h of headers ?? []) {
    const name = (h.name ?? '').trim()
    const value = (h.value ?? '').trim()
    if (!name) continue
    if (!value) continue
    out[name.toLowerCase()] = value
  }
  return out
}

export async function getGmailThread(providerToken: string, threadId: string): Promise<GmailThreadDetail> {
  const id = threadId.trim()
  if (!id) throw new Error('Thread Gmail invalide')

  const data = await gmailFetchJSON<{
    id: string
    messages?: Array<{
      id: string
      snippet?: string
      internalDate?: string
      payload?: { headers?: Array<{ name?: string; value?: string }> }
    }>
  }>(providerToken, `/users/me/threads/${encodeURIComponent(id)}`, {
    format: 'metadata',
    // on limite à des headers utiles pour l’affichage minimal
    metadataHeaders: 'Subject,From,To,Date',
  })

  return {
    id: data.id,
    messages: (data.messages ?? []).map((m) => ({
      id: m.id,
      snippet: m.snippet,
      internalDate: m.internalDate,
      headers: headersArrayToRecord(m.payload?.headers),
    })),
  }
}

export function getGmailHeader(message: GmailThreadMessage, headerName: string): string | null {
  const key = headerName.trim().toLowerCase()
  if (!key) return null
  return message.headers[key] ?? null
}
