import { useEffect, useState } from 'react';
import { getMe, type ApiError } from './api';

type AuthState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'authenticated'; me: { id: string; email: string; full_name?: string | null; avatar_url?: string | null } };

export function useAuth() {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  async function refresh() {
    setState({ status: 'loading' });
    try {
      const me = await getMe();
      setState({ status: 'authenticated', me });
    } catch (e: any) {
      const err = e as ApiError;
      if (err?.status === 401) {
        setState({ status: 'anonymous' });
      } else {
        setState({ status: 'anonymous' });
      }
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { state, refresh };
}
