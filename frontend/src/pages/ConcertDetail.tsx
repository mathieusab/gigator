import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import GmailThreads from '../components/GmailThreads';
import { getConcert, type Concert } from '../services/concerts';

function formatDateTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export default function ConcertDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const concertId = id;

  const [concert, setConcert] = useState<Concert | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!concertId) {
      setError('Missing concert id');
      setIsLoading(false);
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
  }, [concertId]);

  return (
    <main
      style={{ padding: 24, fontFamily: 'system-ui, sans-serif', maxWidth: 900, margin: '0 auto' }}
    >
      <header
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
      >
        <h1 style={{ margin: 0 }}>Détail du concert</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Link to="/">Retour</Link>
          {concertId ? (
            <button type="button" onClick={() => navigate(`/concerts/${concertId}/edit`)}>
              Modifier
            </button>
          ) : null}
        </div>
      </header>

      {error ? (
        <p role="alert" style={{ color: 'crimson' }}>
          {error}
        </p>
      ) : null}

      {isLoading ? <p>Chargement…</p> : null}

      {!isLoading && !error && concert ? (
        <section style={{ marginTop: 16, display: 'grid', gap: 10 }}>
          <div style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{concert.venue_name}</div>
            <div style={{ color: '#4b5563' }}>{formatDateTime(concert.date_start)}</div>
            <div style={{ color: '#4b5563' }}>
              {concert.city ? concert.city : ''}
              {concert.country ? (concert.city ? `, ${concert.country}` : concert.country) : ''}
            </div>

            {concert.address ? <div style={{ marginTop: 8 }}>{concert.address}</div> : null}

            {concert.venue_contact_email ? (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 12, color: '#6b7280' }}>Contact email</div>
                <div>{concert.venue_contact_email}</div>
              </div>
            ) : null}

            {concert.notes ? (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 12, color: '#6b7280' }}>Notes</div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{concert.notes}</div>
              </div>
            ) : null}
          </div>

          {concert.venue_contact_email ? (
            <GmailThreads email={concert.venue_contact_email} />
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
