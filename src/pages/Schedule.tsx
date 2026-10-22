import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { CalendarPlus, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useAgents, useHospitalAgents, useMeetings, usePatientScans, useTasks } from '../lib/api'
import { SCAN_PROCEDURE_LABELS } from '../lib/types'
import { classNames, todayISO } from '../lib/utils'
import { ErrorState, Spinner } from '../components/ui'
import { PlannedSurgeryModal } from '../components/PlannedSurgeryModal'
import { MeetingFormModal } from '../components/MeetingFormModal'
import { TaskFormModal } from '../components/TaskFormModal'
import { usePlannedSurgeries, type PlannedSurgery } from '../lib/plannedSurgeries'
import { iso, parseISO, rangeFor, shiftAnchor, titleFor, type CalView } from '../lib/calendar'
import { usePersisted } from '../lib/usePersisted'
import { DAY_NAMES, KINDS, type Item, type Kind } from '../components/schedule/shared'
import { TimeGrid } from '../components/schedule/TimeGrid'
import { MonthGrid } from '../components/schedule/MonthGrid'
import { EventSheet, addToOutlook } from '../components/schedule/EventSheet'
import { SlotMenu } from '../components/schedule/SlotMenu'
import type { TaskRow } from '../lib/types'

const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : '')
const VIEWS: [CalView, string][] = [['day', 'יומי'], ['week', 'שבועי'], ['month', 'חודשי']]
const nextHalfHour = () => {
  const n = new Date()
  const m = Math.ceil((n.getHours() * 60 + n.getMinutes() + 1) / 30) * 30
  return `${String(Math.min(Math.floor(m / 60), 23)).padStart(2, '0')}:${m % 60 === 0 ? '00' : '30'}`
}

