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
};

type UpdateOpportunityInput = {
  status?: OpportunityStatus;
  description?: string | null;
  title?: string;
  venue_id?: string | null;
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
    RETURNING id, title, description, venue_id, status, created_at, updated_at;
  `;

  const res = await db.query(sql, [title, description, venueId]);
  const row = res?.rows?.[0];
  if (!row) throw new Error('failed_to_create');
  return row as Opportunity;
}

export async function listOpportunities(db: DbClient, filter?: ListOpportunitiesFilter): Promise<Opportunity[]> {
  const venue_id = filter?.venue_id;

  const where: string[] = [];
  const params: any[] = [];

  if (typeof venue_id !== 'undefined') {
    const vid = normalizeRequiredText(venue_id);
    if (!vid) throw new Error('invalid_request');
    params.push(vid);
    where.push(`venue_id = $${params.length}`);
  }

  const sql = `
    SELECT id, title, description, venue_id, status, created_at, updated_at
    FROM opportunities
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY updated_at DESC, id ASC;
  `;

  const res = await db.query(sql, params);
  return (res?.rows || []) as Opportunity[];
}

export async function getOpportunityById(db: DbClient, id: string): Promise<Opportunity | null> {
  const opportunityId = normalizeRequiredText(id);
  if (!opportunityId) throw new Error('invalid_request');

  const sql = `
    SELECT id, title, description, venue_id, status, created_at, updated_at
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

  if (!hasTitle && !hasDescription && !hasStatus && !hasVenue) {
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

  params.push(opportunityId);

  const sql = `
    UPDATE opportunities
    SET ${sets.join(', ')}, updated_at = now()
    WHERE id = $${params.length}
    RETURNING id, title, description, venue_id, status, created_at, updated_at;
  `;

  const res = await db.query(sql, params);
  return (res?.rows?.[0] as Opportunity) || null;
}
