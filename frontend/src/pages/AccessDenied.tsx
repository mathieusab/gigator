import { signOut } from '../lib/supabaseAuth';

export default function AccessDenied() {
  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif', maxWidth: 640 }}>
      <h1>Access denied</h1>
      <p>Your account is not authorized to use this app.</p>
      <button type="button" onClick={() => void signOut()}>
        Sign out
      </button>
    </main>
  );
}
