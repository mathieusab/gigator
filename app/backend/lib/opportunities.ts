// app/backend/lib/opportunities.ts
// DB helpers for opportunities - minimal MVP.

export type DbClient = {
  query: (sql: string, params?: any[]) => Promise<{ rows: any[] }>;
};

export const OPPORTUNITY_STATUSES = [
  'draft',
  'open',
  'negotiating',
  'booked',
  'cancelled',
  'declined',
  'archived'
] as const;

export type OpportunityStatus = (typeof OPPORTUNITY_STATUSES)[number];

export type Opportunity = {
  id: string;
  title: string;
  description: string | null;
  next_action: string | null;
  follow_up_due_date: string | null;
  status: OpportunityStatus;
  venue_id: string | null;
  created_at?: string;
  updated_at?: string;
};

type CreateOpportunityInput = {
  title: string;
  description?: string | null;
  venue_id?: string | null;
};

type ListOpportunitiesFilter = {
  venue_id?: string;
  follow_up?: 'due' | 'overdue';
  today?: string; // YYYY-MM-DD (UTC)
};

type UpdateOpportunityInput = {
  status?: OpportunityStatus;
  description?: string | null;
  title?: string;
  venue_id?: string | null;
  next_action?: string | null;
  follow_up_due_date?: string | null;
};

function normalizeRequiredText(value: unknown): string {
  return String(value || '').trim();
}

function normalizeOptionalText(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value === 'undefined') return null;
  const s = String(value).trim();
  return s ? s : null;
}

function normalizeOptionalIsoDate(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value === 'undefined') return null;

  const s = String(value).trim();
  if (!s) return null;

  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) throw new Error('invalid_request');

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) throw new Error('invalid_request');
  if (month < 1 || month > 12) throw new Error('invalid_request');
  if (day < 1 || day > 31) throw new Error('invalid_request');

  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    throw new Error('invalid_request');
  }

  return s;
}

function validateRequiredField(value: string) {
  if (!value) throw new Error('invalid_request');
  if (value.length > 200) throw new Error('invalid_request');
}

function validateOptionalField(value: string | null) {
  if (value === null) return;
  if (value.length > 2000) throw new Error('invalid_request');
}

function isOpportunityStatus(x: unknown): x is OpportunityStatus {
  return typeof x === 'string' && (OPPORTUNITY_STATUSES as readonly string[]).includes(x);
}

export async function createOpportunity(db: DbClient, input: CreateOpportunityInput): Promise<Opportunity> {
  const title = normalizeRequiredText(input?.title);
  const description = typeof input?.description === 'undefined' ? null : normalizeOptionalText(input?.description);

  const hasVenue = Object.prototype.hasOwnProperty.call(input || {}, 'venue_id');
  const venue_id = hasVenue ? (input as any).venue_id : undefined;

  validateRequiredField(title);
  validateOptionalField(description);

  let venueId: string | null = null;
  if (typeof venue_id !== 'undefined') {
    if (venue_id === null) {
      venueId = null;
    } else {
      venueId = normalizeRequiredText(venue_id);
      if (!venueId) throw new Error('invalid_request');
    }
  }

  const sql = `
    INSERT INTO opportunities (title, description, venue_id)
    VALUES ($1, $2, $3)
    RETURNING id, title, description, next_action, follow_up_due_date, venue_id, status, created_at, updated_at;
  `;

  const res = await db.query(sql, [title, description, venueId]);
  const row = res?.rows?.[0];
  if (!row) throw new Error('failed_to_create');
  return row as Opportunity;
}

export async function listOpportunities(db: DbClient, filter?: ListOpportunitiesFilter): Promise<Opportunity[]> {
  const venue_id = filter?.venue_id;
  const follow_up = filter?.follow_up;
  const today = filter?.today;

  const where: string[] = [];
  const params: any[] = [];

  if (typeof venue_id !== 'undefined') {
    const vid = normalizeRequiredText(venue_id);
    if (!vid) throw new Error('invalid_request');
    params.push(vid);
    where.push(`venue_id = $${params.length}`);
  }

  if (typeof follow_up !== 'undefined') {
    if (follow_up !== 'due' && follow_up !== 'overdue') throw new Error('invalid_request');
    const t = normalizeOptionalIsoDate(today);
    if (!t) throw new Error('invalid_request');
    params.push(t);
    if (follow_up === 'due') {
      where.push(`follow_up_due_date = $${params.length}`);
    } else {
      where.push(`follow_up_due_date < $${params.length}`);
    }
  }

  const hasFollowUpFilter = typeof follow_up !== 'undefined';
  const limit = hasFollowUpFilter ? 50 : 200;

  const sql = `
    SELECT id, title, description, next_action, follow_up_due_date, venue_id, status, created_at, updated_at
    FROM opportunities
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY ${hasFollowUpFilter ? 'follow_up_due_date ASC, updated_at DESC' : 'updated_at DESC'}, id ASC
    LIMIT ${limit};
  `;

  const res = await db.query(sql, params);
  return (res?.rows || []) as Opportunity[];
}

