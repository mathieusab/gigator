import { useEffect, useMemo, useState } from 'react';
import type { Concert, ConcertStatus, ConcertUpsertInput } from '../services/concerts';
import { listContacts, type Contact } from '../services/contacts';
import { listVenues, type Venue } from '../services/venues';

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function defaultLocalStartValue() {
  const d = new Date();
  d.setHours(d.getHours() + 1);
  const minutes = d.getMinutes();
  const roundedUpMinutes = minutes % 5 === 0 ? minutes : minutes + (5 - (minutes % 5));
  d.setMinutes(roundedUpMinutes);
  d.setSeconds(0);
  d.setMilliseconds(0);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
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
  onSubmit: (input: ConcertUpsertInput, contactIds: string[]) => Promise<void>;
  submitLabel: string;
  mode: 'create' | 'edit';
}) {
  const initialStart = useMemo(() => {
    if (initial?.date_start) return toDateTimeLocalValue(initial.date_start);
    return '';
  }, [initial?.date_start]);

  const [dateStart, setDateStart] = useState(initialStart);
  const [isDateTbd, setIsDateTbd] = useState(() => !initial?.date_start);
  const [status, setStatus] = useState<ConcertStatus>(
    (initial?.status as ConcertStatus) ?? 'scheduled',
  );

  const [venues, setVenues] = useState<Venue[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [directoryError, setDirectoryError] = useState<string | null>(null);

  const [selectedVenueId, setSelectedVenueId] = useState<string>(initial?.venue_id ?? '');
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>(() =>
    initial?.contact_id ? [initial.contact_id] : [],
  );
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

  const selectedContacts = useMemo(() => {
    const ids = new Set(selectedContactIds);
    return contacts.filter((c) => ids.has(c.id));
  }, [contacts, selectedContactIds]);

  const primaryContact = selectedContacts[0] ?? null;

  const hasSelectedContacts = useMemo(
    () => selectedContactIds.some((x) => String(x).trim().length > 0),
    [selectedContactIds],
  );

  const contactRows = useMemo(
    () => (selectedContactIds.length ? selectedContactIds : ['']),
    [selectedContactIds],
  );

  function addContactRow() {
    setSelectedContactIds((prev) => (prev.length ? [...prev, ''] : ['', '']));
  }

  function removeContactRow(index: number) {
    setSelectedContactIds((prev) => {
      if (prev.length <= 1) return [''];
      const next = prev.filter((_, i) => i !== index);
      return next.length ? next : [''];
    });
  }

  function setContactRowValue(index: number, contactId: string) {
    setSelectedContactIds((prev) => {
      const next = prev.slice();
      next[index] = contactId;
      return next;
    });
  }

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
      const resolvedContactIds: string[] = Array.from(
        new Set(selectedContactIds.map((x) => String(x).trim()).filter(Boolean)),
      );
      const resolvedPrimaryContactId: string | null = resolvedContactIds[0] ?? null;

      const venueFromDirectory = resolvedVenueId ? selectedVenue : null;
      const venueName = venueFromDirectory?.name ?? initial?.venue_name ?? '';

      if (!venueName.trim()) {
        setError('La salle est requise.');
        return;
      }

      const input: ConcertUpsertInput = {
        date_start: isDateTbd ? null : dateStart.trim() ? toIsoFromDateTimeLocal(dateStart) : null,
        status,
        venue_id: resolvedVenueId,
        contact_id: resolvedPrimaryContactId,
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
      if (resolvedPrimaryContactId) {
        input.venue_contact_name = null;
        input.venue_contact_email = null;
      }

      await onSubmit(input, resolvedContactIds);
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

      <div style={{ display: 'grid', gap: 6 }}>
        <label htmlFor="concert-date-start">Date</label>
        <input
          id="concert-date-start"
          type="datetime-local"
          value={dateStart}
          onChange={(e) => {
            const v = e.target.value;
            setDateStart(v);
            if (v.trim()) setIsDateTbd(false);
          }}
          aria-label="Date"
        />
        <label
          style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: '#4b5563' }}
        >
          <input
            type="checkbox"
            checked={isDateTbd}
            onChange={(e) => {
              if (e.target.checked) {
                setIsDateTbd(true);
                setDateStart('');
                return;
              }

              // If the user re-enables the date, provide a sensible default.
              setIsDateTbd(false);
              setDateStart(defaultLocalStartValue());
            }}
          />
          Date à définir
        </label>
      </div>

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

      <div style={{ display: 'grid', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <span>Contacts</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => setSelectedContactIds([''])} disabled={!hasSelectedContacts}>
              Aucun
            </button>
            <button type="button" onClick={addContactRow} disabled={!contacts.length}>
              + Ajouter un contact
            </button>
          </div>
        </div>

        {!contacts.length && !directoryError ? (
          <span style={{ fontSize: 12, color: '#6b7280' }}>Aucun contact dans l’annuaire.</span>
        ) : null}

        <div role="group" aria-label="Contacts" style={{ display: 'grid', gap: 8 }}>
          {contactRows.map((value, idx) => {
            const alreadySelected = new Set(
              contactRows
                .filter((_, i) => i !== idx)
                .map((x) => String(x).trim())
                .filter(Boolean),
            );

            return (
              <div key={`contact-row-${idx}`} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select
                  value={value}
                  onChange={(e) => setContactRowValue(idx, e.target.value)}
                  aria-label={idx === 0 ? 'Contact principal' : `Contact ${idx + 1}`}
                  style={{ flex: 1 }}
                >
                  <option value="">— Choisir un contact —</option>
                  {contacts.map((c) => {
                    const label = (c.full_name ?? '').trim() || (c.email ?? '').trim() || c.id;
                    const disabled = alreadySelected.has(c.id);
                    return (
                      <option key={c.id} value={c.id} disabled={disabled}>
                        {label}
                      </option>
                    );
                  })}
                </select>

                <button type="button" onClick={() => removeContactRow(idx)} disabled={contactRows.length <= 1}>
                  Retirer
                </button>
              </div>
            );
          })}
        </div>

        {mode === 'edit' && !selectedContactIds.map((x) => x.trim()).filter(Boolean).length && (initial?.venue_contact_name || initial?.venue_contact_email) ? (
          <span style={{ fontSize: 12, color: '#6b7280' }}>
            Concert non lié à un contact (infos existantes conservées).
          </span>
        ) : null}

        {primaryContact ? (
          <span style={{ fontSize: 12, color: '#6b7280' }}>
            Contact principal: {(primaryContact.full_name ?? '').trim() || primaryContact.id}
            {primaryContact.email ? ` — ${primaryContact.email}` : ''}
            {selectedContacts.length > 1 ? ` (+${selectedContacts.length - 1})` : ''}
          </span>
        ) : null}
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
