import type { Concert } from '../services/concerts';

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
}: {
  concert: Concert;
  onOpen: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
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
        <div style={{ fontWeight: 600 }}>{concert.venue_name}</div>
        <div style={{ color: '#4b5563' }}>
          {formatDateTime(concert.date_start)}
          {concert.city ? ` • ${concert.city}` : ''}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={() => onOpen(concert.id)}>
          Voir
        </button>
        <button type="button" onClick={() => onEdit(concert.id)}>
          Modifier
        </button>
        <button type="button" onClick={() => onDelete(concert.id)}>
          Supprimer
        </button>
      </div>
    </li>
  );
}
