import type { ConcertStatus } from '../services/concerts';

export function formatConcertStatusFr(status: ConcertStatus): string {
  switch (status) {
    case 'contacted':
      return 'Contacté';
    case 'scheduled':
      return 'Planifié';
    case 'completed':
      return 'Joués';
    case 'cancelled':
      return 'Annulé';
    default: {
      // Exhaustiveness guard for future statuses.
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}
