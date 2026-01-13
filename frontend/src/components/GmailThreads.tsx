import { useEffect, useState } from 'react';
import { useAuth } from '../lib/useAuth';
import {
  getGmailMessageById,
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

export default function GmailThreads({
  email,
  mode = 'compact',
}: {
  email: string;
  mode?: 'compact' | 'full';
}) {
  const { session } = useAuth();
  const [threads, setThreads] = useState<GmailThread[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsConnect, setNeedsConnect] = useState(false);
  const [isFullMode, setIsFullMode] = useState(mode === 'full');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loadingMessage, setLoadingMessage] = useState<Record<string, boolean>>({});
  const [openMessageByThread, setOpenMessageByThread] = useState<Record<string, string | null>>(
    {},
  );

  useEffect(() => {
    setIsFullMode(mode === 'full');
  }, [mode]);

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
        const items = await listGmailThreadsForEmail({
          appAccessToken,
          email: trimmedEmail,
          maxThreads: isFullMode ? 200 : 20,
        });
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
  }, [email, session, isFullMode]);

  async function ensureMessageFullyLoaded(threadId: string, messageId: string) {
    const appAccessToken = (session as any)?.access_token as string | undefined;
    if (!appAccessToken) {
      setError('Session missing. Please sign in again.');
      return;
    }

    const key = `${threadId}:${messageId}`;
    if (loadingMessage[key]) return;

    const existingThread = threads.find((t) => t.id === threadId || t.threadId === threadId);
    const existingMessage = existingThread?.messages?.find((m) => m.id === messageId);
    const looksFull = Boolean(existingMessage?.bodyText || existingMessage?.bodyHtml);
    if (looksFull) return;

    setLoadingMessage((prev) => ({ ...prev, [key]: true }));
    try {
      const fullMessage = await getGmailMessageById({ appAccessToken, messageId });
      setThreads((prev) =>
        prev.map((t) => {
          const id = t.id ?? t.threadId;
          if (id !== threadId) return t;
          const messages = (t.messages ?? []).map((m) => (m.id === messageId ? { ...m, ...fullMessage } : m));
          return { ...t, messages };
        }),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load Gmail thread';
      setError(msg);
      setNeedsConnect(shouldPromptGmailConnect(msg));
    } finally {
      setLoadingMessage((prev) => ({ ...prev, [key]: false }));
    }
  }

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

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" onClick={() => setIsFullMode((v) => !v)} disabled={isLoading}>
          {isFullMode ? 'Mode compact' : 'Mode complet'}
        </button>
        <span style={{ fontSize: 12, color: '#6b7280' }}>
          {isFullMode ? 'Jusqu’à 200 threads' : 'Jusqu’à 20 threads'}
        </span>
      </div>

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
                      Messages
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const next = !Boolean(expanded[t.id]);
                        setExpanded((prev) => ({ ...prev, [t.id]: next }));
                      }}
                      style={{ marginBottom: 6 }}
                    >
                      {expanded[t.id] ? 'Masquer' : 'Afficher'}
                    </button>

                    <ul style={{ margin: 0, paddingLeft: 16 }}>
                      {(expanded[t.id] ? t.messages : t.messages.slice(0, 3)).map((m) => (
                        <li
                          key={m.id ?? `${t.id}:${m.internalDate ?? ''}`}
                          style={{ fontSize: 13, marginBottom: 4 }}
                        >
                          {m.internalDate ? (
                            <span style={{ color: '#6b7280' }}>
                              {formatDate(m.internalDate)} —{' '}
                            </span>
                          ) : null}
                          <span style={{ fontWeight: 600 }}>
                            {m.headers?.subject ? m.headers.subject : m.snippet ?? ''}
                          </span>

                          {expanded[t.id] && m.id ? (
                            <button
                              type="button"
                              onClick={() => {
                                const nextId = openMessageByThread[t.id] === m.id ? null : m.id;
                                setOpenMessageByThread((prev) => ({ ...prev, [t.id]: nextId }));
                                if (nextId) void ensureMessageFullyLoaded(t.id, m.id);
                              }}
                              style={{ marginLeft: 8 }}
                            >
                              {openMessageByThread[t.id] === m.id ? 'Masquer le message' : 'Ouvrir'}
                            </button>
                          ) : null}

                          {expanded[t.id] && openMessageByThread[t.id] === (m.id ?? null) ? (
                            <div style={{ marginTop: 6 }}>
                              {m.headers?.from ? (
                                <div style={{ fontSize: 12, color: '#6b7280' }}>{m.headers.from}</div>
                              ) : null}

                              {m.bodyText ? (
                                <pre
                                  style={{
                                    margin: '6px 0 0',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word',
                                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                                    fontSize: 12,
                                    background: '#f9fafb',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: 6,
                                    padding: 8,
                                  }}
                                >
                                  {m.bodyText}
                                </pre>
                              ) : m.bodyHtml ? (
                                <iframe
                                  title={`gmail-html-${m.id ?? ''}`}
                                  sandbox=""
                                  srcDoc={m.bodyHtml}
                                  style={{
                                    marginTop: 6,
                                    width: '100%',
                                    minHeight: 120,
                                    border: '1px solid #e5e7eb',
                                    borderRadius: 6,
                                    background: 'white',
                                  }}
                                />
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => (m.id ? void ensureMessageFullyLoaded(t.id, m.id) : undefined)}
                                  disabled={Boolean(m.id) ? Boolean(loadingMessage[`${t.id}:${m.id}`]) : true}
                                  style={{ marginTop: 6 }}
                                >
                                  Charger le message complet
                                </button>
                              )}
                            </div>
                          ) : null}
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
