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
import {
  listContactsForConcert,
  replaceContactsForConcert,
  type ConcertContactLinkInput,
} from '../services/concertContactLinks';
import { upsertVenueContactLink } from '../services/venueContactLinks';

export default function ConcertEdit({ mode }: { mode: 'create' | 'edit' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const concertId = params.id;

  const [concert, setConcert] = useState<Concert | null>(null);
  const [contactLinks, setContactLinks] = useState<ConcertContactLinkInput[]>([]);
  const [isLoading, setIsLoading] = useState(mode === 'edit');
  const [error, setError] = useState<string | null>(null);

  const prefillInitial = (() => {
    if (mode !== 'create') return undefined;
    const qs = new URLSearchParams(location.search);
    const source = String(qs.get('source') ?? '').trim();
    if (source !== 'gmail') return undefined;

    const email = String(qs.get('email') ?? '').trim();
    const subject = String(qs.get('subject') ?? '').trim();
    const snippet = String(qs.get('snippet') ?? '').trim();
    const threadId = String(qs.get('threadId') ?? '').trim();

    const lines: string[] = [];
    lines.push('Issue Gmail à traiter');
    if (email) lines.push(`Contact email: ${email}`);
    if (subject) lines.push(`Objet: ${subject}`);
    if (snippet) lines.push(`Extrait: ${snippet}`);
    if (threadId) lines.push(`ThreadId: ${threadId}`);

    const notes = lines.join('\n');
    return { notes };
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
