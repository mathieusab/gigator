import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { fetchAppUser, getSession, type AppUser } from './supabaseAuth';
import { supabase } from './supabaseClient';

type AuthState = {
  session: Session | null;
  appUser: AppUser | null;
  isLoading: boolean;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        const initialSession = await getSession();
        if (!isMounted) return;

        setSession(initialSession);
        if (initialSession?.user?.id) {
          const u = await fetchAppUser(initialSession.user.id);
          if (!isMounted) return;
          setAppUser(u);
        } else {
          setAppUser(null);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void init();

    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setIsLoading(true);
      void (async () => {
        try {
          if (newSession?.user?.id) {
            const u = await fetchAppUser(newSession.user.id);
            setAppUser(u);
          } else {
            setAppUser(null);
          }
        } finally {
          setIsLoading(false);
        }
      })();
    });

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({ session, appUser, isLoading }),
    [session, appUser, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function isAuthorized(appUser: AppUser | null): boolean {
  return !!appUser?.is_active;
}
