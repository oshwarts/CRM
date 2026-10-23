import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, Building2, CalendarDays, FolderKanban, Plus, Search } from 'lucide-react'
import { useAuth } from '../context/AuthProvider'
import { useTasks } from '../lib/api'
import { useProjects } from '../lib/projectsApi'
import { PROJECT_STATUS, projectStats } from '../lib/projects'
import { attention, defaultProjectFilters, filterProjects, projectTotals, sortProjects, type ProjectFilters, type ProjectRow, type ProjectSort } from '../lib/projectList'
import { usePersisted } from '../lib/usePersisted'
import { ProjectFormModal } from '../components/ProjectFormModal'
import { AddFab } from '../components/AddFab'
import { EmptyState, ErrorState, Spinner } from '../components/ui'
import { classNames, daysUntil, formatDate, todayISO } from '../lib/utils'

const SORTS: Record<ProjectSort, string> = { urgent: 'דחוף קודם', target: 'תאריך יעד', progress: 'התקדמות', name: 'שם' }

/** all projects with their progress, what is stuck and what is late: the ones that need a look come first */
export default function Projects() {
  const { user } = useAuth()
  const projects = useProjects()
  const tasks = useTasks()
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const [f, setF] = usePersisted<ProjectFilters>('projects.filters', defaultProjectFilters)
  const filters = useMemo<ProjectFilters>(() => ({ ...defaultProjectFilters, ...f }), [f])
  const patch = (p: Partial<ProjectFilters>) => setF({ ...filters, ...p })
  const today = todayISO()

  const rows: ProjectRow[] = useMemo(
    () =>
      (projects.data ?? []).map((p) => ({
        p: p as unknown as ProjectRow['p'],
        stats: projectStats((tasks.data ?? []).filter((t) => t.project_id === p.id)),
      })),
    [projects.data, tasks.data],
  )
  const totals = useMemo(() => projectTotals(rows, today), [rows, today])
  const shown = useMemo(() => sortProjects(filterProjects(rows, filters, today, user?.id), filters.sort, today), [rows, filters, today, user?.id])
  const hospitals = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of rows) if (r.p.hospital) m.set(r.p.hospital.id, r.p.hospital.name)
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'he'))
  }, [rows])

  if (projects.isLoading || tasks.isLoading) return <Spinner /> // not 0% on every card while the tasks are still loading
  if (projects.error && !projects.data) return <ErrorState error={projects.error} /> // cached data stays visible when only a background refresh failed
  if (tasks.error && !tasks.data) return <ErrorState error={tasks.error} /> // cached data stays visible when only a background refresh failed

  const filtered = filters.q.trim() !== '' || filters.mine || filters.attentionOnly || filters.hospitalId !== ''
  const card = ({ p, stats }: ProjectRow) => {
    const left = p.target_date ? (daysUntil(p.target_date) ?? null) : null
    const late = !!p.target_date && p.status !== 'done' && (left ?? 0) < 0
    const level = attention({ p, stats }, today)
    return (
      <li key={p.id}>
        <Link
          to={`/projects/${p.id}`}
          className={classNames('card block border-s-4 p-4 transition hover:border-brand-300 hover:shadow-sm', level === 'high' ? 'border-s-red-500' : level === 'medium' ? 'border-s-amber-400' : 'border-s-transparent')}
        >
          <div className="flex items-start justify-between gap-2">
            <p dir="auto" className="min-w-0 break-words text-base font-semibold text-slate-800">
              {p.name}
            </p>
            {p.status !== 'active' && <span className="chip shrink-0 border-slate-200 bg-slate-50 !px-2 !py-0 text-xs text-slate-600">{PROJECT_STATUS[p.status]}</span>}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            {p.hospital && (
              <span className="inline-flex items-center gap-1">
                <Building2 size={12} aria-hidden="true" /> {p.hospital.name}
              </span>
            )}
            {p.owner && <span>אחראי: {p.owner.full_name}</span>}
            {p.target_date && (
              <span className={classNames('inline-flex items-center gap-1', late && 'font-medium text-red-600')}>
                <CalendarDays size={12} aria-hidden="true" /> יעד {formatDate(p.target_date)}
                {late ? ` (עבר לפני ${Math.abs(left ?? 0)} ימים)` : p.status !== 'done' && left !== null && left <= 14 ? ` (${left === 0 ? 'היום' : `בעוד ${left} ימים`})` : ''}
              </span>
            )}
          </p>
          <div className="mt-3 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label="התקדמות הפרויקט" aria-valuemin={0} aria-valuemax={100} aria-valuenow={stats.percent}>
              <div className="h-full bg-emerald-500 transition-all" style={{ width: `${stats.percent}%` }} />
            </div>
            <span className="shrink-0 text-xs font-medium text-slate-600">{stats.total ? `${stats.done}/${stats.total} · ${stats.percent}%` : 'אין משימות'}</span>
          </div>
          {(stats.blocked.length > 0 || stats.overdue.length > 0) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {stats.blocked.length > 0 && (
                <span className="chip border-red-200 bg-red-50 !px-2 !py-0.5 text-xs text-red-600">
                  <AlertTriangle size={11} aria-hidden="true" /> {stats.blocked.length} תקועות
                </span>
              )}
              {stats.overdue.length > 0 && <span className="chip border-amber-200 bg-amber-50 !px-2 !py-0.5 text-xs text-amber-700">{stats.overdue.length} באיחור</span>}
            </div>
          )}
          {stats.next[0] && (
            <p dir="auto" className="mt-2 line-clamp-2 text-sm text-slate-600">
              <span className="text-xs text-slate-500">הצעד הבא: </span>
              {stats.next[0].description}
            </p>
          )}
        </Link>
      </li>
    )
  }

  const stat = (label: string, value: number, tone = '') => (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={classNames('font-semibold', tone)}>{value}</p>
    </div>
  )
  const statusBtn = (k: ProjectFilters['status'], label: string, n: number) => (
    <button key={k} type="button" role="radio" aria-checked={filters.status === k} onClick={() => patch({ status: k })} className={classNames('min-h-[44px] rounded-lg px-2 text-sm font-medium transition', filters.status === k ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600 hover:text-slate-800')}>
      {label} <span className="text-xs text-slate-500">{n}</span>
    </button>
  )
  const chip = (on: boolean, label: string, onClick: () => void) => (
    <button type="button" aria-pressed={on} onClick={onClick} className={classNames('min-h-[40px] rounded-full border px-3 text-sm font-medium', on ? 'border-brand-500 bg-brand-500 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}>
      {label}
    </button>
  )

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-brand-800 sm:text-3xl">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#00326d] text-white">
              <FolderKanban size={20} />
            </span>
            פרויקטים
          </h1>
          <p className="text-sm text-slate-500">משימות גדולות שמורכבות מכמה תחומים — רכש, הנדסה רפואית, אישורים ועוד</p>
        </div>
        <button className="btn-primary" onClick={() => setCreating(true)}>
          <Plus size={16} />
          פרויקט חדש
        </button>
      </div>

      {rows.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            {stat('פרויקטים פתוחים', totals.open)}
            {stat('דורשים תשומת לב', totals.needAttention, totals.needAttention ? 'text-red-700' : '')}
            {stat('משימות תקועות', totals.blocked, totals.blocked ? 'text-red-700' : '')}
            {stat('משימות באיחור', totals.overdue, totals.overdue ? 'text-amber-700' : '')}
          </div>

          <div role="radiogroup" aria-label="אילו פרויקטים להציג" className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 sm:max-w-md">
            {statusBtn('open', 'פתוחים', totals.open)}
            {statusBtn('done', 'הושלמו', totals.done)}
            {statusBtn('all', 'הכל', totals.open + totals.done)}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="relative block w-full sm:w-64">
              <Search size={16} aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="search" className="input !pr-9" aria-label="חיפוש בפרויקטים" placeholder="חיפוש: פרויקט, בית חולים, אחראי" value={filters.q} onChange={(e) => patch({ q: e.target.value })} />
            </label>
            {chip(filters.attentionOnly, 'דורשים תשומת לב', () => patch({ attentionOnly: !filters.attentionOnly }))}
            {chip(filters.mine, 'שלי', () => patch({ mine: !filters.mine }))}
            {hospitals.length > 1 && (
              <select className="input !w-full sm:!w-auto" aria-label="בית חולים" value={filters.hospitalId} onChange={(e) => patch({ hospitalId: e.target.value })}>
                <option value="">כל בתי החולים</option>
                {hospitals.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            )}
            <select className="input !w-full sm:!w-auto" aria-label="מיון" value={filters.sort} onChange={(e) => patch({ sort: e.target.value as ProjectSort })}>
              {(Object.keys(SORTS) as ProjectSort[]).map((k) => (
                <option key={k} value={k}>
                  מיון: {SORTS[k]}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      {shown.length === 0 ? (
        rows.length === 0 ? (
          <EmptyState title="אין פרויקטים" hint="צור פרויקט חדש — אפשר להתחיל מתבנית 'אינטגרציית MAKO בבית חולים'" />
        ) : (
          <EmptyState
            title={filters.status === 'done' && !filtered ? 'עדיין לא הושלמו פרויקטים' : 'אין פרויקטים בסינון הזה'}
            hint={filtered ? 'נסה לנקות את הסינון' : undefined}
            action={filtered ? <button className="btn-secondary" onClick={() => setF({ ...defaultProjectFilters, status: filters.status })}>נקה סינון</button> : undefined}
          />
        )
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">{shown.map(card)}</ul>
      )}

      <AddFab label="פרויקט חדש" onClick={() => setCreating(true)} />
      {creating && <ProjectFormModal onClose={() => setCreating(false)} onSaved={(id) => navigate(`/projects/${id}`)} />}
    </div>
  )
}
