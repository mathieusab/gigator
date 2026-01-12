import { supabase } from './supabaseClient';

export type AppUser = {
  id: string;
  email: string;
  is_active: boolean;
  name: string | null;
  picture: string | null;
};

export async function signInWithGoogle(): Promise<void> {
  const redirectTo = `${window.location.origin}/`;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
    },
  });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function fetchAppUser(userId: string): Promise<AppUser | null> {
  const { data, error } = await supabase
    .from('app_users')
    .select('id,email,is_active,name,picture')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}
