import { Navigate, Route, Routes } from 'react-router-dom'
import { AppGateLayout } from './components/AppGateLayout'
import { CalendarPage } from './pages/CalendarPage'
import { ConcertDetailPage } from './pages/ConcertDetailPage'
import { ConcertsPage } from './pages/ConcertsPage'
import { ContactsPage } from './pages/ContactsPage'
import { MapPage } from './pages/MapPage'
import { NewConcertPage } from './pages/NewConcertPage'
import { VenuesPage } from './pages/VenuesPage'

export default function App() {
  return (
    <Routes>
      <Route element={<AppGateLayout />}>
        <Route path="/" element={<Navigate to="/concerts" replace />} />
        <Route path="/concerts" element={<ConcertsPage />} />
        <Route path="/concerts/new" element={<NewConcertPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/contacts" element={<ContactsPage />} />
        <Route path="/venues" element={<VenuesPage />} />
        <Route path="/concerts/:id" element={<ConcertDetailPage />} />
        <Route path="*" element={<Navigate to="/concerts" replace />} />
      </Route>
    </Routes>
  )
}
