export type SlackConcertAction = 'created' | 'updated' | 'deleted';

type SlackWebhookResponse = {
  ok: boolean;
  status: number;
  bodyText?: string;
};

function env(name: string): string {
  return String(process.env[name] ?? '').trim();
}

function formatStatusFr(statusRaw: string): string {
  const status = String(statusRaw ?? '').trim().toLowerCase();
  if (status === 'scheduled') return 'Prévu';
  if (status === 'completed') return 'Terminé';
  if (status === 'cancelled') return 'Annulé';
  return statusRaw;
}

function formatDateFr(iso: string): string | null {
  const s = String(iso ?? '').trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;

  const tz = env('SLACK_TIMEZONE') || 'Europe/Paris';
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: tz,
    }).format(d);
  } catch {
    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(d);
  }
}

function buildConcertUrl(concertId: string): string | null {
  const id = String(concertId ?? '').trim();
  if (!id) return null;

  // Requested default for local dev; can be overridden in prod.
  const base = env('SLACK_FRONTEND_BASE_URL') || 'http://localhost:5173';
  try {
    const u = new URL(base);
    u.pathname = `/concerts/${encodeURIComponent(id)}`;
    u.search = '';
    u.hash = '';
    return u.toString();
  } catch {
    return `http://localhost:5173/concerts/${encodeURIComponent(id)}`;
  }
}

function formatConcertLine(concert: {
  title?: string | null;
  venue_name?: string | null;
  city?: string | null;
  date_start?: string | null;
  status?: string | null;
}): string {
  const title = String(concert.title ?? '').trim();
  const venue = String(concert.venue_name ?? '').trim();
  const city = String(concert.city ?? '').trim();
  const dateStart = String(concert.date_start ?? '').trim();
  const status = String(concert.status ?? '').trim();

  const name = title || venue || 'Concert';
  const where = [city].filter(Boolean).join(', ');
  const when = dateStart ? ` — ${dateStart}` : '';
  const st = status ? ` — ${status}` : '';
  const extra = [where].filter(Boolean).join('');

  return `${name}${extra ? ` (${extra})` : ''}${when}${st}`;
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
  actorName?: string;
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

  const venue = String(params.concert.venue_name ?? '').trim();
  const city = String(params.concert.city ?? '').trim();
  const title = String(params.concert.title ?? '').trim() || venue || 'Concert';
  const statusFr = formatStatusFr(String(params.concert.status ?? '').trim());
  const dateFr = formatDateFr(String(params.concert.date_start ?? '').trim());

  const concertId = String(params.concert.id ?? '').trim();
  const url = buildConcertUrl(concertId);
  const slackLink = url ? `<${url}|Ouvrir dans Gigator>` : null;

  const details: string[] = [];
  if (venue) details.push(`*Lieu:* ${venue}`);
  if (city) details.push(`*Ville:* ${city}`);
  if (dateFr) details.push(`*Date:* ${dateFr}`);
  if (statusFr) details.push(`*Statut:* ${statusFr}`);
  const actorName = String(params.actorName ?? '').trim();
  if (actorName) details.push(`*Par:* ${actorName}`);

  const payload: Record<string, unknown> = {
    // Keep text for notifications + compatibility, even when using blocks.
    text: `${actionLabel}: ${title}${city ? ` (${city})` : ''}${dateFr ? ` — ${dateFr}` : ''}`,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: actionLabel },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${title}*`,
        },
      },
      {
        type: 'section',
        fields: details.map((t) => ({ type: 'mrkdwn', text: t })),
      },
      ...(url
        ? [
            {
              type: 'actions',
              elements: [
                {
                  type: 'button',
                  text: { type: 'plain_text', text: 'Ouvrir dans Gigator' },
                  url,
                },
              ],
            },
          ]
        : []),
    ],
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