/** the calendar: day, week and month like Outlook; meetings, surgeries, CT, rescans, follow-ups and tasks with a due date; a press on a free hour starts something there */
export default function Schedule() {
  const meetings = useMeetings()
  const scans = usePatientScans()
  const planned = usePlannedSurgeries()
  const tasks = useTasks()
  const agents = useAgents()
  const hospitalAgents = useHospitalAgents()

  const [view, setView] = usePersisted<CalView>('schedule.view', 'week')
  const [anchorISO, setAnchorISO] = useState(todayISO())
  const anchor = parseISO(anchorISO)
  const [agentId, setAgentId] = useState('')
  const [shown, setShown] = useState<Record<Kind, boolean>>({ meeting: true, surgery: true, ct: true, rescan: true, followup: true, task: true })
  // what is open: the menu of a free hour, an event, and the forms
  const [slot, setSlot] = useState<{ date: string; time: string } | null>(null)
  const [sheet, setSheet] = useState<Item | null>(null)
  const [newMeeting, setNewMeeting] = useState<{ date: string; time: string } | null>(null)
  const [newTask, setNewTask] = useState<{ date: string } | null>(null)
  const [surgery, setSurgery] = useState<{ surgery?: PlannedSurgery; date?: string; time?: string } | null>(null)
  const [editTask, setEditTask] = useState<TaskRow | null>(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const { days, from, to } = useMemo(() => rangeFor(view, anchor), [view, anchorISO])
  const today = todayISO()

  // the agents responsible for each hospital (scans have no agent of their own)
  const agentsOfHospital = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const r of hospitalAgents.data ?? []) m.set(r.hospital_id, [...(m.get(r.hospital_id) ?? []), r.agent_id])
    return m
  }, [hospitalAgents.data])

  const items = useMemo(() => {
    const out: Item[] = []
    for (const m of meetings.data ?? []) {
      if (m.status === 'cancelled') continue
      const who = [
        ...m.meeting_doctors.flatMap((d) => (d.doctor ? [`${d.doctor.title} ${d.doctor.name}`] : [])),
        ...m.meeting_contacts.flatMap((c) => (c.contact ? [c.contact.name] : [])),
      ].join(', ')
      const sub = [m.hospital?.name, who].filter(Boolean).join(' · ')
      const agentIds = [
        ...(m.responsible_agent_id ? [m.responsible_agent_id] : []),
        ...m.meeting_agents.flatMap((a) => (a.agent ? [a.agent.id] : [])),
      ]
      if (m.meeting_date)
        out.push({
          id: `m-${m.id}`, date: m.meeting_date, time: hhmm(m.meeting_time), durationMin: 60, kind: 'meeting',
          title: m.subject || 'פגישה', sub, to: `/meetings/${m.id}`, muted: m.status === 'done', agentIds,
        })
      if (m.next_followup_date && m.status !== 'done')
        out.push({
          id: `f-${m.id}`, date: m.next_followup_date, time: '', kind: 'followup',
          title: `מעקב: ${m.subject || 'פגישה'}`, sub, to: `/meetings/${m.id}`, agentIds,
        })
    }
    const surgeryGroups = new Map<string, { date: string; proc: string; base: string; link: string; ag: string[]; n: number; done: number; one: { side: string; patient: string } }>()
    for (const s of scans.data ?? []) {
      if (s.status === 'cancelled') continue
      const ag = agentsOfHospital.get(s.hospital_id) ?? []
      const proc = SCAN_PROCEDURE_LABELS[s.procedure_type] ?? ''
      const surgeon = s.surgeon ? `${s.surgeon.title} ${s.surgeon.name}` : ''
      const base = [s.hospital?.name, surgeon].filter(Boolean).join(' · ')
      const link = `/scans?hospital=${s.hospital_id}`
      if (s.surgery_date) {
        const key = `${s.surgeon_id ?? ''}|${s.hospital_id}|${s.surgery_date}|${s.procedure_type}`
        const g = surgeryGroups.get(key) ?? { date: s.surgery_date, proc, base, link, ag, n: 0, done: 0, one: { side: s.side, patient: s.patient_name } }
        g.n++
        if (s.status === 'done') g.done++
        surgeryGroups.set(key, g)
      }
      if (s.ct_date)
        out.push({
          id: `c-${s.id}`, date: s.ct_date, time: hhmm(s.ct_time), durationMin: 30, kind: 'ct',
          title: `CT – ${s.patient_name}`, sub: base, to: link, muted: s.scanned, agentIds: ag,
        })
      if (s.rescan && !s.rescan_done && s.rescan_date)
        out.push({
          id: `r-${s.id}`, date: s.rescan_date, time: '', kind: 'rescan',
          title: `סריקה חוזרת – ${s.patient_name}`, sub: [s.rescan_reason, base].filter(Boolean).join(' · '), to: link, agentIds: ag,
        })
    }
    for (const [key, g] of surgeryGroups) {
      out.push({
        id: `s-${key}`, date: g.date, time: '', kind: 'surgery',
        title: g.n > 1 ? `${g.n} × ${g.proc} MAKO` : `${g.proc} MAKO${g.one.side ? ` ${g.one.side}` : ''} – ${g.one.patient}`,
        sub: g.base, to: g.link, muted: g.done === g.n, agentIds: g.ag,
      })
    }
    // surgeries entered by hand: the same surgeon, hospital, day and type add up to one line as well
    const entered = new Map<string, { first: PlannedSurgery; cases: number; time: string; done: boolean; notes: string[] }>()
    for (const x of planned.data ?? []) {
      if (x.status === 'cancelled') continue
      const key = `${x.doctor_id ?? ''}|${x.hospital_id ?? ''}|${x.surgery_date}|${x.procedure.trim().toLowerCase()}`
      const e = entered.get(key) ?? { first: x, cases: 0, time: '', done: true, notes: [] }
      e.cases += x.cases ?? 1
      const t = hhmm(x.surgery_time)
      if (t && (!e.time || t < e.time)) e.time = t
      if (x.status !== 'done') e.done = false
      if (x.notes) e.notes.push(x.notes)
      entered.set(key, e)
    }
    for (const e of entered.values()) {
      const x = e.first
      const doctor = x.doctor ? `${x.doctor.title} ${x.doctor.name}` : ''
      out.push({
        id: `p-${x.id}`, date: x.surgery_date, time: e.time, kind: 'surgery',
        title: [e.cases > 1 ? `${e.cases} ×` : '', x.procedure || 'ניתוח', x.company ? `· ${x.company}` : ''].filter(Boolean).join(' '),
        sub: [x.hospital?.name, doctor, ...e.notes].filter(Boolean).join(' · '), to: '', surgery: x,
        muted: e.done, agentIds: x.agent_id ? [x.agent_id] : [],
      })
    }
    // tasks with a due date (open ones): an all-day row, with the type chip "משימה"
    for (const t of tasks.data ?? []) {
      if (t.is_done || !t.due_date) continue
      out.push({
        id: `t-${t.id}`, date: t.due_date, time: '', kind: 'task', title: t.description,
        sub: [t.doctor ? `${t.doctor.title} ${t.doctor.name}` : '', t.hospital?.name].filter(Boolean).join(' · '), to: '', task: t,
        agentIds: t.assignee_id ? [t.assignee_id] : [],
      })
    }
    return out
  }, [meetings.data, scans.data, planned.data, tasks.data, agentsOfHospital])

  const visible = useMemo(
    () =>
      items
        .filter((it) => it.date >= from && it.date <= to && shown[it.kind])
        .filter((it) => !agentId || it.agentIds.includes(agentId))
        .sort((a, b) => a.date.localeCompare(b.date) || (a.time || '99').localeCompare(b.time || '99') || a.kind.localeCompare(b.kind)),
    [items, from, to, shown, agentId],
  )

  // how many of each kind the range holds (for the agent chosen), shown on the type chips
  const counts = useMemo(() => {
    const c: Record<Kind, number> = { meeting: 0, surgery: 0, ct: 0, rescan: 0, followup: 0, task: 0 }
    for (const it of items) if (it.date >= from && it.date <= to && (!agentId || it.agentIds.includes(agentId))) c[it.kind]++
    return c
  }, [items, from, to, agentId])

  const openItem = (it: Item) => setSheet(it)
  const editItem = (it: Item) => {
    setSheet(null)
    if (it.surgery) setSurgery({ surgery: it.surgery })
    else if (it.task) setEditTask(it.task)
  }
  const goDay = (date: string) => {
    setAnchorISO(date)
    setView('day')
  }
  const pick = (kind: 'meeting' | 'task' | 'surgery', date: string, time: string) => {
    setSlot(null)
    if (kind === 'meeting') setNewMeeting({ date, time })
    else if (kind === 'task') setNewTask({ date })
    else setSurgery({ date, time })
  }

  if (meetings.isLoading || scans.isLoading) return <Spinner />
  if (meetings.error && !meetings.data) return <ErrorState error={meetings.error} /> // cached data stays visible when only a background refresh failed

  const isCurrent = view === 'month' ? anchorISO.slice(0, 7) === today.slice(0, 7) : from <= today && today <= to
  // the week on the phone: the days one under the other
  const agenda = (
    <div className="space-y-2 md:hidden">
      {days.map((d) => {
        const date = iso(d)
        const list = visible.filter((it) => it.date === date)
        const isToday = date === today
        return (
          <section key={date} aria-label={`יום ${DAY_NAMES[d.getDay()]} ${format(d, 'dd/MM')}`} className={classNames('card p-2.5', isToday && 'border-brand-400 ring-2 ring-brand-200')}>
            <h2 className={classNames('flex items-center justify-between gap-2 rounded-lg px-2 py-0.5 text-base font-semibold', isToday ? 'bg-brand-500 text-white' : list.length ? 'bg-brand-50 text-brand-800' : 'text-slate-600')}>
              <button type="button" className="flex flex-wrap items-baseline gap-x-1.5 text-right" onClick={() => goDay(date)}>
                יום {DAY_NAMES[d.getDay()]}
                <span className={classNames('text-xs font-normal', isToday ? 'text-white' : 'text-slate-500')}>{format(d, 'dd/MM')}</span>
                {isToday && <span className="rounded-full bg-white/25 px-1.5 text-xs font-medium">היום</span>}
              </button>
              <button type="button" className={classNames('inline-flex min-h-[32px] shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-medium', isToday ? 'hover:bg-white/20' : 'text-brand-700 hover:bg-brand-100')} aria-label={`אירוע חדש ביום ${DAY_NAMES[d.getDay()]}`} onClick={() => setSlot({ date, time: '09:00' })}>
                <Plus size={14} aria-hidden /> חדש
              </button>
            </h2>
            {list.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {list.map((it) => (
                  <li key={it.id} className="flex items-stretch gap-1">
                    <button type="button" onClick={() => openItem(it)} className={classNames('block min-w-0 flex-1 rounded-xl border px-2.5 py-2 text-right text-sm', it.muted ? 'border-slate-200 bg-slate-50 text-slate-500' : KINDS[it.kind].chip)}>
                      <span className="flex items-center justify-between gap-1">
                        <span className="font-semibold">
                          {KINDS[it.kind].label}
                          {it.muted ? ' · בוצע' : ''}
                        </span>
                        {it.time && (
                          <span dir="ltr" className="font-semibold">
                            {it.time}
                          </span>
                        )}
                      </span>
                      <span className={classNames('block break-words font-medium', it.muted ? 'text-slate-500' : 'text-slate-800')}>{it.title}</span>
                      {it.sub && <span className="block break-words text-slate-600">{it.sub}</span>}
                    </button>
                    <button type="button" className="btn-ghost !px-2" aria-label={`הוסף ל-Outlook: ${it.title}`} title="הוסף ל-Outlook" onClick={() => addToOutlook(it)}>
                      <CalendarPlus size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-brand-800 sm:text-3xl">לוז</h1>
          <p className="text-sm text-slate-500">פגישות, ניתוחים, CT, מעקבים ומשימות</p>
        </div>
        <button className="btn-primary shrink-0" onClick={() => setSlot({ date: view === 'month' ? today : anchorISO, time: nextHalfHour() })}>
          <Plus size={16} aria-hidden /> חדש
        </button>
      </div>

      <div className="card space-y-2.5 p-3 sm:p-4">
        <div role="tablist" aria-label="תצוגת היומן" className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
          {VIEWS.map(([v, label]) => (
            <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)} className={classNames('min-h-[40px] rounded-lg text-sm font-medium transition', view === v ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary !px-2" onClick={() => setAnchorISO(iso(shiftAnchor(view, anchor, -1)))} aria-label={view === 'day' ? 'היום הקודם' : view === 'week' ? 'השבוע הקודם' : 'החודש הקודם'}>
            <ChevronRight size={18} />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="font-semibold text-slate-800">
              <span dir={view === 'month' ? undefined : 'ltr'}>{titleFor(view, anchor)}</span>
            </p>
          </div>
          <button className="btn-secondary !px-2" onClick={() => setAnchorISO(iso(shiftAnchor(view, anchor, 1)))} aria-label={view === 'day' ? 'היום הבא' : view === 'week' ? 'השבוע הבא' : 'החודש הבא'}>
            <ChevronLeft size={18} />
          </button>
          <button className={classNames('btn-secondary', isCurrent && '!border-brand-400 !text-brand-700')} onClick={() => setAnchorISO(today)} aria-label="חזרה להיום">
            היום
          </button>
        </div>
        <select className="input !py-1.5 text-sm sm:!w-auto" aria-label="סינון לפי סוכן" value={agentId} onChange={(e) => setAgentId(e.target.value)}>
          <option value="">כל הסוכנים</option>
          {(agents.data ?? []).map((a) => (
            <option key={a.id} value={a.id}>
              {a.full_name || a.email}
            </option>
          ))}
        </select>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden [&>*]:shrink-0" role="group" aria-label="סוגי אירועים">
          {(Object.keys(KINDS) as Kind[]).map((k) => (
            <button key={k} type="button" aria-pressed={shown[k]} onClick={() => setShown((s) => ({ ...s, [k]: !s[k] }))} className={classNames('chip transition', shown[k] ? KINDS[k].chip : 'border-slate-200 bg-white text-slate-500 line-through')}>
              {KINDS[k].label}
              {counts[k] > 0 && <span className="font-semibold">{counts[k]}</span>}
            </button>
          ))}
        </div>
      </div>

      {view === 'day' && <TimeGrid days={days} items={visible} today={today} onSlot={(date, time) => setSlot({ date, time })} onItem={openItem} />}
      {view === 'week' && (
        <>
          {agenda}
          <div className="hidden md:block">
            <TimeGrid days={days} items={visible} today={today} onSlot={(date, time) => setSlot({ date, time })} onItem={openItem} onDay={goDay} />
          </div>
        </>
      )}
      {view === 'month' && <MonthGrid anchor={anchor} items={visible} today={today} onDay={goDay} onItem={openItem} />}
      {view === 'day' && visible.length === 0 && <p className="text-center text-sm text-slate-500">אין אירועים ביום הזה. לחיצה על שעה פנויה יוצרת אירוע.</p>}
      <p className="text-center text-xs text-slate-500">
        <Link to="/tasks" className="inline-block min-h-[28px] py-1 underline">
          כל המשימות
        </Link>
        {' · '}לחיצה על אירוע פותחת אותו, ועל שעה פנויה יוצרת אירוע חדש
      </p>

      {slot && <SlotMenu date={slot.date} time={slot.time} onPick={pick} onClose={() => setSlot(null)} />}
      {sheet && <EventSheet item={sheet} onClose={() => setSheet(null)} onEdit={editItem} />}
      {newMeeting && <MeetingFormModal open onClose={() => setNewMeeting(null)} defaultDate={newMeeting.date} defaultTime={newMeeting.time} />}
      {newTask && <TaskFormModal defaults={{ due_date: newTask.date }} onClose={() => setNewTask(null)} />}
      {editTask && <TaskFormModal task={editTask} onClose={() => setEditTask(null)} />}
      {surgery && <PlannedSurgeryModal surgery={surgery.surgery} date={surgery.date} time={surgery.time} onClose={() => setSurgery(null)} />}
    </div>
  )
}
