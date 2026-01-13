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
): Promise<GmailThread[]> {
  const q = `from:${email} OR to:${email}`;
  const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/threads?q=${encodeURIComponent(q)}&maxResults=10`;

  const listJson = (await fetchJson(listUrl, config.accessToken)) as {
    threads?: Array<{ id?: string; threadId?: string }>;
  };

  const threadRefs = (listJson.threads ?? []).slice(0, 10);
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

    threads.push({
      id: threadJson.id ?? threadId,
      threadId: threadJson.id ?? threadId,
      snippet: threadJson.snippet,
      historyId: threadJson.historyId,
      messages: (threadJson.messages ?? []).slice(0, 5).map((m) => {
        const ms = m.internalDate ? Number(m.internalDate) : NaN;
        const internalDate = Number.isFinite(ms) ? new Date(ms).toISOString() : undefined;
        return {
          id: m.id,
          threadId: m.threadId,
          snippet: m.snippet,
          internalDate,
        };
      }),
    });
  }

  return threads;
}
