// app/backend/lib/allowlist.ts
// Allowlist/whitelist helpers for app authentication.

export type DbClient = {
  query: (sql: string, params?: any[]) => Promise<{ rows: any[] }>;
};

export function isEmailAllowedByEnv(email: string): boolean | null {
  const raw = process.env.APP_EMAIL_ALLOWLIST;
  if (!raw) return null;

  const allowed = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  return allowed.includes(String(email || '').trim().toLowerCase());
}

export async function isEmailAllowed(db: DbClient, email: string): Promise<boolean> {
  const normalizedEmail = String(email || '').trim();
  const normalizedEmailLower = normalizedEmail.toLowerCase();

  const sql = `
    SELECT is_active
    FROM app_email_allowlist
    WHERE lower(email) = lower($1)
    LIMIT 1;
  `;

  const res = await db.query(sql, [normalizedEmailLower]);
  const row = res?.rows?.[0];
  return row?.is_active === true;
}
