import { Navigate, Route, Routes } from 'react-router-dom';

import { AuthProvider, isAuthorized, useAuth } from './lib/useAuth';
import AccessDenied from './pages/AccessDenied';
import CalendarPage from './pages/CalendarPage';
import ConcertDetail from './pages/ConcertDetail';
import ConcertEdit from './pages/ConcertEdit';
import ConcertList from './pages/ConcertList';
import ContactDetail from './pages/ContactDetail';
import ContactList from './pages/ContactList';
import Login from './pages/Login';
import MapPage from './pages/MapPage';
import NotFound from './pages/NotFound';
import VenueDetail from './pages/VenueDetail';
import VenueList from './pages/VenueList';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, appUser, isLoading } = useAuth();

  // Keep the protected UI mounted during background refreshes (e.g. token refresh on tab focus),
  // otherwise in-progress form state gets wiped by an unmount/remount.
  if (isLoading && !(session && isAuthorized(appUser))) {
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
        <Route
          path="/calendar"
          element={
            <RequireAuth>
              <CalendarPage />
            </RequireAuth>
          }
        />
        <Route
          path="/map"
          element={
            <RequireAuth>
              <MapPage />
            </RequireAuth>
          }
        />
        <Route
          path="/venues"
          element={
            <RequireAuth>
              <VenueList />
            </RequireAuth>
          }
        />
        <Route
          path="/venues/:id"
          element={
            <RequireAuth>
              <VenueDetail />
            </RequireAuth>
          }
        />
        <Route
          path="/contacts"
          element={
            <RequireAuth>
              <ContactList />
            </RequireAuth>
          }
        />
        <Route
          path="/contacts/:id"
          element={
            <RequireAuth>
              <ContactDetail />
            </RequireAuth>
          }
        />
        <Route
          path="/concerts/new"
          element={
            <RequireAuth>
              <ConcertEdit mode="create" />
            </RequireAuth>
          }
        />
        <Route
          path="/concerts/:id"
          element={
            <RequireAuth>
              <ConcertDetail />
            </RequireAuth>
          }
        />
        <Route
          path="/concerts/:id/edit"
          element={
            <RequireAuth>
              <ConcertEdit mode="edit" />
            </RequireAuth>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  );
}
