import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleSlash, Plus, Users, Warehouse } from 'lucide-react';
import Modal from './Modal';
import ContactCreateForm from './ContactCreateForm';
import VenueCreateForm from './VenueCreateForm';
import { getGmailThreadById, type GmailThread } from '../services/gmailProxy';

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

function normalizeEmail(email: string) {
  return safeString(email).toLowerCase();
}

function chooseCounterpartEmail(params: {
  fromHeader?: string;
  toHeader?: string;
  fallback?: string;
  selfEmail?: string;
}) {
  const from = extractEmailAddress(params.fromHeader);
  const to = extractEmailAddress(params.toHeader);
  const fallback = safeString(params.fallback);
  const self = normalizeEmail(params.selfEmail ?? '');

  const fromNorm = normalizeEmail(from);
  const toNorm = normalizeEmail(to);

  if (self && fromNorm === self && to) return to;
  if (self && toNorm === self && from) return from;

  return from || to || fallback;
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

  const [isVenueCreateOpen, setIsVenueCreateOpen] = useState(false);
  const [isContactCreateOpen, setIsContactCreateOpen] = useState(false);

  const [actionFlash, setActionFlash] = useState<{ kind: 'success' | 'info'; text: string } | null>(null);

  const sortedMessages = useMemo(() => {
    const messages = thread?.messages ?? [];
    return [...messages].sort((a, b) => {
      const ta = a.internalDate ? new Date(a.internalDate).getTime() : 0;
      const tb = b.internalDate ? new Date(b.internalDate).getTime() : 0;
      return ta - tb;
    });
  }, [thread?.messages]);

  useEffect(() => {
    if (!open) return;
    setThread(null);
    setThreadError(null);
    setIsLoadingThread(false);

    setIsVenueCreateOpen(false);
    setIsContactCreateOpen(false);

    setActionFlash(null);
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

  const headerLine = useMemo(() => {
    if (!todo) return '';
    const parts = [safeString(todo.counterpartEmail), safeString(todo.subject)].filter(Boolean);
    return parts.join(' — ');
  }, [todo]);

  const counterpartEmail = useMemo(() => {
    const last = sortedMessages[sortedMessages.length - 1];
    return chooseCounterpartEmail({
      fromHeader: last?.headers?.from,
      toHeader: last?.headers?.to,
      fallback: todo?.counterpartEmail,
      selfEmail: 'barelyblue.theband@gmail.com',
    });
  }, [sortedMessages, todo?.counterpartEmail]);

  function openConcertCreate() {
    if (!todo) return;
    const qs = new URLSearchParams({
      source: 'gmail',
      email: counterpartEmail || safeString(todo.counterpartEmail),
      subject: safeString(todo.subject),
      snippet: safeString(todo.snippet),
      threadId: safeString(todo.threadId),
    });

    if (todo.todoId) qs.set('todoId', todo.todoId);

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
              <div style={{ fontWeight: 800 }}>Actions</div>
            </div>

            {actionFlash ? (
              <div
                role="status"
                style={{
                  marginTop: 10,
                  padding: 10,
                  borderRadius: 10,
                  border: actionFlash.kind === 'success' ? '1px solid #bbf7d0' : '1px solid #bfdbfe',
                  background: actionFlash.kind === 'success' ? '#f0fdf4' : '#eff6ff',
                  color: actionFlash.kind === 'success' ? '#065f46' : '#1d4ed8',
                  fontSize: 13,
                }}
              >
                {actionFlash.text}
              </div>
            ) : null}

            <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
              <button type="button" className="btn btn-sm" onClick={() => setIsVenueCreateOpen(true)}>
                <Warehouse size={16} aria-hidden="true" />
                Ajouter un lieu
              </button>
              <button type="button" className="btn btn-sm" onClick={() => setIsContactCreateOpen(true)}>
                <Users size={16} aria-hidden="true" />
                Ajouter un contact
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={openConcertCreate}>
                <Plus size={16} aria-hidden="true" />
                Ajouter un concert
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => void markRejected()}
                disabled={!todo.todoId}
              >
                <CircleSlash size={16} aria-hidden="true" />
                Classer en refusé
              </button>
            </div>
          </section>
        </div>
      ) : null}

      <Modal
        open={isVenueCreateOpen}
        title="Nouveau lieu"
        onClose={() => setIsVenueCreateOpen(false)}
        widthPx={820}
      >
        <VenueCreateForm
          onResult={(result) => {
            const name = safeString((result.venue as any)?.name);
            const city = safeString((result.venue as any)?.city);
            const suffix = [name, city].filter(Boolean).join(city ? ' — ' : '');

            if (result.existed) {
              setActionFlash({
                kind: 'info',
                text: `Lieu existant réutilisé${suffix ? ` : ${suffix}` : ''}`,
              });
            } else {
              setActionFlash({
                kind: 'success',
                text: `Lieu ajouté${suffix ? ` : ${suffix}` : ''}`,
              });
            }
          }}
          onCreated={(created) => {
            setIsVenueCreateOpen(false);
          }}
        />
      </Modal>

      <Modal
        open={isContactCreateOpen}
        title="Nouveau contact"
        onClose={() => setIsContactCreateOpen(false)}
      >
        <ContactCreateForm
          prefill={{
            email: counterpartEmail || safeString(todo?.counterpartEmail),
          }}
          onResult={(result) => {
            const fullName = safeString((result.contact as any)?.full_name);
            const email = safeString((result.contact as any)?.email);
            const phone = safeString((result.contact as any)?.phone);
            const label = fullName || email || phone;

            if (result.existed) {
              setActionFlash({
                kind: 'info',
                text: `Contact existant réutilisé${label ? ` : ${label}` : ''}`,
              });
            } else {
              setActionFlash({
                kind: 'success',
                text: `Contact ajouté${label ? ` : ${label}` : ''}`,
              });
            }
          }}
          onCreated={(created) => {
            setIsContactCreateOpen(false);
          }}
        />
      </Modal>
    </Modal>
  );
}
