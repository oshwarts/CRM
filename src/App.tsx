import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthProvider'
import { Layout } from './components/Layout'
import { Spinner } from './components/ui'
import Login from './pages/Login'
import Home from './pages/Home'
import Doctors from './pages/Doctors'
import DoctorProfile from './pages/DoctorProfile'
import Meetings from './pages/Meetings'
import MeetingView from './pages/MeetingView'
import MapPage from './pages/MapPage'
import Pipeline from './pages/Pipeline'
import Reports from './pages/Reports'
import Scans from './pages/Scans'
import Schedule from './pages/Schedule'
import Info from './pages/Info'
import Consumables from './pages/Consumables'
import Settings from './pages/Settings'
import Users from './pages/Users'
import Tasks from './pages/Tasks'
import Competitors from './pages/Competitors'
import Pending from './pages/Pending'

export default function App() {
  const { session, loading, profile } = useAuth()

  if (loading) {
    return (
      <div className="grid h-full place-items-center">
        <Spinner label="טוען את המערכת…" />
      </div>
    )
  }

  if (!session) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  // signed in but not approved yet (new sign-up) or deactivated by an admin
  if (profile && profile.active === false) return <Pending />

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/doctors" element={<Doctors />} />
        <Route path="/doctors/:id" element={<DoctorProfile />} />
        <Route path="/meetings" element={<Meetings />} />
        <Route path="/meetings/:id" element={<MeetingView />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/pipeline" element={<Pipeline />} />
        <Route path="/scans" element={<Scans />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/info" element={<Info />} />
        <Route path="/consumables" element={<Consumables />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/users" element={<Users />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/competitors" element={<Competitors />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
