import { describe, expect, test, vi } from 'vitest';

const supabaseMocks = vi.hoisted(() => {
  const eq = vi.fn();
  const del = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ delete: del }));
  return { eq, del, from };
});

vi.mock('../lib/supabaseClient', () => {
  return {
    supabase: { from: supabaseMocks.from },
  };
});

import { deleteVenue } from './venues';

describe('venues.deleteVenue', () => {
  test('maps foreign key violation to a helpful message', async () => {
    supabaseMocks.eq.mockResolvedValueOnce({
      error: {
        message: 'update or delete on table "venues" violates foreign key constraint',
        code: '23503',
      },
    });

    await expect(deleteVenue('v-1')).rejects.toThrow(/lié à d’autres données/i);
  });

  test('maps permission/RLS errors to a helpful message', async () => {
    supabaseMocks.eq.mockResolvedValueOnce({
      error: {
        message: 'permission denied for table venues',
        code: '42501',
      },
    });

    await expect(deleteVenue('v-1')).rejects.toThrow(/pas les droits/i);
  });
});
