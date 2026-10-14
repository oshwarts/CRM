import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowDown, Copy, Search, X, ArrowRight, ArrowUp, Building2, CalendarDays, Clock, GripVertical, Mail, Pencil, Phone, Plus, Trash2, User, Users } from 'lucide-react'
import { useTasks } from '../lib/api'
import { useDeleteArea, useDeleteProject, useProjectUpdates, useProjects, useMoveTask, useReorderAreas, useSaveArea, useSetAreaContact, useSetTaskStatus, useSetTasksContact } from '../lib/projectsApi'
import { PROJECT_STATUS, STATUS_ORDER, TASK_STATUS, isOverdue, projectStats } from '../lib/projects'
import { ProjectFormModal } from '../components/ProjectFormModal'
import { ProjectTaskModal } from '../components/ProjectTaskModal'
import { ProjectUpdates } from '../components/ProjectUpdates'
import { ContactPickerModal } from '../components/ContactPickerModal'
import { normalizeHe } from '../lib/contactMatch'
import { ConfirmButton, EmptyState, ErrorState, Spinner, Tab, TabList, TabPanel, Tabs } from '../components/ui'
import type { ProjectWithRelations, TaskRow } from '../lib/types'
import { classNames, daysUntil, formatDate } from '../lib/utils'

function Bar({ percent }: { percent: number }) {
  return (
    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
      <div className="h-full bg-emerald-500 transition-all" style={{ width: `${percent}%` }} />
    </div>
  )
}

const dueText = (d: string | null) => {
  const n = daysUntil(d)
  return n === null ? '' : n === 0 ? 'היום' : n === 1 ? 'מחר' : n === -1 ? 'אתמול' : formatDate(d)
}

