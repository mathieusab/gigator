import type { Concert } from '../services/concerts';
import { Link } from 'react-router-dom';
import { bucketColors, deriveConcertBucket } from '../lib/concertBuckets';

function formatDateTime(value: string | null) {
  if (!value) return 'Date à définir';
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
  const displayTitle = String(concert.title ?? '').trim() || concert.venue_name;
  const colors = bucketColors(deriveConcertBucket(concert));

  return (
    <li
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
        padding: 12,
        border: `1px solid ${colors.border}`,
        borderLeft: `6px solid ${colors.accent}`,
        borderRadius: 8,
        background: colors.bg,
      }}
    >
      <div>
        <div style={{ fontWeight: 600 }}>{displayTitle}</div>
        <div style={{ color: '#4b5563' }}>
          <span>
            {concert.venue_id ? (
              <Link to={`/venues/${concert.venue_id}`}>{concert.venue_name}</Link>
            ) : (
              concert.venue_name
            )}
          </span>
          {concert.city ? <span>{` — ${concert.city}`}</span> : null}
        </div>
        <div style={{ color: '#4b5563' }}>{formatDateTime(concert.date_start)}</div>
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
