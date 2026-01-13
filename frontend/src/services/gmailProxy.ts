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
    headers?: {
      from?: string;
      to?: string;
      subject?: string;
      date?: string;
    };
    bodyText?: string;
    bodyHtml?: string;
  }>;
};

export async function listGmailThreadsForEmail(params: {
  appAccessToken: string;
  email: string;
  maxThreads?: number;
}): Promise<GmailThread[]> {
  const email = params.email.trim();
  if (!email) throw new Error('Missing email');

  const maxThreads = typeof params.maxThreads === 'number' ? params.maxThreads : undefined;
  const qs = new URLSearchParams({ email });
  if (maxThreads && Number.isFinite(maxThreads)) {
    qs.set('maxThreads', String(Math.max(1, Math.min(200, Math.floor(maxThreads)))));
  }

  const res = await fetch(`/gmail/threads?${qs.toString()}`, {
    headers: {
      Authorization: `Bearer ${params.appAccessToken}`,
    },
  });

  if (res.status === 401) {
    const body = (await res.json().catch(() => null)) as any;
    throw new Error(body?.error ?? 'Unauthorized');
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as any;
    throw new Error(body?.error ?? `Gmail proxy error (${res.status})`);
  }

  return (await res.json()) as GmailThread[];
}

export async function getGmailThreadById(params: {
  appAccessToken: string;
  threadId: string;
}): Promise<GmailThread> {
  const threadId = params.threadId.trim();
  if (!threadId) throw new Error('Missing threadId');

  const res = await fetch(`/gmail/threads/${encodeURIComponent(threadId)}`, {
    headers: {
      Authorization: `Bearer ${params.appAccessToken}`,
    },
  });

  if (res.status === 401) {
    const body = (await res.json().catch(() => null)) as any;
    throw new Error(body?.error ?? 'Unauthorized');
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as any;
    throw new Error(body?.error ?? `Gmail proxy error (${res.status})`);
  }

  return (await res.json()) as GmailThread;
}

export async function startGmailOAuth(params: {
  appAccessToken: string;
  redirectTo: string;
}): Promise<{ url: string }> {
  const res = await fetch('/gmail/oauth/start', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.appAccessToken}`,
    },
    body: JSON.stringify({ redirectTo: params.redirectTo }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as any;
    throw new Error(body?.error ?? `Failed to start Gmail OAuth (${res.status})`);
  }

  const json = (await res.json()) as { url?: string };
  const url = String(json.url ?? '').trim();
  if (!url) throw new Error('Missing OAuth URL');
  return { url };
}
