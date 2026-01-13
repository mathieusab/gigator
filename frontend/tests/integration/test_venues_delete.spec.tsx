import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, test, vi } from 'vitest';

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
  venues: [
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
  ],
};

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

import App from '../../src/App';

test('Salles: supprimer une salle depuis la liste', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);

  render(
    <MemoryRouter initialEntries={['/venues']}>
      <App />
    </MemoryRouter>,
  );

  expect(await screen.findByText('Salles')).toBeInTheDocument();
  expect(await screen.findByText('Le Bikini')).toBeInTheDocument();
  expect(screen.getByText('Rock School Barbey')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Supprimer Le Bikini' }));

  await waitFor(() => expect(screen.queryByText('Le Bikini')).not.toBeInTheDocument());
  expect(screen.getByText('Rock School Barbey')).toBeInTheDocument();
});
