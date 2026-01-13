import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../lib/useAuth';
import { autocompletePlaces, geocodePlace, type PlaceSuggestion } from '../services/mapsProxy';
import { createVenue, listVenues, type Venue } from '../services/venues';

type PlayedFilter = 'all' | 'played' | 'not_played';

function venueLocation(v: Venue): string {
  return [v.city, v.region, v.country].filter(Boolean).join(', ');
}

export default function VenueList() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        const items = await listVenues();
        if (!isMounted) return;
        setVenues(items);
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
    return venues.filter((v) => {
      if (playedFilter === 'played' && !v.has_played) return false;
      if (playedFilter === 'not_played' && v.has_played) return false;

      if (!q) return true;
      const haystack = [v.name, v.city, v.region, v.country, v.address]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [venues, locationFilter, playedFilter]);

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
        const next = [created, ...prev.filter((v) => v.id !== created.id)];
        next.sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? '')));
        return next;
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
                  <button
                    type="button"
                    onClick={() => navigate(`/venues/${v.id}`)}
                    style={{
                      width: '100%',
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
                      <div style={{ color: v.has_played ? '#065f46' : '#6b7280', fontSize: 13 }}>
                        {v.has_played ? 'Déjà joué' : 'Jamais joué'}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </section>
    </main>
  );
}
