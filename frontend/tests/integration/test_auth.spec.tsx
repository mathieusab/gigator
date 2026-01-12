import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, test, vi } from 'vitest';

vi.mock('../../src/lib/useAuth', () => {
  return {
    AuthProvider: ({ children }: { children: React.ReactNode }) => children,
    useAuth: () => ({ session: null, appUser: null, isLoading: false }),
    isAuthorized: () => false,
  };
});

import App from '../../src/App';

test('unauthenticated users are sent to login', async () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>,
  );

  expect(await screen.findByText('Sign in to access concerts.')).toBeInTheDocument();
});
