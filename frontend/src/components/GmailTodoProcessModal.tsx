import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from './Modal';
import { getGmailThreadById, type GmailThread } from '../services/gmailProxy';
import { analyzeGmailThread, type GmailThreadSuggestion } from '../services/gmailThreadAnalysis';

function safeString(v: unknown) {
  return String(v ?? '').trim();
}

function formatIsoDate(iso: string | undefined) {
  const s = safeString(iso);
  if (!s) return '';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function extractEmailAddress(headerValue: string | undefined) {
  const raw = safeString(headerValue);
  if (!raw) return '';
  const m = raw.match(/<([^>]+)>/);
  if (m?.[1]) return m[1].trim();
  if (raw.includes('@')) return raw.split(/[\s,;]/)[0].trim();
  return '';
}

function messageBodyToDisplay(m: NonNullable<GmailThread['messages']>[number]) {
  const text = safeString(m.bodyText);
  if (text) return text;
  const html = safeString(m.bodyHtml);
  if (html) {
    // Very small / safe-ish conversion: strip tags for display.
    return html
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }
  return safeString(m.snippet);
}

export type GmailTodoProcessModalTodo = {
  todoId?: string;
  threadId: string;
  counterpartEmail: string;
  subject: string;
  snippet: string;
};

export default function GmailTodoProcessModal({
  open,
  onClose,
  todo,
  appAccessToken,
  onMarkStatus,
}: {
  open: boolean;
  onClose: () => void;
  todo: GmailTodoProcessModalTodo | null;
  appAccessToken: string | undefined;
  onMarkStatus: (todoId: string, status: 'open' | 'done' | 'ignored') => Promise<void>;
}) {
  const navigate = useNavigate();
  const [thread, setThread] = useState<GmailThread | null>(null);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [isLoadingThread, setIsLoadingThread] = useState(false);

  const [suggestion, setSuggestion] = useState<GmailThreadSuggestion | null>(null);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const sortedMessages = useMemo(() => {
    const messages = thread?.messages ?? [];
    return [...messages].sort((a, b) => {
      const ta = a.internalDate ? new Date(a.internalDate).getTime() : 0;
      const tb = b.internalDate ? new Date(b.internalDate).getTime() : 0;
      return ta - tb;
    });
  }, [thread?.messages]);

  const [prefillTitle, setPrefillTitle] = useState('');
  const [prefillVenueName, setPrefillVenueName] = useState('');
  const [prefillCity, setPrefillCity] = useState('');
  const [prefillDateStartIso, setPrefillDateStartIso] = useState('');
  const [prefillNotes, setPrefillNotes] = useState('');

  useEffect(() => {
    if (!open) return;
    setThread(null);
    setThreadError(null);
    setIsLoadingThread(false);

    setSuggestion(null);
    setSuggestionError(null);
    setIsAnalyzing(false);

    setPrefillTitle('');
    setPrefillVenueName('');
    setPrefillCity('');
    setPrefillDateStartIso('');
    setPrefillNotes('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!todo?.threadId) return;
    if (!appAccessToken) {
      setThreadError('Session invalide: access_token manquant');
      return;
    }

    let isMounted = true;
    void (async () => {
      setIsLoadingThread(true);
      setThreadError(null);
      try {
        const t = await getGmailThreadById({ appAccessToken, threadId: todo.threadId });
        if (!isMounted) return;
        setThread(t);
      } catch (e) {
        if (!isMounted) return;
        setThreadError(e instanceof Error ? e.message : 'Impossible de charger le thread Gmail');
      } finally {
        if (isMounted) setIsLoadingThread(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [open, todo?.threadId, appAccessToken]);

  useEffect(() => {
    if (!open) return;
    if (!todo?.threadId) return;
    if (!appAccessToken) return;

    let isMounted = true;
    void (async () => {
      setIsAnalyzing(true);
      setSuggestionError(null);
      try {
        const s = await analyzeGmailThread({ appAccessToken, threadId: todo.threadId });
        if (!isMounted) return;
        setSuggestion(s);

        if (s.kind === 'create_concert') {
          setPrefillTitle(s.extracted.title ?? todo.subject);
          setPrefillVenueName(s.extracted.venue_name ?? '');
          setPrefillCity(s.extracted.city ?? '');
          setPrefillDateStartIso(s.extracted.date_start ?? '');
          setPrefillNotes(s.extracted.notes ?? '');
        } else {
          setPrefillNotes(s.rationale ?? '');
        }
      } catch (e) {
        if (!isMounted) return;
        setSuggestionError(e instanceof Error ? e.message : "Impossible d'analyser le thread");
      } finally {
        if (isMounted) setIsAnalyzing(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [open, todo?.threadId, appAccessToken, todo?.subject]);

  const headerLine = useMemo(() => {
    if (!todo) return '';
    const parts = [safeString(todo.counterpartEmail), safeString(todo.subject)].filter(Boolean);
    return parts.join(' — ');
  }, [todo]);

  const lastFromEmail = useMemo(() => {
    const last = sortedMessages[sortedMessages.length - 1];
    return extractEmailAddress(last?.headers?.from) || safeString(todo?.counterpartEmail);
  }, [sortedMessages, todo?.counterpartEmail]);

  function openConcertCreate() {
    if (!todo) return;
    const qs = new URLSearchParams({
      source: 'gmail',
      email: lastFromEmail || safeString(todo.counterpartEmail),
      subject: safeString(todo.subject),
      snippet: safeString(todo.snippet),
      threadId: safeString(todo.threadId),
    });

    if (todo.todoId) qs.set('todoId', todo.todoId);
    if (safeString(prefillTitle)) qs.set('prefillTitle', safeString(prefillTitle));
    if (safeString(prefillVenueName)) qs.set('prefillVenueName', safeString(prefillVenueName));
    if (safeString(prefillCity)) qs.set('prefillCity', safeString(prefillCity));
    if (safeString(prefillDateStartIso)) qs.set('prefillDateStart', safeString(prefillDateStartIso));
    if (safeString(prefillNotes)) qs.set('prefillNotes', safeString(prefillNotes));

    onClose();
    navigate(`/concerts/new?${qs.toString()}`);
  }

  async function markRejected() {
    const todoId = safeString(todo?.todoId);
    if (!todoId) return;
    await onMarkStatus(todoId, 'ignored');
    onClose();
  }

  return (
    <Modal open={open} title={todo ? `Traiter — ${headerLine}` : 'Traiter'} onClose={onClose} widthPx={980}>
      {!todo ? <p style={{ color: '#6b7280' }}>Aucun thread sélectionné.</p> : null}

      {isLoadingThread ? <p>Chargement du thread Gmail…</p> : null}
      {threadError ? (
        <p role="alert" style={{ color: 'crimson' }}>
          {threadError}
        </p>
      ) : null}

      {todo && !threadError ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 12 }}>
          <section style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ fontWeight: 800 }}>Conversation</div>
              <div style={{ color: '#6b7280', fontSize: 12 }}>
                {sortedMessages.length ? `${sortedMessages.length} message(s)` : '—'}
              </div>
            </div>

            {sortedMessages.length === 0 && !isLoadingThread ? (
              <p style={{ color: '#6b7280', marginTop: 10 }}>Aucun message dans ce thread.</p>
            ) : null}

            <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
              {sortedMessages.map((m) => (
                <article
                  key={safeString(m.id) || Math.random().toString(16)}
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: 10,
                    padding: 10,
                    background: '#fff',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ fontWeight: 700 }}>{safeString(m.headers?.from) || '—'}</div>
                    <div style={{ color: '#6b7280', fontSize: 12 }}>{formatIsoDate(m.internalDate)}</div>
                  </div>
                  {safeString(m.headers?.subject) ? (
                    <div style={{ marginTop: 4, color: '#374151' }}>{safeString(m.headers?.subject)}</div>
                  ) : null}
                  <pre
                    style={{
                      marginTop: 8,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                      fontSize: 12,
                      lineHeight: 1.4,
                      background: '#f9fafb',
                      padding: 10,
                      borderRadius: 8,
                      border: '1px solid #e5e7eb',
                      maxHeight: 260,
                      overflow: 'auto',
                    }}
                  >
                    {messageBodyToDisplay(m)}
                  </pre>
                </article>
              ))}
            </div>
          </section>

          <section style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <div style={{ fontWeight: 800 }}>Suggestion IA</div>
              <div style={{ color: '#6b7280', fontSize: 12 }}>{isAnalyzing ? 'Analyse…' : ''}</div>
            </div>

            {suggestionError ? (
              <p role="alert" style={{ color: 'crimson', marginTop: 10 }}>
                {suggestionError}
              </p>
            ) : null}

            {suggestion ? (
              <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
                <div style={{
                  padding: 10,
                  borderRadius: 10,
                  border: '1px solid #e5e7eb',
                  background: suggestion.kind === 'reject' ? '#fef2f2' : '#ecfeff',
                }}>
                  <div style={{ fontWeight: 800 }}>
                    {suggestion.kind === 'reject' ? 'Proposition: classer en refusé' : 'Proposition: créer une opportunité de concert'}
                  </div>
                  {suggestion.rationale ? (
                    <div style={{ marginTop: 6, color: '#374151', whiteSpace: 'pre-wrap' }}>{suggestion.rationale}</div>
                  ) : null}
                  <div style={{ marginTop: 6, color: '#6b7280', fontSize: 12 }}>
                    Confiance: {Math.round((suggestion.confidence ?? 0) * 100)}%
                  </div>
                </div>

                {suggestion.kind === 'create_concert' ? (
                  <div style={{ display: 'grid', gap: 8 }}>
                    <label style={{ display: 'grid', gap: 4 }}>
                      <span style={{ fontSize: 12, color: '#6b7280' }}>Titre (optionnel)</span>
                      <input value={prefillTitle} onChange={(e) => setPrefillTitle(e.currentTarget.value)} />
                    </label>
                    <label style={{ display: 'grid', gap: 4 }}>
                      <span style={{ fontSize: 12, color: '#6b7280' }}>Lieu (nom)</span>
                      <input
                        value={prefillVenueName}
                        onChange={(e) => setPrefillVenueName(e.currentTarget.value)}
                        placeholder="Ex: Le Molotov"
                      />
                    </label>
                    <label style={{ display: 'grid', gap: 4 }}>
                      <span style={{ fontSize: 12, color: '#6b7280' }}>Ville</span>
                      <input
                        value={prefillCity}
                        onChange={(e) => setPrefillCity(e.currentTarget.value)}
                        placeholder="Ex: Marseille"
                      />
                    </label>
                    <label style={{ display: 'grid', gap: 4 }}>
                      <span style={{ fontSize: 12, color: '#6b7280' }}>Date (ISO) (optionnel)</span>
                      <input
                        value={prefillDateStartIso}
                        onChange={(e) => setPrefillDateStartIso(e.currentTarget.value)}
                        placeholder="2026-02-10T20:00:00.000Z"
                      />
                    </label>
                    <label style={{ display: 'grid', gap: 4 }}>
                      <span style={{ fontSize: 12, color: '#6b7280' }}>Notes</span>
                      <textarea
                        value={prefillNotes}
                        onChange={(e) => setPrefillNotes(e.currentTarget.value)}
                        rows={6}
                        style={{ resize: 'vertical' }}
                      />
                    </label>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button type="button" onClick={openConcertCreate}>
                        Ouvrir la création de concert
                      </button>
                      <button type="button" onClick={() => void markRejected()} disabled={!todo.todoId}>
                        Classer en refusé
                      </button>
                    </div>

                    <p style={{ margin: 0, color: '#6b7280', fontSize: 12 }}>
                      La création est préremplie, mais rien n’est validé sans votre confirmation.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    <label style={{ display: 'grid', gap: 4 }}>
                      <span style={{ fontSize: 12, color: '#6b7280' }}>Raison (optionnel)</span>
                      <textarea
                        value={prefillNotes}
                        onChange={(e) => setPrefillNotes(e.currentTarget.value)}
                        rows={5}
                        style={{ resize: 'vertical' }}
                      />
                    </label>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button type="button" onClick={() => void markRejected()} disabled={!todo.todoId}>
                        Confirmer: classer en refusé
                      </button>
                      <button type="button" onClick={openConcertCreate}>
                        Finalement: créer une opportunité
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p style={{ color: '#6b7280', marginTop: 10 }}>
                {isAnalyzing ? 'Analyse en cours…' : 'Aucune suggestion disponible.'}
              </p>
            )}
          </section>
        </div>
      ) : null}
    </Modal>
  );
}
