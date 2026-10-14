import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, CalendarDays, ChevronDown, ChevronLeft, Flame, ListChecks, Pencil, Plus, Repeat, Search, Stethoscope, User } from 'lucide-react'
import {
  useAddSubtask,
  useAgents,
  useSaveTask,
  useSetTaskDone,
  useTasks,
  useToggleSubtask,
} from '../lib/api'
import { useAuth } from '../context/AuthProvider'
import { TaskFormModal } from '../components/TaskFormModal'
import { useTaskGuess } from '../components/TaskSuggestions'
import { PendingMark } from '../components/PendingMark'
import { EmptyState, ErrorState, Spinner } from '../components/ui'
import { normalizeHe } from '../lib/contactMatch'
import type { TaskRow } from '../lib/types'
import { classNames, daysUntil, formatDate } from '../lib/utils'

type Bucket = 'overdue' | 'today' | 'week' | 'later' | 'none'
const BUCKETS: { key: Bucket; label: string; tone: string }[] = [
  { key: 'overdue', label: 'באיחור', tone: 'text-red-600' },
  { key: 'today', label: 'להיום', tone: 'text-amber-600' },
  { key: 'week', label: 'בשבוע הקרוב', tone: 'text-slate-800' },
  { key: 'later', label: 'מאוחר יותר', tone: 'text-slate-800' },
  { key: 'none', label: 'ללא תאריך', tone: 'text-slate-500' },
]

function bucketOf(t: TaskRow): Bucket {
  const d = daysUntil(t.due_date)
  if (d === null) return 'none'
  if (d < 0) return 'overdue'
  if (d === 0) return 'today'
  if (d <= 7) return 'week'
  return 'later'
}

function dueLabel(due: string | null) {
  const d = daysUntil(due)
  if (d === null) return ''
  if (d === 0) return 'היום'
  if (d === 1) return 'מחר'
  if (d === -1) return 'אתמול'
  return formatDate(due)
}

