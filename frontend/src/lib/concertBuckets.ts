import type { Concert, ConcertStatus } from '../services/concerts';

// UI-facing buckets used for consistent coloring across the app.
// These buckets intentionally blend DB `status` with date-based heuristics so that
// the UI matches the user's mental model (à planifier / à venir / passés).
export type ConcertBucket = 'contacted' | 'to_schedule' | 'upcoming' | 'past' | 'cancelled';

export type UiBucket = ConcertBucket | 'to_process';

export type BucketColors = {
  accent: string;
  bg: string;
  border: string;
  text: string;
};

// Harmonized palette (Tailwind-inspired) with consistent lightness/saturation.
const BUCKET_COLORS: Record<UiBucket, BucketColors> = {
  // Concerts à traiter (Gmail TODO): vivid red
  to_process: {
    accent: '#dc2626',
    bg: '#fee2e2',
    border: '#fca5a5',
    text: '#7f1d1d',
  },

  // Contactés: light blue
  contacted: {
    accent: '#60a5fa',
    bg: '#eff6ff',
    border: '#bfdbfe',
    text: '#1d4ed8',
  },

  // À planifier: light purple
  to_schedule: {
    accent: '#a78bfa',
    bg: '#f5f3ff',
    border: '#ddd6fe',
    text: '#5b21b6',
  },

  // À venir: light green
  upcoming: {
    accent: '#86efac',
    bg: '#ecfdf5',
    border: '#bbf7d0',
    text: '#065f46',
  },

  // Joués: dark green
  past: {
    accent: '#166534',
    bg: '#f0fdf4',
    border: '#bbf7d0',
    text: '#14532d',
  },

  // Annulés: light red
  cancelled: {
    accent: '#f87171',
    bg: '#fef2f2',
    border: '#fecaca',
    text: '#991b1b',
  },
};

export function bucketColors(bucket: UiBucket): BucketColors {
  return BUCKET_COLORS[bucket];
}

export function formatBucketFr(bucket: UiBucket): string {
  switch (bucket) {
    case 'to_process':
      return 'À traiter';
    case 'contacted':
      return 'Contacté';
    case 'to_schedule':
      return 'À planifier';
    case 'upcoming':
      return 'À venir';
    case 'past':
      return 'Joué';
    case 'cancelled':
      return 'Annulé';
    default: {
      const _exhaustive: never = bucket;
      return _exhaustive;
    }
  }
}

export function deriveConcertBucket(concert: Pick<Concert, 'status' | 'date_start'>, now = new Date()): ConcertBucket {
  if (concert.status === 'cancelled') return 'cancelled';
  if (concert.status === 'contacted') return 'contacted';

  // Date-based UI buckets.
  const ds = concert.date_start;
  if (!ds) return 'to_schedule';

  const d = new Date(ds);
  const ms = d.getTime();
  if (!Number.isFinite(ms)) return 'to_schedule';

  return ms >= now.getTime() ? 'upcoming' : 'past';
}

export function bucketForStatus(status: ConcertStatus): ConcertBucket {
  switch (status) {
    case 'contacted':
      return 'contacted';
    case 'scheduled':
      return 'to_schedule';
    case 'completed':
      return 'past';
    case 'cancelled':
      return 'cancelled';
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}
