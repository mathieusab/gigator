// app/backend/lib/admin_members.ts
// DB helpers for admin member management (app allowlist).

export type DbClient = {
  query: (sql: string, params?: any[]) => Promise<{ rows: any[] }>;
};

export type AdminMember = {
  id: string;
  email: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

function normalizeEmail(email: string): string {
  return String(email || '').trim().toLowerCase();
}

export async function listMembers(db: DbClient): Promise<AdminMember[]> {
  const sql = `
    SELECT id, email, is_active, created_at, updated_at
    FROM app_email_allowlist
    ORDER BY lower(email) ASC;
  `;

  const res = await db.query(sql);
  return (res?.rows || []) as AdminMember[];
}

export async function upsertInvite(db: DbClient, email: string): Promise<AdminMember> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    throw new Error('invalid_email');
  }

  const sql = `
    INSERT INTO app_email_allowlist (email, is_active)
    VALUES ($1, true)
    ON CONFLICT (email)
    DO UPDATE SET is_active = true, updated_at = now()
    RETURNING id, email, is_active, created_at, updated_at;
  `;

  const res = await db.query(sql, [normalizedEmail]);
  const row = res?.rows?.[0];
  if (!row) {
    throw new Error('failed_to_upsert_invite');
  }
  return row as AdminMember;
}

export async function setMemberActive(db: DbClient, id: string, isActive: boolean): Promise<AdminMember | null> {
  const sql = `
    UPDATE app_email_allowlist
    SET is_active = $1, updated_at = now()
    WHERE id = $2
    RETURNING id, email, is_active, created_at, updated_at;
  `;

  const res = await db.query(sql, [!!isActive, id]);
  return (res?.rows?.[0] as AdminMember) || null;
}
