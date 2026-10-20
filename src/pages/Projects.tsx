import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, Building2, CalendarDays, FolderKanban, Plus } from 'lucide-react'
import { useTasks } from '../lib/api'
import { useProjects } from '../lib/projectsApi'
import { PROJECT_STATUS, projectStats } from '../lib/projects'
import { ProjectFormModal } from '../components/ProjectFormModal'
import { EmptyState, ErrorState, Spinner } from '../components/ui'
import { classNames, daysUntil, formatDate } from '../lib/utils'

/** all projects with their progress, what is stuck and what is late */
export default function Projects() {
  const projects = useProjects()
  const tasks = useTasks()
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const [showDone, setShowDone] = useState(false)

  const rows = useMemo(
    () =>
      (projects.data ?? []).map((p) => ({
        p,
        stats: projectStats((tasks.data ?? []).filter((t) => t.project_id === p.id)),
      })),
    [projects.data, tasks.data],
  )

  if (projects.isLoading) return <Spinner />
  if (projects.error && !projects.data) return <ErrorState error={projects.error} /> // cached data stays visible when only a background refresh failed
  if (tasks.error && !tasks.data) return <ErrorState error={tasks.error} /> // cached data stays visible when only a background refresh failed

  const open = rows.filter((r) => r.p.status !== 'done')
  const closed = rows.filter((r) => r.p.status === 'done')
  const blockedTotal = open.reduce((n, r) => n + r.stats.blocked.length, 0)
  const overdueTotal = open.reduce((n, r) => n + r.stats.overdue.length, 0)

  const card = ({ p, stats }: (typeof rows)[number]) => {
    const late = p.target_date && p.status !== 'done' && (daysUntil(p.target_date) ?? 0) < 0
    return (
      <li key={p.id}>
        <Link to={`/projects/${p.id}`} className="card block p-4 transition hover:border-brand-300 hover:shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <p dir="auto" className="min-w-0 text-base font-semibold text-slate-800">
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
                {late ? ' (עבר)' : ''}
              </span>
            )}
          </p>
          <div className="mt-3 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label="התקדמות הפרויקט" aria-valuemin={0} aria-valuemax={100} aria-valuenow={stats.percent}>
              <div className="h-full bg-emerald-500 transition-all" style={{ width: `${stats.percent}%` }} />
            </div>
            <span className="shrink-0 text-xs font-medium text-slate-600">
              {stats.done}/{stats.total} · {stats.percent}%
            </span>
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-brand-800 sm:text-3xl">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#00326d] text-white">
              <FolderKanban size={20} />
            </span>
            פרויקטים
          </h1>
          <p className="text-sm text-slate-500">
            {open.length > 0 ? (
              <>
                {open.length} פעילים
                {blockedTotal > 0 && <span className="font-medium text-red-600"> · {blockedTotal} משימות תקועות</span>}
                {overdueTotal > 0 && <span className="font-medium text-amber-700"> · {overdueTotal} באיחור</span>}
              </>
            ) : (
              'משימות גדולות שמורכבות מכמה תחומים — רכש, הנדסה רפואית, אישורים ועוד'
            )}
          </p>
        </div>
        <button className="btn-primary" onClick={() => setCreating(true)}>
          <Plus size={16} />
          פרויקט חדש
        </button>
      </div>

      {open.length === 0 ? (
        <EmptyState title="אין פרויקטים פעילים" hint="צור פרויקט חדש — אפשר להתחיל מתבנית 'אינטגרציית MAKO בבית חולים'" />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">{open.map(card)}</ul>
      )}

      {closed.length > 0 && (
        <div>
          <button className="btn-ghost text-sm text-slate-600" aria-expanded={showDone} onClick={() => setShowDone((v) => !v)}>
            {showDone ? 'הסתר פרויקטים שהושלמו' : `הצג פרויקטים שהושלמו (${closed.length})`}
          </button>
          {showDone && <ul className="mt-2 grid gap-3 lg:grid-cols-2">{closed.map(card)}</ul>}
        </div>
      )}

      {creating && <ProjectFormModal onClose={() => setCreating(false)} onSaved={(id) => navigate(`/projects/${id}`)} />}
    </div>
  )
}
