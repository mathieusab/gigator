import { signOut } from '../lib/supabaseAuth';
import { useAuth } from '../lib/useAuth';
import { LogOut } from 'lucide-react';

export default function AccessDenied() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const email = session?.user?.email ?? null;

  return (
    <main className="container" style={{ maxWidth: 760 }}>
      <div className="card card-pad">
        <h1 className="h1">Access denied</h1>
        <p className="p-muted" style={{ marginTop: 8 }}>
          Your account is not authorized to use this app.
        </p>

        <section style={{ marginTop: 16 }}>
          <h2 className="h2" style={{ marginBottom: 8 }}>
            How to get access
          </h2>
          <p style={{ marginTop: 0 }}>
          An admin must add your Supabase user to the <code>app_users</code> table with{' '}
          <code>is_active=true</code>.
          </p>
          {userId ? (
            <div className="card" style={{ padding: 12, boxShadow: 'none', background: '#fff' }}>
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

        <div style={{ marginTop: 16 }}>
          <button type="button" className="btn" onClick={() => void signOut()}>
            <LogOut size={16} aria-hidden="true" />
            Sign out
          </button>
        </div>
      </div>
    </main>
  );
}
