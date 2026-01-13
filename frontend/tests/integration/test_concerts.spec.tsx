import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, test, vi } from 'vitest';

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
  date_start: string;
  date_end: string | null;
  status: 'scheduled' | 'completed' | 'cancelled';
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
      id: 'c-upcoming',
      date_start: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      date_end: null,
      status: 'scheduled',
      venue_name: 'Future Venue',
      city: 'Paris',
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
      id: 'c-past',
      date_start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      date_end: null,
      status: 'completed',
      venue_name: 'Past Venue',
      city: 'Lyon',
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
    createConcert: vi.fn(async (input: any) => {
      const created: Concert = {
        id: `c-${store.concerts.length + 1}`,
        date_start: input.date_start,
        date_end: input.date_end ?? null,
        status: input.status ?? 'scheduled',
        venue_name: input.venue_name,
        city: input.city ?? null,
        country: input.country ?? null,
        address: input.address ?? null,
        lat: input.lat ?? null,
        lng: input.lng ?? null,
        venue_contact_name: input.venue_contact_name ?? null,
        venue_contact_email: input.venue_contact_email ?? null,
        notes: input.notes ?? null,
        created_by: 'user-1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      store.concerts.push(created);
      return created;
    }),
    updateConcert: vi.fn(async (id: string, input: any) => {
      const idx = store.concerts.findIndex((c) => c.id === id);
      if (idx === -1) throw new Error('Not found');
      store.concerts[idx] = { ...store.concerts[idx], ...input, updated_at: new Date().toISOString() };
      return store.concerts[idx];
    }),
    deleteConcert: vi.fn(async (id: string) => {
      store.concerts = store.concerts.filter((c) => c.id !== id);
    }),
  };
});

import App from '../../src/App';

test('US2 flow: list groups, create, edit, delete', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);

  render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>,
  );

  expect(await screen.findByText('À venir')).toBeInTheDocument();
  expect(screen.getByText('Passés')).toBeInTheDocument();
  expect(screen.getByText('Future Venue')).toBeInTheDocument();
  expect(screen.getByText('Past Venue')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
  expect(await screen.findByText('Nouveau concert')).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Salle'), { target: { value: 'New Venue' } });
  fireEvent.change(screen.getByLabelText('Ville'), { target: { value: 'Toulouse' } });
  fireEvent.click(screen.getByRole('button', { name: 'Créer' }));

  expect(await screen.findByText('Concerts')).toBeInTheDocument();
  await waitFor(() => expect(screen.getByText('New Venue')).toBeInTheDocument());

  fireEvent.click(screen.getAllByRole('button', { name: 'Modifier' })[0]);
  expect(await screen.findByText('Modifier le concert')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Salle'), { target: { value: 'Edited Venue' } });
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

  expect(await screen.findByText('Concerts')).toBeInTheDocument();
  await waitFor(() => expect(screen.getByText('Edited Venue')).toBeInTheDocument());

  fireEvent.click(screen.getAllByRole('button', { name: 'Supprimer' })[0]);
  await waitFor(() => expect(screen.queryByText('Edited Venue')).not.toBeInTheDocument());
});
