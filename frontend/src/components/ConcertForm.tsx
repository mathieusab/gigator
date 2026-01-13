import { useEffect, useMemo, useState } from 'react';
import type { Concert, ConcertStatus, ConcertUpsertInput } from '../services/concerts';
import { listContacts, type Contact } from '../services/contacts';
import { listVenues, type Venue } from '../services/venues';

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function toDateTimeLocalValue(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function toIsoFromDateTimeLocal(localValue: string) {
  const d = new Date(localValue);
  if (Number.isNaN(d.getTime())) throw new Error('Invalid date');
  return d.toISOString();
}

export default function ConcertForm({
  initial,
  onSubmit,
  submitLabel,
  mode,
}: {
  initial?: Partial<Concert>;
  onSubmit: (input: ConcertUpsertInput) => Promise<void>;
  submitLabel: string;
  mode: 'create' | 'edit';
}) {
  const initialStart = useMemo(() => {
    if (initial?.date_start) return toDateTimeLocalValue(initial.date_start);
    const d = new Date();
    d.setHours(d.getHours() + 1);
    const minutes = d.getMinutes();
    const roundedUpMinutes = minutes % 5 === 0 ? minutes : minutes + (5 - (minutes % 5));
    d.setMinutes(roundedUpMinutes);
    d.setSeconds(0);
    d.setMilliseconds(0);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }, [initial?.date_start]);

  const [dateStart, setDateStart] = useState(initialStart);
  const [status, setStatus] = useState<ConcertStatus>(
    (initial?.status as ConcertStatus) ?? 'scheduled',
  );

  const [venues, setVenues] = useState<Venue[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [directoryError, setDirectoryError] = useState<string | null>(null);

  const [selectedVenueId, setSelectedVenueId] = useState<string>(initial?.venue_id ?? '');
  const [selectedContactId, setSelectedContactId] = useState<string>(initial?.contact_id ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    void (async () => {
      setDirectoryError(null);
      try {
        const [v, c] = await Promise.all([listVenues(), listContacts()]);
        if (!isMounted) return;
        setVenues(Array.isArray(v) ? v : []);
        setContacts(Array.isArray(c) ? c : []);
      } catch (e) {
        if (!isMounted) return;
        setDirectoryError(e instanceof Error ? e.message : 'Failed to load directories');
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const selectedVenue = useMemo(
    () => venues.find((x) => x.id === selectedVenueId) ?? null,
    [venues, selectedVenueId],
  );

  const selectedContact = useMemo(
    () => contacts.find((x) => x.id === selectedContactId) ?? null,
    [contacts, selectedContactId],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === 'create' && !selectedVenueId.trim()) {
      setError('La salle est requise.');
      return;
    }

    setIsSubmitting(true);
    try {
      const resolvedVenueId: string | null = selectedVenueId.trim() || null;
      const resolvedContactId: string | null = selectedContactId.trim() || null;

      const venueFromDirectory = resolvedVenueId ? selectedVenue : null;
      const venueName = venueFromDirectory?.name ?? initial?.venue_name ?? '';

      if (!venueName.trim()) {
        setError('La salle est requise.');
        return;
      }

      const input: ConcertUpsertInput = {
        date_start: toIsoFromDateTimeLocal(dateStart),
        status,
        venue_id: resolvedVenueId,
        contact_id: resolvedContactId,
        venue_name: venueName.trim(),
        city: venueFromDirectory?.city ?? initial?.city ?? null,
        country: venueFromDirectory?.country ?? initial?.country ?? null,
        address: venueFromDirectory?.address ?? initial?.address ?? null,
        lat: (() => {
          const raw = venueFromDirectory?.lat ?? initial?.lat ?? null;
          if (raw === null || raw === undefined) return null;
          const n = typeof raw === 'number' ? raw : Number(raw);
          return Number.isFinite(n) ? n : null;
        })(),
        lng: (() => {
          const raw = venueFromDirectory?.lng ?? initial?.lng ?? null;
          if (raw === null || raw === undefined) return null;
          const n = typeof raw === 'number' ? raw : Number(raw);
          return Number.isFinite(n) ? n : null;
        })(),
        notes: notes.trim() || null,
      };

      // If we attach a contact, we intentionally do not persist ad-hoc email/name on the concert.
      // Avoid overwriting legacy snapshot fields unless we explicitly set them.
      if (resolvedContactId) {
        input.venue_contact_name = null;
        input.venue_contact_email = null;
      }

      await onSubmit(input);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Enregistrement impossible');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
      {error ? (
        <p role="alert" style={{ color: 'crimson', margin: 0 }}>
          {error}
        </p>
      ) : null}

      {directoryError ? (
        <p role="alert" style={{ color: 'crimson', margin: 0 }}>
          {directoryError}
        </p>
      ) : null}

      <label style={{ display: 'grid', gap: 4 }}>
        <span>Date</span>
        <input
          type="datetime-local"
          value={dateStart}
          onChange={(e) => setDateStart(e.target.value)}
          required
        />
      </label>

      <label style={{ display: 'grid', gap: 4 }}>
        <span>Statut</span>
        <select value={status} onChange={(e) => setStatus(e.target.value as ConcertStatus)}>
          <option value="scheduled">scheduled</option>
          <option value="completed">completed</option>
          <option value="cancelled">cancelled</option>
        </select>
      </label>

      <label style={{ display: 'grid', gap: 4 }}>
        <span>Salle</span>
        <select
          value={selectedVenueId}
          onChange={(e) => setSelectedVenueId(e.target.value)}
          aria-label="Salle"
          required={mode === 'create'}
        >
          <option value="">— Choisir une salle —</option>
          {venues.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
              {v.city ? ` — ${v.city}` : ''}
              {v.country ? (v.city ? `, ${v.country}` : ` — ${v.country}`) : ''}
            </option>
          ))}
        </select>
        {!venues.length && !directoryError ? (
          <span style={{ fontSize: 12, color: '#6b7280' }}>
            Aucune salle dans l’annuaire.
          </span>
        ) : null}
        {mode === 'edit' && !selectedVenueId && initial?.venue_name ? (
          <span style={{ fontSize: 12, color: '#6b7280' }}>
            Concert non lié à une salle (valeur existante: {String(initial.venue_name)}).
          </span>
        ) : null}
      </label>

      <label style={{ display: 'grid', gap: 4 }}>
        <span>Contact</span>
        <select
          value={selectedContactId}
          onChange={(e) => setSelectedContactId(e.target.value)}
          aria-label="Contact"
        >
          <option value="">— Aucun —</option>
          {contacts.map((c) => {
            const label = (c.full_name ?? '').trim() || (c.email ?? '').trim() || c.id;
            return (
              <option key={c.id} value={c.id}>
                {label}
              </option>
            );
          })}
        </select>
        {mode === 'edit' && !selectedContactId && (initial?.venue_contact_name || initial?.venue_contact_email) ? (
          <span style={{ fontSize: 12, color: '#6b7280' }}>
            Concert non lié à un contact (infos existantes conservées).
          </span>
        ) : null}
        {selectedContact ? (
          <span style={{ fontSize: 12, color: '#6b7280' }}>
            {selectedContact.email ? `Email: ${selectedContact.email}` : 'Email non renseigné'}
          </span>
        ) : null}
      </label>

      <label style={{ display: 'grid', gap: 4 }}>
        <span>Notes</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Cachet, horaires, etc."
        />
      </label>

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'En cours…' : submitLabel}
      </button>
    </form>
  );
}
