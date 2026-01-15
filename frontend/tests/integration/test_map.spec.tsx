import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';

vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'test-key');

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
  status: 'contacted' | 'scheduled' | 'completed' | 'cancelled';
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
      date_start: new Date().toISOString(),
      date_end: null,
      status: 'scheduled',
      title: 'Bikini — Toulouse',
      venue_name: 'Le Bikini',
      city: 'Toulouse',
      country: 'France',
      address: null,
      lat: 43.562,
      lng: 1.51,
      venue_contact_name: null,
      venue_contact_email: null,
      notes: null,
      created_by: 'user-1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'c-2',
      date_start: new Date().toISOString(),
      date_end: null,
      status: 'scheduled',
      title: 'No coords',
      venue_name: 'Somewhere',
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

const markerInstances: Array<{ triggerClick: () => void }> = [];

beforeEach(() => {
  markerInstances.length = 0;

  class LatLngBounds {
    extend() {
      // noop
    }
  }

  class Map {
    panTo() {
      // noop
    }
    setZoom() {
      // noop
    }
    setCenter() {
      // noop
    }
    fitBounds() {
      // noop
    }
  }

  class Marker {
    private listeners: Record<string, () => void> = {};

    constructor() {
      markerInstances.push({
        triggerClick: () => this.listeners.click?.(),
      });
    }

    addListener(eventName: string, handler: () => void) {
      this.listeners[eventName] = handler;
      return { remove: () => undefined };
    }

    setMap() {
      // noop
    }
  }

  class AdvancedMarkerElement {
    private listeners: Record<string, () => void> = {};

    constructor() {
      markerInstances.push({
        triggerClick: () => (this.listeners['gmp-click'] ?? this.listeners.click)?.(),
      });
    }

    addListener(eventName: string, handler: () => void) {
      this.listeners[eventName] = handler;
      return { remove: () => undefined };
    }
  }

  // @ts-expect-error test stub
  globalThis.google = {
    maps: {
      Map,
      Marker,
      LatLngBounds,
      importLibrary: async (name: string) => {
        if (name === 'marker') return { AdvancedMarkerElement };
        return {};
      },
      marker: {
        AdvancedMarkerElement,
      },
    },
  };
});

import App from '../../src/App';

test('US4: map renders pins for concerts with coordinates', async () => {
  render(
    <MemoryRouter initialEntries={['/map']}>
      <App />
    </MemoryRouter>,
  );

  expect(await screen.findByText('Carte')).toBeInTheDocument();

  await waitFor(() => expect(screen.getByTestId('map-pin-count')).toHaveTextContent('1 concert'));
  await waitFor(() => expect(markerInstances.length).toBe(1));

  markerInstances[0].triggerClick();
  expect(await screen.findByTestId('map-selected-venue')).toHaveTextContent('Le Bikini');
});