export async function getOpportunityById(db: DbClient, id: string): Promise<Opportunity | null> {
  const opportunityId = normalizeRequiredText(id);
  if (!opportunityId) throw new Error('invalid_request');

  const sql = `
    SELECT id, title, description, next_action, follow_up_due_date, venue_id, status, created_at, updated_at
    FROM opportunities
    WHERE id = $1
    LIMIT 1;
  `;

  const res = await db.query(sql, [opportunityId]);
  return (res?.rows?.[0] as Opportunity) || null;
}

export async function updateOpportunity(db: DbClient, id: string, patch: UpdateOpportunityInput): Promise<Opportunity | null> {
  const opportunityId = normalizeRequiredText(id);
  if (!opportunityId) throw new Error('invalid_request');

  const hasTitle = Object.prototype.hasOwnProperty.call(patch || {}, 'title');
  const hasDescription = Object.prototype.hasOwnProperty.call(patch || {}, 'description');
  const hasStatus = Object.prototype.hasOwnProperty.call(patch || {}, 'status');
  const hasVenue = Object.prototype.hasOwnProperty.call(patch || {}, 'venue_id');
  const hasNextAction = Object.prototype.hasOwnProperty.call(patch || {}, 'next_action');
  const hasFollowUpDueDate = Object.prototype.hasOwnProperty.call(patch || {}, 'follow_up_due_date');

  if (!hasTitle && !hasDescription && !hasStatus && !hasVenue && !hasNextAction && !hasFollowUpDueDate) {
    throw new Error('invalid_request');
  }

  const sets: string[] = [];
  const params: any[] = [];

  if (hasTitle) {
    const title = normalizeRequiredText((patch as any).title);
    validateRequiredField(title);
    params.push(title);
    sets.push(`title = $${params.length}`);
  }

  if (hasDescription) {
    const description = (patch as any).description === null ? null : normalizeOptionalText((patch as any).description);
    validateOptionalField(description);
    params.push(description);
    sets.push(`description = $${params.length}`);
  }

  if (hasStatus) {
    const status = (patch as any).status;
    if (!isOpportunityStatus(status)) {
      throw new Error('invalid_request');
    }
    params.push(status);
    sets.push(`status = $${params.length}`);
  }

  if (hasVenue) {
    const venue_id = (patch as any).venue_id;
    if (venue_id === null) {
      params.push(null);
      sets.push(`venue_id = $${params.length}`);
    } else {
      const vid = normalizeRequiredText(venue_id);
      if (!vid) throw new Error('invalid_request');
      params.push(vid);
      sets.push(`venue_id = $${params.length}`);
    }
  }

  if (hasNextAction) {
    const next_action = (patch as any).next_action === null ? null : normalizeOptionalText((patch as any).next_action);
    validateOptionalField(next_action);
    params.push(next_action);
    sets.push(`next_action = $${params.length}`);
  }

  if (hasFollowUpDueDate) {
    const follow_up_due_date = (patch as any).follow_up_due_date === null ? null : normalizeOptionalIsoDate((patch as any).follow_up_due_date);
    params.push(follow_up_due_date);
    sets.push(`follow_up_due_date = $${params.length}`);
  }

  params.push(opportunityId);

  const sql = `
    UPDATE opportunities
    SET ${sets.join(', ')}, updated_at = now()
    WHERE id = $${params.length}
    RETURNING id, title, description, next_action, follow_up_due_date, venue_id, status, created_at, updated_at;
  `;

  const res = await db.query(sql, params);
  return (res?.rows?.[0] as Opportunity) || null;
}
