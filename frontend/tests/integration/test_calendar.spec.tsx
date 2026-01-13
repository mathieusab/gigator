import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, test, vi } from 'vitest';

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

vi.mock('../../src/lib/useAuth', () => {
  return {
    AuthProvider: ({ children }: { children: React.ReactNode }) => children,
    useAuth: () => ({
      session: { user: { id: 'user-1' } },
      appUser: { id: 'user-1', email: 'a@b.com', is_active: true },
      isLoading: false,
    }),
    isAuthorized: () => true,
  };
});

type Concert = {
  id: string;
  date_start: string | null;
  date_end: string | null;
  status: 'scheduled' | 'completed' | 'cancelled';
  title: string;
  venue_name: string;
  city: string | null;
  country: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  venue_contact_name: string | null;
  venue_contact_email: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

const store: { concerts: Concert[] } = {
  concerts: [
    {
      id: 'c-1',
      date_start: (() => {
        const now = new Date();
        const y = now.getUTCFullYear();
        const m = now.getUTCMonth() + 1;
        return `${y}-${pad2(m)}-15T12:00:00.000Z`;
      })(),
      date_end: null,
      status: 'scheduled',
      title: 'Bikini — Toulouse',
      venue_name: 'Le Bikini',
      city: 'Toulouse',
      country: 'France',
      address: null,
      lat: null,
      lng: null,
      venue_contact_name: null,
      venue_contact_email: null,
      notes: null,
      created_by: 'user-1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
};

vi.mock('../../src/services/concerts', () => {
  return {
    listConcerts: vi.fn(async () => store.concerts.slice()),
    getConcert: vi.fn(async (id: string) => {
      const found = store.concerts.find((c) => c.id === id);
      if (!found) throw new Error('Not found');
      return found;
    }),
    createConcert: vi.fn(async () => {
      throw new Error('not used');
    }),
    updateConcert: vi.fn(async () => {
      throw new Error('not used');
    }),
    deleteConcert: vi.fn(async () => {
      throw new Error('not used');
    }),
  };
});

import App from '../../src/App';

test('US3: calendar navigation and event click opens concert detail', async () => {
  render(
    <MemoryRouter initialEntries={['/calendar']}>
      <App />
    </MemoryRouter>,
  );

  expect(await screen.findByText('Calendrier')).toBeInTheDocument();

  const now = new Date();
  const currentMonthLabel = `${now.getUTCFullYear()}-${pad2(now.getUTCMonth() + 1)}`;
  const dayKey = `${now.getUTCFullYear()}-${pad2(now.getUTCMonth() + 1)}-15`;

  await waitFor(() =>
    expect(screen.getByTestId('calendar-month-label')).toHaveTextContent(currentMonthLabel),
  );

  fireEvent.click(screen.getByTestId('calendar-next-month'));
  await waitFor(() =>
    expect(screen.getByTestId('calendar-month-label')).not.toHaveTextContent(currentMonthLabel),
  );

  fireEvent.click(screen.getByTestId('calendar-prev-month'));
  await waitFor(() =>
    expect(screen.getByTestId('calendar-month-label')).toHaveTextContent(currentMonthLabel),
  );

  fireEvent.click(screen.getByTestId(`calendar-day-${dayKey}`));
  expect(await screen.findByText('Le Bikini')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Ouvrir' }));
  expect(await screen.findByText('Détail du concert')).toBeInTheDocument();
  expect(await screen.findByText('Le Bikini')).toBeInTheDocument();
});
