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

type Contact = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  last_contact_at: string | null;
  role: string | null;
  organization: string | null;
  preferred_language: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

const hoisted = vi.hoisted(() => {
  const store: { contacts: Contact[] } = {
    contacts: [
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
    ],
  };

  const listContactsMock = vi.fn(async () => store.contacts.slice());
  const getContactMock = vi.fn(async (id: string) => {
    const found = store.contacts.find((c) => c.id === id);
    if (!found) throw new Error('Not found');
    return found;
  });
  const createContactMock = vi.fn(async (input: any) => {
    const created: Contact = {
      id: `ct-${store.contacts.length + 1}`,
      full_name: input.full_name ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      last_contact_at: null,
      role: null,
      organization: null,
      preferred_language: null,
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    store.contacts.push(created);
    return created;
  });

  return { store, listContactsMock, getContactMock, createContactMock };
});

vi.mock('../../src/services/contacts', () => {
  return {
    listContacts: hoisted.listContactsMock,
    getContact: hoisted.getContactMock,
    createContact: hoisted.createContactMock,
    createContactWithInfo: vi.fn(async (input: any) => ({ contact: await hoisted.createContactMock(input), existed: false })),
  };
});

vi.mock('../../src/services/venueContactLinks', () => {
  return {
    listVenuesForContact: vi.fn(async () => []),
    listContactsForVenue: vi.fn(async () => []),
    upsertVenueContactLink: vi.fn(async () => undefined),
    deleteVenueContactLink: vi.fn(async () => undefined),
    VENUE_CONTACT_RELATION_TYPES: [
      'Booker',
      'Programmateur',
      'Régisseur',
      'Technique',
      'Communication',
      'Presse',
      'Administration',
      'Autre',
    ],
  };
});

import App from '../../src/App';

test('Contacts: can create a contact with a phone number', async () => {
  render(
    <MemoryRouter initialEntries={['/contacts']}>
      <App />
    </MemoryRouter>,
  );

  expect(await screen.findByText('Contacts')).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Bob' } });
  fireEvent.change(screen.getByLabelText('Téléphone'), { target: { value: '+33 6 12 34 56 78' } });

  fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));

  await waitFor(() =>
    expect(hoisted.createContactMock).toHaveBeenCalledWith({
      full_name: 'Bob',
      email: null,
      phone: '+33 6 12 34 56 78',
    }),
  );

  expect(await screen.findByText('Bob')).toBeInTheDocument();
  expect(screen.getByText('+33 6 12 34 56 78')).toBeInTheDocument();
});
