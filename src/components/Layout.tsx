import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  CalendarDays,
  Home,
  LogOut,
  Map as MapIcon,
  Menu,
  ScanLine,
  Settings,
  Stethoscope,
  Target,
  X,
} from 'lucide-react'
import { useAuth } from '../context/AuthProvider'
import { ProfileModal } from './ProfileModal'
import { classNames } from '../lib/utils'

const NAV = [
  { to: '/', label: 'דף הבית', short: 'בית', icon: Home, end: true },
  { to: '/doctors', label: 'רופאים', short: 'רופאים', icon: Stethoscope, end: false },
  { to: '/meetings', label: 'פגישות', short: 'פגישות', icon: CalendarDays, end: false },
  { to: '/map', label: 'מפה', short: 'מפה', icon: MapIcon, end: false },
  { to: '/scans', label: 'סריקות MAKO', short: 'סריקות', icon: ScanLine, end: false },
  { to: '/pipeline', label: 'פוטנציאליים', short: 'פוטנציאליים', icon: Target, end: false },
  { to: '/reports', label: 'דוחות', short: 'דוחות', icon: BarChart3, end: false },
  { to: '/settings', label: 'הגדרות', short: 'הגדרות', icon: Settings, end: false },
]

// the five destinations reachable with one thumb tap on a phone
const TABS = ['/', '/doctors', '/meetings', '/scans', '/map']

const VERSION = 'v18 · תיקון טופס בנייד'

export function Layout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [showProfile, setShowProfile] = useState(false)
  const [drawer, setDrawer] = useState(false)

  useEffect(() => setDrawer(false), [location.pathname])

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    classNames(
      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition md:py-2',
      isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100',
    )

  const account = (
    <div className="border-t border-slate-200 p-3">
      <button
        className="mb-1 w-full rounded-lg px-2 py-1.5 text-right text-xs text-slate-500 hover:bg-slate-100"
        onClick={() => {
          setDrawer(false)
          setShowProfile(true)
        }}
      >
        {profile?.full_name || profile?.email || 'הפרופיל שלי'}
        {profile?.role === 'admin' && ' · מנהל'}
        <span className="block text-[11px] text-brand-500">עריכת פרופיל</span>
      </button>
      <button className="btn-ghost w-full justify-start" onClick={handleSignOut}>
        <LogOut size={16} />
        התנתקות
      </button>
      <p className="mt-1 px-2 text-center text-[10px] text-slate-300">{VERSION}</p>
    </div>
  )

  const brand = (
    <div className="flex items-center gap-2">
      <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500 text-white">
        <Stethoscope size={18} />
      </div>
      <div>
        <p className="text-sm font-bold leading-tight text-slate-800">A.M.I. CRM</p>
        <p className="text-xs text-slate-400">ניהול לקוחות רופאים</p>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-full">
      {/* desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 flex-col border-l border-slate-200 bg-white md:flex">
        <div className="px-5 py-5">{brand}</div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={navLinkClass}>
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        {account}
      </aside>

      {/* mobile top bar */}
      <header className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 pb-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] backdrop-blur md:hidden">
        {brand}
        <button
          className="btn-ghost !px-2"
          onClick={() => setDrawer(true)}
          aria-label="תפריט"
        >
          <Menu size={22} />
        </button>
      </header>

      {/* mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 right-0 flex w-72 max-w-[85%] flex-col bg-white pt-[env(safe-area-inset-top)] shadow-xl">
            <div className="flex items-center justify-between px-4 py-4">
              {brand}
              <button className="btn-ghost !px-2" onClick={() => setDrawer(false)} aria-label="סגור">
                <X size={20} />
              </button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto px-3">
              {NAV.map(({ to, label, icon: Icon, end }) => (
                <NavLink key={to} to={to} end={end} className={navLinkClass}>
                  <Icon size={18} />
                  {label}
                </NavLink>
              ))}
            </nav>
            <div className="pb-[env(safe-area-inset-bottom)]">{account}</div>
          </aside>
        </div>
      )}

      <main className="min-w-0 flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-6xl px-3 pb-[calc(env(safe-area-inset-bottom)+5rem)] pt-[calc(env(safe-area-inset-top)+4.5rem)] md:px-6 md:pb-6 md:pt-6">
          <Outlet />
        </div>
      </main>

      {/* mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {NAV.filter((n) => TABS.includes(n.to)).map(({ to, short, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              classNames(
                'flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium',
                isActive ? 'text-brand-600' : 'text-slate-400',
              )
            }
          >
            <Icon size={20} />
            {short}
          </NavLink>
        ))}
      </nav>

      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
    </div>
  )
}
