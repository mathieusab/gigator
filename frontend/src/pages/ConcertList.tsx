import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ConcertListItem from '../components/ConcertListItem';
import ConfirmDialog from '../components/ConfirmDialog';
import { deleteConcert, listConcerts, type Concert } from '../services/concerts';

function isUpcoming(dateStart: string) {
  return new Date(dateStart).getTime() >= Date.now();
}

export default function ConcertList() {
  const navigate = useNavigate();
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pendingDeleteConcert, setPendingDeleteConcert] = useState<Concert | null>(null);
  const [deletingConcertId, setDeletingConcertId] = useState<string | null>(null);

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

  const { upcoming, past } = useMemo(() => {
    const upcoming = concerts
      .filter((c) => isUpcoming(c.date_start))
      .sort((a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime());
    const past = concerts
      .filter((c) => !isUpcoming(c.date_start))
      .sort((a, b) => new Date(b.date_start).getTime() - new Date(a.date_start).getTime());
    return { upcoming, past };
  }, [concerts]);

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
