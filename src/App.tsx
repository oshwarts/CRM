import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthProvider'
import { Layout } from './components/Layout'
import { Spinner } from './components/ui'
import Login from './pages/Login'
import Home from './pages/Home'
import { AdminOnly } from './components/AdminOnly'
import Pending from './pages/Pending'
import SetPassword from './pages/SetPassword'

// The pages are loaded when they are opened (the first screen stays small and fast on a phone). After the first screen is
// shown the rest is fetched quietly in the background, so that every page also opens without a network afterwards.
const load = {
  Doctors: () => import('./pages/Doctors'),
  DoctorProfile: () => import('./pages/DoctorProfile'),
  Meetings: () => import('./pages/Meetings'),
  MeetingView: () => import('./pages/MeetingView'),
  Hospitals: () => import('./pages/Hospitals'),
  HospitalView: () => import('./pages/HospitalView'),
  Reports: () => import('./pages/Reports'),
  Scans: () => import('./pages/Scans'),
  Schedule: () => import('./pages/Schedule'),
  Info: () => import('./pages/Info'),
  Consumables: () => import('./pages/Consumables'),
  Settings: () => import('./pages/Settings'),
  MenuSettings: () => import('./pages/MenuSettings'),
  Users: () => import('./pages/Users'),
  Tasks: () => import('./pages/Tasks'),
  Agents: () => import('./pages/Agents'),
  AgentView: () => import('./pages/AgentView'),
  Projects: () => import('./pages/Projects'),
  ProjectView: () => import('./pages/ProjectView'),
  Competitors: () => import('./pages/Competitors'),
  CompetitorView: () => import('./pages/CompetitorView'),
  Learn: () => import('./pages/Learn'),
  Now: () => import('./pages/Now'),
  LearnTopic: () => import('./pages/LearnTopic'),
  LearnReview: () => import('./pages/LearnReview'),
}
const Doctors = lazy(load.Doctors)
const DoctorProfile = lazy(load.DoctorProfile)
const Meetings = lazy(load.Meetings)
const MeetingView = lazy(load.MeetingView)
const Hospitals = lazy(load.Hospitals)
const HospitalView = lazy(load.HospitalView)
const Reports = lazy(load.Reports)
const Scans = lazy(load.Scans)
const Schedule = lazy(load.Schedule)
const Info = lazy(load.Info)
const Consumables = lazy(load.Consumables)
const Settings = lazy(load.Settings)
const MenuSettings = lazy(load.MenuSettings)
const Users = lazy(load.Users)
const Tasks = lazy(load.Tasks)
const Agents = lazy(load.Agents)
const AgentView = lazy(load.AgentView)
const Projects = lazy(load.Projects)
const ProjectView = lazy(load.ProjectView)
const Competitors = lazy(load.Competitors)
const CompetitorView = lazy(load.CompetitorView)
const Learn = lazy(load.Learn)
const Now = lazy(load.Now)
const LearnTopic = lazy(load.LearnTopic)
const LearnReview = lazy(load.LearnReview)

function Page({ children }: { children: ReactNode }) {
  return <Suspense fallback={<Spinner />}>{children}</Suspense>
}

function preloadPages() {
  const run = () => Object.values(load).forEach((l) => void l().catch(() => undefined))
  const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback
  if (idle) idle(run, { timeout: 8000 })
  else setTimeout(run, 3000)
}

export default function App() {
  const { session, loading, realProfile, recovering } = useAuth()
  const signedIn = !!session
  useEffect(() => {
    if (signedIn) preloadPages()
  }, [signedIn])

  if (loading) {
    return (
      <div className="grid h-full place-items-center">
        <Spinner label="טוען את המערכת…" />
      </div>
    )
  }

  // opened from a password-reset link: choose the new password first
  if (session && recovering) return <SetPassword />

  if (!session) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  // signed in but not approved yet (new sign-up) or deactivated by an admin
  if (realProfile && realProfile.active === false) return <Pending />

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/now" element={<Page><Now /></Page>} />
        <Route path="/doctors" element={<Page><Doctors /></Page>} />
        <Route path="/doctors/:id" element={<Page><DoctorProfile /></Page>} />
        <Route path="/meetings" element={<Page><Meetings /></Page>} />
        <Route path="/meetings/:id" element={<Page><MeetingView /></Page>} />
        <Route path="/map" element={<Page><Hospitals /></Page>} />
        <Route path="/hospitals/:id" element={<Page><HospitalView /></Page>} />
        <Route path="/pipeline" element={<Navigate to="/doctors?status=potential" replace />} />
        <Route path="/scans" element={<Page><Scans /></Page>} />
        <Route path="/schedule" element={<Page><Schedule /></Page>} />
        <Route path="/info" element={<Page><Info /></Page>} />
        <Route path="/consumables" element={<Page><Consumables /></Page>} />
        <Route path="/reports" element={<Page><Reports /></Page>} />
        <Route path="/menu" element={<Page><MenuSettings /></Page>} />
        <Route path="/settings" element={<Page><AdminOnly><Settings /></AdminOnly></Page>} />
        <Route path="/users" element={<Page><Users /></Page>} />
        <Route path="/tasks" element={<Page><Tasks /></Page>} />
        <Route path="/agents" element={<Page><Agents /></Page>} />
        <Route path="/agents/:id" element={<Page><AgentView /></Page>} />
        <Route path="/projects" element={<Page><Projects /></Page>} />
        <Route path="/projects/:id" element={<Page><ProjectView /></Page>} />
        <Route path="/competitors" element={<Page><Competitors /></Page>} />
        <Route path="/competitors/:id" element={<Page><CompetitorView /></Page>} />
        <Route path="/learn" element={<Page><Learn /></Page>} />
        <Route path="/learn/review" element={<Page><LearnReview /></Page>} />
        <Route path="/learn/:id" element={<Page><LearnTopic /></Page>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
