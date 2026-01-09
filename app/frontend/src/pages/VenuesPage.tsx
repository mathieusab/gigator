import { useEffect, useState } from 'react';
import { apiFetch } from '../api';

type Venue = {
  id: string;
  name: string;
  city: string;
  notes?: string | null;
};

export function VenuesPage() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    const data = await apiFetch<Venue[]>('/api/venues');
    setVenues(data);
  }

  useEffect(() => {
    load().catch((e: any) => setError(e?.message || e?.error || 'Erreur'));
  }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch<Venue>('/api/venues', {
        method: 'POST',
        body: JSON.stringify({ name, city, notes: notes.trim() ? notes : undefined })
      });
      setName('');
      setCity('');
      setNotes('');
      await load();
    } catch (e: any) {
      setError(e?.message || e?.error || 'Erreur');
    }
  }

  return (
    <main>
      <h2>Salles</h2>

      <form onSubmit={onCreate} style={{ display: 'grid', gap: 8, marginBottom: 16, maxWidth: 520 }}>
        <label>
          Nom
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          Ville
          <input value={city} onChange={(e) => setCity(e.target.value)} required />
        </label>
        <label>
          Notes
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <button type="submit">Créer</button>
      </form>

      {error ? (
        <p role="alert">Erreur: {error}</p>
      ) : null}

      <ul>
        {venues.map((v) => (
          <li key={v.id}>
            <strong>{v.name}</strong> — {v.city}
          </li>
        ))}
      </ul>
    </main>
  );
}
