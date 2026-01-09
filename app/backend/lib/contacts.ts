// app/backend/lib/contacts.ts
// DB helpers for contacts - minimal MVP.

export type DbClient = {
  query: (sql: string, params?: any[]) => Promise<{ rows: any[] }>;
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

type CreateContactInput = {
  name: string;
  email?: string | null;
  phone?: string | null;
  instagram?: string | null;
  notes?: string | null;
};

type ListContactsInput = {
  q?: string;
};

type UpdateContactInput = {
  name?: string;
  email?: string | null;
  phone?: string | null;
  instagram?: string | null;
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

function validateRequiredField(value: string) {
  if (!value) throw new Error('invalid_request');
  if (value.length > 200) throw new Error('invalid_request');
}

function validateOptionalField(value: string | null) {
  if (value === null) return;
  if (value.length > 2000) throw new Error('invalid_request');
}

export async function createContact(db: DbClient, input: CreateContactInput): Promise<Contact> {
  const name = normalizeRequiredText(input?.name);
  const email = typeof input?.email === 'undefined' ? null : normalizeOptionalText(input?.email);
  const phone = typeof input?.phone === 'undefined' ? null : normalizeOptionalText(input?.phone);
  const instagram = typeof input?.instagram === 'undefined' ? null : normalizeOptionalText(input?.instagram);
  const notes = typeof input?.notes === 'undefined' ? null : normalizeOptionalText(input?.notes);

  validateRequiredField(name);
  validateOptionalField(email);
  validateOptionalField(phone);
  validateOptionalField(instagram);
  validateOptionalField(notes);

  const sql = `
    INSERT INTO contacts (name, email, phone, instagram, notes)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, name, email, phone, instagram, notes, created_at, updated_at;
  `;

  const res = await db.query(sql, [name, email, phone, instagram, notes]);
  const row = res?.rows?.[0];
  if (!row) throw new Error('failed_to_create');
  return row as Contact;
}

export async function listContacts(db: DbClient, input: ListContactsInput = {}): Promise<Contact[]> {
  const q = normalizeOptionalText(input?.q);

  if (q) {
    const needle = `%${q.toLowerCase()}%`;
    const sql = `
      SELECT id, name, email, phone, instagram, notes, created_at, updated_at
      FROM contacts
      WHERE lower(name) LIKE $1
      ORDER BY lower(name) ASC;
    `;

    const res = await db.query(sql, [needle]);
    return (res?.rows || []) as Contact[];
  }

  const sql = `
    SELECT id, name, email, phone, instagram, notes, created_at, updated_at
    FROM contacts
    ORDER BY lower(name) ASC;
  `;

  const res = await db.query(sql);
  return (res?.rows || []) as Contact[];
}

export async function getContactById(db: DbClient, id: string): Promise<Contact | null> {
  const contactId = normalizeRequiredText(id);
  if (!contactId) throw new Error('invalid_request');

  const sql = `
    SELECT id, name, email, phone, instagram, notes, created_at, updated_at
    FROM contacts
    WHERE id = $1
    LIMIT 1;
  `;

  const res = await db.query(sql, [contactId]);
  return (res?.rows?.[0] as Contact) || null;
}

export async function updateContact(db: DbClient, id: string, patch: UpdateContactInput): Promise<Contact | null> {
  const contactId = normalizeRequiredText(id);
  if (!contactId) throw new Error('invalid_request');

  const hasName = Object.prototype.hasOwnProperty.call(patch || {}, 'name');
  const hasEmail = Object.prototype.hasOwnProperty.call(patch || {}, 'email');
  const hasPhone = Object.prototype.hasOwnProperty.call(patch || {}, 'phone');
  const hasInstagram = Object.prototype.hasOwnProperty.call(patch || {}, 'instagram');
  const hasNotes = Object.prototype.hasOwnProperty.call(patch || {}, 'notes');

  if (!hasName && !hasEmail && !hasPhone && !hasInstagram && !hasNotes) {
    throw new Error('invalid_request');
  }

  const sets: string[] = [];
  const params: any[] = [];

  if (hasName) {
    const name = normalizeRequiredText((patch as any).name);
    validateRequiredField(name);
    params.push(name);
    sets.push(`name = $${params.length}`);
  }

  if (hasEmail) {
    const email = (patch as any).email === null ? null : normalizeOptionalText((patch as any).email);
    validateOptionalField(email);
    params.push(email);
    sets.push(`email = $${params.length}`);
  }

  if (hasPhone) {
    const phone = (patch as any).phone === null ? null : normalizeOptionalText((patch as any).phone);
    validateOptionalField(phone);
    params.push(phone);
    sets.push(`phone = $${params.length}`);
  }

  if (hasInstagram) {
    const instagram = (patch as any).instagram === null ? null : normalizeOptionalText((patch as any).instagram);
    validateOptionalField(instagram);
    params.push(instagram);
    sets.push(`instagram = $${params.length}`);
  }

  if (hasNotes) {
    const notes = (patch as any).notes === null ? null : normalizeOptionalText((patch as any).notes);
    validateOptionalField(notes);
    params.push(notes);
    sets.push(`notes = $${params.length}`);
  }

  params.push(contactId);

  const sql = `
    UPDATE contacts
    SET ${sets.join(', ')}, updated_at = now()
    WHERE id = $${params.length}
    RETURNING id, name, email, phone, instagram, notes, created_at, updated_at;
  `;

  const res = await db.query(sql, params);
  return (res?.rows?.[0] as Contact) || null;
}
