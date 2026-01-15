import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

const store: { concerts: Concert[] } = {
  concerts: [
    {
      id: 'c-upcoming',
      date_start: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      date_end: null,
      status: 'scheduled',
      title: 'Future Venue — Paris',
      venue_id: null,
      contact_id: null,
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
      title: 'Past Venue — Lyon',
      venue_id: null,
      contact_id: null,
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
        date_start: input.date_start ?? null,
        date_end: input.date_end ?? null,
        status: input.status ?? 'scheduled',
        title: input.title ?? `${input.venue_name}${input.city ? ` — ${input.city}` : ''}`,
        venue_id: input.venue_id ?? null,
        contact_id: input.contact_id ?? null,
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
      store.concerts[idx] = {
        ...store.concerts[idx],
        ...input,
        updated_at: new Date().toISOString(),
      };
      return store.concerts[idx];
    }),
    deleteConcert: vi.fn(async (id: string) => {
      store.concerts = store.concerts.filter((c) => c.id !== id);
    }),
  };
});

vi.mock('../../src/services/venues', () => {
  return {
    listVenues: vi.fn(async () => {
      return [
        {
          id: 'v-new',
          name: 'New Venue',
          city: 'Toulouse',
          country: null,
          address: null,
          postal_code: null,
          region: null,
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
          id: 'v-edited',
          name: 'Edited Venue',
          city: 'Toulouse',
          country: null,
          address: null,
          postal_code: null,
          region: null,
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
      ];
    }),
  };
});

vi.mock('../../src/services/contacts', () => {
  return {
    listContacts: vi.fn(async () => {
      return [
        {
          id: 'ct-1',
          full_name: 'Alice',
          email: 'alice@example.com',
          phone: null,
          last_contact_at: null,
          role: null,
          organization: null,
          preferred_language: null,
          notes: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];
    }),
  };
});

vi.mock('../../src/services/concertContactLinks', () => {
  return {
    CONCERT_CONTACT_CATEGORIES: [
      'Gérant',
      'Ingé son',
      'Ingé lumière',
      'Organisateur',
      'Responsable bar',
      'Connaissance',
      'Membre du co-plateau',
    ],
    replaceContactsForConcert: vi.fn(async () => undefined),
    listContactsForConcert: vi.fn(async () => []),
  };
});

vi.mock('../../src/services/concertFinancialItems', () => {
  return {
    CONCERT_FINANCIAL_CATEGORIES: ['Cachet', 'Billetterie', 'Merch', 'Parking', 'Transport', 'Hébergement'],
    listConcertFinancialItems: vi.fn(async () => []),
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

function expandSection(name: RegExp) {
  const btns = screen.getAllByRole('button', { name });
  for (const btn of btns) {
    if (btn.getAttribute('aria-expanded') !== 'true') {
      fireEvent.click(btn);
    }
  }
}

test('US2 flow: list groups, create, edit, delete', async () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>,
  );

  expect(await screen.findByRole('heading', { level: 2, name: /À venir/ })).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 2, name: /Passés/ })).toBeInTheDocument();

  // Sections are collapsed by default.
  expandSection(/À venir/);
  expandSection(/Passés/);

  expect(screen.getByText('Future Venue')).toBeInTheDocument();
  expect(screen.getByText('Past Venue')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
  expect(await screen.findByText('Nouveau concert')).toBeInTheDocument();

  fireEvent.change(screen.getByRole('combobox', { name: 'Lieu' }), { target: { value: 'v-new' } });
  fireEvent.click(screen.getByRole('button', { name: 'Créer' }));

  expect(await screen.findByText('Concerts')).toBeInTheDocument();

  expandSection(/À planifier/);
  expandSection(/À venir/);
  expandSection(/Passés/);

  await waitFor(() => expect(screen.getByText('New Venue')).toBeInTheDocument());

  fireEvent.click(screen.getAllByRole('button', { name: 'Modifier' })[0]);
  expect(await screen.findByText('Modifier le concert')).toBeInTheDocument();
  fireEvent.change(screen.getByRole('combobox', { name: 'Lieu' }), { target: { value: 'v-edited' } });
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

  expect(await screen.findByText('Concerts')).toBeInTheDocument();

  expandSection(/À planifier/);
  expandSection(/À venir/);
  expandSection(/Passés/);

  await waitFor(() => expect(screen.getByText('Edited Venue')).toBeInTheDocument());

  fireEvent.click(screen.getByRole('button', { name: 'Supprimer Edited Venue' }));

  const dialog = await screen.findByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Oui, supprimer' }));
  await waitFor(() => expect(screen.queryByText('Edited Venue')).not.toBeInTheDocument());
});

test('create concert without date (date_start=null)', async () => {
  render(
    <MemoryRouter initialEntries={['/concerts/new']}>
      <App />
    </MemoryRouter>,
  );

  expect(await screen.findByText('Nouveau concert')).toBeInTheDocument();

  // Date is optional: keep it as "Date à définir" and create.
  expect(screen.getByLabelText('Date à définir')).toBeChecked();

  fireEvent.change(screen.getByRole('combobox', { name: 'Lieu' }), { target: { value: 'v-new' } });
  fireEvent.click(screen.getByRole('button', { name: 'Créer' }));

  expect(await screen.findByText('Concerts')).toBeInTheDocument();

  expandSection(/À planifier/);

  await waitFor(() => expect(screen.getByText('New Venue')).toBeInTheDocument());
  expect(screen.getByText(/Date à définir/i)).toBeInTheDocument();
});
