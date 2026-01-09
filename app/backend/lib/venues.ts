// app/backend/lib/venues.ts
// DB helpers for venues (rooms directory) - minimal MVP.

export type DbClient = {
  query: (sql: string, params?: any[]) => Promise<{ rows: any[] }>;
};

export type Venue = {
  id: string;
  name: string;
  city: string;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
};

type CreateVenueInput = {
  name: string;
  city: string;
  notes?: string | null;
};

type UpdateVenueInput = {
  name?: string;
  city?: string;
  notes?: string | null;
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

function validateRequiredField(name: string, value: string) {
  if (!value) throw new Error('invalid_request');
  if (value.length > 200) throw new Error('invalid_request');
}

function validateOptionalField(value: string | null) {
  if (value === null) return;
  if (value.length > 2000) throw new Error('invalid_request');
}

export async function createVenue(db: DbClient, input: CreateVenueInput): Promise<Venue> {
  const name = normalizeRequiredText(input?.name);
  const city = normalizeRequiredText(input?.city);
  const notes = typeof input?.notes === 'undefined' ? null : normalizeOptionalText(input?.notes);

  validateRequiredField('name', name);
  validateRequiredField('city', city);
  validateOptionalField(notes);

  const sql = `
    INSERT INTO venues (name, city, notes)
    VALUES ($1, $2, $3)
    RETURNING id, name, city, notes, created_at, updated_at;
  `;

  const res = await db.query(sql, [name, city, notes]);
  const row = res?.rows?.[0];
  if (!row) throw new Error('failed_to_create');
  return row as Venue;
}

export async function listVenues(db: DbClient): Promise<Venue[]> {
  const sql = `
    SELECT id, name, city, notes, created_at, updated_at
    FROM venues
    ORDER BY lower(name) ASC;
  `;

  const res = await db.query(sql);
  return (res?.rows || []) as Venue[];
}

export async function getVenueById(db: DbClient, id: string): Promise<Venue | null> {
  const venueId = normalizeRequiredText(id);
  if (!venueId) throw new Error('invalid_request');

  const sql = `
    SELECT id, name, city, notes, created_at, updated_at
    FROM venues
    WHERE id = $1
    LIMIT 1;
  `;

  const res = await db.query(sql, [venueId]);
  return (res?.rows?.[0] as Venue) || null;
}

export async function updateVenue(db: DbClient, id: string, patch: UpdateVenueInput): Promise<Venue | null> {
  const venueId = normalizeRequiredText(id);
  if (!venueId) throw new Error('invalid_request');

  const hasName = Object.prototype.hasOwnProperty.call(patch || {}, 'name');
  const hasCity = Object.prototype.hasOwnProperty.call(patch || {}, 'city');
  const hasNotes = Object.prototype.hasOwnProperty.call(patch || {}, 'notes');

  if (!hasName && !hasCity && !hasNotes) {
    throw new Error('invalid_request');
  }

  const sets: string[] = [];
  const params: any[] = [];

  if (hasName) {
    const name = normalizeRequiredText((patch as any).name);
    validateRequiredField('name', name);
    params.push(name);
    sets.push(`name = $${params.length}`);
  }

  if (hasCity) {
    const city = normalizeRequiredText((patch as any).city);
    validateRequiredField('city', city);
    params.push(city);
    sets.push(`city = $${params.length}`);
  }

  if (hasNotes) {
    const notes = (patch as any).notes === null ? null : normalizeOptionalText((patch as any).notes);
    validateOptionalField(notes);
    params.push(notes);
    sets.push(`notes = $${params.length}`);
  }

  params.push(venueId);

  const sql = `
    UPDATE venues
    SET ${sets.join(', ')}, updated_at = now()
    WHERE id = $${params.length}
    RETURNING id, name, city, notes, created_at, updated_at;
  `;

  const res = await db.query(sql, params);
  return (res?.rows?.[0] as Venue) || null;
}
