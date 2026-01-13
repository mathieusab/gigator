export type GmailThread = {
  id: string;
  snippet?: string;
  threadId?: string;
  historyId?: string;
  messages?: Array<{
    id?: string;
    threadId?: string;
    snippet?: string;
    internalDate?: string;
  }>;
};

export type GmailMessageFull = {
  id?: string;
  threadId?: string;
  snippet?: string;
  internalDate?: string;
  headers?: {
    from?: string;
    to?: string;
    subject?: string;
    date?: string;
  };
  bodyText?: string;
  bodyHtml?: string;
};

export type GmailThreadFull = {
  id: string;
  threadId?: string;
  snippet?: string;
  historyId?: string;
  messages?: GmailMessageFull[];
};

export type GmailProxyConfig = {
  clientId: string;
  clientSecret: string;
  accessToken: string;
};

export class GmailProxyError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type GmailApiHeader = { name?: string; value?: string };
type GmailApiMessagePart = {
  mimeType?: string;
  headers?: GmailApiHeader[];
  body?: { size?: number; data?: string };
  parts?: GmailApiMessagePart[];
};

function normalizeHeaderValue(headers: GmailApiHeader[] | undefined, name: string): string {
  const list = Array.isArray(headers) ? headers : [];
  const needle = name.toLowerCase();
  const found = list.find((h) => String(h?.name ?? '').toLowerCase() === needle);
  return String(found?.value ?? '').trim();
}

function decodeBase64UrlUtf8(data: string): string {
  const raw = String(data ?? '').trim();
  if (!raw) return '';
  try {
    return Buffer.from(raw, 'base64url').toString('utf8');
  } catch {
    return '';
  }
}

function extractBodies(payload: GmailApiMessagePart | undefined): { text?: string; html?: string } {
  const out: { text?: string; html?: string } = {};
  const visit = (part: GmailApiMessagePart | undefined) => {
    if (!part) return;

    const mimeType = String(part.mimeType ?? '').toLowerCase();
    const data = part.body?.data;
    if (data && (mimeType === 'text/plain' || mimeType === 'text/html')) {
      const decoded = decodeBase64UrlUtf8(data);
      if (decoded) {
        if (mimeType === 'text/plain' && !out.text) out.text = decoded;
        if (mimeType === 'text/html' && !out.html) out.html = decoded;
      }
    }

    const parts = Array.isArray(part.parts) ? part.parts : [];
    for (const p of parts) visit(p);
  };

  visit(payload);
  return out;
}

async function fetchJson(url: string, accessToken: string) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (res.status === 401 || res.status === 403) {
    throw new GmailProxyError(
      401,
      'Unauthorized to access Gmail. Re-authenticate with Gmail permission.',
    );
  }

  if (!res.ok) {
    throw new GmailProxyError(502, `Gmail API error (${res.status})`);
  }

  return (await res.json()) as unknown;
}

export async function listThreadsForEmail(
  config: GmailProxyConfig,
  email: string,
  opts?: {
    maxThreads?: number;
  },
): Promise<GmailThread[]> {
  const q = `from:${email} OR to:${email}`;
  const maxThreadsRaw = opts?.maxThreads;
  const maxThreads =
    typeof maxThreadsRaw === 'number' && Number.isFinite(maxThreadsRaw)
      ? Math.max(1, Math.min(200, Math.floor(maxThreadsRaw)))
      : 20;

  const threadRefs: Array<{ id?: string; threadId?: string }> = [];
  let pageToken: string | undefined;
  while (threadRefs.length < maxThreads) {
    const remaining = maxThreads - threadRefs.length;
    const pageSize = Math.max(1, Math.min(100, remaining));
    const params = new URLSearchParams({ q, maxResults: String(pageSize) });
    if (pageToken) params.set('pageToken', pageToken);

    const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/threads?${params.toString()}`;
    const listJson = (await fetchJson(listUrl, config.accessToken)) as {
      threads?: Array<{ id?: string; threadId?: string }>;
      nextPageToken?: string;
    };

    const pageThreads = listJson.threads ?? [];
    if (pageThreads.length === 0) break;
    threadRefs.push(...pageThreads);
    pageToken = listJson.nextPageToken;
    if (!pageToken) break;
  }

  if (threadRefs.length === 0) return [];

  const threads: GmailThread[] = [];
  for (const ref of threadRefs) {
    const threadId = ref.id ?? ref.threadId;
    if (!threadId) continue;

    const getUrl = `https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(threadId)}?format=metadata`;
    const threadJson = (await fetchJson(getUrl, config.accessToken)) as {
      id?: string;
      snippet?: string;
      historyId?: string;
      messages?: Array<{
        id?: string;
        threadId?: string;
        snippet?: string;
        internalDate?: string;
      }>;
    };

    const messages = (threadJson.messages ?? []).map((m) => {
      const ms = m.internalDate ? Number(m.internalDate) : NaN;
      const internalDate = Number.isFinite(ms) ? new Date(ms).toISOString() : undefined;
      return {
        id: m.id,
        threadId: m.threadId,
        snippet: m.snippet,
        internalDate,
      };
    });

    threads.push({
      id: threadJson.id ?? threadId,
      threadId: threadJson.id ?? threadId,
      snippet: threadJson.snippet,
      historyId: threadJson.historyId,
      messages,
    });
  }

  return threads;
}

export async function getThreadById(
  config: GmailProxyConfig,
  threadId: string,
): Promise<GmailThreadFull> {
  const id = String(threadId ?? '').trim();
  if (!id) throw new GmailProxyError(400, 'Missing threadId');

  const getUrl = `https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(id)}?format=full`;
  const threadJson = (await fetchJson(getUrl, config.accessToken)) as {
    id?: string;
    snippet?: string;
    historyId?: string;
    messages?: Array<{
      id?: string;
      threadId?: string;
      snippet?: string;
      internalDate?: string;
      payload?: GmailApiMessagePart;
    }>;
  };

  const messages: GmailMessageFull[] = (threadJson.messages ?? []).map((m) => {
    const ms = m.internalDate ? Number(m.internalDate) : NaN;
    const internalDate = Number.isFinite(ms) ? new Date(ms).toISOString() : undefined;

    const headersRaw = m.payload?.headers;
    const from = normalizeHeaderValue(headersRaw, 'From');
    const to = normalizeHeaderValue(headersRaw, 'To');
    const subject = normalizeHeaderValue(headersRaw, 'Subject');
    const date = normalizeHeaderValue(headersRaw, 'Date');

    const bodies = extractBodies(m.payload);

    return {
      id: m.id,
      threadId: m.threadId,
      snippet: m.snippet,
      internalDate,
      headers: {
        from: from || undefined,
        to: to || undefined,
        subject: subject || undefined,
        date: date || undefined,
      },
      bodyText: bodies.text || undefined,
      bodyHtml: bodies.html || undefined,
    };
  });

  return {
    id: threadJson.id ?? id,
    threadId: threadJson.id ?? id,
    snippet: threadJson.snippet,
    historyId: threadJson.historyId,
    messages,
  };
}
