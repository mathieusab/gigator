import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import CalendarView from '../components/CalendarView';
import { listConcerts, type Concert } from '../services/concerts';

export default function CalendarPage() {
  const navigate = useNavigate();
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <main
      style={{ padding: 24, fontFamily: 'system-ui, sans-serif', maxWidth: 900, margin: '0 auto' }}
    >
      <header
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
      >
        <h1 style={{ margin: 0 }}>Calendrier</h1>
        <Link to="/">Retour</Link>
      </header>

      {isLoading ? <p>Chargement…</p> : null}
      {error ? (
        <p role="alert" style={{ color: 'crimson' }}>
          {error}
        </p>
      ) : null}

      {!isLoading && !error ? (
        <div style={{ marginTop: 16 }}>
          <CalendarView concerts={concerts} onOpenConcert={(id) => navigate(`/concerts/${id}`)} />
        </div>
      ) : null}
    </main>
  );
}
