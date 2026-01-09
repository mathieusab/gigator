// app/backend/lib/activity_log.ts
// DB helpers for activity log (append-only) + non-email interactions.

export type DbClient = {
  query: (sql: string, params?: any[]) => Promise<{ rows: any[] }>;
};

export type ActivityActionType = 'non_email_interaction' | 'status_changed' | 'owner_changed' | 'gmail_action' | string;

export type ActivityLogEvent = {
  id: string;
  opportunity_id: string | null;
  actor_profile_id: string | null;
  action_type: ActivityActionType;
  occurred_at: string;
  metadata: Record<string, any>;
  created_at: string;
};

export type NonEmailInteractionChannel = 'call' | 'instagram' | 'in_person' | 'other';

function normalizeRequiredText(value: unknown): string {
  return String(value || '').trim();
}

function normalizeOptionalText(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value === 'undefined') return null;
  const s = String(value).trim();
  return s ? s : null;
}

function parseOptionalIsoDatetime(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value === 'undefined') return null;
  const s = String(value).trim();
  if (!s) return null;

  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) throw new Error('invalid_request');
  return d.toISOString();
}

function isChannel(x: unknown): x is NonEmailInteractionChannel {
  return x === 'call' || x === 'instagram' || x === 'in_person' || x === 'other';
}

export async function appendNonEmailInteraction(
  db: DbClient,
  input: {
    opportunity_id: string;
    actor_profile_id: string;
    channel: NonEmailInteractionChannel;
    occurred_at?: string;
    notes?: string | null;
  }
): Promise<ActivityLogEvent> {
  const opportunity_id = normalizeRequiredText(input?.opportunity_id);
  const actor_profile_id = normalizeRequiredText(input?.actor_profile_id);
  const channel = (input as any)?.channel;
  const occurredAt = parseOptionalIsoDatetime((input as any)?.occurred_at) || new Date().toISOString();
  const notes = typeof (input as any)?.notes === 'undefined' ? null : normalizeOptionalText((input as any)?.notes);

  if (!opportunity_id) throw new Error('invalid_request');
  if (!actor_profile_id) throw new Error('invalid_request');
  if (!isChannel(channel)) throw new Error('invalid_request');

  const metadata = { channel, notes };

  const sql = `
    INSERT INTO activity_log (opportunity_id, actor_profile_id, action_type, occurred_at, metadata)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, opportunity_id, actor_profile_id, action_type, occurred_at, metadata, created_at;
  `;

  const res = await db.query(sql, [opportunity_id, actor_profile_id, 'non_email_interaction', occurredAt, metadata]);
  const row = res?.rows?.[0];
  if (!row) throw new Error('failed_to_create');
  return row as ActivityLogEvent;
}

export async function listActivityForOpportunity(
  db: DbClient,
  opportunityId: string,
  input: { limit?: number } = {}
): Promise<ActivityLogEvent[]> {
  const id = normalizeRequiredText(opportunityId);
  if (!id) throw new Error('invalid_request');

  const rawLimit = (input as any)?.limit;
  const limit = Number.isFinite(rawLimit) ? Number(rawLimit) : 100;
  if (!Number.isFinite(limit) || limit <= 0 || limit > 200) throw new Error('invalid_request');

  const sql = `
    SELECT id, opportunity_id, actor_profile_id, action_type, occurred_at, metadata, created_at
    FROM activity_log
    WHERE opportunity_id = $1
    ORDER BY occurred_at DESC, id DESC
    LIMIT $2;
  `;

  const res = await db.query(sql, [id, limit]);
  return (res?.rows || []) as ActivityLogEvent[];
}