export default function Tasks() {
  const { user, isAdmin } = useAuth()
  const tasks = useTasks()
  const agents = useAgents()
  const setDone = useSetTaskDone()
  const toggleSub = useToggleSubtask()
  const addSub = useAddSubtask()
  const quick = useSaveTask()

  const [who, setWho] = useState('me') // admin: me | all | <agent id>
  const [status, setStatus] = useState<'open' | 'done' | 'all'>('open')
  const [urgentOnly, setUrgentOnly] = useState(false)
  const [q, setQ] = useState('')
  const [quickText, setQuickText] = useState('')
  const quickGuess = useTaskGuess(quickText)
  const [editing, setEditing] = useState<TaskRow | null>(null)
  const [adding, setAdding] = useState(false)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [subText, setSubText] = useState<Record<string, string>>({})
  const [error, setError] = useState('')

  const words = normalizeHe(q).split(' ').filter(Boolean)

  const list = useMemo(() => {
    return (tasks.data ?? []).filter((t) => {
      if (!isAdmin || who === 'me') {
        if (t.assignee_id !== user?.id) return false
      } else if (who !== 'all' && t.assignee_id !== who) return false
      if (status === 'open' && t.is_done) return false
      if (status === 'done' && !t.is_done) return false
      if (urgentOnly && t.priority !== 'urgent') return false
      if (words.length) {
        const hay = normalizeHe(
          [t.description, t.notes, t.doctor?.name, t.hospital?.name, t.meeting?.subject, t.assignee?.full_name, ...t.subtasks.map((s) => s.text)]
            .filter(Boolean)
            .join(' '),
        )
        if (!words.every((w) => hay.includes(w))) return false
      }
      return true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks.data, who, status, urgentOnly, q, isAdmin, user?.id])

  const openList = list.filter((t) => !t.is_done)
  const doneList = list
    .filter((t) => t.is_done)
    .sort((a, b) => (b.done_at ?? '').localeCompare(a.done_at ?? ''))

  const groups = BUCKETS.map((b) => ({
    ...b,
    items: openList
      .filter((t) => bucketOf(t) === b.key)
      // urgent first, then by date
      .sort((a, c) => Number(c.priority === 'urgent') - Number(a.priority === 'urgent')),
  })).filter((g) => g.items.length)

  const myOpen = (tasks.data ?? []).filter((t) => !t.is_done && t.assignee_id === user?.id).length

  function fail(e: unknown) {
    setError(e instanceof Error ? e.message : 'הפעולה נכשלה')
  }

  function addQuick() {
    const text = quickText.trim()
    if (!text) return
    setError('')
    quick.mutate(
      {
        // what was understood (date, urgency, doctor, hospital) is used — it is shown under the field
        description: quickGuess?.description ?? text,
        notes: '',
        due_date: quickGuess?.due_date ?? null,
        priority: quickGuess?.priority ?? 'normal',
        doctor_id: quickGuess?.doctor_id ?? null,
        hospital_id: quickGuess?.hospital_id ?? null,
        recurrence: quickGuess?.recurrence ?? 'none',
        assignee_id: isAdmin && who !== 'me' && who !== 'all' ? who : (user?.id ?? null),
        subtasks: [],
      },
      { onSuccess: () => setQuickText(''), onError: fail },
    )
  }

  const card = (t: TaskRow) => {
    const total = t.subtasks.length
    const done = t.subtasks.filter((s) => s.is_done).length
    const expanded = open.has(t.id)
    const due = daysUntil(t.due_date)
    return (
      <li key={t.id} className={classNames('card p-3', t.priority === 'urgent' && !t.is_done && 'border-r-4 border-r-red-400')}>
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 h-6 w-6 shrink-0 cursor-pointer accent-emerald-600"
            checked={t.is_done}
            onChange={(e) => setDone.mutate({ task: t, done: e.target.checked }, { onError: fail })}
            aria-label="סמן כבוצע"
          />
          <div className="min-w-0 flex-1">
            <button className="block w-full text-right" onClick={() => setEditing(t)}>
              <span dir="auto" className={classNames('block whitespace-pre-line break-words text-sm font-medium', t.is_done ? 'text-slate-400 line-through' : 'text-slate-800')}>
                {t.description}
              </span>
            </button>
            {t.notes && !t.is_done && <p dir="auto" className="mt-0.5 line-clamp-2 whitespace-pre-line text-xs text-slate-500">{t.notes}</p>}
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
              {t.due_date && (
                <span
                  className={classNames(
                    'chip !px-2 !py-0',
                    !t.is_done && due !== null && due < 0 ? 'border-red-200 bg-red-50 text-red-600' : !t.is_done && due === 0 ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-600',
                  )}
                >
                  <CalendarDays size={12} /> {dueLabel(t.due_date)}
                </span>
              )}
              {t.priority === 'urgent' && !t.is_done && (
                <span className="chip border-red-200 bg-red-50 !px-2 !py-0 text-red-600">
                  <Flame size={12} /> דחוף
                </span>
              )}
              {t.recurrence !== 'none' && (
                <span className="chip border-slate-200 bg-slate-50 !px-2 !py-0 text-slate-600">
                  <Repeat size={12} /> {t.recurrence === 'weekly' ? 'שבועית' : 'חודשית'}
                </span>
              )}
              {t.doctor && (
                <Link to={`/doctors/${t.doctor.id}`} className="chip border-brand-200 bg-brand-50 !px-2 !py-0 text-brand-700 hover:underline">
                  <Stethoscope size={12} /> {t.doctor.name}
                </Link>
              )}
              {t.hospital && (
                <span className="chip border-slate-200 bg-slate-50 !px-2 !py-0 text-slate-600">
                  <Building2 size={12} /> {t.hospital.name}
                </span>
              )}
              {t.project && (
                <Link to={`/projects/${t.project.id}`} className="chip border-violet-200 bg-violet-50 !px-2 !py-0 text-violet-700 hover:underline">
                  פרויקט: {t.project.name}
                  {t.area ? ` · ${t.area.name}` : ''}
                </Link>
              )}
              {t.status === 'blocked' && !t.is_done && <span className="chip border-red-200 bg-red-50 !px-2 !py-0 text-red-600">תקוע</span>}
              {t.waiting_for && !t.is_done && <span className="chip border-amber-200 bg-amber-50 !px-2 !py-0 text-amber-700">ממתין ל: {t.waiting_for}</span>}
              {t.meeting && (
                <Link to={`/meetings/${t.meeting.id}`} className="chip border-slate-200 bg-slate-50 !px-2 !py-0 text-slate-600 hover:underline">
                  פגישה: {t.meeting.subject}
                </Link>
              )}
              {isAdmin && t.assignee && t.assignee.id !== user?.id && (
                <span className="chip border-violet-200 bg-violet-50 !px-2 !py-0 text-violet-700">
                  <User size={12} /> {t.assignee.full_name}
                </span>
              )}
              <PendingMark id={t.id} />
              {t.is_done && t.done_at && <span className="text-slate-400">בוצע {formatDate(t.done_at.slice(0, 10))}</span>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <button className="btn-ghost !px-2" onClick={() => setEditing(t)} aria-label="עריכה">
              <Pencil size={15} />
            </button>
            <button
              className="btn-ghost !px-2 text-slate-500"
              onClick={() =>
                setOpen((s) => {
                  const n = new Set(s)
                  if (n.has(t.id)) n.delete(t.id)
                  else n.add(t.id)
                  return n
                })
              }
              aria-label="שלבים"
            >
              {total > 0 && <span className="text-xs">{done}/{total}</span>}
              {expanded ? <ChevronDown size={16} /> : <ChevronLeft size={16} />}
            </button>
          </div>
        </div>

        {total > 0 && (
          <div className="mr-9 mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(done / total) * 100}%` }} />
          </div>
        )}

        {expanded && (
          <div className="mr-9 mt-2 space-y-1.5">
            {t.subtasks.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-emerald-600"
                  checked={s.is_done}
                  onChange={(e) => toggleSub.mutate({ id: s.id, is_done: e.target.checked }, { onError: fail })}
                />
                <span dir="auto" className={s.is_done ? 'text-slate-400 line-through' : 'text-slate-700'}>
                  {s.text}
                </span>
              </label>
            ))}
            <form
              className="flex gap-2 pt-1"
              onSubmit={(e) => {
                e.preventDefault()
                const text = (subText[t.id] ?? '').trim()
                if (!text) return
                addSub.mutate(
                  { taskId: t.id, text, sort: t.subtasks.length },
                  { onSuccess: () => setSubText((x) => ({ ...x, [t.id]: '' })), onError: fail },
                )
              }}
            >
              <input
                className="input !py-1.5 text-sm"
                dir="auto"
                placeholder="הוסף שלב…"
                value={subText[t.id] ?? ''}
                onChange={(e) => setSubText((x) => ({ ...x, [t.id]: e.target.value }))}
              />
              <button className="btn-secondary !px-3" aria-label="הוסף שלב">
                <Plus size={16} />
              </button>
            </form>
          </div>
        )}
      </li>
    )
  }

  if (tasks.isLoading) return <Spinner />
  if (tasks.error) return <ErrorState error={tasks.error} />

  const chip = (active: boolean, label: string, onClick: () => void) => (
    <button
      key={label}
      onClick={onClick}
      className={classNames(
        'chip shrink-0 transition',
        active ? 'border-brand-500 bg-brand-500 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
      )}
    >
      {label}
    </button>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
            <ListChecks size={24} className="text-brand-500" />
            משימות
          </h1>
          <p className="text-sm text-slate-400">
            {myOpen} משימות פתוחות שלי{isAdmin ? ' · כמנהל אתה רואה ויכול להקצות משימות לסוכנים' : ''}
          </p>
        </div>
        <button className="btn-primary" onClick={() => setAdding(true)}>
          <Plus size={16} />
          משימה חדשה
        </button>
      </div>

      <form
        className="card flex gap-2 p-2"
        onSubmit={(e) => {
          e.preventDefault()
          addQuick()
        }}
      >
        <input
          className="input !border-0 !shadow-none"
          dir="auto"
          placeholder="הוספה מהירה — כתוב משימה ולחץ Enter"
          value={quickText}
          onChange={(e) => setQuickText(e.target.value)}
        />
        <button className="btn-primary" disabled={!quickText.trim() || quick.isPending}>
          <Plus size={16} />
          הוסף
        </button>
      </form>
      {quickGuess && (
        <div className="-mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-700">
          <span>זיהיתי ויישמר עם המשימה:</span>
          {quickGuess.found.map((f, i) => (
            <span key={i} className="chip border-violet-200 bg-white !px-2 !py-0 text-violet-700">
              {f.label}
            </span>
          ))}
        </div>
      )}

      <div className="card space-y-3 p-3">
        <label className="relative block">
          <Search size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="search" className="input !pr-10" placeholder="חיפוש במשימות, רופא, בית חולים…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div className="-mx-1 flex flex-wrap items-center gap-1.5 px-1">
          {chip(status === 'open', 'פתוחות', () => setStatus('open'))}
          {chip(status === 'done', 'בוצעו', () => setStatus('done'))}
          {chip(status === 'all', 'הכול', () => setStatus('all'))}
          {chip(urgentOnly, 'דחוף בלבד', () => setUrgentOnly((v) => !v))}
          {isAdmin && (
            <select className="input !w-auto !py-1.5 text-sm" value={who} onChange={(e) => setWho(e.target.value)} aria-label="משימות של">
              <option value="me">המשימות שלי</option>
              <option value="all">כל הסוכנים</option>
              {(agents.data ?? [])
                .filter((a) => a.id !== user?.id)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.full_name || a.email}
                  </option>
                ))}
            </select>
          )}
        </div>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {list.length === 0 ? (
        <EmptyState
          title={status === 'done' ? 'עדיין אין משימות שבוצעו' : 'אין משימות להצגה'}
          hint={status === 'open' ? 'הוסף משימה בשורת ההוספה המהירה למעלה' : undefined}
        />
      ) : (
        <>
          {status !== 'done' &&
            groups.map((g) => (
              <section key={g.key} className="space-y-2">
                <h2 className={classNames('flex items-baseline gap-2 text-base font-semibold', g.tone)}>
                  {g.label}
                  <span className="text-sm font-normal text-slate-400">{g.items.length}</span>
                </h2>
                <ul className="space-y-2">{g.items.map(card)}</ul>
              </section>
            ))}
          {status !== 'open' && doneList.length > 0 && (
            <section className="space-y-2">
              <h2 className="flex items-baseline gap-2 text-base font-semibold text-slate-500">
                בוצעו <span className="text-sm font-normal text-slate-400">{doneList.length}</span>
              </h2>
              <ul className="space-y-2">{doneList.map(card)}</ul>
            </section>
          )}
        </>
      )}

      {adding && <TaskFormModal onClose={() => setAdding(false)} defaults={isAdmin && who !== 'me' && who !== 'all' ? { assignee_id: who } : undefined} />}
      {editing && <TaskFormModal task={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
