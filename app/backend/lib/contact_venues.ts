// app/backend/lib/contact_venues.ts
// DB helpers for contact ↔ venue links.

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

export type Contact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  instagram: string | null;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
};

function normalizeRequiredText(value: unknown): string {
  return String(value || '').trim();
}

export async function linkContactToVenue(db: DbClient, contactId: string, venueId: string): Promise<void> {
  const cId = normalizeRequiredText(contactId);
  const vId = normalizeRequiredText(venueId);
  if (!cId || !vId) throw new Error('invalid_request');

  const sql = `
    INSERT INTO contact_venues (contact_id, venue_id)
    VALUES ($1, $2)
    ON CONFLICT (contact_id, venue_id) DO NOTHING;
  `;

  await db.query(sql, [cId, vId]);
}

export async function unlinkContactFromVenue(db: DbClient, contactId: string, venueId: string): Promise<void> {
  const cId = normalizeRequiredText(contactId);
  const vId = normalizeRequiredText(venueId);
  if (!cId || !vId) throw new Error('invalid_request');

  const sql = `
    DELETE FROM contact_venues
    WHERE contact_id = $1 AND venue_id = $2;
  `;

  await db.query(sql, [cId, vId]);
}

export async function listVenuesForContact(db: DbClient, contactId: string): Promise<Venue[]> {
  const cId = normalizeRequiredText(contactId);
  if (!cId) throw new Error('invalid_request');

  const sql = `
    SELECT v.id, v.name, v.city, v.notes, v.created_at, v.updated_at
    FROM venues v
    JOIN contact_venues cv ON cv.venue_id = v.id
    WHERE cv.contact_id = $1
    ORDER BY lower(v.name) ASC;
  `;

  const res = await db.query(sql, [cId]);
  return (res?.rows || []) as Venue[];
}

export async function listContactsForVenue(db: DbClient, venueId: string): Promise<Contact[]> {
  const vId = normalizeRequiredText(venueId);
  if (!vId) throw new Error('invalid_request');

  const sql = `
    SELECT c.id, c.name, c.email, c.phone, c.instagram, c.notes, c.created_at, c.updated_at
    FROM contacts c
    JOIN contact_venues cv ON cv.contact_id = c.id
    WHERE cv.venue_id = $1
    ORDER BY lower(c.name) ASC;
  `;

  const res = await db.query(sql, [vId]);
  return (res?.rows || []) as Contact[];
}
