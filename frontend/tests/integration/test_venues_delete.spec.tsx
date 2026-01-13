import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

vi.mock('../../src/lib/useAuth', () => {
  return {
    AuthProvider: ({ children }: { children: React.ReactNode }) => children,
    useAuth: () => ({
      session: { user: { id: 'user-1' }, access_token: 'app-token' },
      appUser: { id: 'user-1', email: 'a@b.com', is_active: true },
      isLoading: false,
    }),
    isAuthorized: () => true,
  };
});

type Venue = {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  address: string | null;
  postal_code: string | null;
  region: string | null;
  lat: number | null;
  lng: number | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  capacity: number | null;
  has_played: boolean;
  load_in_notes: string | null;
  parking_notes: string | null;
  hospitality_notes: string | null;
  tech_notes: string | null;
  merch_notes: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

const store: { venues: Venue[] } = {
  venues: [],
};

const initialVenues: Venue[] = [
    {
      id: 'v-1',
      name: 'Le Bikini',
      city: 'Toulouse',
      country: 'France',
      address: 'Parc Technologique du Canal',
      postal_code: '31520',
      region: 'Occitanie',
      lat: null,
      lng: null,
      website: null,
      instagram: null,
      facebook: null,
      capacity: null,
      has_played: false,
      load_in_notes: null,
      parking_notes: null,
      hospitality_notes: null,
      tech_notes: null,
      merch_notes: null,
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'v-2',
      name: 'Rock School Barbey',
      city: 'Bordeaux',
      country: 'France',
      address: null,
      postal_code: null,
      region: null,
      lat: null,
      lng: null,
      website: null,
      instagram: null,
      facebook: null,
      capacity: null,
      has_played: true,
      load_in_notes: null,
      parking_notes: null,
      hospitality_notes: null,
      tech_notes: null,
      merch_notes: null,
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
];

beforeEach(() => {
  store.venues = initialVenues.map((v) => ({ ...v }));
});

afterEach(() => {
  cleanup();
});

vi.mock('../../src/services/venues', () => {
  return {
    listVenues: vi.fn(async () => store.venues.slice()),
    createVenue: vi.fn(async () => {
      throw new Error('not used');
    }),
    deleteVenue: vi.fn(async (id: string) => {
      store.venues = store.venues.filter((v) => v.id !== id);
    }),
  };
});

// VenueList imports mapsProxy for autocomplete/geocode but we don't use it in this test.
vi.mock('../../src/services/mapsProxy', () => {
  return {
    autocompletePlaces: vi.fn(async () => []),
    geocodePlace: vi.fn(async () => {
      throw new Error('not used');
    }),
  };
});

vi.mock('../../src/services/concerts', () => {
  return {
    listConcerts: vi.fn(async () => []),
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

import App from '../../src/App';

test('Salles: supprimer une salle depuis la liste', async () => {
  render(
    <MemoryRouter initialEntries={['/venues']}>
      <App />
    </MemoryRouter>,
  );

  expect(await screen.findByText('Salles')).toBeInTheDocument();
  expect(await screen.findByText('Le Bikini')).toBeInTheDocument();
  expect(screen.getByText('Rock School Barbey')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Supprimer Le Bikini' }));

  const dialog = await screen.findByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Oui, supprimer' }));

  await waitFor(() => expect(screen.queryByText('Le Bikini')).not.toBeInTheDocument());
  expect(screen.getByText('Rock School Barbey')).toBeInTheDocument();
});

test('Salles: affiche une erreur claire si la suppression est impossible', async () => {
  const venues = await import('../../src/services/venues');
  vi.mocked(venues.deleteVenue).mockRejectedValueOnce(
    new Error(
      "Impossible de supprimer cette salle car elle est liée à d’autres données (concerts, contacts, etc.). Supprimez ou dissociez ces éléments puis réessayez.",
    ),
  );

  render(
    <MemoryRouter initialEntries={['/venues']}>
      <App />
    </MemoryRouter>,
  );

  expect(await screen.findByText('Salles')).toBeInTheDocument();
  expect(await screen.findByText('Le Bikini')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Supprimer Le Bikini' }));

  const dialog = await screen.findByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Oui, supprimer' }));

  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent('Suppression de "Le Bikini" impossible');
  expect(alert).toHaveTextContent(/liée à d’autres données/i);
});

test('Salles: tri par date (jamais joué puis joué, plus récent en premier)', async () => {
  // Override venues + concerts for this test.
  store.venues = [
    {
      ...initialVenues[0],
      id: 'v-unplayed',
      name: 'AAA Unplayed',
      has_played: false,
    },
    {
      ...initialVenues[0],
      id: 'v-played-old',
      name: 'Played Old',
      has_played: true,
    },
    {
      ...initialVenues[0],
      id: 'v-played-new',
      name: 'Played New',
      has_played: true,
    },
  ];

  const concerts = await import('../../src/services/concerts');
  vi.mocked(concerts.listConcerts).mockResolvedValueOnce([
    {
      id: 'c-1',
      date_start: '2024-01-10T20:00:00.000Z',
      date_end: null,
      status: 'completed',
      title: 'Old show',
      venue_id: 'v-played-old',
      contact_id: null,
      venue_name: 'Played Old',
      city: null,
      country: null,
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
    {
      id: 'c-2',
      date_start: '2025-06-10T20:00:00.000Z',
      date_end: null,
      status: 'completed',
      title: 'New show',
      venue_id: 'v-played-new',
      contact_id: null,
      venue_name: 'Played New',
      city: null,
      country: null,
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
  ]);

  render(
    <MemoryRouter initialEntries={['/venues']}>
      <App />
    </MemoryRouter>,
  );

  expect(await screen.findByText('Salles')).toBeInTheDocument();

  const items = await screen.findAllByRole('listitem');
  const names = items.map((li) => {
    // Each list item contains the venue name as visible text.
    const a = within(li).queryByText('AAA Unplayed');
    if (a) return 'AAA Unplayed';
    const b = within(li).queryByText('Played New');
    if (b) return 'Played New';
    const c = within(li).queryByText('Played Old');
    if (c) return 'Played Old';
    return 'UNKNOWN';
  });

  expect(names).toEqual(['AAA Unplayed', 'Played New', 'Played Old']);
});