/** a task line used in the area list, the board and the next-steps list */
function TaskLine({ t, onOpen, showArea, onStatus, selected, onSelect, last }: { t: TaskRow; onOpen: () => void; showArea?: boolean; onStatus: (s: string) => void; selected?: boolean; onSelect?: () => void; last?: { date: string; body: string } }) {
  const st = TASK_STATUS[t.status] ?? TASK_STATUS.todo
  const owner = t.assignee?.full_name || t.external_owner
  return (
    <div className="flex flex-wrap items-start gap-2 py-2">
      {onSelect && <input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={!!selected} onChange={onSelect} aria-label="בחר משימה" />}
      <span className={classNames('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', st.dot)} />
      <button className="min-w-0 flex-1 text-right" onClick={onOpen}>
        <span dir="auto" className={classNames('block text-sm', t.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-800')}>
          {t.description}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-400">
          {showArea && t.area && <span>{t.area.name}</span>}
          {owner && (
            <span className="inline-flex items-center gap-1">
              <User size={11} /> {owner}
              {t.assignee && t.external_owner ? ` · ${t.external_owner}` : ''}
            </span>
          )}
          {t.due_date && (
            <span className={classNames('inline-flex items-center gap-1', isOverdue(t) && 'font-medium text-red-600')}>
              <CalendarDays size={11} /> {dueText(t.due_date)}
            </span>
          )}
          {t.contact && (
            <span className="inline-flex items-center gap-1 rounded bg-sky-50 px-1.5 py-0.5 text-sky-700">
              <Users size={11} /> מול: {t.contact.name}
              {t.contact.role ? ` · ${t.contact.role}` : ''}
              {t.contact.phone && (
                <a href={`tel:${t.contact.phone}`} dir="ltr" className="mr-1 underline" onClick={(e) => e.stopPropagation()}>
                  {t.contact.phone}
                </a>
              )}
              {t.contact.office_phone && (
                <a href={`tel:${t.contact.office_phone}`} dir="ltr" className="mr-1 underline" title="טלפון במשרד" onClick={(e) => e.stopPropagation()}>
                  {t.contact.office_phone} (משרד)
                </a>
              )}
            </span>
          )}
          {last && (
            <span dir="auto" className="inline-flex max-w-full items-center gap-1 truncate text-slate-500">
              <CalendarDays size={11} className="shrink-0" /> עדכון אחרון {formatDate(last.date)}: {last.body || 'קובץ'}
            </span>
          )}
          {t.waiting_for && t.status !== 'done' && (
            <span className="inline-flex items-center gap-1 text-amber-600">
              <Clock size={11} /> ממתין ל: {t.waiting_for}
            </span>
          )}
        </span>
      </button>
      <select
        className={classNames('rounded-lg border px-2 py-1 text-xs', st.chip)}
        value={t.status}
        onChange={(e) => onStatus(e.target.value)}
        aria-label="סטטוס"
      >
        {STATUS_ORDER.map((s) => (
          <option key={s} value={s}>
            {TASK_STATUS[s].label}
          </option>
        ))}
      </select>
    </div>
  )
}

export default function ProjectView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const projects = useProjects()
  const allTasks = useTasks()
  const setStatus = useSetTaskStatus()
  const saveArea = useSaveArea()
  const delArea = useDeleteArea()
  const del = useDeleteProject()
  const updatesQ = useProjectUpdates(id)
  const setAreaContact = useSetAreaContact()
  const setTasksContact = useSetTasksContact()
  const moveTask = useMoveTask()
  const reorderAreas = useReorderAreas()
  const [dragArea, setDragArea] = useState<string | null>(null)
  const [overArea, setOverArea] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [contactFilter, setContactFilter] = useState('') // '' | 'c:<contact id>' | 'x:<outside party text>'
  const [q, setQ] = useState('')
  const [copied, setCopied] = useState(false)
  const [overId, setOverId] = useState<string | null>(null)
  const [areaContactFor, setAreaContactFor] = useState<{ id: string; name: string; contactId: string | null; text: string } | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [bulkContact, setBulkContact] = useState(false)
  const [tab, setTab] = useState('summary')
  const [editing, setEditing] = useState(false)
  const [taskModal, setTaskModal] = useState<{ task?: TaskRow; areaId?: string | null } | null>(null)
  const [newArea, setNewArea] = useState('')

  const project = (projects.data ?? []).find((p) => p.id === id) as ProjectWithRelations | undefined
  // the project's order: by area, then by the order the user gave the tasks inside the area
  const tasks = useMemo(() => {
    const areaIdx = new Map((project?.areas ?? []).map((a, i) => [a.id, i]))
    return (allTasks.data ?? [])
      .filter((t) => t.project_id === id)
      .sort(
        (a, b) =>
          (areaIdx.get(a.area_id ?? '') ?? 999) - (areaIdx.get(b.area_id ?? '') ?? 999) ||
          a.sort - b.sort ||
          a.created_at.localeCompare(b.created_at),
      )
  }, [allTasks.data, id, project])
  const stats = useMemo(() => projectStats(tasks), [tasks])

  if (projects.isLoading || allTasks.isLoading) return <Spinner />
  if (projects.error && !projects.data) return <ErrorState error={projects.error} /> // cached data stays visible when only a background refresh failed
  if (allTasks.error && !allTasks.data) return <ErrorState error={allTasks.error} /> // cached data stays visible when only a background refresh failed
  if (!project) return <EmptyState title="הפרויקט לא נמצא" hint="ייתכן שאין לך גישה אליו או שנמחק" />

  const areas = project.areas
  const byArea = (areaId: string | null) =>
    tasks
      .filter((t) => (t.area_id ?? null) === areaId)
      .sort((a, b) => a.sort - b.sort || a.created_at.localeCompare(b.created_at))
  // ---- search: by the person we work with and / or free text; the summary tab always shows the whole project
  const words = normalizeHe(q).split(' ').filter(Boolean)
  const filtering = !!contactFilter || words.length > 0
  const matches = (t: TaskRow) => {
    if (contactFilter.startsWith('c:') && t.contact_id !== contactFilter.slice(2)) return false
    if (contactFilter.startsWith('x:') && (t.contact_id || t.external_owner.trim() !== contactFilter.slice(2))) return false
    if (!words.length) return true
    const hay = normalizeHe([t.description, t.notes, t.waiting_for, t.contact?.name, t.external_owner, t.area?.name, t.assignee?.full_name].filter(Boolean).join(' '))
    return words.every((w) => hay.includes(w))
  }
  const visibleTasks = tasks.filter(matches)
  const byAreaV = (areaId: string | null) => visibleTasks.filter((t) => (t.area_id ?? null) === areaId)
  const noArea = byArea(null)
  const noAreaV = byAreaV(null)
  // everyone the project's tasks are connected to, for the picker
  const people = (() => {
    const m = new Map<string, { key: string; label: string; open: number }>()
    for (const t of tasks) {
      const key = t.contact_id ? `c:${t.contact_id}` : t.external_owner.trim() ? `x:${t.external_owner.trim()}` : ''
      if (!key) continue
      const e = m.get(key) ?? { key, label: t.contact ? `${t.contact.name}${t.contact.role ? ` · ${t.contact.role}` : ''}` : t.external_owner.trim(), open: 0 }
      if (t.status !== 'done') e.open++
      m.set(key, e)
    }
    return [...m.values()].sort((a, b) => b.open - a.open || a.label.localeCompare(b.label, 'he'))
  })()
  const person = contactFilter ? tasks.find((t) => (contactFilter.startsWith('c:') ? t.contact_id === contactFilter.slice(2) : !t.contact_id && t.external_owner.trim() === contactFilter.slice(2))) : undefined
  const personTasks = contactFilter ? tasks.filter((t) => (contactFilter.startsWith('c:') ? t.contact_id === contactFilter.slice(2) : !t.contact_id && t.external_owner.trim() === contactFilter.slice(2))) : []
  function pickPerson(key: string) {
    setContactFilter(key)
    if (key) setTab('areas')
  }
  const open = (t: TaskRow) => setTaskModal({ task: t })
  /** puts an area before another area (null = last) */
  function placeArea(areaId: string, beforeId: string | null) {
    if (areaId === beforeId) return
    const ids = areas.map((a) => a.id).filter((x) => x !== areaId)
    const at = beforeId ? ids.indexOf(beforeId) : -1
    ids.splice(at < 0 ? ids.length : at, 0, areaId)
    reorderAreas.mutate(ids)
  }
  /** places a task in an area, before another task (or at the end) — also used by the arrows (swap with the neighbour) */
  function place(taskId: string, areaId: string | null, beforeId: string | null) {
    const moved = tasks.find((t) => t.id === taskId)
    if (!moved || taskId === beforeId) return
    const target = byArea(areaId).filter((t) => t.id !== taskId)
    const at = beforeId ? target.findIndex((t) => t.id === beforeId) : -1
    target.splice(at < 0 ? target.length : at, 0, moved)
    moveTask.mutate({ taskId, areaId, orderedIds: target.map((t) => t.id), sameArea: (moved.area_id ?? null) === areaId })
  }
  const change = (t: TaskRow, status: string) => setStatus.mutate({ id: t.id, status })
  const taskNames = new Map(tasks.map((t) => [t.id, t.description]))
  // the latest dated note of each task
  const lastNote = new Map<string, { date: string; body: string }>()
  for (const u of [...(updatesQ.data ?? [])].sort((a, b) => a.event_date.localeCompare(b.event_date) || a.created_at.localeCompare(b.created_at)))
    if (u.task_id) lastNote.set(u.task_id, { date: u.event_date, body: u.body })
  const lateProject = project.target_date && project.status !== 'done' && (daysUntil(project.target_date) ?? 0) < 0

  return (
    <div className="space-y-4">
      <Link to="/projects" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowRight size={15} />
        כל הפרויקטים
      </Link>

      <div className="card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 dir="auto" className="text-xl font-bold text-slate-800">
              {project.name}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
              {project.hospital && (
                <span className="inline-flex items-center gap-1">
                  <Building2 size={14} /> {project.hospital.name}
                </span>
              )}
              {project.owner && <span>אחראי: {project.owner.full_name}</span>}
              {project.start_date && <span>התחלה {formatDate(project.start_date)}</span>}
              {project.target_date && <span className={classNames(lateProject && 'font-medium text-red-600')}>יעד {formatDate(project.target_date)}{lateProject ? ' (עבר)' : ''}</span>}
              <span className="chip border-slate-200 bg-slate-50 !px-2 !py-0 text-xs">{PROJECT_STATUS[project.status]}</span>
            </p>
            {project.description && (
              <p dir="auto" className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                {project.description}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => setEditing(true)}>
              <Pencil size={15} />
              עריכה
            </button>
            <ConfirmButton
              className="btn-ghost text-red-500"
              message="למחוק את הפרויקט עם כל התחומים, המשימות והעדכונים שלו? הפעולה אינה הפיכה."
              onConfirm={() => del.mutate(project.id, { onSuccess: () => navigate('/projects') })}
            >
              <Trash2 size={16} />
            </ConfirmButton>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Bar percent={stats.percent} />
          <span className="shrink-0 text-sm font-medium text-slate-600">
            {stats.done}/{stats.total} · {stats.percent}%
          </span>
        </div>
      </div>

      {/* find all the tasks with one person (when sitting with him) or search the project */}
      <div className="card flex flex-wrap items-center gap-2 p-3">
        <Users size={16} className="shrink-0 text-sky-600" />
        <select className="input !w-auto min-w-48 flex-1 sm:flex-none" value={contactFilter} onChange={(e) => pickPerson(e.target.value)} aria-label="סינון לפי איש קשר">
          <option value="">כל אנשי הקשר</option>
          {people.map((e) => (
            <option key={e.key} value={e.key}>
              {e.label} ({e.open} פתוחות)
            </option>
          ))}
        </select>
        <label className="relative block min-w-40 flex-1">
          <Search size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            className="input !py-1.5 !pr-9"
            placeholder="חיפוש במשימות: טקסט, איש קשר, תחום…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              if (e.target.value) setTab((t) => (t === 'summary' ? 'areas' : t))
            }}
          />
        </label>
        {filtering && (
          <button
            className="btn-ghost text-sm text-brand-600"
            onClick={() => {
              setContactFilter('')
              setQ('')
            }}
          >
            <X size={14} /> נקה סינון
          </button>
        )}
      </div>

      {contactFilter && person && (
        <div className="card space-y-2 border-sky-200 bg-sky-50/40 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p dir="auto" className="font-semibold text-slate-800">
                {person.contact ? person.contact.name : person.external_owner}
                {person.contact?.role && <span className="font-normal text-slate-500"> · {person.contact.role}</span>}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-4 text-sm">
                {person.contact?.phone && (
                  <a href={`tel:${person.contact.phone}`} dir="ltr" className="inline-flex items-center gap-1 text-brand-600 hover:underline">
                    <Phone size={13} /> {person.contact.phone}
                  </a>
                )}
                {person.contact?.office_phone && (
                  <a href={`tel:${person.contact.office_phone}`} dir="ltr" className="inline-flex items-center gap-1 text-brand-600 hover:underline">
                    <Phone size={13} /> {person.contact.office_phone} <span className="text-xs text-slate-400">(משרד)</span>
                  </a>
                )}
                {person.contact?.email && (
                  <a href={`mailto:${person.contact.email}`} dir="ltr" className="inline-flex items-center gap-1 text-brand-600 hover:underline">
                    <Mail size={13} /> {person.contact.email}
                  </a>
                )}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {personTasks.filter((t) => t.status !== 'done').length} משימות פתוחות · {personTasks.filter((t) => t.status === 'blocked').length} תקועות · {personTasks.filter((t) => t.status === 'done').length} הושלמו
              </p>
            </div>
            <button
              className="btn-secondary"
              onClick={async () => {
                const lines = personTasks
                  .filter((t) => t.status !== 'done')
                  .map((t) => {
                    const last = lastNote.get(t.id)
                    return `• ${t.description}${t.area ? ` (${t.area.name})` : ''} — ${TASK_STATUS[t.status]?.label ?? ''}${t.due_date ? `, יעד ${formatDate(t.due_date)}` : ''}${t.waiting_for ? `, ממתין ל: ${t.waiting_for}` : ''}${last ? `, עדכון אחרון ${formatDate(last.date)}: ${last.body}` : ''}`
                  })
                const phones = [person.contact?.phone, person.contact?.office_phone && `${person.contact.office_phone} (משרד)`].filter(Boolean).join(' · ')
                const text = `משימות פתוחות מול ${person.contact ? person.contact.name : person.external_owner}${phones ? ` (${phones})` : ''} — ${project.name}\n${lines.join('\n')}`
                try {
                  await navigator.clipboard.writeText(text)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                } catch {
                  window.prompt('העתק את הרשימה:', text)
                }
              }}
            >
              <Copy size={15} /> {copied ? 'הועתק' : 'העתק רשימת משימות פתוחות'}
            </button>
          </div>
        </div>
      )}

      <Tabs value={tab} onChange={setTab}>
        <TabList>
          <Tab id="summary">סיכום</Tab>
          <Tab id="areas">תחומים ומשימות</Tab>
          <Tab id="board">לוח</Tab>
          <Tab id="timeline">ציר זמן</Tab>
          <Tab id="updates">יומן עדכונים</Tab>
        </TabList>

        {/* ---- summary: progress per area, what is stuck, next steps ---- */}
        <TabPanel id="summary">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="card space-y-3 p-4">
              <h2 className="font-semibold text-slate-800">התקדמות לפי תחום</h2>
              {areas.length === 0 && noArea.length === 0 && <p className="text-sm text-slate-400">אין עדיין תחומים — הוסף בלשונית "תחומים ומשימות".</p>}
              {areas.map((a) => {
                const s = projectStats(byArea(a.id))
                return (
                  <div key={a.id}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700">{a.name}</span>
                      <span className="flex items-center gap-2 text-xs text-slate-500">
                        {s.blocked.length > 0 && <span className="text-red-600">{s.blocked.length} תקועות</span>}
                        {s.done}/{s.total}
                      </span>
                    </div>
                    <Bar percent={s.percent} />
                  </div>
                )
              })}
            </div>

            <div className="space-y-4">
              <WorkingWith tasks={tasks} onPick={pickPerson} />
              <div className={classNames('card p-4', stats.blocked.length > 0 && 'border-red-200')}>
                <h2 className="mb-2 flex items-center gap-2 font-semibold text-slate-800">
                  <AlertTriangle size={16} className={stats.blocked.length ? 'text-red-500' : 'text-slate-300'} />
                  מה תקוע ({stats.blocked.length})
                </h2>
                {stats.blocked.length === 0 ? (
                  <p className="text-sm text-slate-400">אין משימות תקועות.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {stats.blocked.map((t) => (
                      <TaskLine key={t.id} t={t} showArea onOpen={() => open(t)} onStatus={(s) => change(t, s)} last={lastNote.get(t.id)} />
                    ))}
                  </div>
                )}
              </div>
              <div className="card p-4">
                <h2 className="mb-2 font-semibold text-slate-800">הצעדים הבאים</h2>
                {stats.next.length === 0 ? (
                  <p className="text-sm text-slate-400">{stats.total ? 'כל המשימות הושלמו או תקועות.' : 'אין משימות.'}</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {stats.next.map((t) => (
                      <TaskLine key={t.id} t={t} showArea onOpen={() => open(t)} onStatus={(s) => change(t, s)} last={lastNote.get(t.id)} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabPanel>

        {/* ---- areas: the tasks of each area ---- */}
        <TabPanel id="areas">
          <div className="space-y-4">
            {filtering && visibleTasks.length === 0 && <EmptyState title="לא נמצאו משימות" hint="נסה לנקות את הסינון או לשנות את החיפוש" />}
            {[...areas.map((a) => ({ id: a.id as string | null, name: a.name })), ...(noArea.length ? [{ id: null, name: 'ללא תחום' }] : [])]
              .filter((a) => !filtering || (a.id ? byAreaV(a.id).length > 0 : noAreaV.length > 0))
              .map((a) => {
              const list = byAreaV(a.id)
              const s = projectStats(list)
              return (
                <section
                  key={a.id ?? 'none'}
                  className={classNames('card p-4', overArea === a.id && dragArea && 'border-t-4 border-t-brand-400')}
                  onDragOver={(e) => {
                    if (dragArea && a.id && dragArea !== a.id) {
                      e.preventDefault()
                      setOverArea(a.id)
                    }
                  }}
                  onDrop={(e) => {
                    if (dragArea && a.id) {
                      e.preventDefault()
                      placeArea(dragArea, a.id)
                      setDragArea(null)
                      setOverArea(null)
                    }
                  }}
                >
                  <div
                    className="mb-2 flex flex-wrap items-center justify-between gap-2"
                    draggable={!!a.id}
                    onDragStart={(e) => {
                      if (!a.id) return
                      e.stopPropagation()
                      setDragArea(a.id)
                    }}
                    onDragEnd={() => {
                      setDragArea(null)
                      setOverArea(null)
                    }}
                  >
                    <h2 className="flex items-center gap-2 font-semibold text-slate-800">
                      {a.id && (
                        <span className="flex items-center text-slate-300">
                          <GripVertical size={14} className="hidden cursor-grab md:block" />
                          <button
                            className="rounded p-0.5 hover:text-brand-600 disabled:opacity-20"
                            disabled={areas[0]?.id === a.id}
                            aria-label="הזז תחום למעלה"
                            onClick={() => placeArea(a.id as string, areas[areas.findIndex((x) => x.id === a.id) - 1]?.id ?? null)}
                          >
                            <ArrowUp size={15} />
                          </button>
                          <button
                            className="rounded p-0.5 hover:text-brand-600 disabled:opacity-20"
                            disabled={areas[areas.length - 1]?.id === a.id}
                            aria-label="הזז תחום למטה"
                            onClick={() => placeArea(a.id as string, areas[areas.findIndex((x) => x.id === a.id) + 2]?.id ?? null)}
                          >
                            <ArrowDown size={15} />
                          </button>
                        </span>
                      )}
                      {a.name}
                      <span className="text-xs font-normal text-slate-400">
                        {s.done}/{s.total}
                      </span>
                    </h2>
                    <div className="flex flex-wrap items-center gap-1">
                      {a.id && (
                        <button
                          className="btn-ghost text-sky-700"
                          onClick={() => {
                            const ar = areas.find((x) => x.id === a.id)
                            setAreaContactFor({ id: a.id as string, name: a.name, contactId: ar?.contact_id ?? null, text: ar?.contact_text ?? '' })
                          }}
                        >
                          <Users size={15} />
                          {(() => {
                            const ar = areas.find((x) => x.id === a.id)
                            const c = tasks.find((x) => x.contact_id && x.contact_id === ar?.contact_id)?.contact
                            return c ? `מול: ${c.name}` : ar?.contact_text ? `מול: ${ar.contact_text}` : 'איש קשר לתחום'
                          })()}
                        </button>
                      )}
                      <button className="btn-ghost text-brand-600" onClick={() => setTaskModal({ areaId: a.id })}>
                        <Plus size={15} /> משימה
                      </button>
                      {a.id && (
                        <>
                          <button
                            className="btn-ghost !px-2"
                            aria-label="שנה שם"
                            onClick={() => {
                              const name = window.prompt('שם התחום', a.name)
                              if (name?.trim()) saveArea.mutate({ id: a.id as string, project_id: project.id, name })
                            }}
                          >
                            <Pencil size={14} />
                          </button>
                          <ConfirmButton className="btn-ghost !px-2 text-slate-300 hover:text-red-500" message="למחוק את התחום? המשימות שלו יישארו בלי תחום." onConfirm={() => delArea.mutate(a.id as string)}>
                            <Trash2 size={14} />
                          </ConfirmButton>
                        </>
                      )}
                    </div>
                  </div>
                  {list.length === 0 ? (
                    <p
                      className={classNames('rounded-lg py-2 text-sm text-slate-400', dragId && 'border border-dashed border-brand-300 bg-brand-50/40 text-center')}
                      onDragOver={(e) => dragId && e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault()
                        if (dragId) place(dragId, a.id, null)
                        setDragId(null)
                      }}
                    >
                      {dragId ? 'שחרר כאן להעברה לתחום' : 'אין משימות בתחום.'}
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {list.map((t, idx) => (
                        <div
                          key={t.id}
                          draggable
                          onDragStart={() => setDragId(t.id)}
                          onDragEnd={() => {
                            setDragId(null)
                            setOverId(null)
                          }}
                          onDragOver={(e) => {
                            if (dragId && dragId !== t.id) {
                              e.preventDefault()
                              setOverId(t.id)
                            }
                          }}
                          onDrop={(e) => {
                            e.preventDefault()
                            if (dragId) place(dragId, a.id, t.id)
                            setDragId(null)
                            setOverId(null)
                          }}
                          className={classNames('flex items-start gap-1', dragId === t.id && 'opacity-40', overId === t.id && 'border-t-2 border-brand-400')}
                        >
                          <div className="flex shrink-0 flex-col items-center pt-1.5 text-slate-300">
                            <GripVertical size={14} className="hidden cursor-grab md:block" />
                            <button className="rounded p-0.5 hover:text-brand-600 disabled:opacity-20" disabled={idx === 0} aria-label="הזז למעלה" onClick={() => place(t.id, a.id, list[idx - 1].id)}>
                              <ArrowUp size={14} />
                            </button>
                            <button
                              className="rounded p-0.5 hover:text-brand-600 disabled:opacity-20"
                              disabled={idx === list.length - 1}
                              aria-label="הזז למטה"
                              onClick={() => place(t.id, a.id, list[idx + 2]?.id ?? null)}
                            >
                              <ArrowDown size={14} />
                            </button>
                          </div>
                          <div className="min-w-0 flex-1">
                        <TaskLine
                          t={t}
                          onOpen={() => open(t)}
                          onStatus={(s) => change(t, s)}
                          last={lastNote.get(t.id)}
                          selected={picked.has(t.id)}
                          onSelect={() =>
                            setPicked((x) => {
                              const n = new Set(x)
                              if (n.has(t.id)) n.delete(t.id)
                              else n.add(t.id)
                              return n
                            })
                          }
                        />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )
            })}
            <form
              className="card flex gap-2 p-3"
              onSubmit={(e) => {
                e.preventDefault()
                if (!newArea.trim()) return
                saveArea.mutate({ project_id: project.id, name: newArea, sort: areas.length }, { onSuccess: () => setNewArea('') })
              }}
            >
              <input className="input" dir="auto" placeholder="תחום חדש (למשל: מימון, הדרכה…)" value={newArea} onChange={(e) => setNewArea(e.target.value)} />
              <button className="btn-secondary shrink-0" disabled={!newArea.trim()}>
                <Plus size={16} /> הוסף תחום
              </button>
            </form>
          </div>
        </TabPanel>

        {/* ---- board: four columns by status ---- */}
        <TabPanel id="board">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {STATUS_ORDER.map((s) => {
              const col = visibleTasks.filter((t) => t.status === s)
              return (
                <div key={s} className="rounded-xl bg-slate-100/70 p-2">
                  <p className="mb-2 flex items-center justify-between px-1 text-sm font-semibold text-slate-700">
                    <span className="flex items-center gap-1.5">
                      <span className={classNames('h-2.5 w-2.5 rounded-full', TASK_STATUS[s].dot)} />
                      {TASK_STATUS[s].label}
                    </span>
                    <span className="text-xs font-normal text-slate-400">{col.length}</span>
                  </p>
                  <div className="space-y-2">
                    {col.map((t) => (
                      <div key={t.id} className="card p-2">
                        <TaskLine t={t} showArea onOpen={() => open(t)} onStatus={(x) => change(t, x)} last={lastNote.get(t.id)} />
                      </div>
                    ))}
                    {col.length === 0 && <p className="px-1 py-3 text-center text-xs text-slate-400">ריק</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </TabPanel>

        {/* ---- timeline: by due date ---- */}
        <TabPanel id="timeline">
          <Timeline tasks={visibleTasks} project={project} onOpen={open} onStatus={change} />
        </TabPanel>

        <TabPanel id="updates">
          <ProjectUpdates projectId={project.id} taskNames={taskNames} />
        </TabPanel>
      </Tabs>

      {picked.size > 0 && tab === 'areas' && (
        <div className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-40 mx-auto flex max-w-md items-center justify-between gap-2 rounded-xl bg-slate-800 px-3 py-2 text-sm text-white shadow-lg md:bottom-4">
          <span>{picked.size} משימות נבחרו</span>
          <span className="flex gap-2">
            <button className="rounded-lg bg-white/15 px-3 py-1.5 hover:bg-white/25" onClick={() => setBulkContact(true)}>
              קבע איש קשר
            </button>
            <button className="rounded-lg px-2 py-1.5 text-white/70 hover:text-white" onClick={() => setPicked(new Set())}>
              נקה
            </button>
          </span>
        </div>
      )}
      {bulkContact && (
        <ContactPickerModal
          title={`איש קשר ל-${picked.size} משימות`}
          hospitalId={project.hospital_id}
          confirmLabel="החל על המשימות שנבחרו"
          onClose={() => setBulkContact(false)}
          onConfirm={async (c) => {
            await setTasksContact.mutateAsync({ ids: [...picked], contactId: c.contactId, text: c.text })
            setPicked(new Set())
          }}
        />
      )}
      {areaContactFor && (
        <ContactPickerModal
          title={`איש קשר לתחום: ${areaContactFor.name}`}
          hospitalId={project.hospital_id}
          initial={{ contactId: areaContactFor.contactId, text: areaContactFor.text }}
          hint="איש הקשר יוגדר לכל המשימות בתחום, וכברירת מחדל גם למשימות חדשות שיתווספו אליו."
          confirmLabel="החל על התחום"
          extra={({ overwrite, setOverwrite }) => (
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" className="h-4 w-4" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
              להחליף גם במשימות שכבר יש להן איש קשר
            </label>
          )}
          onClose={() => setAreaContactFor(null)}
          onConfirm={(c, overwrite) => setAreaContact.mutateAsync({ areaId: areaContactFor.id, contactId: c.contactId, text: c.text, overwrite })}
        />
      )}
      {editing && <ProjectFormModal project={project} onClose={() => setEditing(false)} />}
      {taskModal && <ProjectTaskModal project={project} areas={areas} task={taskModal.task} defaultAreaId={taskModal.areaId} onClose={() => setTaskModal(null)} />}
    </div>
  )
}

/** the people outside the team the project depends on: hospital contacts and outside parties named on tasks */
function WorkingWith({ tasks, onPick }: { tasks: TaskRow[]; onPick: (key: string) => void }) {
  type Entry = { key: string; name: string; role: string; phone: string; officePhone: string; email: string; open: TaskRow[]; done: number }
  const map = new Map<string, Entry>()
  for (const t of tasks) {
    const key = t.contact ? `c:${t.contact.id}` : t.external_owner.trim() ? `x:${t.external_owner.trim()}` : ''
    if (!key) continue
    const e = map.get(key) ?? {
      key,
      name: t.contact?.name ?? t.external_owner.trim(),
      role: t.contact?.role ?? '',
      phone: t.contact?.phone ?? '',
      officePhone: t.contact?.office_phone ?? '',
      email: t.contact?.email ?? '',
      open: [],
      done: 0,
    }
    if (t.status === 'done') e.done++
    else e.open.push(t)
    map.set(key, e)
  }
  const list = [...map.values()].sort((a, b) => b.open.length - a.open.length)
  return (
    <div className="card p-4">
      <h2 className="mb-2 flex items-center gap-2 font-semibold text-slate-800">
        <Users size={16} className="text-brand-500" />
        מול מי עובדים
      </h2>
      {list.length === 0 ? (
        <p className="text-sm text-slate-400">עדיין לא נבחרו אנשי קשר במשימות. בחר "איש קשר" בעריכת משימה כדי לראות כאן מי אחראי מצד בית החולים.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {list.map((e) => (
            <li key={e.key} className="py-2 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <button className="text-right" onClick={() => onPick(e.key)} title="הצג את כל המשימות מול איש קשר זה">
                    <span dir="auto" className="font-medium text-slate-800 hover:text-brand-600 hover:underline">
                      {e.name}
                      {e.role && <span className="font-normal text-slate-500"> · {e.role}</span>}
                    </span>
                  </button>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-slate-400">
                    {e.phone && (
                      <a href={`tel:${e.phone}`} dir="ltr" className="inline-flex items-center gap-1 text-brand-600 hover:underline">
                        <Phone size={12} /> {e.phone}
                      </a>
                    )}
                    {e.officePhone && (
                      <a href={`tel:${e.officePhone}`} dir="ltr" className="inline-flex items-center gap-1 text-brand-600 hover:underline">
                        <Phone size={12} /> {e.officePhone} (משרד)
                      </a>
                    )}
                    {e.email && (
                      <a href={`mailto:${e.email}`} dir="ltr" className="inline-flex items-center gap-1 text-brand-600 hover:underline">
                        <Mail size={12} /> {e.email}
                      </a>
                    )}
                    {!e.phone && !e.officePhone && !e.email && e.key.startsWith('x:') && <span>גורם חיצוני (ללא איש קשר במערכת)</span>}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-slate-500">
                  {e.open.length} פתוחות{e.done ? ` · ${e.done} הושלמו` : ''}
                </span>
              </div>
              {e.open.length > 0 && (
                <ul className="mt-1 space-y-0.5 pr-3 text-xs text-slate-500">
                  {e.open.slice(0, 4).map((t) => (
                    <li key={t.id} dir="auto" className="truncate">
                      • {t.description}
                      {t.status === 'blocked' && <span className="mr-1 text-red-500">(תקוע)</span>}
                    </li>
                  ))}
                  {e.open.length > 4 && <li>ועוד {e.open.length - 4}…</li>}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Timeline({ tasks, project, onOpen, onStatus }: { tasks: TaskRow[]; project: ProjectWithRelations; onOpen: (t: TaskRow) => void; onStatus: (t: TaskRow, s: string) => void }) {
  const dated = tasks.filter((t) => t.due_date).sort((a, b) => (a.due_date as string).localeCompare(b.due_date as string))
  const undated = tasks.filter((t) => !t.due_date && t.status !== 'done')
  const months = new Map<string, TaskRow[]>()
  for (const t of dated) {
    const k = (t.due_date as string).slice(0, 7)
    months.set(k, [...(months.get(k) ?? []), t])
  }
  const monthName = (k: string) => new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric' }).format(new Date(`${k}-01T00:00:00`))

  if (dated.length === 0 && undated.length === 0) return <EmptyState title="אין משימות עם תאריך יעד" hint="הוסף תאריכי יעד למשימות כדי לראות אותן על ציר הזמן" />

  return (
    <div className="space-y-4">
      {project.target_date && (
        <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">יעד הפרויקט: {formatDate(project.target_date)}</p>
      )}
      {[...months.entries()].map(([k, list]) => (
        <section key={k}>
          <h3 className="mb-1 text-sm font-semibold text-slate-500">{monthName(k)}</h3>
          <div className="card divide-y divide-slate-100 border-r-4 border-r-brand-300 px-3">
            {list.map((t) => (
              <div key={t.id} className="flex items-start gap-3">
                <span className={classNames('w-14 shrink-0 pt-2.5 text-xs', isOverdue(t) ? 'font-semibold text-red-600' : 'text-slate-400')}>{dueText(t.due_date)}</span>
                <div className="min-w-0 flex-1">
                  <TaskLine t={t} showArea onOpen={() => onOpen(t)} onStatus={(s) => onStatus(t, s)} />
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
      {undated.length > 0 && (
        <section>
          <h3 className="mb-1 text-sm font-semibold text-slate-500">ללא תאריך יעד ({undated.length})</h3>
          <div className="card divide-y divide-slate-100 px-3">
            {undated.map((t) => (
              <TaskLine key={t.id} t={t} showArea onOpen={() => onOpen(t)} onStatus={(s) => onStatus(t, s)} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
