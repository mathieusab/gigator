import type { Concert } from '../services/concerts';
import { Link } from 'react-router-dom';

function formatDateTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export default function ConcertListItem({
  concert,
  onOpen,
  onEdit,
  onDelete,
  isDeleting = false,
}: {
  concert: Concert;
  onOpen: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  isDeleting?: boolean;
}) {
  return (
    <li
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
        padding: 12,
        border: '1px solid #e5e7eb',
        borderRadius: 8,
      }}
    >
      <div>
        <div style={{ fontWeight: 600 }}>
          {concert.venue_id ? (
            <Link to={`/venues/${concert.venue_id}`}>{concert.venue_name}</Link>
          ) : (
            concert.venue_name
          )}
        </div>
        <div style={{ color: '#4b5563' }}>
          {formatDateTime(concert.date_start)}
          {concert.city ? ` • ${concert.city}` : ''}
        </div>

        {concert.contact_id ? (
          <div style={{ marginTop: 4, fontSize: 13, color: '#4b5563' }}>
            <Link to={`/contacts/${concert.contact_id}`}>
              {(concert.venue_contact_name ?? '').trim() || (concert.venue_contact_email ?? '').trim() || 'Contact'}
            </Link>
          </div>
        ) : null}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={() => onOpen(concert.id)}>
          Voir
        </button>
        <button type="button" onClick={() => onEdit(concert.id)}>
          Modifier
        </button>
        <button
          type="button"
          onClick={() => onDelete(concert.id)}
          disabled={isDeleting}
          aria-label={`Supprimer ${concert.venue_name}`}
        >
          Supprimer
        </button>
      </div>
    </li>
  );
}
