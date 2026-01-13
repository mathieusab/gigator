import { useMemo, useState } from 'react';
import type { Concert, ConcertStatus, ConcertUpsertInput } from '../services/concerts';

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
}: {
  initial?: Partial<Concert>;
  onSubmit: (input: ConcertUpsertInput) => Promise<void>;
  submitLabel: string;
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
  const [venueName, setVenueName] = useState(initial?.venue_name ?? '');
  const [city, setCity] = useState(initial?.city ?? '');
  const [country, setCountry] = useState(initial?.country ?? '');
  const [address, setAddress] = useState(initial?.address ?? '');
  const [lat, setLat] = useState(initial?.lat?.toString?.() ?? '');
  const [lng, setLng] = useState(initial?.lng?.toString?.() ?? '');
  const [contactName, setContactName] = useState(initial?.venue_contact_name ?? '');
  const [contactEmail, setContactEmail] = useState(initial?.venue_contact_email ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!venueName.trim()) {
      setError('Le nom de la salle est requis.');
      return;
    }
    if (!city.trim()) {
      setError('La ville est requise.');
      return;
    }

    setIsSubmitting(true);
    try {
      const input = {
        date_start: toIsoFromDateTimeLocal(dateStart),
        status,
        venue_name: venueName.trim(),
        city: city.trim(),
        country: country.trim() || null,
        address: address.trim() || null,
        lat: lat.trim() ? Number(lat) : null,
        lng: lng.trim() ? Number(lng) : null,
        venue_contact_name: contactName.trim() || null,
        venue_contact_email: contactEmail.trim() || null,
        notes: notes.trim() || null,
      } satisfies ConcertUpsertInput;

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
        <input
          value={venueName}
          onChange={(e) => setVenueName(e.target.value)}
          placeholder="Le Bikini"
          required
        />
      </label>

      <label style={{ display: 'grid', gap: 4 }}>
        <span>Ville</span>
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Toulouse"
          required
        />
      </label>

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
        <label style={{ display: 'grid', gap: 4 }}>
          <span>Pays</span>
          <input
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="France"
          />
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span>Adresse</span>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Rue ..."
          />
        </label>
      </div>

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
        <label style={{ display: 'grid', gap: 4 }}>
          <span>Lat</span>
          <input
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            inputMode="decimal"
            placeholder="43.6043"
          />
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span>Lng</span>
          <input
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            inputMode="decimal"
            placeholder="1.4437"
          />
        </label>
      </div>

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
        <label style={{ display: 'grid', gap: 4 }}>
          <span>Contact</span>
          <input
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="Prénom Nom"
          />
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span>Email</span>
          <input
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            inputMode="email"
            placeholder="contact@salle.com"
          />
        </label>
      </div>

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
