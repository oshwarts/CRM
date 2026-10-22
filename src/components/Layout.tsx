import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import {
  ArrowRight,
  LogOut,
  SlidersHorizontal,
  ChevronDown,
  Pencil,
  Plus,
  Search,
  Menu,
  X,
  Lightbulb,
} from 'lucide-react'
import { useAuth } from '../context/AuthProvider'
import { ProfileModal } from './ProfileModal'
import { SuggestionModal } from './SuggestionModal'
import { RefreshButton } from './RefreshButton'
import { OfflineBanner } from './OfflineBanner'
import { DeveloperBar, DeveloperSwitcher } from './DeveloperSwitch'
import { BrandLogo } from './BrandLogo'
import { GlobalSearch } from './GlobalSearch'
import { QuickCreate } from './QuickCreate'
import { ThemeToggle } from './ThemeToggle'
import { usePendingSignups, useTasks } from '../lib/api'
import { NAV } from '../lib/navItems'
import { useMenu } from '../lib/useMenu'
import { clearOutbox, drain, outboxSize } from '../lib/outbox'
import { classNames, todayISO } from '../lib/utils'
import { useLocalSetting } from '../lib/useLocalSetting'
import { useLiveUpdates } from '../lib/liveUpdates'
import { useErrorLog } from '../lib/errorLog'
import { ErrorBoundary } from './ErrorBoundary'
import { useIdleLogout } from '../lib/idleLogout'
import { useThemeSync } from '../lib/theme'
import { useDialog } from './ui'


// the four destinations next to the "+" button on a phone
const TABS = ['/', '/doctors', '/tasks', '/schedule']

// scroll position of each visited page, so that going back returns to the same place
const scrollOf = new Map<string, number>()

const VERSION = 'v134 · סריקות: נדחה / בוטל, ברירת מחדל ניתוחים של השבועיים הקרובים לפי הסדר, בלי ניתוחים ישנים'

// a failure of the shell itself (not of one screen) also ends in a message with a way out, never in a blank page
export function Layout() {
  return (
    <ErrorBoundary version={VERSION}>
      <Shell />
    </ErrorBoundary>
  )
}

