// app/backend/lib/search.ts
// Minimal global search helpers.

export type DbClient = {
  query: (sql: string, params?: any[]) => Promise<{ rows: any[] }>;
};

function normalizeRequiredText(value: unknown): string {
  return String(value || '').trim();
}

export async function searchAll(db: DbClient, q: string): Promise<{
  contacts: any[];
  venues: any[];
  opportunities: any[];
}> {
  const raw = normalizeRequiredText(q);
  if (!raw) throw new Error('invalid_request');

  const needle = `%${raw.toLowerCase()}%`;

  const contactsSql = `
    SELECT id, name, email, phone, instagram, notes, created_at, updated_at
    FROM contacts
    WHERE lower(name) LIKE $1
    ORDER BY lower(name) ASC
    LIMIT 10;
  `;

  const venuesSql = `
    SELECT id, name, city, notes, created_at, updated_at
    FROM venues
    WHERE lower(name) LIKE $1
    ORDER BY lower(name) ASC
    LIMIT 10;
  `;

  const opportunitiesSql = `
    SELECT id, title, status, date, venue_id, owner_id, created_by, related_thread_id
    FROM opportunities
    WHERE lower(title) LIKE $1
    ORDER BY lower(title) ASC
    LIMIT 10;
  `;

  const [contactsRes, venuesRes, opportunitiesRes] = await Promise.all([
    db.query(contactsSql, [needle]),
    db.query(venuesSql, [needle]),
    db.query(opportunitiesSql, [needle])
  ]);

  return {
    contacts: contactsRes?.rows || [],
    venues: venuesRes?.rows || [],
    opportunities: opportunitiesRes?.rows || []
  };
}
