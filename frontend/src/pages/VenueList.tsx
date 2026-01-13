import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { createVenue, listVenues, type Venue } from '../services/venues';

type PlayedFilter = 'all' | 'played' | 'not_played';

function venueLocation(v: Venue): string {
  return [v.city, v.region, v.country].filter(Boolean).join(', ');
}

export default function VenueList() {
  const navigate = useNavigate();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newCountry, setNewCountry] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newLat, setNewLat] = useState('');
  const [newLng, setNewLng] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

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
    const name = newName.trim();
    if (!name) {
      setCreateError('Le nom de la salle est requis.');
      return;
    }

    const lat = newLat.trim() ? Number(newLat) : null;
    const lng = newLng.trim() ? Number(newLng) : null;
    if (lat !== null && !Number.isFinite(lat)) {
      setCreateError('Latitude invalide.');
      return;
    }
    if (lng !== null && !Number.isFinite(lng)) {
      setCreateError('Longitude invalide.');
      return;
    }

    setIsCreating(true);
    try {
      const created = await createVenue({
        name,
        city: newCity.trim() || null,
        country: newCountry.trim() || null,
        address: newAddress.trim() || null,
        lat,
        lng,
      });
      setVenues((prev) => {
        const next = [created, ...prev.filter((v) => v.id !== created.id)];
        next.sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? '')));
        return next;
      });
      setNewName('');
      setNewCity('');
      setNewCountry('');
      setNewAddress('');
      setNewLat('');
      setNewLng('');
    } catch (e2) {
      setCreateError(e2 instanceof Error ? e2.message : 'Création impossible');
    } finally {
      setIsCreating(false);
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

          {createError ? (
            <p role="alert" style={{ color: 'crimson', margin: 0 }}>
              {createError}
            </p>
          ) : null}

          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '2fr 1fr 1fr' }}>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 12, color: '#6b7280' }}>Nom</span>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Le Bikini" />
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 12, color: '#6b7280' }}>Ville</span>
              <input value={newCity} onChange={(e) => setNewCity(e.target.value)} placeholder="Toulouse" />
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 12, color: '#6b7280' }}>Pays</span>
              <input value={newCountry} onChange={(e) => setNewCountry(e.target.value)} placeholder="France" />
            </label>
          </div>

          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '2fr 1fr 1fr' }}>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 12, color: '#6b7280' }}>Adresse</span>
              <input value={newAddress} onChange={(e) => setNewAddress(e.target.value)} placeholder="Rue …" />
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 12, color: '#6b7280' }}>Lat</span>
              <input value={newLat} onChange={(e) => setNewLat(e.target.value)} inputMode="decimal" placeholder="43.6043" />
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 12, color: '#6b7280' }}>Lng</span>
              <input value={newLng} onChange={(e) => setNewLng(e.target.value)} inputMode="decimal" placeholder="1.4437" />
            </label>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="submit" disabled={isCreating}>
              {isCreating ? 'Création…' : 'Ajouter'}
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
