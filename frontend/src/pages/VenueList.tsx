import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import ConfirmDialog from '../components/ConfirmDialog';
import VenueCreateForm from '../components/VenueCreateForm';
import { listConcerts, type Concert } from '../services/concerts';
import { deleteVenue, listVenues, type Venue } from '../services/venues';
import { ArrowLeft, Trash2 } from 'lucide-react';

type PlayedFilter = 'all' | 'played' | 'not_played';

function venueLocation(v: Venue): string {
  return [v.city, v.region, v.country].filter(Boolean).join(', ');
}

type LastPlayedByVenueId = Record<string, string | null | undefined>;

function parseIsoToMs(iso: string | null | undefined): number {
  if (!iso) return Number.NaN;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : Number.NaN;
}

function computeLastPlayedByVenueId(concerts: Concert[]): LastPlayedByVenueId {
  const map: LastPlayedByVenueId = {};
  for (const c of concerts) {
    if (!c.venue_id) continue;
    if (c.status !== 'completed') continue;
    const ms = parseIsoToMs(c.date_start);
    if (!Number.isFinite(ms)) continue;

    const existingMs = parseIsoToMs(map[c.venue_id] ?? null);
    if (!Number.isFinite(existingMs) || ms > existingMs) {
      map[c.venue_id] = c.date_start;
    }
  }
  return map;
}

function hasPlayedComputed(v: Venue, lastPlayed: LastPlayedByVenueId): boolean {
  return Boolean(v.has_played) || Boolean(lastPlayed[v.id]);
}

function compareVenuesForLieux(a: Venue, b: Venue, lastPlayed: LastPlayedByVenueId): number {
  const aPlayed = hasPlayedComputed(a, lastPlayed);
  const bPlayed = hasPlayedComputed(b, lastPlayed);

  // Unplayed first, then played.
  if (aPlayed !== bPlayed) return aPlayed ? 1 : -1;

  // For played venues, most recent played date first.
  if (aPlayed && bPlayed) {
    const aMs = parseIsoToMs(lastPlayed[a.id] ?? null);
    const bMs = parseIsoToMs(lastPlayed[b.id] ?? null);
    const aHas = Number.isFinite(aMs);
    const bHas = Number.isFinite(bMs);

    if (aHas && bHas && aMs !== bMs) return bMs - aMs;
    if (aHas !== bHas) return aHas ? -1 : 1;
  }

  // Fallback stable ordering.
  return String(a.name ?? '').localeCompare(String(b.name ?? ''), 'fr', { sensitivity: 'base' });
}

