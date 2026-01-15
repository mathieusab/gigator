export type GmailThreadSuggestion =
  | {
      kind: 'create_concert';
      confidence: number;
      rationale?: string;
      extracted: {
        title?: string;
        venue_name?: string;
        city?: string;
        date_start?: string;
        notes?: string;
      };
    }
  | {
      kind: 'reject';
      confidence: number;
      rationale?: string;
    };

export async function analyzeGmailThread(params: {
  appAccessToken: string;
  threadId: string;
}): Promise<GmailThreadSuggestion> {
  const threadId = params.threadId.trim();
  if (!threadId) throw new Error('Missing threadId');

  const res = await fetch(`/gmail/threads/${encodeURIComponent(threadId)}/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.appAccessToken}`,
    },
  });

  if (res.status === 401) {
    const body = (await res.json().catch(() => null)) as any;
    throw new Error(body?.error ?? 'Unauthorized');
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as any;
    throw new Error(body?.error ?? `Gmail analysis error (${res.status})`);
  }

  return (await res.json()) as GmailThreadSuggestion;
}
