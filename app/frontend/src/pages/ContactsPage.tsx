import { useEffect, useState } from 'react';
import { apiFetch } from '../api';

type Contact = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  instagram?: string | null;
  notes?: string | null;
};

type Venue = { id: string; name: string; city: string };

type ContactVenueLink = { id: string; contact_id: string; venue_id: string };

export function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [instagram, setInstagram] = useState('');
  const [notes, setNotes] = useState('');

  const [linkContactId, setLinkContactId] = useState<string>('');
  const [linkVenueId, setLinkVenueId] = useState<string>('');

  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    const [c, v] = await Promise.all([apiFetch<Contact[]>('/api/contacts'), apiFetch<Venue[]>('/api/venues')]);
    setContacts(c);
    setVenues(v);
    if (!linkContactId && c[0]?.id) setLinkContactId(c[0].id);
    if (!linkVenueId && v[0]?.id) setLinkVenueId(v[0].id);
  }

  useEffect(() => {
    load().catch((e: any) => setError(e?.message || e?.error || 'Erreur'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch<Contact>('/api/contacts', {
        method: 'POST',
        body: JSON.stringify({
          name,
          email: email.trim() ? email : undefined,
          phone: phone.trim() ? phone : undefined,
          instagram: instagram.trim() ? instagram : undefined,
          notes: notes.trim() ? notes : undefined
        })
      });
      setName('');
      setEmail('');
      setPhone('');
      setInstagram('');
      setNotes('');
      await load();
    } catch (e: any) {
      setError(e?.message || e?.error || 'Erreur');
    }
  }

  async function onLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!linkContactId || !linkVenueId) {
      setError('Choisis un contact et une salle');
      return;
    }
    try {
      await apiFetch<ContactVenueLink>(`/api/contacts/${encodeURIComponent(linkContactId)}/venues`, {
        method: 'POST',
        body: JSON.stringify({ venue_id: linkVenueId })
      });
      await load();
    } catch (e: any) {
      setError(e?.message || e?.error || 'Erreur');
    }
  }

  return (
    <main>
      <h2>Contacts</h2>

      <form onSubmit={onCreate} style={{ display: 'grid', gap: 8, marginBottom: 16, maxWidth: 520 }}>
        <label>
          Nom
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Téléphone
          <input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <label>
          Instagram
          <input value={instagram} onChange={(e) => setInstagram(e.target.value)} />
        </label>
        <label>
          Notes
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <button type="submit">Créer</button>
      </form>

      <h3>Lier contact ↔ salle</h3>
      <form onSubmit={onLink} style={{ display: 'grid', gap: 8, marginBottom: 16, maxWidth: 520 }}>
        <label>
          Contact
          <select value={linkContactId} onChange={(e) => setLinkContactId(e.target.value)}>
            <option value="">—</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Salle
          <select value={linkVenueId} onChange={(e) => setLinkVenueId(e.target.value)}>
            <option value="">—</option>
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} — {v.city}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Lier</button>
      </form>

      {error ? (
        <p role="alert">Erreur: {error}</p>
      ) : null}

      <ul>
        {contacts.map((c) => (
          <li key={c.id}>
            <strong>{c.name}</strong>
            {c.email ? ` — ${c.email}` : ''}
          </li>
        ))}
      </ul>
    </main>
  );
}
