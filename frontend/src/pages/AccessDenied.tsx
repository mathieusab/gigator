import { signOut } from '../lib/supabaseAuth';
import { useAuth } from '../lib/useAuth';

export default function AccessDenied() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const email = session?.user?.email ?? null;

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif', maxWidth: 640 }}>
      <h1>Access denied</h1>
      <p>Your account is not authorized to use this app.</p>

      <section style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>How to get access</h2>
        <p style={{ marginTop: 0 }}>
          An admin must add your Supabase user to the <code>app_users</code> table with{' '}
          <code>is_active=true</code>.
        </p>
        {userId ? (
          <div
            style={{
              padding: 12,
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              background: '#fafafa',
            }}
          >
            <div>
              <strong>Your user id</strong>: <code>{userId}</code>
            </div>
            {email ? (
              <div style={{ marginTop: 6 }}>
                <strong>Your email</strong>: <code>{email}</code>
              </div>
            ) : null}
            <div style={{ marginTop: 10 }}>
              <strong>SQL</strong> (run in Supabase SQL editor):
              <pre
                style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}
              >{`insert into app_users (id, email, is_active)
values ('${userId}', '${email ?? 'you@example.com'}', true);`}</pre>
            </div>
          </div>
        ) : null}
      </section>

      <button type="button" onClick={() => void signOut()}>
        Sign out
      </button>
    </main>
  );
}
