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

export type GmailMessageResult = GmailMessageFull & {
  id: string;
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

function stripQuotedLines(text: string): string {
  const s = String(text ?? '');
  if (!s) return '';

  const normalized = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');

  const historyMarkers: RegExp[] = [
    /^\s*-----\s*Original\s+Message\s*-----\s*$/i,
    /^\s*-{2,}\s*Forwarded\s+message\s*-{2,}\s*$/i,
    /^\s*Begin\s+forwarded\s+message\s*:\s*$/i,
    /^\s*On\s.+\s+wrote\s*:\s*$/i,
    /^\s*Le\s.+\s+a\s+\u00e9crit\s*:\s*$/i,
    /^\s*Le\s.+\s+a\s+ecrit\s*:\s*$/i,
  ];

  const signatureSeparators: RegExp[] = [
    /^\s*--\s*$/,
    /^\s*_{5,}\s*$/,
    /^\s*[-–—]{5,}\s*$/,
  ];

  let cutIndex = lines.length;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    const next = lines[i + 1] ?? '';
    const twoLine = `${line.trim()} ${next.trim()}`.trim();

    if (historyMarkers.some((re) => re.test(line) || (twoLine && re.test(twoLine)))) {
      cutIndex = i;
      break;
    }

    // Signature blocks often start with a separator near the end of the email.
    if (signatureSeparators.some((re) => re.test(line))) {
      const remaining = lines.length - i;
      if (remaining <= 30) {
        cutIndex = i;
        break;
      }
    }
  }

  const prefix = lines.slice(0, cutIndex);
  const kept = prefix.filter((line) => !line.trimStart().startsWith('>'));
  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
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

function mapApiMessageToFull(m: {
  id?: string;
  threadId?: string;
  snippet?: string;
  internalDate?: string;
  payload?: GmailApiMessagePart;
}): GmailMessageFull {
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
    bodyText: bodies.text ? stripQuotedLines(bodies.text) || undefined : undefined,
    bodyHtml: bodies.html || undefined,
  };
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

  const messages: GmailMessageFull[] = (threadJson.messages ?? []).map(mapApiMessageToFull);

  return {
    id: threadJson.id ?? id,
    threadId: threadJson.id ?? id,
    snippet: threadJson.snippet,
    historyId: threadJson.historyId,
    messages,
  };
}

export async function getMessageById(
  config: GmailProxyConfig,
  messageId: string,
): Promise<GmailMessageResult> {
  const id = String(messageId ?? '').trim();
  if (!id) throw new GmailProxyError(400, 'Missing messageId');

  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=full`;
  const json = (await fetchJson(url, config.accessToken)) as {
    id?: string;
    threadId?: string;
    snippet?: string;
    internalDate?: string;
    payload?: GmailApiMessagePart;
  };

  const mapped = mapApiMessageToFull(json);
  const returnedId = String(mapped.id ?? id).trim();
  return {
    ...mapped,
    id: returnedId,
  };
}
