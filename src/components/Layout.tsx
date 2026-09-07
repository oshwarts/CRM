import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  CalendarDays,
  Home,
  LogOut,
  Map as MapIcon,
  Settings,
  Stethoscope,
  Target,
} from 'lucide-react'
import { useAuth } from '../context/AuthProvider'
import { ProfileModal } from './ProfileModal'
import { classNames } from '../lib/utils'

const NAV = [
  { to: '/', label: 'דף הבית', icon: Home, end: true },
  { to: '/doctors', label: 'רופאים', icon: Stethoscope, end: false },
  { to: '/meetings', label: 'פגישות', icon: CalendarDays, end: false },
  { to: '/map', label: 'מפה', icon: MapIcon, end: false },
  { to: '/pipeline', label: 'פוטנציאליים', icon: Target, end: false },
  { to: '/reports', label: 'דוחות', icon: BarChart3, end: false },
  { to: '/settings', label: 'הגדרות', icon: Settings, end: false },
]

export function Layout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [showProfile, setShowProfile] = useState(false)

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-full">
      <aside className="sticky top-0 flex h-screen w-60 flex-col border-l border-slate-200 bg-white">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500 text-white">
            <Stethoscope size={18} />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight text-slate-800">A.M.I. CRM</p>
            <p className="text-xs text-slate-400">ניהול לקוחות רופאים</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                classNames(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-slate-600 hover:bg-slate-100',
                )
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-200 p-3">
          <button
            className="mb-1 w-full rounded-lg px-2 py-1.5 text-right text-xs text-slate-500 hover:bg-slate-100"
            onClick={() => setShowProfile(true)}
          >
            {profile?.full_name || profile?.email || 'הפרופיל שלי'}
            {profile?.role === 'admin' && ' · מנהל'}
            <span className="block text-[11px] text-brand-500">עריכת פרופיל</span>
          </button>
          <button className="btn-ghost w-full justify-start" onClick={handleSignOut}>
            <LogOut size={16} />
            התנתקות
          </button>
          <p className="mt-1 px-2 text-center text-[10px] text-slate-300">
            v11 · MAKO ▲▼ לכל ערך
          </p>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-6xl px-6 py-6">
          <Outlet />
        </div>
      </main>

      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
    </div>
  )
}
