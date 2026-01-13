import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

const gmailProxyMocks = vi.hoisted(() => {
  return {
    listGmailThreadsForEmail: vi.fn(),
    startGmailOAuth: vi.fn(),
    getGmailThreadById: vi.fn(),
    getGmailMessageById: vi.fn(),
  };
});

vi.mock('../../src/lib/useAuth', () => {
  const session = { access_token: 'app-token' };

  return {
    useAuth: () => ({
      session,
      appUser: { id: 'user-1', is_active: true },
      isLoading: false,
    }),
  };
});

vi.mock('../../src/services/gmailProxy', () => {
  return gmailProxyMocks;
});

describe('GmailThreads error states', () => {
  let GmailThreads: (props: { email: string }) => JSX.Element;

  beforeAll(async () => {
    const mod = await import('../../src/components/GmailThreads');
    GmailThreads = mod.default;
  });

  beforeEach(() => {
    gmailProxyMocks.listGmailThreadsForEmail.mockReset();
    gmailProxyMocks.startGmailOAuth.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  test('prompts to connect when Gmail is not connected', async () => {
    gmailProxyMocks.listGmailThreadsForEmail.mockRejectedValue(new Error('Gmail not connected'));

    render(<GmailThreads email="contact@example.com" />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Gmail not connected');
    expect(await screen.findByRole('button', { name: /connecter gmail/i })).toBeInTheDocument();
  });

  test('prompts to reconnect when token refresh fails', async () => {
    gmailProxyMocks.listGmailThreadsForEmail.mockRejectedValue(
      new Error('Failed to refresh Gmail access token. Reconnect Gmail.'),
    );

    render(<GmailThreads email="contact@example.com" />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/reconnect gmail/i);
    expect(await screen.findByRole('button', { name: /connecter gmail/i })).toBeInTheDocument();
  });
});
