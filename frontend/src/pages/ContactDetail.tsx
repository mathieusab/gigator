import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Home, Link2, Link2Off, Pencil, Save, X } from 'lucide-react';

import ConfirmDialog from '../components/ConfirmDialog';
import GmailThreads from '../components/GmailThreads';
import { getContact, type Contact } from '../services/contacts';
import { listVenues, type Venue } from '../services/venues';
import {
  deleteVenueContactLink,
  listVenuesForContact,
  upsertVenueContactLink,
  VENUE_CONTACT_RELATION_TYPES,
  type VenueContactLinkWithVenue,
} from '../services/venueContactLinks';

function displayName(c: Contact): string {
  const name = String(c.full_name ?? '').trim();
  if (name) return name;
  const email = String(c.email ?? '').trim();
  return email || 'Contact';
}

function formatDate(value: string | null | undefined) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: '2-digit' }).format(d);
}

function relationTypeOptions(current?: string) {
  const base = Array.from(VENUE_CONTACT_RELATION_TYPES);
  const cur = String(current ?? '').trim();
  if (cur && !base.includes(cur as any)) return [cur, ...base];
  return base;
}

export default function ContactDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const contactId = id;

  const [contact, setContact] = useState<Contact | null>(null);
  const [links, setLinks] = useState<VenueContactLinkWithVenue[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [venueFilter, setVenueFilter] = useState('');
  const [newVenueId, setNewVenueId] = useState('');
  const [newRelationType, setNewRelationType] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [isMutating, setIsMutating] = useState(false);
  const [mutateError, setMutateError] = useState<string | null>(null);

  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [editRelationType, setEditRelationType] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const [confirmUnlink, setConfirmUnlink] = useState<null | { id: string; venueName: string }>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!contactId) {
      setError('Missing contact id');
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    void (async () => {
      setError(null);
      setIsLoading(true);
      try {
        const [c, l, v] = await Promise.all([
          getContact(contactId),
          listVenuesForContact(contactId),
          listVenues(),
        ]);
        if (!isMounted) return;
        setContact(c);
        setLinks(Array.isArray(l) ? l : []);
        setVenues(Array.isArray(v) ? v : []);
      } catch (e) {
        if (!isMounted) return;
        setError(e instanceof Error ? e.message : 'Failed to load contact');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [contactId]);

  async function refreshLinks() {
    if (!contactId) return;
    const l = await listVenuesForContact(contactId);
    setLinks(Array.isArray(l) ? l : []);
  }

  const filteredVenues = venues.filter((v) => {
    const q = venueFilter.trim().toLowerCase();
    if (!q) return true;
    const hay = [v.name, v.city, v.region, v.country].filter(Boolean).join(' ').toLowerCase();
    return hay.includes(q);
  });

  return (
    <main className="container">
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h1 className="h1">Contact</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Link to="/contacts" className="btn btn-ghost btn-sm">
            <ArrowLeft size={16} />
            Retour
          </Link>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/')}
          >
            <Home size={16} />
            Accueil
          </button>
        </div>
      </header>

      {error ? (
        <p role="alert" style={{ color: 'crimson' }}>
          {error}
        </p>
      ) : null}

      {isLoading ? <p>Chargement…</p> : null}

      {!isLoading && !error && contact ? (
        <section style={{ marginTop: 16, display: 'grid', gap: 12 }}>
          <div className="card card-pad">
            <div style={{ fontWeight: 800, fontSize: 18 }}>{displayName(contact)}</div>
            {contact.role || contact.organization ? (
              <div style={{ color: '#4b5563' }}>
                {contact.role ? contact.role : ''}
                {contact.organization ? (contact.role ? ` — ${contact.organization}` : contact.organization) : ''}
              </div>
            ) : null}

            {contact.email ? (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 12, color: '#6b7280' }}>Email</div>
                <div>{contact.email}</div>
              </div>
            ) : null}

            {contact.phone ? (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 12, color: '#6b7280' }}>Téléphone</div>
                <div>{contact.phone}</div>
              </div>
            ) : null}

            {contact.preferred_language ? (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 12, color: '#6b7280' }}>Langue</div>
                <div>{contact.preferred_language}</div>
              </div>
            ) : null}

            {contact.last_contact_at ? (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 12, color: '#6b7280' }}>Dernier échange</div>
                <div>{formatDate(contact.last_contact_at)}</div>
              </div>
            ) : null}

            {contact.notes ? (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 12, color: '#6b7280' }}>Notes</div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{contact.notes}</div>
              </div>
            ) : null}
          </div>

          <div className="card card-pad">
            <h2 className="h2" style={{ marginBottom: 8 }}>
              Lieux
            </h2>

            {mutateError ? (
              <p role="alert" style={{ color: 'crimson', marginTop: 0 }}>
                {mutateError}
              </p>
            ) : null}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!contactId) return;
                const venueId = newVenueId.trim();
                if (!venueId) {
                  setMutateError('Sélectionnez un lieu.');
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
                    setNewVenueId('');
                    setNewRelationType('');
                    setNewNotes('');
                    setVenueFilter('');
                  } catch (e2) {
                    setMutateError(e2 instanceof Error ? e2.message : 'Impossible de lier ce lieu');
                  } finally {
                    setIsMutating(false);
                  }
                })();
              }}
              className="card"
              style={{ display: 'grid', gap: 10, padding: 12, marginBottom: 10, boxShadow: 'none' }}
            >
              <div style={{ fontWeight: 700 }}>Ajouter un lieu</div>
              <label style={{ display: 'grid', gap: 4 }}>
                <span style={{ fontSize: 12, color: '#6b7280' }}>Rechercher</span>
                <input
                  className="input"
                  value={venueFilter}
                  onChange={(e) => setVenueFilter(e.currentTarget.value)}
                  placeholder="Nom, ville…"
                />
              </label>
              <label style={{ display: 'grid', gap: 4 }}>
                <span style={{ fontSize: 12, color: '#6b7280' }}>Lieu</span>
                <select
                  className="select"
                  aria-label="Ajouter un lieu"
                  value={newVenueId}
                  onChange={(e) => setNewVenueId(e.currentTarget.value)}
                >
                  <option value="">— Sélectionner —</option>
                  {filteredVenues.map((v) => (
                    <option key={v.id} value={v.id}>
                      {[v.name, [v.city, v.country].filter(Boolean).join(', ')].filter(Boolean).join(' — ')}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'grid', gap: 4 }}>
                <span style={{ fontSize: 12, color: '#6b7280' }}>Type de relation</span>
                <select
                  className="select"
                  value={newRelationType}
                  onChange={(e) => setNewRelationType(e.currentTarget.value)}
                >
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
                  className="textarea"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.currentTarget.value)}
                  rows={3}
                  placeholder="Infos utiles (heures, préférences, etc.)"
                />
              </label>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="submit" className="btn btn-primary btn-sm" disabled={isMutating}>
                  <Link2 size={16} />
                  {isMutating ? 'Enregistrement…' : 'Lier'}
                </button>
              </div>
            </form>

            {links.length === 0 ? <p>Aucun lieu lié.</p> : null}
            {links.length ? (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
                {links.map((l) => (
                  <li key={l.id} style={{ padding: 10, border: '1px solid #e5e7eb', borderRadius: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>
                          <Link to={`/venues/${l.venue.id}`}>{l.venue.name}</Link>
                        </div>
                        <div style={{ color: '#4b5563' }}>
                          {[l.venue.city, l.venue.region, l.venue.country].filter(Boolean).join(', ')}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', fontSize: 13, color: '#6b7280' }}>
                        {l.relation_type ? <div>{l.relation_type}</div> : null}
                      </div>
                    </div>

                    {editingLinkId === l.id ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!contactId) return;
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
                            className="select"
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
                            className="textarea"
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
                            className="btn btn-ghost btn-sm"
                          >
                            <X size={16} />
                            Annuler
                          </button>
                          <button type="submit" className="btn btn-primary btn-sm" disabled={isMutating}>
                            <Save size={16} />
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
                            className="btn btn-ghost btn-sm"
                          >
                            <Pencil size={16} />
                            Modifier
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmUnlink({ id: l.id, venueName: l.venue.name })}
                            disabled={isMutating}
                            className="btn btn-danger btn-sm"
                          >
                            <Link2Off size={16} />
                            Dissocier
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {contact.email ? <GmailThreads email={contact.email} mode="full" /> : null}
        </section>
      ) : null}

      <ConfirmDialog
        open={Boolean(confirmUnlink)}
        title={confirmUnlink ? `Dissocier “${confirmUnlink.venueName}” ?` : 'Dissocier ?'}
        description="Le lien entre ce contact et ce lieu sera supprimé."
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
