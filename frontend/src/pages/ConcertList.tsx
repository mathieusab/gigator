import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ConcertListItem from '../components/ConcertListItem';
import ConfirmDialog from '../components/ConfirmDialog';
import { deleteConcert, listConcerts, type Concert } from '../services/concerts';
import { listContacts } from '../services/contacts';
import { useAuth } from '../lib/useAuth';
import { getGmailConnection, listGmailThreadsForEmail, type GmailThread } from '../services/gmailProxy';
import { listOpenGmailTodoThreads, upsertGmailTodoThreads } from '../services/gmailTodoThreads';

function isUpcoming(dateStart: string | null) {
  if (!dateStart) return false;
  return new Date(dateStart).getTime() >= Date.now();
}

export default function ConcertList() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const appAccessToken = (session as any)?.access_token as string | undefined;
  const appUserId = (session as any)?.user?.id as string | undefined;
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [todoThreads, setTodoThreads] = useState<
    Array<{
      thread: GmailThread;
      counterpartEmail: string;
      subject: string;
      snippet: string;
      date: string | null;
    }>
  >([]);

  const [pendingDeleteConcert, setPendingDeleteConcert] = useState<Concert | null>(null);
  const [deletingConcertId, setDeletingConcertId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (!appUserId) return () => {
      isMounted = false;
    };

    // Best-effort: show persisted items quickly, then refresh from Gmail.
    void (async () => {
      try {
        const rows = await listOpenGmailTodoThreads({ limit: 20 });
        if (!isMounted) return;

        const next = rows.map((r) => {
          const thread: GmailThread = { id: r.thread_id };
          return {
            thread,
            counterpartEmail: r.counterpart_email,
            subject: String(r.subject ?? '').trim() || 'Conversation',
            snippet: String(r.snippet ?? '').trim(),
            date: r.last_message_at,
          };
        });

        setTodoThreads((prev) => (prev.length ? prev : next));
      } catch {
        // Silent: persistence is optional UX.
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [appUserId]);

  useEffect(() => {
    let isMounted = true;
    void (async () => {
      setError(null);
      setIsLoading(true);
      try {
        const items = await listConcerts();
        if (!isMounted) return;
        setConcerts(items);
      } catch (e) {
        if (!isMounted) return;
        setError(e instanceof Error ? e.message : 'Failed to load concerts');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  function normalizeOneLine(value: string) {
    return value.replace(/\s+/g, ' ').trim();
  }

  function extractFirstEmail(value?: string): string {
    const raw = normalizeOneLine(String(value ?? '').trim());
    if (!raw) return '';

    // Try angle bracket format: Name <email@domain>
    const angle = raw.match(/<\s*([^>]+)\s*>/);
    if (angle) return normalizeOneLine(angle[1] ?? '').toLowerCase();

    // Fallback: any email-like token.
    const m = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    return m ? String(m[0]).toLowerCase() : '';
  }

  function getThreadLatestMessage(t: GmailThread) {
    const messages = t.messages ?? [];
    if (messages.length === 0) return null;
    const withMs = messages
      .map((m) => ({ m, ms: m.internalDate ? new Date(m.internalDate).getTime() : Number.NaN }))
      .filter((x) => Number.isFinite(x.ms));
    if (withMs.length === 0) return messages[0] ?? null;
    withMs.sort((a, b) => b.ms - a.ms);
    return withMs[0]?.m ?? null;
  }

  function getThreadSubject(t: GmailThread): string {
    const latest = getThreadLatestMessage(t);
    return normalizeOneLine(String(latest?.headers?.subject ?? '').trim()) || 'Conversation';
  }

  function getThreadSnippet(t: GmailThread): string {
    return normalizeOneLine(String(t.snippet ?? '').trim());
  }

  function getThreadCounterpartEmail(t: GmailThread, groupEmail: string): string {
    const latest = getThreadLatestMessage(t);
    const fromEmail = extractFirstEmail(latest?.headers?.from);
    const toEmail = extractFirstEmail(latest?.headers?.to);
    const group = String(groupEmail ?? '').trim().toLowerCase();
    if (!group) return fromEmail || toEmail;
    if (fromEmail && fromEmail !== group) return fromEmail;
    if (toEmail && toEmail !== group) return toEmail;
    return fromEmail || toEmail;
  }

  useEffect(() => {
    let isMounted = true;
    if (!appAccessToken) {
      setTodoThreads((prev) => (prev.length ? [] : prev));
      return () => {
        isMounted = false;
      };
    }

    void (async () => {
      try {
        const [{ gmailEmail }, contacts] = await Promise.all([
          getGmailConnection({ appAccessToken }),
          listContacts(),
        ]);

        const email = String(gmailEmail ?? '').trim();
        if (!email) {
          if (isMounted) setTodoThreads([]);
          return;
        }

        const threads = await listGmailThreadsForEmail({ appAccessToken, email, maxThreads: 50 });
        const knownEmails = new Set(
          contacts
            .map((c) => String(c.email ?? '').trim().toLowerCase())
            .filter(Boolean),
        );

        const group = email.toLowerCase();
        const next = (Array.isArray(threads) ? threads : [])
          .map((thread) => {
            const counterpartEmail = getThreadCounterpartEmail(thread, group);
            const latest = getThreadLatestMessage(thread);
            const date = latest?.internalDate ? String(latest.internalDate) : null;
            return {
              thread,
              counterpartEmail,
              subject: getThreadSubject(thread),
              snippet: getThreadSnippet(thread),
              date,
            };
          })
          .filter((x) => x.counterpartEmail && !knownEmails.has(x.counterpartEmail.toLowerCase()))
          .sort((a, b) => {
            const ams = a.date ? new Date(a.date).getTime() : 0;
            const bms = b.date ? new Date(b.date).getTime() : 0;
            return bms - ams;
          });

        if (isMounted) setTodoThreads(next);

        // Persist best-effort for offline/fast load later.
        if (appUserId) {
          void upsertGmailTodoThreads({
            appUserId,
            gmailEmail: email,
            threads: next.map((t) => ({
              threadId: t.thread.id,
              counterpartEmail: t.counterpartEmail,
              subject: t.subject,
              snippet: t.snippet,
              lastMessageAt: t.date,
            })),
          }).catch(() => undefined);
        }
      } catch {
        // Deliberately silent: concerts page should not show Gmail errors.
        if (isMounted) setTodoThreads([]);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [appAccessToken]);

  const { unscheduled, upcoming, past } = useMemo(() => {
    const unscheduled = concerts.filter((c) => !c.date_start);

    const upcoming = concerts
      .filter((c) => c.date_start && isUpcoming(c.date_start))
      .sort((a, b) => new Date(a.date_start as string).getTime() - new Date(b.date_start as string).getTime());

    const past = concerts
      .filter((c) => c.date_start && !isUpcoming(c.date_start))
      .sort((a, b) => new Date(b.date_start as string).getTime() - new Date(a.date_start as string).getTime());

    return { unscheduled, upcoming, past };
  }, [concerts]);

  const todoTop3 = todoThreads.slice(0, 3);

  function requestDelete(id: string) {
    const found = concerts.find((c) => c.id === id);
    if (!found) return;
    setError(null);
    setPendingDeleteConcert(found);
  }

  async function handleConfirmDelete() {
    if (!pendingDeleteConcert) return;
    const id = pendingDeleteConcert.id;
    setDeletingConcertId(id);
    try {
      await deleteConcert(id);
      setConcerts((prev) => prev.filter((c) => c.id !== id));
      setPendingDeleteConcert(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete concert');
    } finally {
      setDeletingConcertId((current) => (current === id ? null : current));
    }
  }

  return (
    <main
      style={{ padding: 24, fontFamily: 'system-ui, sans-serif', maxWidth: 900, margin: '0 auto' }}
    >
      <ConfirmDialog
        open={pendingDeleteConcert !== null}
        title={
          pendingDeleteConcert
            ? `Supprimer \"${pendingDeleteConcert.venue_name}\" ?`
            : 'Supprimer ce concert ?'
        }
        description={
          pendingDeleteConcert
            ? 'Cette action est définitive.'
            : undefined
        }
        confirmText="Oui, supprimer"
        cancelText="Annuler"
        isConfirming={pendingDeleteConcert ? deletingConcertId === pendingDeleteConcert.id : false}
        onCancel={() => {
          if (pendingDeleteConcert && deletingConcertId === pendingDeleteConcert.id) return;
          setPendingDeleteConcert(null);
        }}
        onConfirm={() => void handleConfirmDelete()}
      />

      <header
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
      >
        <h1 style={{ margin: 0 }}>Concerts</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => navigate('/venues')}>
            Salles
          </button>
          <button type="button" onClick={() => navigate('/contacts')}>
            Contacts
          </button>
          <button type="button" onClick={() => navigate('/calendar')}>
            Calendrier
          </button>
          <button type="button" onClick={() => navigate('/map')}>
            Carte
          </button>
          <button type="button" onClick={() => navigate('/stats')}>
            Stats
          </button>
          <button type="button" onClick={() => navigate('/concerts/new')}>
            Ajouter
          </button>
        </div>
      </header>

      {isLoading ? <p>Chargement…</p> : null}
      {error ? (
        <p role="alert" style={{ color: 'crimson' }}>
          {error}
        </p>
      ) : null}

      {!isLoading && !error ? (
        <section style={{ marginTop: 16 }}>
          <h2>À traiter</h2>
          {todoTop3.length === 0 ? <p>Rien à traiter.</p> : null}
          {todoTop3.length ? (
            <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 10 }}>
              {todoTop3.map((t) => (
                <li
                  key={t.thread.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: 12,
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    background: '#fff7ed',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{t.subject}</div>
                    <div style={{ color: '#4b5563' }}>
                      {t.counterpartEmail}
                      {t.snippet ? ` — ${t.snippet}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() =>
                        navigate(`/contacts?email=${encodeURIComponent(t.counterpartEmail)}`)
                      }
                    >
                      Créer contact
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
          {todoThreads.length > 3 ? (
            <p style={{ color: '#4b5563', marginTop: 8 }}>
              +{todoThreads.length - 3} autres à traiter
            </p>
          ) : null}

          <h2>À planifier</h2>
          {unscheduled.length === 0 ? <p>Aucun concert sans date.</p> : null}
          {unscheduled.length ? (
            <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 10 }}>
              {unscheduled.map((c) => (
                <ConcertListItem
                  key={c.id}
                  concert={c}
                  onOpen={(id) => navigate(`/concerts/${id}`)}
                  onEdit={(id) => navigate(`/concerts/${id}/edit`)}
                  onDelete={requestDelete}
                  isDeleting={deletingConcertId === c.id}
                />
              ))}
            </ul>
          ) : null}

          <h2>À venir</h2>
          {upcoming.length === 0 ? <p>Aucun concert à venir.</p> : null}
          {upcoming.length ? (
            <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 10 }}>
              {upcoming.map((c) => (
                <ConcertListItem
                  key={c.id}
                  concert={c}
                  onOpen={(id) => navigate(`/concerts/${id}`)}
                  onEdit={(id) => navigate(`/concerts/${id}/edit`)}
                  onDelete={requestDelete}
                  isDeleting={deletingConcertId === c.id}
                />
              ))}
            </ul>
          ) : null}

          <h2 style={{ marginTop: 24 }}>Passés</h2>
          {past.length === 0 ? <p>Aucun concert passé.</p> : null}
          {past.length ? (
            <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 10 }}>
              {past.map((c) => (
                <ConcertListItem
                  key={c.id}
                  concert={c}
                  onOpen={(id) => navigate(`/concerts/${id}`)}
                  onEdit={(id) => navigate(`/concerts/${id}/edit`)}
                  onDelete={requestDelete}
                  isDeleting={deletingConcertId === c.id}
                />
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
