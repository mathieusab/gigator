import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './AppShell';
import { useAuth } from './auth';
import { ContactsPage } from './pages/ContactsPage';
import { LoginPage } from './pages/LoginPage';
import { VenuesPage } from './pages/VenuesPage';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { state } = useAuth();
  if (state.status === 'loading') return <p style={{ padding: 16 }}>Chargement…</p>;
  if (state.status === 'anonymous') return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function HomeRedirect() {
  const { state } = useAuth();
  if (state.status === 'loading') return <p style={{ padding: 16 }}>Chargement…</p>;
  if (state.status === 'anonymous') return <Navigate to="/login" replace />;
  return <Navigate to="/venues" replace />;
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <main>
      <h2>{title}</h2>
      <p>À implémenter.</p>
    </main>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/login" element={<LoginPage />} />

        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route path="/venues" element={<VenuesPage />} />
          <Route path="/contacts" element={<ContactsPage />} />
          <Route path="/opportunities" element={<PlaceholderPage title="Opportunités" />} />
          <Route path="/admin/members" element={<PlaceholderPage title="Membres" />} />
        </Route>

        <Route path="*" element={<p style={{ padding: 16 }}>Page introuvable</p>} />
      </Routes>
    </BrowserRouter>
  );
}
