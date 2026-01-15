export type SlackConcertAction = 'created' | 'updated' | 'deleted';

type SlackWebhookResponse = {
  ok: boolean;
  status: number;
  bodyText?: string;
};

function env(name: string): string {
  return String(process.env[name] ?? '').trim();
}

function formatConcertLine(concert: {
  title?: string | null;
  venue_name?: string | null;
  city?: string | null;
  date_start?: string | null;
  status?: string | null;
  id?: string | null;
}): string {
  const title = String(concert.title ?? '').trim();
  const venue = String(concert.venue_name ?? '').trim();
  const city = String(concert.city ?? '').trim();
  const dateStart = String(concert.date_start ?? '').trim();
  const status = String(concert.status ?? '').trim();
  const id = String(concert.id ?? '').trim();

  const name = title || venue || 'Concert';
  const where = [city].filter(Boolean).join(', ');
  const when = dateStart ? ` — ${dateStart}` : '';
  const st = status ? ` — ${status}` : '';
  const extra = [where].filter(Boolean).join('');

  return `${name}${extra ? ` (${extra})` : ''}${when}${st}${id ? ` [${id}]` : ''}`;
}

export async function postSlackConcertUpdate(params: {
  action: SlackConcertAction;
  concert: {
    id?: string | null;
    title?: string | null;
    venue_name?: string | null;
    city?: string | null;
    date_start?: string | null;
    status?: string | null;
  };
  actorUserId?: string;
}): Promise<{ sent: boolean; skipped: boolean }> {
  const webhookUrl = env('SLACK_WEBHOOK_URL');
  if (!webhookUrl) return { sent: false, skipped: true };

  const channel = env('SLACK_CHANNEL');

  const actionLabel =
    params.action === 'created'
      ? 'Nouveau concert'
      : params.action === 'updated'
        ? 'Concert modifié'
        : 'Concert supprimé';

  const line = formatConcertLine(params.concert);
  const by = params.actorUserId ? ` (par ${params.actorUserId})` : '';

  const payload: Record<string, unknown> = {
    text: `${actionLabel}: ${line}${by}`,
  };

  // Incoming Webhooks may allow overriding the channel depending on Slack config.
  if (channel) payload.channel = channel;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  let resp: SlackWebhookResponse;
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const bodyText = await res.text().catch(() => '');
    resp = { ok: res.ok, status: res.status, bodyText };
  } finally {
    clearTimeout(timeout);
  }

  if (!resp.ok) {
    console.warn(`Slack webhook error (${resp.status}): ${resp.bodyText ?? ''}`);
    return { sent: false, skipped: false };
  }

  return { sent: true, skipped: false };
}
