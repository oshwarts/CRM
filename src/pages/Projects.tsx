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
  if (projects.error) return <ErrorState error={projects.error} />

  const open = rows.filter((r) => r.p.status !== 'done')
  const closed = rows.filter((r) => r.p.status === 'done')

  const card = ({ p, stats }: (typeof rows)[number]) => {
    const late = p.target_date && p.status !== 'done' && (daysUntil(p.target_date) ?? 0) < 0
    return (
      <li key={p.id}>
        <Link to={`/projects/${p.id}`} className="card block p-4 transition hover:border-brand-300 hover:shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p dir="auto" className="font-semibold text-slate-800">
                {p.name}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                {p.hospital && (
                  <span className="inline-flex items-center gap-1">
                    <Building2 size={12} /> {p.hospital.name}
                  </span>
                )}
                {p.owner && <span>אחראי: {p.owner.full_name}</span>}
                {p.target_date && (
                  <span className={classNames('inline-flex items-center gap-1', late && 'font-medium text-red-600')}>
                    <CalendarDays size={12} /> יעד {formatDate(p.target_date)}
                  </span>
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {p.status !== 'active' && <span className="chip border-slate-200 bg-slate-50 !px-2 !py-0 text-xs text-slate-600">{PROJECT_STATUS[p.status]}</span>}
              {stats.blocked.length > 0 && (
                <span className="chip border-red-200 bg-red-50 !px-2 !py-0 text-xs text-red-600">
                  <AlertTriangle size={11} /> {stats.blocked.length} תקועות
                </span>
              )}
              {stats.overdue.length > 0 && (
                <span className="chip border-amber-200 bg-amber-50 !px-2 !py-0 text-xs text-amber-700">{stats.overdue.length} באיחור</span>
              )}
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full bg-emerald-500 transition-all" style={{ width: `${stats.percent}%` }} />
            </div>
            <span className="shrink-0 text-xs text-slate-500">
              {stats.done}/{stats.total} · {stats.percent}%
            </span>
          </div>
          {stats.next[0] && (
            <p dir="auto" className="mt-2 truncate text-xs text-slate-500">
              הצעד הבא: <span className="text-slate-700">{stats.next[0].description}</span>
            </p>
          )}
        </Link>
      </li>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
            <FolderKanban size={24} className="text-brand-500" />
            פרויקטים
          </h1>
          <p className="text-sm text-slate-400">משימות גדולות שמורכבות מכמה תחומים — רכש, הנדסה רפואית, אישורים ועוד</p>
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
          <button className="text-sm text-slate-400 hover:underline" onClick={() => setShowDone((v) => !v)}>
            {showDone ? 'הסתר פרויקטים שהושלמו' : `הצג פרויקטים שהושלמו (${closed.length})`}
          </button>
          {showDone && <ul className="mt-2 grid gap-3 lg:grid-cols-2">{closed.map(card)}</ul>}
        </div>
      )}

      {creating && <ProjectFormModal onClose={() => setCreating(false)} onSaved={(id) => navigate(`/projects/${id}`)} />}
    </div>
  )
}
