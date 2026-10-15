import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, CheckSquare, ScanLine, StickyNote } from 'lucide-react'
import { useMeetings, usePatientScans, useTasks } from '../lib/api'
import { SCAN_PROCEDURE_LABELS } from '../lib/types'
import { classNames, formatDate } from '../lib/utils'
import { Spinner } from './ui'

type Ev = { key: string; date: string; kind: 'meeting' | 'task' | 'scan'; title: string; sub: string; to: string; done: boolean }

const ICON = { meeting: CalendarDays, task: CheckSquare, scan: ScanLine }
const TONE = { meeting: 'bg-brand-50 text-brand-600', task: 'bg-emerald-50 text-emerald-600', scan: 'bg-amber-50 text-amber-600' }

/** one timeline of everything with this doctor: meetings, tasks and surgeries, newest first, grouped by month */
export function DoctorTimeline({ doctorId }: { doctorId: string }) {
  const meetings = useMeetings()
  const tasks = useTasks()
  const scans = usePatientScans()

  const events = useMemo(() => {
    const out: Ev[] = []
    for (const m of meetings.data ?? []) {
      if (!m.meeting_date || !m.meeting_doctors.some((d) => d.doctor?.id === doctorId)) continue
      out.push({ key: `m${m.id}`, date: m.meeting_date, kind: 'meeting', title: m.subject || 'פגישה', sub: [m.hospital?.name, m.summary ? m.summary.slice(0, 120) : ''].filter(Boolean).join(' · '), to: `/meetings/${m.id}?doctor=${doctorId}`, done: m.status === 'done' })
    }
    for (const t of tasks.data ?? []) {
      if (t.doctor_id !== doctorId) continue
      const date = t.is_done && t.done_at ? t.done_at.slice(0, 10) : (t.due_date ?? t.created_at.slice(0, 10))
      out.push({ key: `t${t.id}`, date, kind: 'task', title: t.description, sub: t.is_done ? 'משימה שבוצעה' : t.due_date ? `משימה פתוחה, יעד ${formatDate(t.due_date)}` : 'משימה פתוחה', to: '/tasks', done: t.is_done })
    }
    for (const s of scans.data ?? []) {
      if (s.surgeon_id !== doctorId || !(s.surgery_date ?? s.ct_date)) continue
      out.push({ key: `s${s.id}`, date: (s.surgery_date ?? s.ct_date) as string, kind: 'scan', title: `${SCAN_PROCEDURE_LABELS[s.procedure_type] ?? s.procedure_type} ${s.side}`.trim(), sub: [s.hospital?.name, s.surgery_date ? 'ניתוח' : 'CT'].filter(Boolean).join(' · '), to: '/scans', done: s.status === 'done' })
    }
    return out.sort((a, b) => b.date.localeCompare(a.date))
  }, [meetings.data, tasks.data, scans.data, doctorId])

  if (meetings.isLoading || tasks.isLoading || scans.isLoading) return <Spinner />
  if (events.length === 0)
    return (
      <p className="flex items-center gap-2 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
        <StickyNote size={16} /> עוד אין פעילות מתועדת עם הרופא הזה.
      </p>
    )

  let lastMonth = ''
  return (
    <ol className="relative space-y-1 border-r-2 border-brand-100 pr-5">
      {events.map((e) => {
        const month = new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric' }).format(new Date(`${e.date}T12:00:00`))
        const head = month !== lastMonth
        lastMonth = month
        const Icon = ICON[e.kind]
        return (
          <li key={e.key}>
            {head && <p className="-mr-5 pb-1 pt-3 text-sm font-semibold text-brand-800">{month}</p>}
            <Link to={e.to} className="relative flex items-start gap-3 rounded-xl p-2 transition hover:bg-brand-50/60">
              <span className="absolute -right-[1.65rem] top-3.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-brand-400" />
              <span className={classNames('grid h-9 w-9 shrink-0 place-items-center rounded-lg', TONE[e.kind])}>
                <Icon size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span dir="auto" className={classNames('block text-sm font-medium', e.done && e.kind === 'task' ? 'text-slate-500 line-through' : 'text-slate-800')}>
                  {e.title}
                </span>
                {e.sub && (
                  <span dir="auto" className="block text-xs text-slate-600">
                    {e.sub}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-xs text-slate-500">{formatDate(e.date)}</span>
            </Link>
          </li>
        )
      })}
    </ol>
  )
}
