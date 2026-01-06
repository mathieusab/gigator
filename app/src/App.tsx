import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { CalendarPage } from './pages/CalendarPage'
import { ConcertDetailPage } from './pages/ConcertDetailPage'
import { ConcertsPage } from './pages/ConcertsPage'
import { MapPage } from './pages/MapPage'

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Navigate to="/concerts" replace />} />
        <Route path="/concerts" element={<ConcertsPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/concerts/:id" element={<ConcertDetailPage />} />
        <Route path="*" element={<Navigate to="/concerts" replace />} />
      </Route>
    </Routes>
  )
}
