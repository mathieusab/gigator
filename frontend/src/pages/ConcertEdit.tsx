import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ConcertForm from '../components/ConcertForm';
import { createConcert, getConcert, updateConcert, type Concert, type ConcertUpsertInput } from '../services/concerts';

export default function ConcertEdit({ mode }: { mode: 'create' | 'edit' }) {
  const navigate = useNavigate();
  const params = useParams();
  const concertId = params.id;

  const [concert, setConcert] = useState<Concert | null>(null);
  const [isLoading, setIsLoading] = useState(mode === 'edit');
  const [error, setError] = useState<string | null>(null);

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

  async function handleSubmit(input: ConcertUpsertInput) {
    if (mode === 'create') {
      await createConcert(input);
      navigate('/', { replace: true });
      return;
    }

    if (!concertId) throw new Error('Missing concert id');
    await updateConcert(concertId, input);
    navigate('/', { replace: true });
  }

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif', maxWidth: 900, margin: '0 auto' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h1 style={{ margin: 0 }}>{mode === 'create' ? 'Nouveau concert' : 'Modifier le concert'}</h1>
        <Link to="/">Retour</Link>
      </header>

      {error ? (
        <p role="alert" style={{ color: 'crimson' }}>
          {error}
        </p>
      ) : null}

      {isLoading ? <p>Chargement…</p> : null}

      {!isLoading && !error ? (
        <ConcertForm initial={concert ?? undefined} onSubmit={handleSubmit} submitLabel={mode === 'create' ? 'Créer' : 'Enregistrer'} />
      ) : null}
    </main>
  );
}
