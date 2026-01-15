import { useEffect, useRef, useState } from 'react';

import { useAuth } from '../lib/useAuth';
import { autocompletePlaces, geocodePlace, type PlaceSuggestion } from '../services/mapsProxy';
import { createVenueWithInfo, type Venue, type CreateVenueResult } from '../services/venues';

export default function VenueCreateForm({
  onCreated,
  onResult,
}: {
  onCreated?: (created: Venue) => void;
  onResult?: (result: CreateVenueResult) => void;
}) {
  const { session } = useAuth();

  const [newName, setNewName] = useState('');
  const [resolvedCity, setResolvedCity] = useState<string | null>(null);
  const [resolvedRegion, setResolvedRegion] = useState<string | null>(null);
  const [resolvedCountry, setResolvedCountry] = useState<string | null>(null);
  const [resolvedPostalCode, setResolvedPostalCode] = useState<string | null>(null);
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [resolvedLat, setResolvedLat] = useState<number | null>(null);
  const [resolvedLng, setResolvedLng] = useState<number | null>(null);

  const [createError, setCreateError] = useState<string | null>(null);
  const [createInfo, setCreateInfo] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const [isResolving, setIsResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const lastSuggestQueryRef = useRef<string>('');

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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setResolveError(null);
    setCreateInfo(null);
    const name = newName.trim();
    if (!name) {
      setCreateError('Le nom du lieu est requis.');
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
      setCreateError('Lieu introuvable. Essayez une orthographe différente.');
      return;
    }

    setIsCreating(true);
    try {
      const result = await createVenueWithInfo({
        name,
        city,
        region,
        country,
        postal_code,
        address,
        lat,
        lng,
      });

      const created = result.venue;

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

      onResult?.(result);
      if (!onResult && result.existed) setCreateInfo('Ce lieu existait déjà — lieu existant réutilisé.');
      onCreated?.(created);
    } catch (e2) {
      setCreateError(e2 instanceof Error ? e2.message : 'Création impossible');
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <form
      onSubmit={handleCreate}
      style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 8, display: 'grid', gap: 10 }}
    >
      <div style={{ fontWeight: 700 }}>Ajouter un lieu</div>

      {resolveError ? (
        <p role="alert" style={{ color: 'crimson', margin: 0 }}>
          {resolveError}
        </p>
      ) : null}

      {createInfo ? (
        <p role="status" style={{ color: '#065f46', margin: 0 }}>
          {createInfo}
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
  );
}
