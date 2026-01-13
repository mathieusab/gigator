import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import ConfirmDialog from '../components/ConfirmDialog';
import { useAuth } from '../lib/useAuth';
import { listConcerts, type Concert } from '../services/concerts';
import { autocompletePlaces, geocodePlace, type PlaceSuggestion } from '../services/mapsProxy';
import { createVenue, deleteVenue, listVenues, type Venue } from '../services/venues';

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

function compareVenuesForSalles(a: Venue, b: Venue, lastPlayed: LastPlayedByVenueId): number {
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
  const { session } = useAuth();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [lastPlayedByVenueId, setLastPlayedByVenueId] = useState<LastPlayedByVenueId>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingVenueId, setDeletingVenueId] = useState<string | null>(null);
  const [pendingDeleteVenue, setPendingDeleteVenue] = useState<Venue | null>(null);

  const [newName, setNewName] = useState('');
  const [resolvedCity, setResolvedCity] = useState<string | null>(null);
  const [resolvedRegion, setResolvedRegion] = useState<string | null>(null);
  const [resolvedCountry, setResolvedCountry] = useState<string | null>(null);
  const [resolvedPostalCode, setResolvedPostalCode] = useState<string | null>(null);
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [resolvedLat, setResolvedLat] = useState<number | null>(null);
  const [resolvedLng, setResolvedLng] = useState<number | null>(null);

  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const [isResolving, setIsResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const lastSuggestQueryRef = useRef<string>('');

  const [locationFilter, setLocationFilter] = useState('');
  const [playedFilter, setPlayedFilter] = useState<PlayedFilter>('all');

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

  useEffect(() => {
    const token = String(session?.access_token ?? '').trim();
    const input = newName.trim();

    // Keep suggestions quiet when not meaningful.
    if (!token || input.length < 3 || !showSuggestions) {
      setIsSuggesting(false);
      setSuggestions([]);
      return;
    }

    // If user edits after selecting a suggestion, clear resolved details.
    if (selectedPlaceId) setSelectedPlaceId(null);
    if (resolvedAddress || resolvedLat !== null || resolvedLng !== null) {
      setResolvedAddress(null);
      setResolvedCity(null);
      setResolvedRegion(null);
      setResolvedCountry(null);
      setResolvedPostalCode(null);
      setResolvedLat(null);
      setResolvedLng(null);
    }

    const current = input;
    lastSuggestQueryRef.current = current;

    setIsSuggesting(true);
    const t = setTimeout(() => {
      void (async () => {
        try {
          const items = await autocompletePlaces({
            appAccessToken: token,
            input: current,
            language: 'fr',
          });
          if (lastSuggestQueryRef.current !== current) return;
          setSuggestions(items);
        } catch {
          if (lastSuggestQueryRef.current !== current) return;
          setSuggestions([]);
        } finally {
          if (lastSuggestQueryRef.current === current) setIsSuggesting(false);
        }
      })();
    }, 300);

    return () => {
      clearTimeout(t);
    };
  }, [newName, session?.access_token, showSuggestions, selectedPlaceId, resolvedAddress, resolvedLat, resolvedLng]);

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

    items.sort((a, b) => compareVenuesForSalles(a, b, lastPlayedByVenueId));
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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setResolveError(null);
    const name = newName.trim();
    if (!name) {
      setCreateError('Le nom de la salle est requis.');
      return;
    }

    const token = String(session?.access_token ?? '').trim();
    if (!token) {
      setCreateError('Session manquante. Reconnectez-vous.');
      return;
    }

    let city = resolvedCity;
    let region = resolvedRegion;
    let country = resolvedCountry;
    let postal_code = resolvedPostalCode;
    let address = resolvedAddress;
    let lat = resolvedLat;
    let lng = resolvedLng;

    // If we don't have resolved details yet (or user typed a free name), resolve now.
    if (!address && lat === null && lng === null) {
      setIsResolving(true);
      try {
        const place = await geocodePlace({
          appAccessToken: token,
          query: name,
          placeId: selectedPlaceId ?? undefined,
          language: 'fr',
          region: 'fr',
        });

        address = place.address || place.formatted_address;
        city = place.city;
        region = place.region;
        country = place.country;
        postal_code = place.postal_code;
        lat = place.lat;
        lng = place.lng;

        setResolvedAddress(address);
        setResolvedCity(city);
        setResolvedRegion(region);
        setResolvedCountry(country);
        setResolvedPostalCode(postal_code);
        setResolvedLat(lat);
        setResolvedLng(lng);
      } catch (err) {
        setCreateError(err instanceof Error ? err.message : 'Résolution impossible');
        return;
      } finally {
        setIsResolving(false);
      }
    }

    // If Google didn't return anything useful, avoid creating unusable venues.
    if (!address && lat === null && lng === null) {
      setCreateError("Lieu introuvable. Essayez une orthographe différente.");
      return;
    }

    setIsCreating(true);
    try {
      const created = await createVenue({
        name,
        city,
        region,
        country,
        postal_code,
        address,
        lat,
        lng,
      });
      setVenues((prev) => {
        return [created, ...prev.filter((v) => v.id !== created.id)];
      });
      setNewName('');
      setSelectedPlaceId(null);
      setSuggestions([]);
      setShowSuggestions(false);
      setResolvedAddress(null);
      setResolvedCity(null);
      setResolvedRegion(null);
      setResolvedCountry(null);
      setResolvedPostalCode(null);
      setResolvedLat(null);
      setResolvedLng(null);
    } catch (e2) {
      setCreateError(e2 instanceof Error ? e2.message : 'Création impossible');
    } finally {
      setIsCreating(false);
    }
  }

  async function handlePickSuggestion(s: PlaceSuggestion) {
    setResolveError(null);
    setSelectedPlaceId(s.place_id);
    setShowSuggestions(false);
    setSuggestions([]);

    if (s.name) setNewName(s.name);

    const token = String(session?.access_token ?? '').trim();
    if (!token) return;

    setIsResolving(true);
    try {
      const place = await geocodePlace({
        appAccessToken: token,
        placeId: s.place_id,
        language: 'fr',
        region: 'fr',
      });

      setResolvedAddress(place.address || place.formatted_address);
      setResolvedCity(place.city);
      setResolvedRegion(place.region);
      setResolvedCountry(place.country);
      setResolvedPostalCode(place.postal_code);
      setResolvedLat(place.lat);
      setResolvedLng(place.lng);

      if (!place.address && !place.formatted_address && place.lat === null && place.lng === null) {
        setResolveError('Aucune info exploitable trouvée.');
      }
    } catch (e) {
      setResolveError(e instanceof Error ? e.message : 'Résolution impossible');
    } finally {
      setIsResolving(false);
    }
  }

  return (
    <main
      style={{ padding: 24, fontFamily: 'system-ui, sans-serif', maxWidth: 900, margin: '0 auto' }}
    >
      <ConfirmDialog
        open={pendingDeleteVenue !== null}
        title={pendingDeleteVenue ? `Supprimer \"${pendingDeleteVenue.name}\" ?` : 'Supprimer cette salle ?'}
        description={
          pendingDeleteVenue
            ? "Cette action est définitive. Si la salle est liée à des concerts/contacts, la suppression peut être refusée."
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
        <h1 style={{ margin: 0 }}>Salles</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => navigate('/')}>Retour</button>
        </div>
      </header>

      <section style={{ marginTop: 16, display: 'grid', gap: 12 }}>
        <form
          onSubmit={handleCreate}
          style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 8, display: 'grid', gap: 10 }}
        >
          <div style={{ fontWeight: 700 }}>Ajouter une salle</div>

          {resolveError ? (
            <p role="alert" style={{ color: 'crimson', margin: 0 }}>
              {resolveError}
            </p>
          ) : null}

          {createError ? (
            <p role="alert" style={{ color: 'crimson', margin: 0 }}>
              {createError}
            </p>
          ) : null}

          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '2fr 1fr 1fr' }}>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 12, color: '#6b7280' }}>Nom</span>
              <div style={{ position: 'relative' }}>
                <input
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => {
                    // Let click handlers run before hiding.
                    setTimeout(() => setShowSuggestions(false), 150);
                  }}
                  placeholder="Le Bikini"
                  autoComplete="off"
                />

                {showSuggestions && (isSuggesting || suggestions.length > 0) ? (
                  <div
                    style={{
                      position: 'absolute',
                      zIndex: 10,
                      top: 'calc(100% + 6px)',
                      left: 0,
                      right: 0,
                      background: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: 8,
                      overflow: 'hidden',
                      boxShadow: '0 10px 20px rgba(0,0,0,0.08)',
                    }}
                  >
                    {isSuggesting ? (
                      <div style={{ padding: 10, fontSize: 13, color: '#6b7280' }}>Recherche…</div>
                    ) : null}
                    {suggestions.map((s) => (
                      <button
                        key={s.place_id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          void handlePickSuggestion(s);
                        }}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: 10,
                          border: 'none',
                          background: 'white',
                          cursor: 'pointer',
                          display: 'grid',
                          gap: 2,
                        }}
                      >
                        <div style={{ fontWeight: 650 }}>{s.name ?? s.description ?? 'Lieu'}</div>
                        {s.secondary_text ? (
                          <div style={{ fontSize: 12, color: '#6b7280' }}>{s.secondary_text}</div>
                        ) : null}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </label>
            <div />
            <div />
          </div>

          {resolvedAddress || resolvedCity || resolvedCountry ? (
            <div style={{ fontSize: 13, color: '#4b5563' }}>
              Résolu: {[resolvedAddress, resolvedCity, resolvedCountry].filter(Boolean).join(' · ')}
            </div>
          ) : null}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="submit" disabled={isCreating || isResolving}>
              {isCreating ? 'Création…' : isResolving ? 'Recherche…' : 'Ajouter'}
            </button>
          </div>
        </form>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 12, color: '#6b7280' }}>Filtrer (lieu)</span>
            <input
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              placeholder="Ville, pays…"
            />
          </label>

          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 12, color: '#6b7280' }}>Déjà joué</span>
            <select
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
            <p>Aucune salle.</p>
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
                        style={{
                          background: deletingVenueId === v.id ? '#f3f4f6' : '#fee2e2',
                          border: '1px solid #fecaca',
                          color: '#991b1b',
                        }}
                      >
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
