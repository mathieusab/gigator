import { useState } from 'react';
import GoogleSignInButton from '../components/GoogleSignInButton';
import { signInWithGoogle } from '../lib/supabaseAuth';

export default function Login() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    setError(null);
    setIsLoading(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed');
      setIsLoading(false);
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif', maxWidth: 480 }}>
      <h1>Gigator</h1>
      <p>Sign in to access concerts.</p>
      <GoogleSignInButton onClick={handleSignIn} disabled={isLoading} />
      {error ? (
        <p role="alert" style={{ marginTop: 12, color: 'crimson' }}>
          {error}
        </p>
      ) : null}
    </main>
  );
}
