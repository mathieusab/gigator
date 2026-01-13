import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { getVenue, type Venue } from '../services/venues';
import { listContactsForVenue, type VenueContactLinkWithContact } from '../services/venueContactLinks';

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
        const [v, l] = await Promise.all([getVenue(venueId), listContactsForVenue(venueId)]);
        if (!isMounted) return;
        setVenue(v);
        setLinks(Array.isArray(l) ? l : []);
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

  return (
    <main
      style={{ padding: 24, fontFamily: 'system-ui, sans-serif', maxWidth: 900, margin: '0 auto' }}
    >
      <header
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
      >
        <h1 style={{ margin: 0 }}>Salle</h1>
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
                      {l.notes ? (
                        <div style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{l.notes}</div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        </section>
      ) : null}
    </main>
  );
}
