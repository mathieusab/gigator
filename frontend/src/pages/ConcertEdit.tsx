import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import ConcertForm from '../components/ConcertForm';
import ConcertFinancesEditor from '../components/ConcertFinancesEditor';
import {
  createConcert,
  getConcert,
  updateConcert,
  type Concert,
  type ConcertUpsertInput,
} from '../services/concerts';
import { createConcertFinancialItem } from '../services/concertFinancialItems';
import {
  listContactsForConcert,
  replaceContactsForConcert,
  type ConcertContactLinkInput,
} from '../services/concertContactLinks';
import { upsertVenueContactLink } from '../services/venueContactLinks';
import { updateGmailTodoThreadStatus } from '../services/gmailTodoThreads';

export default function ConcertEdit({ mode }: { mode: 'create' | 'edit' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const concertId = params.id;

  const [concert, setConcert] = useState<Concert | null>(null);
  const [contactLinks, setContactLinks] = useState<ConcertContactLinkInput[]>([]);
  const [isLoading, setIsLoading] = useState(mode === 'edit');
  const [error, setError] = useState<string | null>(null);

  const [prefillCachetCents, setPrefillCachetCents] = useState<number | null>(null);

  const prefillInitial = (() => {
    if (mode !== 'create') return undefined;
    const qs = new URLSearchParams(location.search);
    const source = String(qs.get('source') ?? '').trim();
    if (source !== 'gmail') return undefined;

    const email = String(qs.get('email') ?? '').trim();
    const subject = String(qs.get('subject') ?? '').trim();
    const snippet = String(qs.get('snippet') ?? '').trim();
    const threadId = String(qs.get('threadId') ?? '').trim();
    const todoId = String(qs.get('todoId') ?? '').trim();

    const prefillTitle = String(qs.get('prefillTitle') ?? '').trim();
    const prefillVenueName = String(qs.get('prefillVenueName') ?? '').trim();
    const prefillCity = String(qs.get('prefillCity') ?? '').trim();
    const prefillDateStart = String(qs.get('prefillDateStart') ?? '').trim();
    const prefillNotes = String(qs.get('prefillNotes') ?? '').trim();
    const prefillCachetCentsRaw = String(qs.get('prefillCachetCents') ?? '').trim();

    const prefillCachetCentsParsed = prefillCachetCentsRaw ? Number(prefillCachetCentsRaw) : NaN;
    const prefillCachetCents = Number.isFinite(prefillCachetCentsParsed)
      ? Math.max(0, Math.floor(prefillCachetCentsParsed))
      : 0;

    const lines: string[] = [];
    lines.push('Issue Gmail à traiter');
    if (email) lines.push(`Contact email: ${email}`);
    if (subject) lines.push(`Objet: ${subject}`);
    if (snippet) lines.push(`Extrait: ${snippet}`);
    if (threadId) lines.push(`ThreadId: ${threadId}`);
    if (todoId) lines.push(`TodoId: ${todoId}`);

    if (prefillTitle) lines.push(`Titre suggéré: ${prefillTitle}`);
    if (prefillVenueName) lines.push(`Lieu suggéré: ${prefillVenueName}`);
    if (prefillCity) lines.push(`Ville suggérée: ${prefillCity}`);
    if (prefillDateStart) lines.push(`Date suggérée: ${prefillDateStart}`);
    if (prefillCachetCents > 0) lines.push(`Cachet suggéré: ${(prefillCachetCents / 100).toFixed(2)} €`);
    if (prefillNotes) {
      lines.push('---');
      lines.push(prefillNotes);
    }

    const notes = lines.join('\n');

    const date_start = (() => {
      if (!prefillDateStart) return undefined;
      const d = new Date(prefillDateStart);
      if (Number.isNaN(d.getTime())) return undefined;
      return d.toISOString();
    })();

    return {
      notes,
      title: prefillTitle || undefined,
      venue_name: prefillVenueName || undefined,
      city: prefillCity || undefined,
      date_start,
    };
  })();

  useEffect(() => {
    if (mode !== 'create') return;
    const qs = new URLSearchParams(location.search);
    const source = String(qs.get('source') ?? '').trim();
    if (source !== 'gmail') return;

    const raw = String(qs.get('prefillCachetCents') ?? '').trim();
    const parsed = raw ? Number(raw) : NaN;
    if (!Number.isFinite(parsed)) return;
    const cents = Math.max(0, Math.floor(parsed));
    if (cents <= 0) return;
    setPrefillCachetCents(cents);
  }, [mode, location.search]);

  const gmailTodoId = (() => {
    if (mode !== 'create') return '';
    const qs = new URLSearchParams(location.search);
    const source = String(qs.get('source') ?? '').trim();
    if (source !== 'gmail') return '';
    return String(qs.get('todoId') ?? '').trim();
  })();

  useEffect(() => {
    if (mode !== 'edit') return;
    if (!concertId) {
      setError('Missing concert id');
      return;
    }
    let isMounted = true;
    void (async () => {
      setError(null);
      setIsLoading(true);
      try {
        const c = await getConcert(concertId);
        if (!isMounted) return;
        setConcert(c);

        try {
          const links = await listContactsForConcert(concertId);
          if (!isMounted) return;
          setContactLinks(
            (links ?? []).map((l) => ({
              contact_id: l.contact_id,
              category: l.category ?? null,
            })),
          );
        } catch {
          // Keep the form usable even if the optional join table is unavailable.
          if (!isMounted) return;
          setContactLinks([]);
        }
      } catch (e) {
        if (!isMounted) return;
        setError(e instanceof Error ? e.message : 'Failed to load concert');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [mode, concertId]);

  async function handleSubmit(input: ConcertUpsertInput, links: ConcertContactLinkInput[]) {
    const contactIds = links.map((l) => l.contact_id);

    const shouldWriteJoinTable =
      contactIds.length > 1 ||
      links.some((l) => Boolean(l.category)) ||
      (mode === 'edit' && contactLinks.length > 0);

    if (mode === 'create') {
      const created = await createConcert(input);

      if (prefillCachetCents && prefillCachetCents > 0) {
        // Best-effort: do not block creation if finances insert fails.
        try {
          await createConcertFinancialItem(created.id, {
            kind: 'income',
            label: 'Cachet',
            amount_cents: prefillCachetCents,
          });
        } catch {
          // ignore
        }
      }

      if (gmailTodoId) {
        // Best-effort: do not block navigation if status update fails.
        try {
          await updateGmailTodoThreadStatus({ id: gmailTodoId, status: 'done' });
        } catch {
          // ignore
        }
      }

      if (input.venue_id && contactIds.length) {
        await Promise.all(
          contactIds.map((contactId) =>
            upsertVenueContactLink({ venue_id: input.venue_id as string, contact_id: contactId }),
          ),
        );
      }

      // Multi-contact support is stored in a join table. We only require it when the user selects >1 contact
      // so existing deployments (with only `concerts.contact_id`) keep working for the common case.
      if (shouldWriteJoinTable) {
        await replaceContactsForConcert(created.id, links);
      }
      navigate('/', { replace: true });
      return;
    }

    if (!concertId) throw new Error('Missing concert id');
    await updateConcert(concertId, input);

    if (input.venue_id && contactIds.length) {
      await Promise.all(
        contactIds.map((contactId) =>
          upsertVenueContactLink({ venue_id: input.venue_id as string, contact_id: contactId }),
        ),
      );
    }

    if (shouldWriteJoinTable) {
      await replaceContactsForConcert(concertId, links);
    }
    navigate('/', { replace: true });
  }

  return (
    <main
      style={{ padding: 24, fontFamily: 'system-ui, sans-serif', maxWidth: 900, margin: '0 auto' }}
    >
      <header
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
      >
        <h1 style={{ margin: 0 }}>
          {mode === 'create' ? 'Nouveau concert' : 'Modifier le concert'}
        </h1>
        <Link to="/">Retour</Link>
      </header>

      {error ? (
        <p role="alert" style={{ color: 'crimson' }}>
          {error}
        </p>
      ) : null}

      {isLoading ? <p>Chargement…</p> : null}

      {!isLoading && !error ? (
        <section style={{ marginTop: 16, display: 'grid', gap: 12 }}>
          {mode === 'create' && prefillCachetCents ? (
            <section style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 8 }}>
              <div style={{ fontWeight: 700 }}>Préremplissage finances</div>
              <div style={{ marginTop: 8, display: 'grid', gap: 6, maxWidth: 320 }}>
                <label style={{ display: 'grid', gap: 4 }}>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>Cachet (€)</span>
                  <input
                    value={(prefillCachetCents / 100).toFixed(2).replace(/\.00$/, '')}
                    onChange={(e) => {
                      const raw = String(e.currentTarget.value ?? '').trim();
                      if (!raw) {
                        setPrefillCachetCents(null);
                        return;
                      }
                      const n = Number(raw.replace(',', '.'));
                      if (!Number.isFinite(n) || n <= 0) return;
                      setPrefillCachetCents(Math.round(n * 100));
                    }}
                    inputMode="decimal"
                    placeholder="Ex: 450"
                  />
                </label>
                <div style={{ fontSize: 12, color: '#6b7280' }}>
                  Cet item “Cachet” sera créé automatiquement lors de la création du concert.
                </div>
              </div>
            </section>
          ) : null}

          <ConcertForm
            initial={concert ?? prefillInitial ?? undefined}
            onSubmit={handleSubmit}
            submitLabel={mode === 'create' ? 'Créer' : 'Enregistrer'}
            mode={mode}
            initialContactLinks={mode === 'edit' ? contactLinks : undefined}
          />

          {mode === 'edit' && concertId ? (
            <ConcertFinancesEditor concertId={concertId} />
          ) : (
            <section style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 8, color: '#6b7280' }}>
              <div style={{ fontWeight: 700, color: '#111827' }}>Finances</div>
              <div style={{ marginTop: 6 }}>Enregistre d’abord le concert, puis ajoute les recettes et dépenses ici.</div>
            </section>
          )}
        </section>
      ) : null}
    </main>
  );
}