export default function VenueList() {
  const navigate = useNavigate();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [lastPlayedByVenueId, setLastPlayedByVenueId] = useState<LastPlayedByVenueId>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingVenueId, setDeletingVenueId] = useState<string | null>(null);
  const [pendingDeleteVenue, setPendingDeleteVenue] = useState<Venue | null>(null);

  const [locationFilter, setLocationFilter] = useState('');
  const [playedFilter, setPlayedFilter] = useState<PlayedFilter>('all');

  const [createFlash, setCreateFlash] = useState<string | null>(null);
  const [createFlashKind, setCreateFlashKind] = useState<'success' | 'info'>('success');
  const createFlashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (createFlashTimeoutRef.current) clearTimeout(createFlashTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    void (async () => {
      setError(null);
      setIsLoading(true);
      try {
        const [venueItems, concertItems] = await Promise.all([
          listVenues(),
          // Non-blocking: if this fails (RLS/connection), we still render venues.
          listConcerts().catch(() => [] as Concert[]),
        ]);
        if (!isMounted) return;
        setVenues(venueItems);
        setLastPlayedByVenueId(computeLastPlayedByVenueId(concertItems));
      } catch (e) {
        if (!isMounted) return;
        setError(e instanceof Error ? e.message : 'Failed to load venues');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // The venue creation form is now extracted into <VenueCreateForm />.

  const filtered = useMemo(() => {
    const q = locationFilter.trim().toLowerCase();
    const items = venues.filter((v) => {
      const played = hasPlayedComputed(v, lastPlayedByVenueId);
      if (playedFilter === 'played' && !played) return false;
      if (playedFilter === 'not_played' && played) return false;

      if (!q) return true;
      const haystack = [v.name, v.city, v.region, v.country, v.address]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });

    items.sort((a, b) => compareVenuesForLieux(a, b, lastPlayedByVenueId));
    return items;
  }, [venues, locationFilter, playedFilter, lastPlayedByVenueId]);

  async function handleConfirmDelete() {
    if (!pendingDeleteVenue) return;
    setDeleteError(null);

    const v = pendingDeleteVenue;
    setDeletingVenueId(v.id);
    try {
      await deleteVenue(v.id);
      setVenues((prev) => prev.filter((item) => item.id !== v.id));
      setPendingDeleteVenue(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Suppression impossible';
      setDeleteError(`Suppression de "${v.name}" impossible. ${msg}`);
    } finally {
      setDeletingVenueId((current) => (current === v.id ? null : current));
    }
  }

  // Venue creation is handled by <VenueCreateForm />.

  return (
    <main
      style={{ padding: 24, fontFamily: 'system-ui, sans-serif', maxWidth: 900, margin: '0 auto' }}
    >
      <ConfirmDialog
        open={pendingDeleteVenue !== null}
        title={pendingDeleteVenue ? `Supprimer \"${pendingDeleteVenue.name}\" ?` : 'Supprimer ce lieu ?'}
        description={
          pendingDeleteVenue
            ? "Cette action est définitive. Si le lieu est lié à des concerts/contacts, la suppression peut être refusée."
            : undefined
        }
        confirmText="Oui, supprimer"
        cancelText="Annuler"
        isConfirming={pendingDeleteVenue ? deletingVenueId === pendingDeleteVenue.id : false}
        onCancel={() => {
          if (pendingDeleteVenue && deletingVenueId === pendingDeleteVenue.id) return;
          setPendingDeleteVenue(null);
        }}
        onConfirm={() => void handleConfirmDelete()}
      />

      <header
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
      >
        <h1 style={{ margin: 0 }}>Lieux</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-sm" onClick={() => navigate('/')}
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Retour
          </button>
        </div>
      </header>

      <section style={{ marginTop: 16, display: 'grid', gap: 12 }}>
        {createFlash ? (
          <p
            role="status"
            style={{
              margin: 0,
              padding: 10,
              borderRadius: 8,
              border: '1px solid #d1fae5',
              background: createFlashKind === 'success' ? '#ecfdf5' : '#eff6ff',
              color: createFlashKind === 'success' ? '#065f46' : '#1d4ed8',
            }}
          >
            {createFlash}
          </p>
        ) : null}

        <VenueCreateForm
          onCreated={(created) => {
            setVenues((prev) => [created, ...prev.filter((v) => v.id !== created.id)]);
          }}
          onResult={(result) => {
            if (createFlashTimeoutRef.current) clearTimeout(createFlashTimeoutRef.current);

            const v = result.venue;
            const loc = venueLocation(v);
            const suffix = [v.name, loc].filter(Boolean).join(loc ? ' — ' : '');

            if (result.existed) {
              setCreateFlashKind('info');
              setCreateFlash(`Lieu existant réutilisé${suffix ? ` : ${suffix}` : ''}`);
            } else {
              setCreateFlashKind('success');
              setCreateFlash(`Lieu ajouté${suffix ? ` : ${suffix}` : ''}`);
            }

            createFlashTimeoutRef.current = setTimeout(() => setCreateFlash(null), 3000);
          }}
        />

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 12, color: '#6b7280' }}>Filtrer (lieu)</span>
            <input
              className="input"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              placeholder="Ville, pays…"
            />
          </label>

          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 12, color: '#6b7280' }}>Déjà joué</span>
            <select
              className="select"
              value={playedFilter}
              onChange={(e) => setPlayedFilter(e.target.value as PlayedFilter)}
            >
              <option value="all">Tous</option>
              <option value="played">Oui</option>
              <option value="not_played">Non</option>
            </select>
          </label>
        </div>

        {isLoading ? <p>Chargement…</p> : null}
        {error ? (
          <p role="alert" style={{ color: 'crimson' }}>
            {error}
          </p>
        ) : null}

        {deleteError ? (
          <p role="alert" style={{ color: 'crimson' }}>
            {deleteError}
          </p>
        ) : null}

        {!isLoading && !error ? (
          filtered.length === 0 ? (
            <p>Aucun lieu.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
              {filtered.map((v) => (
                <li
                  key={v.id}
                  style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 8 }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start' }}>
                    <button
                      type="button"
                      onClick={() => navigate(`/venues/${v.id}`)}
                      style={{
                        flex: 1,
                        textAlign: 'left',
                        background: 'transparent',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        font: 'inherit',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>{v.name}</div>
                          <div style={{ color: '#4b5563' }}>{venueLocation(v)}</div>
                        </div>
                        <div
                          style={{
                            color: hasPlayedComputed(v, lastPlayedByVenueId) ? '#065f46' : '#6b7280',
                            fontSize: 13,
                          }}
                        >
                          {hasPlayedComputed(v, lastPlayedByVenueId) ? 'Déjà joué' : 'Jamais joué'}
                        </div>
                      </div>
                    </button>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteError(null);
                          setPendingDeleteVenue(v);
                        }}
                        disabled={deletingVenueId === v.id}
                        aria-label={`Supprimer ${v.name}`}
                        className="btn btn-danger btn-sm"
                      >
                        <Trash2 size={16} aria-hidden="true" />
                        Supprimer
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </section>
    </main>
  );
}
