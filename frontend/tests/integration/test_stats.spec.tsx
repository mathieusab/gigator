import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, test, vi } from 'vitest';

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function monthKeyUTC(date: Date): string {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}`;
}

function addMonthsUTC(monthStart: Date, deltaMonths: number): Date {
  return new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + deltaMonths, 1));
}

function getUtcMonthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
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
  venue_id: string | null;
  contact_id: string | null;
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

type ConcertFinancialItem = {
  id: string;
  concert_id: string;
  kind: 'income' | 'expense';
  label: string;
  amount_cents: number;
  created_by: string;
  created_at: string;
  updated_at: string;
};

const store: { concerts: Concert[]; financialItems: ConcertFinancialItem[] } = {
  concerts: [],
  financialItems: [],
};

vi.mock('../../src/services/concerts', () => {
  return {
    CONCERT_STATUSES: ['scheduled', 'completed', 'cancelled'],
    listConcerts: vi.fn(async () => store.concerts.slice()),
    getConcert: vi.fn(async () => {
      throw new Error('not used');
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

vi.mock('../../src/services/concertFinancialItems', () => {
  return {
    CONCERT_FINANCIAL_CATEGORIES: ['Cachet', 'Billetterie', 'Merch', 'Parking', 'Transport', 'Hébergement'],
    listConcertFinancialItems: vi.fn(async () => store.financialItems.slice()),
    listConcertFinancialItemsForConcert: vi.fn(async () => []),
    createConcertFinancialItem: vi.fn(async () => {
      throw new Error('not used');
    }),
    updateConcertFinancialItem: vi.fn(async () => {
      throw new Error('not used');
    }),
    deleteConcertFinancialItem: vi.fn(async () => {
      throw new Error('not used');
    }),
  };
});

import App from '../../src/App';

test('Stats: renders and counts past concerts per month (24 months)', async () => {
  const now = new Date();
  const nowMonthStart = getUtcMonthStart(now);

  const month0 = addMonthsUTC(nowMonthStart, 0); // current month
  const month1 = addMonthsUTC(nowMonthStart, -1); // last month
  const month25 = addMonthsUTC(nowMonthStart, -25); // outside range

  const currentMonthKey = monthKeyUTC(month0);
  const lastMonthKey = monthKeyUTC(month1);

  store.concerts = [
    {
      id: 'c-1',
      date_start: new Date(Date.UTC(month1.getUTCFullYear(), month1.getUTCMonth(), 10, 12, 0, 0)).toISOString(),
      date_end: null,
      status: 'completed',
      title: 'Past 1',
      venue_id: null,
      contact_id: null,
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
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    },
    {
      id: 'c-2',
      date_start: new Date(Date.UTC(month1.getUTCFullYear(), month1.getUTCMonth(), 11, 12, 0, 0)).toISOString(),
      date_end: null,
      status: 'completed',
      title: 'Past 2',
      venue_id: null,
      contact_id: null,
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
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    },
    // Future concert should not be counted
    {
      id: 'c-3',
      date_start: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString(),
      date_end: null,
      status: 'scheduled',
      title: 'Future',
      venue_id: null,
      contact_id: null,
      venue_name: 'Future Hall',
      city: null,
      country: null,
      address: null,
      lat: null,
      lng: null,
      venue_contact_name: null,
      venue_contact_email: null,
      notes: null,
      created_by: 'user-1',
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    },
    // Past concert older than 24 months should not appear in buckets
    {
      id: 'c-4',
      date_start: new Date(Date.UTC(month25.getUTCFullYear(), month25.getUTCMonth(), 10, 12, 0, 0)).toISOString(),
      date_end: null,
      status: 'completed',
      title: 'Too old',
      venue_id: null,
      contact_id: null,
      venue_name: 'Old Hall',
      city: null,
      country: null,
      address: null,
      lat: null,
      lng: null,
      venue_contact_name: null,
      venue_contact_email: null,
      notes: null,
      created_by: 'user-1',
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    },
  ];

  // Net gains: two past concerts last month.
  store.financialItems = [
    {
      id: 'fi-1',
      concert_id: 'c-1',
      kind: 'income',
      label: 'Billetterie',
      amount_cents: 20000,
      created_by: 'user-1',
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    },
    {
      id: 'fi-2',
      concert_id: 'c-1',
      kind: 'expense',
      label: 'Parking',
      amount_cents: 500,
      created_by: 'user-1',
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    },
  ];

  render(
    <MemoryRouter initialEntries={['/stats']}>
      <App />
    </MemoryRouter>,
  );

  expect(await screen.findByText('Statistiques')).toBeInTheDocument();
  expect(await screen.findByText('Statuts')).toBeInTheDocument();
  expect(await screen.findByText('Concerts par mois')).toBeInTheDocument();
  expect(await screen.findByText('Gains nets par mois')).toBeInTheDocument();

  await waitFor(() => expect(screen.getByTestId('stats-status-count-scheduled')).toBeInTheDocument());
  expect(screen.getByTestId('stats-status-count-scheduled')).toHaveTextContent('1');
  expect(screen.getByTestId('stats-status-count-completed')).toHaveTextContent('3');
  expect(screen.getByTestId('stats-status-count-cancelled')).toHaveTextContent('0');

  await waitFor(() => expect(screen.getByTestId(`stats-bar-${lastMonthKey}`)).toBeInTheDocument());

  expect(screen.getByTestId(`stats-bar-${lastMonthKey}`)).toHaveAttribute('data-count', '2');
  expect(screen.getByTestId(`stats-bar-${currentMonthKey}`)).toHaveAttribute('data-count', '0');

  // Net for last month should be 20000 - 500 = 19500 cents.
  expect(screen.getByTestId(`stats-net-bar-${lastMonthKey}`)).toHaveAttribute('data-net-cents', '19500');

  expect(screen.queryByTestId(`stats-bar-${monthKeyUTC(month25)}`)).not.toBeInTheDocument();
});
