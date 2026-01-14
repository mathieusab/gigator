import { useEffect, useState } from 'react';
import { useAuth } from '../lib/useAuth';
import {
  getGmailMessageById,
  getGmailThreadById,
  listGmailThreadsForEmail,
  startGmailOAuth,
  type GmailThread,
} from '../services/gmailProxy';

function IconChevronDown({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconChevronRight({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M9 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function formatOneLine(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function parseFromHeader(value?: string) {
  const raw = formatOneLine(String(value ?? '').trim());
  if (!raw) return { raw: '', name: '', email: '', display: '' };

  // Common formats:
  // - Name <email@domain>
  // - "Name" <email@domain>
  // - email@domain
  // - Name (no brackets)
  const angle = raw.match(/^\s*(.*?)\s*<\s*([^>]+)\s*>\s*$/);
  if (angle) {
    const name = formatOneLine(angle[1] ?? '').replace(/^"|"$/g, '').trim();
    const email = formatOneLine(angle[2] ?? '').trim();
    const display = name || email;
    return { raw, name, email, display };
  }

  const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw);
  if (looksLikeEmail) {
    return { raw, name: '', email: raw, display: raw };
  }

  return { raw, name: raw, email: '', display: raw };
}

function getThreadLatestMessage(t: GmailThread) {
  const messages = t.messages ?? [];
  if (messages.length === 0) return null;

  const withDate = messages
    .map((m) => ({ m, ms: m.internalDate ? new Date(m.internalDate).getTime() : Number.NaN }))
    .filter((x) => Number.isFinite(x.ms));

  if (withDate.length === 0) return messages[0] ?? null;
  withDate.sort((a, b) => b.ms - a.ms);
  return withDate[0]?.m ?? null;
}

function getMessageMs(internalDate?: string) {
  if (!internalDate) return Number.NaN;
  const ms = new Date(internalDate).getTime();
  return Number.isFinite(ms) ? ms : Number.NaN;
}

function sortMessagesAntichrono<T extends { internalDate?: string }>(messages: T[]) {
  const withIndex = messages.map((m, idx) => ({ m, idx, ms: getMessageMs(m.internalDate) }));
  withIndex.sort((a, b) => {
    const aHas = Number.isFinite(a.ms);
    const bHas = Number.isFinite(b.ms);
    if (aHas && bHas) return b.ms - a.ms;
    if (aHas && !bHas) return -1;
    if (!aHas && bHas) return 1;
    return a.idx - b.idx;
  });
  return withIndex.map((x) => x.m);
}

function getThreadTitle(t: GmailThread) {
  const latest = getThreadLatestMessage(t);
  const subject = formatOneLine(String(latest?.headers?.subject ?? '').trim());
  if (subject) return subject;
  const snippet = formatOneLine(String(t.snippet ?? '').trim());
  return snippet || 'Conversation';
}

function getThreadSubtitle(t: GmailThread) {
  const latest = getThreadLatestMessage(t);
  const from = formatOneLine(String(latest?.headers?.from ?? '').trim());
  const snippet = formatOneLine(String(t.snippet ?? '').trim());
  if (from && snippet) return `${from} — ${snippet}`;
  return from || snippet;
}

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
  const [showAllMessages, setShowAllMessages] = useState<Record<string, boolean>>({});
  const [loadingThread, setLoadingThread] = useState<Record<string, boolean>>({});
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

  const trimmedEmail = email.trim();
  const maxThreads = isFullMode ? 200 : 20;

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

  function mergeThreadsKeepingBodies(prevThread: GmailThread, nextThread: GmailThread): GmailThread {
    const prevMessages = prevThread.messages ?? [];
    const nextMessages = nextThread.messages ?? [];

    const byId = new Map<string, (typeof prevMessages)[number]>();
    for (const m of prevMessages) {
      const id = String(m.id ?? '').trim();
      if (id) byId.set(id, m);
    }

    const mergedMessages = nextMessages.map((m) => {
      const id = String(m.id ?? '').trim();
      const prev = id ? byId.get(id) : undefined;
      if (!prev) return m;
      return {
        ...m,
        bodyText: prev.bodyText ?? m.bodyText,
        bodyHtml: prev.bodyHtml ?? m.bodyHtml,
      };
    });

    return { ...prevThread, ...nextThread, messages: mergedMessages };
  }

  async function ensureThreadHeadersLoaded(threadId: string) {
    const appAccessToken = (session as any)?.access_token as string | undefined;
    if (!appAccessToken) {
      setError('Session missing. Please sign in again.');
      return;
    }

    const key = threadId;
    if (loadingThread[key]) return;

    const existingThread = threads.find((t) => t.id === threadId || t.threadId === threadId);
    const hasHeaders = Boolean(
      existingThread?.messages?.some((m) => Boolean(m.headers?.from || m.headers?.subject || m.headers?.date)),
    );
    if (hasHeaders) return;

    setLoadingThread((prev) => ({ ...prev, [key]: true }));
    try {
      const fullThread = await getGmailThreadById({ appAccessToken, threadId });
      setThreads((prev) =>
        prev.map((t) => {
          const id = t.id ?? t.threadId;
          if (id !== threadId) return t;
          return mergeThreadsKeepingBodies(t, fullThread);
        }),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load Gmail thread';
      setError(msg);
      setNeedsConnect(shouldPromptGmailConnect(msg));
    } finally {
      setLoadingThread((prev) => ({ ...prev, [key]: false }));
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
    <section
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 10,
        background: 'white',
        overflow: 'hidden',
        marginTop: 16,
      }}
    >
      <header
        style={{
          padding: '12px 12px 10px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          background: '#f9fafb',
        }}
      >
        <div style={{ minWidth: 240, flex: '1 1 320px' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Gmail</h2>
          <div style={{ marginTop: 2, color: '#6b7280', fontSize: 13, overflowWrap: 'anywhere' }}>
            {trimmedEmail || 'No contact email set.'}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div
            role="group"
            aria-label="Mode d’affichage"
            style={{
              display: 'inline-flex',
              border: '1px solid #e5e7eb',
              borderRadius: 9999,
              background: '#f3f4f6',
              padding: 2,
            }}
          >
            <button
              type="button"
              onClick={() => setIsFullMode(false)}
              disabled={isLoading}
              aria-pressed={!isFullMode}
              style={{
                border: 0,
                background: !isFullMode ? 'white' : 'transparent',
                borderRadius: 9999,
                padding: '6px 10px',
                fontSize: 13,
                fontWeight: 700,
                color: !isFullMode ? '#111827' : '#4b5563',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                boxShadow: !isFullMode ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              Compact
            </button>
            <button
              type="button"
              onClick={() => setIsFullMode(true)}
              disabled={isLoading}
              aria-pressed={isFullMode}
              style={{
                border: 0,
                background: isFullMode ? 'white' : 'transparent',
                borderRadius: 9999,
                padding: '6px 10px',
                fontSize: 13,
                fontWeight: 700,
                color: isFullMode ? '#111827' : '#4b5563',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                boxShadow: isFullMode ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              Complet
            </button>
          </div>

          <div style={{ fontSize: 12, color: '#6b7280' }}>Jusqu’à {maxThreads} threads</div>
        </div>
      </header>

      <div style={{ padding: 12 }}>
        {isLoading ? <div style={{ color: '#4b5563' }}>Chargement…</div> : null}

        {error ? (
          <div
            style={{
              border: '1px solid #fecaca',
              background: '#fef2f2',
              color: '#991b1b',
              borderRadius: 10,
              padding: 10,
              marginBottom: 10,
            }}
          >
            <div role="alert" style={{ fontWeight: 700 }}>
              {error}
            </div>
            {needsConnect ? (
              <button
                type="button"
                onClick={() => void handleConnect()}
                style={{
                  marginTop: 8,
                  border: '1px solid #e5e7eb',
                  background: 'white',
                  borderRadius: 8,
                  padding: '8px 10px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Connecter Gmail
              </button>
            ) : null}
          </div>
        ) : null}

        {!isLoading && !error ? (
          safeThreads.length === 0 ? (
            <div style={{ color: '#4b5563' }}>Aucun résultat.</div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
              {[...safeThreads]
                .map((t, idx) => ({ t, idx, ms: getMessageMs(getThreadLatestMessage(t)?.internalDate) }))
                .sort((a, b) => {
                  const aHas = Number.isFinite(a.ms);
                  const bHas = Number.isFinite(b.ms);
                  if (aHas && bHas) return b.ms - a.ms;
                  if (aHas && !bHas) return -1;
                  if (!aHas && bHas) return 1;
                  return a.idx - b.idx;
                })
                .map(({ t }, idx) => {
                const threadId = String(t.id ?? t.threadId ?? `thread-${idx}`);
                const isExpanded = Boolean(expanded[threadId]);
                const latest = getThreadLatestMessage(t);
                const dateLabel = latest?.internalDate ? formatDate(latest.internalDate) : '';
                const title = getThreadTitle(t);
                const subtitle = getThreadSubtitle(t);
                const messageCount = t.messages?.length ?? 0;
                const sortedMessages = sortMessagesAntichrono(t.messages ?? []);
                const isThreadLoading = Boolean(loadingThread[threadId]);

                return (
                  <li key={threadId} style={{ borderTop: idx === 0 ? 'none' : '1px solid #e5e7eb' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const next = !isExpanded;

                        setExpanded((prev) => {
                          if (!isFullMode) return { [threadId]: next };
                          return { ...prev, [threadId]: next };
                        });

                        if (!next) {
                          setOpenMessageByThread((prev) => ({ ...prev, [threadId]: null }));
                        } else {
                          void ensureThreadHeadersLoaded(threadId);
                        }
                      }}
                      aria-expanded={isExpanded}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 12px',
                        border: 0,
                        background: isExpanded ? '#f9fafb' : 'white',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ color: '#6b7280', display: 'inline-flex', alignItems: 'center' }}>
                        {isExpanded ? <IconChevronDown /> : <IconChevronRight />}
                      </span>
                      <div style={{ minWidth: 0, flex: '1 1 auto' }}>
                        <div
                          style={{
                            fontWeight: 800,
                            color: '#111827',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={title}
                        >
                          {title}
                        </div>
                        {subtitle ? (
                          <div
                            style={{
                              marginTop: 2,
                              fontSize: 13,
                              color: '#6b7280',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                            title={subtitle}
                          >
                            {subtitle}
                          </div>
                        ) : null}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '0 0 auto' }}>
                        {isThreadLoading ? <span style={{ fontSize: 12, color: '#6b7280' }}>Chargement…</span> : null}
                        {dateLabel ? <span style={{ fontSize: 12, color: '#6b7280' }}>{dateLabel}</span> : null}
                        {messageCount > 0 ? (
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 800,
                              color: '#374151',
                              background: '#f3f4f6',
                              border: '1px solid #e5e7eb',
                              borderRadius: 9999,
                              padding: '2px 8px',
                            }}
                            aria-label={`${messageCount} messages`}
                          >
                            {messageCount}
                          </span>
                        ) : null}
                      </div>
                    </button>

                    {isExpanded ? (
                      <div style={{ padding: '10px 12px', background: 'white' }}>
                        {messageCount > 0 ? (
                          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                            <div style={{ fontSize: 12, fontWeight: 800, color: '#6b7280' }}>Messages</div>

                            {messageCount > 3 ? (
                              <button
                                type="button"
                                onClick={() => setShowAllMessages((prev) => ({ ...prev, [threadId]: !Boolean(prev[threadId]) }))}
                                style={{
                                  border: 0,
                                  padding: 0,
                                  background: 'transparent',
                                  color: '#2563eb',
                                  fontSize: 12,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                {showAllMessages[threadId] ? 'Afficher moins' : `Afficher tout (${messageCount})`}
                              </button>
                            ) : null}
                          </div>
                        ) : null}

                        {sortedMessages.length ? (
                          <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0', display: 'grid', gap: 8 }}>
                            {(showAllMessages[threadId] ? sortedMessages : sortedMessages.slice(0, 3)).map((m, mIdx) => {
                              const messageKey = m.id ?? `${threadId}:${m.internalDate ?? ''}:${mIdx}`;
                              const isOpen = openMessageByThread[threadId] === (m.id ?? null);
                              const from = parseFromHeader(m.headers?.from);
                              const senderLabel = from.display || 'Expéditeur inconnu';
                              const subject = formatOneLine(String(m.headers?.subject ?? '').trim());
                              const preview = formatOneLine(String(m.snippet ?? '').trim());
                              const subjectLine = subject || '(sans objet)';
                              const secondaryLine = preview ? `${subjectLine} — ${preview}` : subjectLine;
                              const date = m.internalDate ? formatDate(m.internalDate) : '';
                              const canOpen = Boolean(m.id);
                              const loadingKey = canOpen ? `${threadId}:${m.id}` : '';

                              return (
                                <li key={messageKey}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!m.id) return;
                                      const nextId = openMessageByThread[threadId] === m.id ? null : m.id;
                                      setOpenMessageByThread((prev) => ({ ...prev, [threadId]: nextId }));
                                      if (nextId) void ensureMessageFullyLoaded(threadId, m.id);
                                    }}
                                    disabled={!canOpen}
                                    aria-expanded={isOpen}
                                    style={{
                                      width: '100%',
                                      textAlign: 'left',
                                      display: 'flex',
                                      gap: 10,
                                      alignItems: 'center',
                                      padding: '8px 10px',
                                      borderRadius: 10,
                                      border: '1px solid #e5e7eb',
                                      background: isOpen ? '#f9fafb' : 'white',
                                      cursor: canOpen ? 'pointer' : 'not-allowed',
                                    }}
                                    title={canOpen ? 'Ouvrir le message' : 'Message non disponible'}
                                  >
                                    <span style={{ color: '#6b7280', display: 'inline-flex', alignItems: 'center' }}>
                                      {isOpen ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                                    </span>
                                    <div style={{ minWidth: 0, flex: '1 1 auto' }}>
                                      <div
                                        style={{
                                          display: 'flex',
                                          alignItems: 'baseline',
                                          justifyContent: 'space-between',
                                          gap: 10,
                                        }}
                                      >
                                        <div
                                          style={{
                                            fontSize: 13,
                                            fontWeight: 800,
                                            color: '#111827',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                          }}
                                          title={from.raw || senderLabel}
                                        >
                                          {senderLabel}
                                        </div>
                                        {date ? <div style={{ fontSize: 12, color: '#6b7280' }}>{date}</div> : null}
                                      </div>
                                      {secondaryLine ? (
                                        <div
                                          style={{
                                            marginTop: 2,
                                            fontSize: 13,
                                            color: '#4b5563',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                          }}
                                          title={secondaryLine}
                                        >
                                          {secondaryLine}
                                        </div>
                                      ) : null}
                                    </div>
                                    {canOpen && Boolean(loadingMessage[loadingKey]) ? (
                                      <span style={{ fontSize: 12, color: '#6b7280' }}>…</span>
                                    ) : null}
                                  </button>

                                  {isOpen ? (
                                    <div style={{ marginTop: 8, paddingLeft: 8 }}>
                                      {m.headers?.from ? (
                                        <div style={{ fontSize: 12, color: '#6b7280' }}>{m.headers.from}</div>
                                      ) : null}

                                      {m.bodyText ? (
                                        <pre
                                          style={{
                                            margin: '6px 0 0',
                                            whiteSpace: 'pre-wrap',
                                            wordBreak: 'break-word',
                                            fontFamily:
                                              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                                            fontSize: 12,
                                            background: '#f9fafb',
                                            border: '1px solid #e5e7eb',
                                            borderRadius: 10,
                                            padding: 10,
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
                                            minHeight: 140,
                                            border: '1px solid #e5e7eb',
                                            borderRadius: 10,
                                            background: 'white',
                                          }}
                                        />
                                      ) : m.id ? (
                                        <button
                                          type="button"
                                          onClick={() => void ensureMessageFullyLoaded(threadId, m.id!)}
                                          disabled={Boolean(loadingMessage[`${threadId}:${m.id}`])}
                                          style={{
                                            marginTop: 6,
                                            border: '1px solid #e5e7eb',
                                            background: 'white',
                                            borderRadius: 8,
                                            padding: '8px 10px',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                          }}
                                        >
                                          Charger le message complet
                                        </button>
                                      ) : null}
                                    </div>
                                  ) : null}
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <div style={{ marginTop: 8, color: '#6b7280', fontSize: 13 }}>Aucun message.</div>
                        )}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )
        ) : null}

        {!error && needsConnect && !isLoading ? (
          <button
            type="button"
            onClick={() => void handleConnect()}
            style={{
              marginTop: 10,
              border: '1px solid #e5e7eb',
              background: 'white',
              borderRadius: 8,
              padding: '8px 10px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Connecter Gmail
          </button>
        ) : null}
      </div>
    </section>
  );
}
