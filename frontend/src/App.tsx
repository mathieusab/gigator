import { Navigate, Route, Routes } from 'react-router-dom';

import { AuthProvider, isAuthorized, useAuth } from './lib/useAuth';
import AccessDenied from './pages/AccessDenied';
import ConcertList from './pages/ConcertList';
import Login from './pages/Login';
import NotFound from './pages/NotFound';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, appUser, isLoading } = useAuth();

  if (isLoading) {
    return (
      <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
        <p>Loading…</p>
      </main>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (!isAuthorized(appUser)) {
    return <Navigate to="/access-denied" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/access-denied" element={<AccessDenied />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <ConcertList />
            </RequireAuth>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  );
}
