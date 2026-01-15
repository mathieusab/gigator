import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import ConfirmDialog from '../components/ConfirmDialog';
import { listContacts, type Contact } from '../services/contacts';
import { getVenue, type Venue } from '../services/venues';
import {
  deleteVenueContactLink,
  listContactsForVenue,
  upsertVenueContactLink,
  VENUE_CONTACT_RELATION_TYPES,
  type VenueContactLinkWithContact,
} from '../services/venueContactLinks';

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return new Intl.NumberFormat().format(value);
}

function safeUrl(value: string | null | undefined): string {
  const v = String(value ?? '').trim();
  if (!v) return '';
  if (v.startsWith('http://') || v.startsWith('https://')) return v;
  return `https://${v}`;
}

function locationLine(v: Venue): string {
  return [v.city, v.region, v.country].filter(Boolean).join(', ');
}

function mapsLink(v: Venue): string {
  const parts = [v.name, v.address, v.city, v.country].filter(Boolean).join(' ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts)}`;
}

function relationTypeOptions(current?: string) {
  const base = Array.from(VENUE_CONTACT_RELATION_TYPES);
  const cur = String(current ?? '').trim();
  if (cur && !base.includes(cur as any)) return [cur, ...base];
  return base;
}

function Section({ title, value }: { title: string; value: string | null | undefined }) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 12, color: '#6b7280' }}>{title}</div>
      <div style={{ whiteSpace: 'pre-wrap' }}>{text}</div>
    </div>
  );
}

