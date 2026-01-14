import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import GmailThreads from '../components/GmailThreads';
import { getContact, type Contact } from '../services/contacts';
import { listVenuesForContact, type VenueContactLinkWithVenue } from '../services/venueContactLinks';

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

export default function ContactDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const contactId = id;

  const [contact, setContact] = useState<Contact | null>(null);
  const [links, setLinks] = useState<VenueContactLinkWithVenue[]>([]);
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
        const [c, l] = await Promise.all([getContact(contactId), listVenuesForContact(contactId)]);
        if (!isMounted) return;
        setContact(c);
        setLinks(Array.isArray(l) ? l : []);
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

  return (
    <main
      style={{ padding: 24, fontFamily: 'system-ui, sans-serif', maxWidth: 900, margin: '0 auto' }}
    >
      <header
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
      >
        <h1 style={{ margin: 0 }}>Contact</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Link to="/contacts">Retour</Link>
          <button type="button" onClick={() => navigate('/')}>Accueil</button>
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
          <div style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 8 }}>
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

          <div style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 8 }}>
            <h2 style={{ margin: 0, marginBottom: 8, fontSize: 16 }}>Lieux</h2>
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
                    {l.notes ? (
                      <div style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{l.notes}</div>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {contact.email ? <GmailThreads email={contact.email} mode="full" /> : null}
        </section>
      ) : null}
    </main>
  );
}
