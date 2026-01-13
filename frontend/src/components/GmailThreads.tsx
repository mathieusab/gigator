import { useEffect, useState } from 'react';
import { useAuth } from '../lib/useAuth';
import {
  listGmailThreadsForEmail,
  startGmailOAuth,
  type GmailThread,
} from '../services/gmailProxy';

function formatDate(value?: string) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(d);
}

export default function GmailThreads({ email }: { email: string }) {
  const { session } = useAuth();
  const [threads, setThreads] = useState<GmailThread[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsConnect, setNeedsConnect] = useState(false);

  function shouldPromptGmailConnect(message: string) {
    const m = message.toLowerCase();
    return (
      m.includes('not connected') ||
      m.includes('reconnect gmail') ||
      m.includes('re-authenticate') ||
      m.includes('unauthorized')
    );
  }

  const safeThreads = Array.isArray(threads) ? threads : [];

  useEffect(() => {
    let isMounted = true;

    const appAccessToken = (session as any)?.access_token as string | undefined;
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setThreads([]);
      setError(null);
      setIsLoading(false);
      setNeedsConnect(false);
      return;
    }

    if (!appAccessToken) {
      setThreads([]);
      setError('Session missing. Please sign in again.');
      setIsLoading(false);
      setNeedsConnect(false);
      return;
    }

    void (async () => {
      setIsLoading(true);
      setError(null);
      setNeedsConnect(false);
      try {
        const items = await listGmailThreadsForEmail({ appAccessToken, email: trimmedEmail });
        if (!isMounted) return;
        setThreads(Array.isArray(items) ? items : []);
      } catch (e) {
        if (!isMounted) return;
        const msg = e instanceof Error ? e.message : 'Failed to load Gmail threads';
        setError(msg);
        setNeedsConnect(shouldPromptGmailConnect(msg));
        setThreads([]);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [email, session]);

  async function handleConnect() {
    const appAccessToken = (session as any)?.access_token as string | undefined;
    if (!appAccessToken) {
      setError('Session missing. Please sign in again.');
      return;
    }

    try {
      const redirectTo = `${window.location.pathname}${window.location.search}`;
      const { url } = await startGmailOAuth({ appAccessToken, redirectTo });
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start Gmail connect');
    }
  }

  return (
    <section style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, marginTop: 16 }}>
      <h2 style={{ margin: 0, marginBottom: 8, fontSize: 16 }}>Gmail — Conversations</h2>
      <p style={{ marginTop: 0, color: '#4b5563' }}>{email.trim() || 'No contact email set.'}</p>

      {isLoading ? <p>Chargement…</p> : null}
      {error ? (
        <p role="alert" style={{ color: 'crimson' }}>
          {error}
        </p>
      ) : null}

      {needsConnect ? (
        <button type="button" onClick={() => void handleConnect()}>
          Connecter Gmail
        </button>
      ) : null}

      {!isLoading && !error ? (
        safeThreads.length === 0 ? (
          <p>Aucun résultat.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
            {safeThreads.map((t) => (
              <li key={t.id} style={{ padding: 10, border: '1px solid #e5e7eb', borderRadius: 8 }}>
                <div style={{ fontWeight: 600 }}>Thread {t.id}</div>
                {t.snippet ? <div style={{ color: '#4b5563' }}>{t.snippet}</div> : null}

                {t.messages?.length ? (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                      Messages (latest)
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 16 }}>
                      {t.messages.slice(0, 3).map((m) => (
                        <li
                          key={m.id ?? `${t.id}:${m.internalDate ?? ''}`}
                          style={{ fontSize: 13, marginBottom: 4 }}
                        >
                          {m.internalDate ? (
                            <span style={{ color: '#6b7280' }}>
                              {formatDate(m.internalDate)} —{' '}
                            </span>
                          ) : null}
                          {m.snippet ?? ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )
      ) : null}
    </section>
  );
}
