import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

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

const store: { contacts: Contact[] } = {
  contacts: [],
};

const initialContacts: Contact[] = [
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
  {
    id: 'ct-2',
    full_name: 'Bob',
    email: null,
    phone: '+33 6 12 34 56 78',
    last_contact_at: null,
    role: null,
    organization: null,
    preferred_language: null,
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

beforeEach(() => {
  store.contacts = initialContacts.map((c) => ({ ...c }));
});

afterEach(() => {
  cleanup();
});

vi.mock('../../src/services/contacts', () => {
  return {
    listContacts: vi.fn(async () => store.contacts.slice()),
    createContact: vi.fn(async () => {
      throw new Error('not used');
    }),
    getContact: vi.fn(async (id: string) => {
      const found = store.contacts.find((c) => c.id === id);
      if (!found) throw new Error('Not found');
      return found;
    }),
    deleteContact: vi.fn(async (id: string) => {
      store.contacts = store.contacts.filter((c) => c.id !== id);
    }),
  };
});

vi.mock('../../src/services/venueContactLinks', () => {
  return {
    listVenuesForContact: vi.fn(async () => []),
    listContactsForVenue: vi.fn(async () => []),
    upsertVenueContactLink: vi.fn(async () => undefined),
  };
});

import App from '../../src/App';

test('Contacts: supprimer un contact depuis la liste', async () => {
  render(
    <MemoryRouter initialEntries={['/contacts']}>
      <App />
    </MemoryRouter>,
  );

  expect(await screen.findByText('Contacts')).toBeInTheDocument();
  expect(await screen.findByText('Alice')).toBeInTheDocument();
  expect(screen.getByText('Bob')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Supprimer Alice' }));

  const dialog = await screen.findByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Oui, supprimer' }));

  await waitFor(() => expect(screen.queryByText('Alice')).not.toBeInTheDocument());
  expect(screen.getByText('Bob')).toBeInTheDocument();
});

test('Contacts: affiche une erreur claire si la suppression est impossible', async () => {
  const contacts = await import('../../src/services/contacts');
  vi.mocked(contacts.deleteContact).mockRejectedValueOnce(
    new Error(
      "Impossible de supprimer ce contact car il est lié à d’autres données (concerts, salles, etc.). Supprimez ou dissociez ces éléments puis réessayez.",
    ),
  );

  render(
    <MemoryRouter initialEntries={['/contacts']}>
      <App />
    </MemoryRouter>,
  );

  expect(await screen.findByText('Contacts')).toBeInTheDocument();
  expect(await screen.findByText('Alice')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Supprimer Alice' }));

  const dialog = await screen.findByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Oui, supprimer' }));

  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent('Suppression de "Alice" impossible');
  expect(alert).toHaveTextContent(/li[eé] à d’autres données/i);
});