export default function VenueDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const venueId = id;

  const [venue, setVenue] = useState<Venue | null>(null);
  const [links, setLinks] = useState<VenueContactLinkWithContact[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactFilter, setContactFilter] = useState('');
  const [newContactId, setNewContactId] = useState('');
  const [newRelationType, setNewRelationType] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [isMutating, setIsMutating] = useState(false);
  const [mutateError, setMutateError] = useState<string | null>(null);

  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [editRelationType, setEditRelationType] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const [confirmUnlink, setConfirmUnlink] = useState<null | { id: string; contactName: string }>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!venueId) {
      setError('Missing venue id');
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    void (async () => {
      setError(null);
      setIsLoading(true);
      try {
        const [v, l, c] = await Promise.all([
          getVenue(venueId),
          listContactsForVenue(venueId),
          listContacts(),
        ]);
        if (!isMounted) return;
        setVenue(v);
        setLinks(Array.isArray(l) ? l : []);
        setContacts(Array.isArray(c) ? c : []);
      } catch (e) {
        if (!isMounted) return;
        setError(e instanceof Error ? e.message : 'Failed to load venue');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [venueId]);

  async function refreshLinks() {
    if (!venueId) return;
    const l = await listContactsForVenue(venueId);
    setLinks(Array.isArray(l) ? l : []);
  }

  const filteredContacts = contacts.filter((c) => {
    const q = contactFilter.trim().toLowerCase();
    if (!q) return true;
    const hay = [c.full_name, c.email, c.phone, c.organization, c.role]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });

  return (
    <main
      style={{ padding: 24, fontFamily: 'system-ui, sans-serif', maxWidth: 900, margin: '0 auto' }}
    >
      <header
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
      >
        <h1 style={{ margin: 0 }}>Lieu</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Link to="/venues">Retour</Link>
          <button type="button" onClick={() => navigate('/')}>Accueil</button>
        </div>
      </header>

      {error ? (
        <p role="alert" style={{ color: 'crimson' }}>
          {error}
        </p>
      ) : null}

      {isLoading ? <p>Chargement…</p> : null}

      {!isLoading && !error && venue ? (
        <section style={{ marginTop: 16, display: 'grid', gap: 12 }}>
          <div style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 18 }}>{venue.name}</div>
                <div style={{ color: '#4b5563' }}>{locationLine(venue)}</div>
                {venue.address ? <div style={{ marginTop: 6 }}>{venue.address}</div> : null}
              </div>
              <div style={{ textAlign: 'right', fontSize: 13, color: venue.has_played ? '#065f46' : '#6b7280' }}>
                {venue.has_played ? 'Déjà joué' : 'Jamais joué'}
                {typeof venue.capacity === 'number' ? (
                  <div style={{ marginTop: 4, color: '#111827' }}>{formatNumber(venue.capacity)} cap.</div>
                ) : null}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
              <a href={mapsLink(venue)} target="_blank" rel="noreferrer">Ouvrir dans Maps</a>
              {safeUrl(venue.website) ? (
                <a href={safeUrl(venue.website)} target="_blank" rel="noreferrer">Site web</a>
              ) : null}
              {safeUrl(venue.instagram) ? (
                <a href={safeUrl(venue.instagram)} target="_blank" rel="noreferrer">Instagram</a>
              ) : null}
              {safeUrl(venue.facebook) ? (
                <a href={safeUrl(venue.facebook)} target="_blank" rel="noreferrer">Facebook</a>
              ) : null}
            </div>

            <Section title="Notes générales" value={venue.notes} />
            <Section title="Load-in / horaires / accès" value={venue.load_in_notes} />
            <Section title="Parking" value={venue.parking_notes} />
            <Section title="Hospitalité" value={venue.hospitality_notes} />
            <Section title="Technique" value={venue.tech_notes} />
            <Section title="Merch" value={venue.merch_notes} />
          </div>

          <div style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 8 }}>
            <h2 style={{ margin: 0, marginBottom: 8, fontSize: 16 }}>Contacts</h2>

            {mutateError ? (
              <p role="alert" style={{ color: 'crimson', marginTop: 0 }}>
                {mutateError}
              </p>
            ) : null}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!venueId) return;
                const contactId = newContactId.trim();
                if (!contactId) {
                  setMutateError('Sélectionnez un contact.');
                  return;
                }
                void (async () => {
                  setMutateError(null);
                  setIsMutating(true);
                  try {
                    await upsertVenueContactLink({
                      venue_id: venueId,
                      contact_id: contactId,
                      relation_type: newRelationType.trim() || null,
                      notes: newNotes.trim() || null,
                    });
                    await refreshLinks();
                    setNewContactId('');
                    setNewRelationType('');
                    setNewNotes('');
                    setContactFilter('');
                  } catch (e2) {
                    setMutateError(e2 instanceof Error ? e2.message : 'Impossible de lier ce contact');
                  } finally {
                    setIsMutating(false);
                  }
                })();
              }}
              style={{
                display: 'grid',
                gap: 10,
                padding: 10,
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                marginBottom: 10,
              }}
            >
              <div style={{ fontWeight: 700 }}>Ajouter un contact</div>
              <label style={{ display: 'grid', gap: 4 }}>
                <span style={{ fontSize: 12, color: '#6b7280' }}>Rechercher</span>
                <input
                  value={contactFilter}
                  onChange={(e) => setContactFilter(e.currentTarget.value)}
                  placeholder="Nom, email…"
                />
              </label>
              <label style={{ display: 'grid', gap: 4 }}>
                <span style={{ fontSize: 12, color: '#6b7280' }}>Contact</span>
                <select
                  aria-label="Ajouter un contact"
                  value={newContactId}
                  onChange={(e) => setNewContactId(e.currentTarget.value)}
                >
                  <option value="">— Sélectionner —</option>
                  {filteredContacts.map((c) => {
                    const title = (c.full_name ?? '').trim() || (c.email ?? '').trim() || 'Contact';
                    const subtitle = [c.organization, c.role].filter(Boolean).join(' — ');
                    return (
                      <option key={c.id} value={c.id}>
                        {[title, subtitle].filter(Boolean).join(' · ')}
                      </option>
                    );
                  })}
                </select>
              </label>
              <label style={{ display: 'grid', gap: 4 }}>
                <span style={{ fontSize: 12, color: '#6b7280' }}>Type de relation</span>
                <select value={newRelationType} onChange={(e) => setNewRelationType(e.currentTarget.value)}>
                  <option value="">—</option>
                  {relationTypeOptions(newRelationType).map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'grid', gap: 4 }}>
                <span style={{ fontSize: 12, color: '#6b7280' }}>Notes</span>
                <textarea
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.currentTarget.value)}
                  rows={3}
                  placeholder="Infos utiles (heures, préférences, etc.)"
                />
              </label>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="submit" disabled={isMutating}>
                  {isMutating ? 'Enregistrement…' : 'Lier'}
                </button>
              </div>
            </form>

            {links.length === 0 ? <p>Aucun contact lié.</p> : null}
            {links.length ? (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
                {links.map((l) => {
                  const c = l.contact;
                  const title = (c.full_name ?? '').trim() || (c.email ?? '').trim() || 'Contact';
                  return (
                    <li key={l.id} style={{ padding: 10, border: '1px solid #e5e7eb', borderRadius: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>
                            <Link to={`/contacts/${c.id}`}>{title}</Link>
                          </div>
                          {c.email ? <div style={{ color: '#4b5563' }}>{c.email}</div> : null}
                          {c.phone ? <div style={{ color: '#4b5563' }}>{c.phone}</div> : null}
                        </div>
                        <div style={{ textAlign: 'right', fontSize: 13, color: '#6b7280' }}>
                          {l.relation_type ? <div>{l.relation_type}</div> : null}
                        </div>
                      </div>

                      {editingLinkId === l.id ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (!venueId) return;
                            void (async () => {
                              setMutateError(null);
                              setIsMutating(true);
                              try {
                                await upsertVenueContactLink({
                                  venue_id: l.venue_id,
                                  contact_id: l.contact_id,
                                  relation_type: editRelationType.trim() || null,
                                  notes: editNotes.trim() || null,
                                });
                                await refreshLinks();
                                setEditingLinkId(null);
                              } catch (e2) {
                                setMutateError(
                                  e2 instanceof Error ? e2.message : 'Impossible de modifier ce lien',
                                );
                              } finally {
                                setIsMutating(false);
                              }
                            })();
                          }}
                          style={{ marginTop: 10, display: 'grid', gap: 8 }}
                        >
                          <label style={{ display: 'grid', gap: 4 }}>
                            <span style={{ fontSize: 12, color: '#6b7280' }}>Type de relation</span>
                            <select
                              value={editRelationType}
                              onChange={(e) => setEditRelationType(e.currentTarget.value)}
                            >
                              <option value="">—</option>
                              {relationTypeOptions(editRelationType).map((t) => (
                                <option key={t} value={t}>
                                  {t}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label style={{ display: 'grid', gap: 4 }}>
                            <span style={{ fontSize: 12, color: '#6b7280' }}>Notes</span>
                            <textarea
                              value={editNotes}
                              onChange={(e) => setEditNotes(e.currentTarget.value)}
                              rows={3}
                            />
                          </label>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingLinkId(null);
                                setEditRelationType('');
                                setEditNotes('');
                              }}
                              disabled={isMutating}
                              style={{ background: 'white', border: '1px solid #e5e7eb' }}
                            >
                              Annuler
                            </button>
                            <button type="submit" disabled={isMutating}>
                              {isMutating ? 'Enregistrement…' : 'Enregistrer'}
                            </button>
                          </div>
                        </form>
                      ) : (
                        <>
                          {l.notes ? (
                            <div style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{l.notes}</div>
                          ) : null}
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingLinkId(l.id);
                                setEditRelationType(l.relation_type ?? '');
                                setEditNotes(l.notes ?? '');
                              }}
                              disabled={isMutating}
                              style={{ background: 'white', border: '1px solid #e5e7eb' }}
                            >
                              Modifier
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmUnlink({ id: l.id, contactName: title })}
                              disabled={isMutating}
                              style={{ background: '#fee2e2', border: '1px solid #fecaca', color: '#991b1b' }}
                            >
                              Dissocier
                            </button>
                          </div>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        </section>
      ) : null}

      <ConfirmDialog
        open={Boolean(confirmUnlink)}
        title={confirmUnlink ? `Dissocier “${confirmUnlink.contactName}” ?` : 'Dissocier ?'}
        description="Le lien entre ce lieu et ce contact sera supprimé."
        confirmText="Oui, dissocier"
        cancelText="Annuler"
        isConfirming={isMutating}
        onCancel={() => setConfirmUnlink(null)}
        onConfirm={() => {
          if (!confirmUnlink) return;
          const linkId = confirmUnlink.id;
          void (async () => {
            setMutateError(null);
            setIsMutating(true);
            try {
              await deleteVenueContactLink(linkId);
              await refreshLinks();
              setConfirmUnlink(null);
            } catch (e2) {
              setMutateError(e2 instanceof Error ? e2.message : 'Impossible de dissocier');
            } finally {
              setIsMutating(false);
            }
          })();
        }}
      />
    </main>
  );
}
