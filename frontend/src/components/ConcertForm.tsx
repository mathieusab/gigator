import { useEffect, useMemo, useState } from 'react';
import type { Concert, ConcertStatus, ConcertUpsertInput } from '../services/concerts';
import { formatConcertStatusFr } from '../lib/concertStatus';
import {
  CONCERT_CONTACT_CATEGORIES,
  type ConcertContactCategory,
  type ConcertContactLinkInput,
} from '../services/concertContactLinks';
import { listContacts, type Contact } from '../services/contacts';
import { listVenues, type Venue } from '../services/venues';
import ContactCreateForm from './ContactCreateForm';
import Modal from './Modal';
import VenueCreateForm from './VenueCreateForm';

function deriveConcertTitle(title: string, venueName: string, city?: string | null) {
  const explicit = String(title ?? '').trim();
  if (explicit) return explicit;

  const venue = String(venueName ?? '').trim();
  const c = String(city ?? '').trim();
  if (!venue) return '';
  return c ? `${venue} — ${c}` : venue;
}

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
  initialContactLinks,
}: {
  initial?: Partial<Concert>;
  onSubmit: (input: ConcertUpsertInput, contactLinks: ConcertContactLinkInput[]) => Promise<void>;
  submitLabel: string;
  mode: 'create' | 'edit';
  initialContactLinks?: ConcertContactLinkInput[];
}) {
  type ContactRow = {
    contactId: string;
    category: ConcertContactCategory | '';
  };

  const initialStart = useMemo(() => {
    if (initial?.date_start) return toDateTimeLocalValue(initial.date_start);
    return '';
  }, [initial?.date_start]);

  const initialDerivedTitle = useMemo(() => {
    return deriveConcertTitle('', initial?.venue_name ?? '', initial?.city ?? null);
  }, [initial?.venue_name, initial?.city]);

  const [title, setTitle] = useState(() => String(initial?.title ?? '').trim());
  const [isTitleAuto, setIsTitleAuto] = useState(() => {
    const existing = String(initial?.title ?? '').trim();
    if (!existing) return true;
    return existing === initialDerivedTitle;
  });

  const [dateStart, setDateStart] = useState(initialStart);
  const [isDateTbd, setIsDateTbd] = useState(() => !initial?.date_start);
  const [status, setStatus] = useState<ConcertStatus>(
    (initial?.status as ConcertStatus) ?? 'scheduled',
  );

  const [venues, setVenues] = useState<Venue[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [directoryError, setDirectoryError] = useState<string | null>(null);

  const [isVenueCreateOpen, setIsVenueCreateOpen] = useState(false);
  const [isContactCreateOpen, setIsContactCreateOpen] = useState(false);

  const [selectedVenueId, setSelectedVenueId] = useState<string>(initial?.venue_id ?? '');
  const [selectedContactRows, setSelectedContactRows] = useState<ContactRow[]>(() => {
    const fromLinks = (initialContactLinks ?? [])
      .map((l) => ({
        contactId: String(l.contact_id ?? '').trim(),
        category: (l.category ?? '') as ConcertContactCategory | '',
      }))
      .filter((l) => Boolean(l.contactId));

    if (fromLinks.length) return fromLinks;
    if (initial?.contact_id) return [{ contactId: initial.contact_id, category: '' }];
    return [];
  });
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
    const ids = new Set(selectedContactRows.map((r) => r.contactId));
    return contacts.filter((c) => ids.has(c.id));
  }, [contacts, selectedContactRows]);

  const primaryContact = selectedContacts[0] ?? null;

  const hasSelectedContacts = useMemo(
    () => selectedContactRows.some((x) => String(x.contactId).trim().length > 0),
    [selectedContactRows],
  );

  const contactRows = useMemo(() => {
    if (selectedContactRows.length) return selectedContactRows;
    return [{ contactId: '', category: '' }];
  }, [selectedContactRows]);

  function addContactRow() {
    setSelectedContactRows((prev) => (prev.length ? [...prev, { contactId: '', category: '' }] : [{ contactId: '', category: '' }, { contactId: '', category: '' }]));
  }

  function removeContactRow(index: number) {
    setSelectedContactRows((prev) => {
      if (prev.length <= 1) return [];
      const next = prev.filter((_, i) => i !== index);
      return next;
    });
  }

  function setContactRowContactId(index: number, contactId: string) {
    setSelectedContactRows((prev) => {
      const next = prev.slice();
      next[index] = { ...next[index], contactId };
      return next;
    });
  }

  function setContactRowCategory(index: number, category: string) {
    setSelectedContactRows((prev) => {
      const next = prev.slice();
      next[index] = { ...next[index], category: (category as ConcertContactCategory) || '' };
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === 'create' && !selectedVenueId.trim()) {
      setError('Le lieu est requis.');
      return;
    }

    setIsSubmitting(true);
    try {
      const resolvedVenueId: string | null = selectedVenueId.trim() || null;
      const normalizedRows = contactRows
        .map((r) => ({
          contactId: String(r.contactId ?? '').trim(),
          category: (r.category ?? '') as ConcertContactCategory | '',
        }))
        .filter((r) => Boolean(r.contactId));

      const seen = new Set<string>();
      const uniqueRows = normalizedRows.filter((r) => {
        if (seen.has(r.contactId)) return false;
        seen.add(r.contactId);
        return true;
      });

      const resolvedPrimaryContactId: string | null = uniqueRows[0]?.contactId ?? null;
      const resolvedContactLinks: ConcertContactLinkInput[] = uniqueRows.map((r) => ({
        contact_id: r.contactId,
        category: r.category ? (r.category as ConcertContactCategory) : null,
      }));

      const venueFromDirectory = resolvedVenueId ? selectedVenue : null;
      const venueName = venueFromDirectory?.name ?? initial?.venue_name ?? '';

      if (!venueName.trim()) {
        setError('Le lieu est requis.');
        return;
      }

      const input: ConcertUpsertInput = {
        title: deriveConcertTitle(
          title,
          venueName.trim(),
          venueFromDirectory?.city ?? initial?.city ?? null,
        ),
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

      await onSubmit(input, resolvedContactLinks);
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
        <span>Nom du concert</span>
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setIsTitleAuto(false);
          }}
          placeholder={selectedVenue ? deriveConcertTitle('', selectedVenue.name, selectedVenue.city ?? null) : 'Ex: Release party'}
          aria-label="Nom du concert"
        />
        <span style={{ fontSize: 12, color: '#6b7280' }}>
          Optionnel. Si vide, il sera généré automatiquement (lieu — ville).
        </span>
      </label>

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
          <option value="scheduled">{formatConcertStatusFr('scheduled')}</option>
          <option value="completed">{formatConcertStatusFr('completed')}</option>
          <option value="cancelled">{formatConcertStatusFr('cancelled')}</option>
        </select>
      </label>
      <label style={{ display: 'grid', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <span>Lieu</span>
          <button type="button" onClick={() => setIsVenueCreateOpen(true)}>
            Nouveau lieu
          </button>
        </div>
        <select
          value={selectedVenueId}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
            const nextId = e.target.value;
            setSelectedVenueId(nextId);

            if (!isTitleAuto) return;

            const v = venues.find((x) => x.id === nextId) ?? null;
            if (!v) return;
            setTitle(deriveConcertTitle('', v.name, v.city ?? null));
          }}
          aria-label="Lieu"
          required={mode === 'create'}
        >
          <option value="">— Choisir un lieu —</option>
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
            Aucun lieu dans l’annuaire.
          </span>
        ) : null}
        {mode === 'edit' && !selectedVenueId && initial?.venue_name ? (
          <span style={{ fontSize: 12, color: '#6b7280' }}>
            Concert non lié à un lieu (valeur existante: {String(initial.venue_name)}).
          </span>
        ) : null}
      </label>

      <div style={{ display: 'grid', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <span>Contacts</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => setIsContactCreateOpen(true)}>
              Nouveau contact
            </button>
            <button type="button" onClick={() => setSelectedContactRows([])} disabled={!hasSelectedContacts}>
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
          {contactRows.map((row, idx) => {
            const alreadySelected = new Set(
              contactRows
                .filter((_, i) => i !== idx)
                .map((x) => String(x.contactId).trim())
                .filter(Boolean),
            );

            return (
              <div key={`contact-row-${idx}`} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select
                  value={row.contactId}
                  onChange={(e) => setContactRowContactId(idx, e.target.value)}
                  aria-label={idx === 0 ? 'Contact principal' : `Contact ${idx + 1}`}
                  style={{ flex: 1, minWidth: 220 }}
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

                <select
                  value={row.category}
                  onChange={(e) => setContactRowCategory(idx, e.target.value)}
                  aria-label={idx === 0 ? 'Catégorie du contact principal' : `Catégorie du contact ${idx + 1}`}
                  style={{ width: 200 }}
                >
                  <option value="">— Catégorie —</option>
                  {CONCERT_CONTACT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                <button type="button" onClick={() => removeContactRow(idx)} disabled={contactRows.length <= 1}>
                  Retirer
                </button>
              </div>
            );
          })}
        </div>

        {mode === 'edit' && !selectedContactRows.map((x) => x.contactId.trim()).filter(Boolean).length && (initial?.venue_contact_name || initial?.venue_contact_email) ? (
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
        />
      </label>

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'En cours…' : submitLabel}
      </button>

      <Modal
        open={isVenueCreateOpen}
        title="Nouveau lieu"
        onClose={() => setIsVenueCreateOpen(false)}
        widthPx={820}
      >
        <VenueCreateForm
          onCreated={(created) => {
            setVenues((prev) => [created, ...prev.filter((v) => v.id !== created.id)]);
            setSelectedVenueId(created.id);
            setIsVenueCreateOpen(false);
          }}
        />
      </Modal>

      <Modal
        open={isContactCreateOpen}
        title="Nouveau contact"
        onClose={() => setIsContactCreateOpen(false)}
      >
        <ContactCreateForm
          onCreated={(created) => {
            setContacts((prev) => [created, ...prev.filter((c) => c.id !== created.id)]);

            setSelectedContactRows((prev) => {
              const normalized = prev.length ? prev : [{ contactId: '', category: '' as const }];

              if (normalized.some((r) => r.contactId === created.id)) return normalized;

              const idx = normalized.findIndex((r) => !String(r.contactId ?? '').trim());
              if (idx >= 0) {
                const next = normalized.slice();
                next[idx] = { ...next[idx], contactId: created.id };
                return next;
              }

              return [...normalized, { contactId: created.id, category: '' as const }];
            });

            setIsContactCreateOpen(false);
          }}
        />
      </Modal>
    </form>
  );
}
