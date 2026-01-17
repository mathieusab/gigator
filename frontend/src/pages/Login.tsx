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
    <main className="container" style={{ maxWidth: 520 }}>
      <div className="card card-pad">
        <h1 className="h1">Gigator</h1>
        <p className="p-muted" style={{ marginTop: 8 }}>
          Sign in to access concerts.
        </p>
        <div style={{ marginTop: 12 }}>
          <GoogleSignInButton onClick={handleSignIn} disabled={isLoading} />
        </div>
        {error ? (
          <p role="alert" style={{ marginTop: 12, color: 'crimson' }}>
            {error}
          </p>
        ) : null}
      </div>
    </main>
  );
}