function Shell() {
  const { profile, signOut, impersonating, isDeveloper } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [showProfile, setShowProfile] = useState(false)
  const [showSuggest, setShowSuggest] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const [searching, setSearching] = useState(false)
  const [creating, setCreating] = useState(false)
  const { navItems, groups, favorites } = useMenu()
  const [accountOpen, setAccountOpen] = useLocalSetting<boolean>('menu.account', false)
  const [openGroups, setOpenGroups] = useLocalSetting<string[]>('menu.open', [])
  const navType = useNavigationType()
  const drawerBox = useRef<HTMLElement>(null)
  const idleBox = useRef<HTMLDivElement>(null)
  const tasks = useTasks()
  const { user } = useAuth()
  // other people's changes appear by themselves, and an error on this screen is recorded for the managers
  useLiveUpdates(!!user)
  useErrorLog(VERSION, !!user)
  useThemeSync()
  // the app has been running for a while, so the "reload once for a new version" guards are cleared: the next deploy may reload again
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        sessionStorage.removeItem('ami.reloadedForChunk')
        sessionStorage.removeItem('ami.reloadedForUpdate')
      } catch {
        // no storage
      }
    }, 15_000)
    return () => clearTimeout(t)
  }, [])
  const hasPrevious = () => (typeof window.history.state?.idx === 'number' ? window.history.state.idx > 0 : location.key !== 'default')
  const todayStr = todayISO() // local date (UTC is a day behind in Israel after midnight)
  // overdue tasks of mine: a small red-pink counter next to "tasks"
  const pendingSignups = usePendingSignups().data?.length ?? 0
  const overdue = (tasks.data ?? []).filter((t) => !t.is_done && t.status !== 'done' && t.assignee_id === user?.id && !!t.due_date && t.due_date < todayStr).length

  // Ctrl/Cmd+K opens the search from anywhere
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearching(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // going back returns to where the page was scrolled; a new page opens at the top
  const keyRef = useRef(location.key)
  useEffect(() => {
    keyRef.current = location.key
    const y = scrollOf.get(location.key)
    if (navType === 'POP' && y) [0, 120, 350].forEach((ms) => setTimeout(() => window.scrollTo(0, y), ms))
    else window.scrollTo(0, 0)
  }, [location.key, navType])
  useEffect(() => {
    const onScroll = () => scrollOf.set(keyRef.current, window.scrollY)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => setDrawer(false), [location.pathname])

  // the tab and the screen reader say where we are: the title of the page, kept in step with its main heading
  useEffect(() => {
    const main = document.querySelector('main')
    let queued: ReturnType<typeof setTimeout> | undefined
    const set = () => {
      queued = undefined
      const h = main?.querySelector('h1')?.textContent?.trim()
      document.title = h ? `${h} · AMI CRM` : 'AMI CRM'
    }
    set()
    if (!main) return
    const obs = new MutationObserver(() => {
      // a short wait lets a burst of changes finish; (not requestAnimationFrame: it does not run while the tab is hidden)
      queued ??= setTimeout(set, 30)
    })
    obs.observe(main, { childList: true, subtree: true, characterData: true })
    return () => {
      obs.disconnect()
      clearTimeout(queued)
    }
  }, [location.pathname])


  async function handleSignOut() {
    // changes made offline that were not sent yet are lost on sign out — try to send them first
    if (outboxSize()) {
      await drain()
      const left = outboxSize()
      if (left > 0 && !window.confirm(`יש ${left} שינויים שעדיין לא נשלחו לשרת. התנתקות תמחק אותם. להמשיך?`)) return
    }
    await clearOutbox()
    await signOut()
    navigate('/login', { replace: true })
  }

  // a device nobody touches for hours signs itself out (after a question a minute before)
  const idle = useIdleLogout(!!user, () => void handleSignOut())
  useDialog(drawer, () => setDrawer(false), drawerBox)
  useDialog(idle.warning > 0, idle.stay, idleBox)

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    classNames(
      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition md:py-2',
      isActive ? 'bg-brand-50 text-brand-700 shadow-[inset_-3px_0_0_var(--blue)]' : 'text-slate-600 hover:bg-brand-50/60 hover:text-brand-700',
    )

  const account = (
    <div className="border-t border-slate-200 px-2 py-2">
      {accountOpen && (
        <div className="mb-2 space-y-1.5 rounded-xl bg-slate-50 p-2">
          <button
            type="button"
            className="flex min-h-[40px] w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-brand-700 hover:bg-brand-50"
            onClick={() => {
              setDrawer(false)
              setShowSuggest(true)
            }}
          >
            <Lightbulb size={14} aria-hidden /> הצעה לשיפור המערכת
          </button>
          <DeveloperSwitcher />
          <ThemeToggle />
          <p className="text-center text-[10px] text-slate-500">{VERSION}</p>
        </div>
      )}
      <div className="flex items-center gap-1">
        <button
          className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-1.5 py-1 text-right hover:bg-slate-100"
          title="עריכת פרופיל"
          onClick={() => {
            setDrawer(false)
            setShowProfile(true)
          }}
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#00326d] text-sm font-semibold text-white">
            {((profile?.full_name || profile?.email || '?').trim()[0] ?? '?').toUpperCase()}
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-xs font-medium text-slate-700">{profile?.full_name || profile?.email || 'הפרופיל שלי'}</span>
            <span className="block truncate text-[11px] text-slate-500">{profile?.role === 'admin' ? 'מנהל' : 'סוכן'}</span>
          </span>
        </button>
        <RefreshButton />
        <button
          className={classNames('btn-ghost relative !px-2', accountOpen && 'bg-slate-100')}
          aria-label="מראה, גודל תצוגה ומצב מפתח"
          aria-expanded={accountOpen}
          title="מראה ותצוגה"
          onClick={() => setAccountOpen((v) => !v)}
        >
          <SlidersHorizontal size={18} />
          {isDeveloper && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-amber-500" />}
        </button>
        <button className="btn-ghost !px-2" aria-label="התנתקות" title="התנתקות" onClick={handleSignOut}>
          <LogOut size={18} />
        </button>
      </div>
    </div>
  )

  const brand = <BrandLogo size="md" />

  // the counters next to a page: my overdue tasks, people waiting for approval
  const badgeOf = (to: string) =>
    to === '/tasks' && overdue > 0
      ? { n: overdue, cls: 'bg-accent', title: 'משימות באיחור' }
      : to === '/users' && pendingSignups > 0
        ? { n: pendingSignups, cls: 'bg-amber-700', title: 'משתמשים שממתינים לאישור' }
        : null

  const renderItem = ({ to, label, icon: Icon, end }: (typeof NAV)[number]) => {
    const badge = badgeOf(to)
    return (
      <NavLink key={to} to={to} end={end} className={navLinkClass}>
        <Icon size={18} aria-hidden />
        {label}
        {badge && (
          <span className={classNames('mr-auto rounded-full px-2 py-0.5 text-xs font-semibold text-white', badge.cls)} title={badge.title} aria-label={`${badge.title}: ${badge.n}`}>
            {badge.n}
          </span>
        )}
      </NavLink>
    )
  }

  // the menu: home, then my favourites (in my order), then the rest in folding groups (the group of the open page opens by itself)
  const renderNav = () => {
    const home = navItems.find((n) => n.to === '/')
    const favItems = favorites.map((to) => navItems.find((n) => n.to === to)).filter((n): n is (typeof NAV)[number] => !!n && n.to !== '/')
    return (
      <>
        {home && <div className="space-y-0.5">{renderItem(home)}</div>}
        <div className="pt-3">
          <div className="flex items-center justify-between px-3 pb-1">
            <p className="text-xs font-semibold text-slate-500">המועדפים שלי</p>
            <NavLink to="/menu" className="flex min-h-[28px] items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-brand-600 hover:bg-brand-50" onClick={() => setDrawer(false)}>
              <Pencil size={12} /> התאמת התפריט
            </NavLink>
          </div>
          <div className="space-y-0.5">
            {favItems.map(renderItem)}
            {favItems.length === 0 && <p className="px-3 py-2 text-xs text-slate-500">אין מועדפים — "התאמת התפריט" מאפשרת לבחור את הדפים שחשובים לך</p>}
          </div>
        </div>
        {groups.map((g) => {
          const items = g.paths.map((to) => navItems.find((n) => n.to === to)).filter((n): n is (typeof NAV)[number] => !!n && !favorites.includes(n.to))
          if (items.length === 0) return null
          const hasActive = items.some((n) => location.pathname === n.to || (n.to !== '/' && location.pathname.startsWith(n.to + '/')))
          const open = hasActive || openGroups.includes(g.id)
          // a folded group still shows that something inside it needs attention
          const attention = open ? 0 : items.reduce((n, it) => n + (badgeOf(it.to)?.n ?? 0), 0)
          return (
            <div key={g.id} className="pt-3">
              <button
                type="button"
                className="flex min-h-[36px] w-full items-center justify-between gap-2 rounded-lg px-3 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100"
                aria-expanded={open}
                onClick={() => setOpenGroups((o) => (o.includes(g.id) ? o.filter((x) => x !== g.id) : [...o, g.id]))}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate">
                    {g.title} <span className="font-normal text-slate-500">({items.length})</span>
                  </span>
                  {attention > 0 && (
                    <span className="rounded-full bg-accent px-1.5 text-[11px] font-semibold leading-4 text-white" aria-label={`דורשים תשומת לב: ${attention}`}>
                      {attention}
                    </span>
                  )}
                </span>
                <ChevronDown size={14} aria-hidden className={classNames('shrink-0 transition', open && 'rotate-180')} />
              </button>
              {open && <div className="mt-1 space-y-0.5">{items.map(renderItem)}</div>}
            </div>
          )
        })}
      </>
    )
  }

  const searchButton = (
    <button
      className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 transition hover:border-brand-300 hover:bg-white"
      onClick={() => setSearching(true)}
    >
      <Search size={16} />
      <span className="flex-1 text-right">חיפוש…</span>
      <kbd className="hidden rounded border border-slate-300 bg-white px-1.5 text-[11px] text-slate-500 md:inline">Ctrl K</kbd>
    </button>
  )

  return (
    <div className="flex min-h-full" style={impersonating ? ({ '--banner': '2.5rem' } as React.CSSProperties) : undefined}>
      <a href="#main-content" className="sr-only z-[100] rounded-lg bg-white text-sm font-medium text-brand-700 shadow-pop focus:not-sr-only focus:fixed focus:right-3 focus:top-3 focus:px-4 focus:py-2">
        דלג לתוכן הראשי
      </a>
      <DeveloperBar />
      {/* desktop sidebar */}
      <aside className="sticky top-[var(--banner,0px)] hidden h-[calc(100dvh-var(--banner,0px))] w-64 flex-col border-l border-brand-100 bg-white md:flex">
        <div className="px-5 pb-3 pt-5">{brand}</div>
        <div className="space-y-2 px-3 pb-3">
          {searchButton}
          <button className="btn-primary w-full" onClick={() => setCreating(true)}>
            <Plus size={16} /> חדש
          </button>
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-2">{renderNav()}</nav>
        {account}
      </aside>

      {/* mobile top bar */}
      <header className="fixed inset-x-0 top-[var(--banner,0px)] z-30 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 pb-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] backdrop-blur md:hidden">
        {/* the menu button is on the right edge (easier for the right thumb) */}
        <div className="flex items-center gap-1">
          <button className="btn-ghost !px-2" onClick={() => setDrawer(true)} aria-label="תפריט">
            <Menu size={24} />
          </button>
          {brand}
        </div>
        <span className="flex items-center gap-1">
          <button className="btn-ghost !px-2" onClick={() => setSearching(true)} aria-label="חיפוש">
            <Search size={22} />
          </button>
          <RefreshButton />
        </span>
      </header>

      {/* mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setDrawer(false)} />
          <aside ref={drawerBox} role="dialog" aria-modal="true" aria-label="תפריט" tabIndex={-1} className="absolute bottom-0 right-0 top-[var(--banner,0px)] flex w-72 max-w-[85%] flex-col bg-white pt-[env(safe-area-inset-top)] shadow-xl outline-none">
            <div className="flex items-center justify-between px-4 py-4">
              {brand}
              <button className="btn-ghost !px-2" onClick={() => setDrawer(false)} aria-label="סגור את התפריט">
                <X size={20} />
              </button>
            </div>
            <nav className="min-h-0 flex-1 overflow-y-auto px-3">{renderNav()}</nav>
            <div className="pb-[env(safe-area-inset-bottom)]">{account}</div>
          </aside>
        </div>
      )}

      <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 overflow-x-clip outline-none">
        <div className="mx-auto max-w-6xl px-3 pb-[calc(env(safe-area-inset-bottom)+5rem+var(--offline-h,0px))] pt-[calc(env(safe-area-inset-top)+4.5rem+var(--banner,0px))] md:px-6 md:pb-[calc(1.5rem+var(--offline-h,0px))] md:pt-[calc(1.5rem+var(--banner,0px))]">
          {location.pathname !== '/' && (
            <button
              type="button"
              className="mb-3 inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              // the page before this one; when the app was opened straight on this page there is none, so go home
              // (the first entry of the history is called "default"; a browser keeps its position in history.state.idx)
              onClick={() => (hasPrevious() ? navigate(-1) : navigate('/'))}
            >
              <ArrowRight size={16} />
              חזרה
            </button>
          )}
          <ErrorBoundary key={location.pathname} version={VERSION}>
            <Outlet />
          </ErrorBoundary>
        </div>
      </main>
      {idle.warning > 0 && (
        <div className="fixed inset-0 z-[95] grid place-items-center bg-slate-900/50 p-4" role="alertdialog" aria-modal="true" aria-label="עדיין כאן?">
          <div ref={idleBox} tabIndex={-1} className="w-full max-w-sm space-y-3 rounded-2xl bg-white p-5 text-center shadow-pop outline-none">
            <h2 className="text-lg font-semibold text-brand-800">עדיין כאן?</h2>
            <p className="text-sm text-slate-600">לא נגעת במסך זמן רב. להגנה על פרטי המטופלים תתבצע התנתקות אוטומטית בעוד {idle.warning} שניות.</p>
            <button className="btn-primary w-full" autoFocus onClick={idle.stay}>
              כן, אני כאן
            </button>
          </div>
        </div>
      )}

      {/* mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 items-end border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {[...TABS.slice(0, 2), '+', ...TABS.slice(2)].map((to) =>
          to === '+' ? (
            <button key="+" className="relative -top-3 mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand-500 text-white shadow-pop transition active:scale-95" onClick={() => setCreating(true)} aria-label="הוספה חדשה">
              <Plus size={28} />
            </button>
          ) : (
            (() => {
              const n = NAV.find((x) => x.to === to)!
              const Icon = n.icon
              return (
                <NavLink
                  key={to}
                  to={to}
                  end={n.end}
                  className={({ isActive }) => classNames('relative flex flex-col items-center gap-0.5 py-2 text-xs font-medium', isActive ? 'text-brand-600' : 'text-slate-500')}
                >
                  <Icon size={22} />
                  {n.short}
                  {to === '/tasks' && overdue > 0 && <span className="absolute right-[calc(50%-1.6rem)] top-0.5 min-w-4 rounded-full bg-accent px-1 text-center text-[10px] font-semibold leading-4 text-white">{overdue}</span>}
                </NavLink>
              )
            })()
          ),
        )}
      </nav>

      <OfflineBanner />
      {searching && <GlobalSearch onClose={() => setSearching(false)} />}
      {creating && <QuickCreate onClose={() => setCreating(false)} />}
      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
      {showSuggest && <SuggestionModal onClose={() => setShowSuggest(false)} />}
    </div>
  )
}
