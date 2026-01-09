import { useState } from 'react';
import { startAppLogin } from '../api';

export function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onLogin() {
    setError(null);
    setLoading(true);
    try {
      const { oauth_url } = await startAppLogin();
      window.location.href = oauth_url;
    } catch (e: any) {
      setError(e?.message || e?.error || 'Login failed');
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 16, maxWidth: 720, margin: '0 auto' }}>
      <h1>Gigator</h1>
      <p>Connecte-toi avec Google (emails autorisés uniquement).</p>
      <button onClick={onLogin} disabled={loading}>
        {loading ? 'Redirection…' : 'Se connecter avec Google'}
      </button>
      {error ? (
        <p role="alert" style={{ marginTop: 12 }}>
          Erreur: {error}
        </p>
      ) : null}
      <p style={{ marginTop: 12, fontSize: 12 }}>
        Dev: configure <code>APP_OAUTH_SUCCESS_REDIRECT_URI</code> vers l’URL du frontend (ex: http://localhost:5173/).
      </p>
    </main>
  );
}
