import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Lightbulb, Pencil } from 'lucide-react'
import { useAgents, useHospitals, useHospitalAgents, useMeetings, usePatientScans, useSaveAvailability, useTasks, useWeekAssignments, useWeekAvailability } from '../lib/api'
import { useAuth } from '../context/AuthProvider'
import { DAY_NAMES, DAY_SHORT } from '../lib/clinics'
import {
  SHIFTS,
  SHIFT_LABELS,
  WORK_TYPE_LABELS,
  availabilityLine,
  dayAvailability,
  overloaded,
  suggestionsFor,
  teamLoad,
  weekDates,
  type AssignmentRow,
  type AvailabilityRow,
  type AvailabilityStatus,
  type RecMeeting,
  type RecScan,
  type RecTask,
  type RosterShift,
} from '../lib/roster'
import { RosterAssignmentModal } from '../components/RosterAssignmentModal'
import { Spinner, ErrorState } from '../components/ui'
import { classNames, formatDate, todayISO } from '../lib/utils'

const DOT: Record<ReturnType<typeof dayAvailability>, string> = {
  full: 'bg-emerald-500',
  morning: 'bg-amber-400',
  evening: 'bg-amber-400',
  none: 'bg-red-400',
  unset: 'bg-slate-300',
}

/** A weekly roster: every agent reports when they can work, a manager decides who works where — with the system's own suggestions. */
export default function Roster() {
  const { user, isAdmin } = useAuth()
  const agents = useAgents()
  const hospitals = useHospitals()
  const hospitalAgents = useHospitalAgents()
  const tasks = useTasks()
  const meetings = useMeetings()
  const scans = usePatientScans()

  const [anchor, setAnchor] = useState(todayISO())
  const dates = useMemo(() => weekDates(anchor), [anchor])
  const today = todayISO()
  const [day, setDay] = useState(dates.includes(today) ? today : dates[0])
  useEffect(() => {
    if (!dates.includes(day)) setDay(dates[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-pick the day when the week itself changes
  }, [dates[0]])

  const avail = useWeekAvailability(dates)
  const assignments = useWeekAssignments(dates)
  const saveAvail = useSaveAvailability()

  const loading = agents.isLoading || hospitals.isLoading || tasks.isLoading || meetings.isLoading || scans.isLoading
  const failed = (agents.error || tasks.error || meetings.error) && !agents.data

  const hospitalsOfAgent = useMemo(() => {
    const names = new Map((hospitals.data ?? []).map((h) => [h.id, h.name]))
    const m = new Map<string, { id: string; name: string }[]>()
    for (const r of hospitalAgents.data ?? []) {
      const name = names.get(r.hospital_id)
      if (!name) continue
      m.set(r.agent_id, [...(m.get(r.agent_id) ?? []), { id: r.hospital_id, name }])
    }
    return m
  }, [hospitalAgents.data, hospitals.data])

  const recTasks: RecTask[] = useMemo(
    () => (tasks.data ?? []).map((t) => ({ assignee_id: t.assignee_id, due_date: t.due_date, is_done: t.is_done, hospital_id: t.hospital?.id ?? null, hospital_name: t.hospital?.name ?? null, priority: t.priority, description: t.description })),
    [tasks.data],
  )
  const recMeetings: RecMeeting[] = useMemo(
    () =>
      (meetings.data ?? []).map((m) => ({
        meeting_date: m.meeting_date,
        status: m.status,
        agent_ids: [...(m.responsible_agent_id ? [m.responsible_agent_id] : []), ...m.meeting_agents.flatMap((a) => (a.agent ? [a.agent.id] : []))],
        hospital_id: m.hospital?.id ?? null,
        hospital_name: m.hospital?.name ?? null,
        subject: m.subject,
      })),
    [meetings.data],
  )
  const recScans: RecScan[] = useMemo(
    () => (scans.data ?? []).map((s) => ({ hospital_id: s.hospital_id, hospital_name: s.hospital?.name ?? null, ct_date: s.ct_date, surgery_date: s.surgery_date, status: s.status })),
    [scans.data],
  )

  // agent_id|date -> its availability rows; agent_id|date|shift -> its assignment
  const availByAgentDay = useMemo(() => {
    const m = new Map<string, AvailabilityRow[]>()
    for (const r of avail.data ?? []) {
      const key = `${r.agent_id}|${r.date}`
      m.set(key, [...(m.get(key) ?? []), { agent_id: r.agent_id, date: r.date, shift: r.shift as RosterShift, status: r.status as AvailabilityStatus, reason: r.reason, note: r.note }])
    }
    return m
  }, [avail.data])
  const assignByKey = useMemo(() => {
    const m = new Map<string, AssignmentRow>()
    for (const r of assignments.data ?? [])
      m.set(`${r.agent_id}|${r.date}|${r.shift}`, { agent_id: r.agent_id, date: r.date, shift: r.shift as RosterShift, hospital_id: r.hospital_id, area: r.area, work_type: r.work_type as AssignmentRow['work_type'], task_id: r.task_id, meeting_id: r.meeting_id, note: r.note })
    return m
  }, [assignments.data])

  const agentList = useMemo(() => agents.data ?? [], [agents.data])
  const loads = useMemo(() => teamLoad([...assignByKey.values()], agentList.map((a) => a.id)), [assignByKey, agentList])
  const overloadedIds = useMemo(() => overloaded(loads), [loads])

  const [editing, setEditing] = useState<{ agentId: string; agentName: string; shift: RosterShift } | null>(null)
  const hospitalMap = useMemo(() => new Map((hospitals.data ?? []).map((h) => [h.id, h.name])), [hospitals.data])

  if (loading) return <Spinner />
  if (failed) return <ErrorState error={agents.error ?? tasks.error ?? meetings.error} />

  return (
    <div className="space-y-4">
      <WeekHeader dates={dates} onShift={setAnchor} onToday={() => setAnchor(todayISO())} />

      <MyAvailability dates={dates} myId={user?.id ?? ''} availByAgentDay={availByAgentDay} saveAvail={saveAvail} />

      <div role="tablist" aria-label="בחירת יום" className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {dates.map((d, i) => (
          <button
            key={d}
            type="button"
            role="tab"
            aria-selected={d === day}
            onClick={() => setDay(d)}
            className={classNames(
              'min-h-[44px] flex-1 shrink-0 rounded-lg px-2 py-1.5 text-sm font-medium transition',
              d === day ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700',
              d === today && d !== day && 'text-brand-600',
            )}
          >
            <span className="block">{DAY_SHORT[i]}</span>
            <span className="block text-xs">{formatDate(d).slice(0, 5)}</span>
          </button>
        ))}
      </div>

      <div className="space-y-3">
        <h2 className="text-base font-semibold text-slate-800">
          {DAY_NAMES[new Date(day).getDay()]}, {formatDate(day)}
        </h2>
        {SHIFTS.map((shift) => (
          <section key={shift} className="card space-y-2 p-3.5 sm:p-4" aria-label={SHIFT_LABELS[shift]}>
            <h3 className="text-sm font-semibold text-brand-800">{SHIFT_LABELS[shift]}</h3>
            <ul className="divide-y divide-slate-100">
              {agentList.map((a) => {
                const dayRows = availByAgentDay.get(`${a.id}|${day}`) ?? []
                const shiftRow = dayRows.find((r) => r.shift === shift)
                const unavailable = shiftRow?.status === 'unavailable'
                const assignment = assignByKey.get(`${a.id}|${day}|${shift}`)
                const sugg = isAdmin && !unavailable ? suggestionsFor({ agentId: a.id, date: day, tasks: recTasks, meetings: recMeetings, scans: recScans, hospitalsOfAgent: hospitalsOfAgent.get(a.id) ?? [] }) : []
                return (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 font-medium text-slate-800">
                        {a.full_name}
                        {overloadedIds.has(a.id) && (
                          <span className="chip border-amber-200 bg-amber-50 text-amber-700" title="עומס שטח גבוה מהממוצע השבוע">
                            עומס
                          </span>
                        )}
                      </p>
                      <p className={classNames('flex items-center gap-1.5 text-xs', unavailable ? 'text-red-600' : 'text-slate-500')}>
                        <span aria-hidden className={classNames('h-1.5 w-1.5 shrink-0 rounded-full', DOT[dayAvailability(dayRows.filter((r) => r.shift === shift))])} />
                        {availabilityLine(dayRows.filter((r) => r.shift === shift))}
                      </p>
                      {assignment && (assignment.hospital_id || assignment.area || assignment.work_type !== 'field') && (
                        <p className="text-xs font-medium text-brand-700">
                          {assignment.hospital_id ? hospitalMap.get(assignment.hospital_id) ?? '—' : WORK_TYPE_LABELS[assignment.work_type]}
                          {assignment.area ? ` · ${assignment.area}` : ''}
                        </p>
                      )}
                      {!assignment && sugg[0] && (
                        <p className="flex items-center gap-1 text-xs text-amber-700">
                          <Lightbulb size={11} aria-hidden /> מוצע: {sugg[0].hospitalName}
                        </p>
                      )}
                    </div>
                    {isAdmin && (
                      <button type="button" className="btn-ghost !px-2" onClick={() => setEditing({ agentId: a.id, agentName: a.full_name, shift })} aria-label={`שיבוץ ${a.full_name}`}>
                        <Pencil size={16} aria-hidden />
                      </button>
                    )}
                  </li>
                )
              })}
              {agentList.length === 0 && <li className="py-3 text-sm text-slate-400">אין סוכנים פעילים</li>}
            </ul>
          </section>
        ))}
      </div>

      {editing && (
        <RosterAssignmentModal
          agentId={editing.agentId}
          agentName={editing.agentName}
          date={day}
          shift={editing.shift}
          current={assignByKey.get(`${editing.agentId}|${day}|${editing.shift}`) ?? null}
          suggestions={suggestionsFor({ agentId: editing.agentId, date: day, tasks: recTasks, meetings: recMeetings, scans: recScans, hospitalsOfAgent: hospitalsOfAgent.get(editing.agentId) ?? [] })}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function WeekHeader({ dates, onShift, onToday }: { dates: string[]; onShift: (d: string) => void; onToday: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h1 className="text-lg font-semibold text-brand-800 sm:text-xl">
        שבוע {formatDate(dates[0]).slice(0, 5)}–{formatDate(dates[6]).slice(0, 5)}
      </h1>
      <div className="flex items-center gap-1">
        <button type="button" className="btn-ghost !px-2" aria-label="שבוע קודם" onClick={() => onShift(addDaysISO(dates[0], -7))}>
          <ChevronRight size={18} aria-hidden />
        </button>
        <button type="button" className="btn-secondary !px-3 !py-1.5 text-sm" onClick={onToday}>
          השבוע הזה
        </button>
        <button type="button" className="btn-ghost !px-2" aria-label="שבוע הבא" onClick={() => onShift(addDaysISO(dates[0], 7))}>
          <ChevronLeft size={18} aria-hidden />
        </button>
      </div>
    </div>
  )
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/** the signed-in agent reports their own week: a day is a whole-day toggle, or morning/evening separately with a reason when they can't */
function MyAvailability({
  dates,
  myId,
  availByAgentDay,
  saveAvail,
}: {
  dates: string[]
  myId: string
  availByAgentDay: Map<string, AvailabilityRow[]>
  saveAvail: ReturnType<typeof useSaveAvailability>
}) {
  const [reasonFor, setReasonFor] = useState<string | null>(null) // `${date}|${shift}` currently editing a reason
  const [reasonText, setReasonText] = useState('')
  if (!myId) return null

  const setShift = (date: string, shift: RosterShift, status: AvailabilityStatus, reason = '') =>
    saveAvail.mutate([{ agent_id: myId, date, shift, status, reason, note: '' }])
  const setWholeDay = (date: string, status: AvailabilityStatus) =>
    saveAvail.mutate(SHIFTS.map((shift) => ({ agent_id: myId, date, shift, status, reason: '', note: '' })))

  return (
    <section className="card space-y-2 p-3.5 sm:p-4" aria-label="הזמינות שלי">
      <h2 className="text-sm font-semibold text-brand-800">הזמינות שלי</h2>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
        {dates.map((d, i) => {
          const rows = availByAgentDay.get(`${myId}|${d}`) ?? []
          const full = dayAvailability(rows)
          return (
            <div key={d} className="rounded-xl border border-slate-200 p-2">
              <p className="mb-1 text-xs font-medium text-slate-600">
                {DAY_SHORT[i]} {formatDate(d).slice(0, 5)}
              </p>
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  className={classNames('chip min-h-[32px]', full === 'full' ? 'border-emerald-300 bg-emerald-100 text-emerald-800' : 'border-slate-200 bg-white text-slate-600')}
                  onClick={() => setWholeDay(d, 'available')}
                >
                  כל היום
                </button>
                {SHIFTS.map((shift) => {
                  const row = rows.find((r) => r.shift === shift)
                  const on = row?.status === 'available'
                  const off = row?.status === 'unavailable'
                  return (
                    <button
                      key={shift}
                      type="button"
                      aria-pressed={on}
                      className={classNames('chip min-h-[32px]', on ? 'border-emerald-300 bg-emerald-100 text-emerald-800' : off ? 'border-red-300 bg-red-100 text-red-700' : 'border-slate-200 bg-white text-slate-600')}
                      onClick={() => {
                        if (off) {
                          setShift(d, shift, 'available')
                        } else {
                          setReasonFor(`${d}|${shift}`)
                          setReasonText(row?.reason ?? '')
                        }
                      }}
                    >
                      {SHIFT_LABELS[shift].split(' (')[0]}
                    </button>
                  )
                })}
              </div>
              {reasonFor?.startsWith(`${d}|`) && (
                <form
                  className="mt-1.5 flex gap-1"
                  onSubmit={(e) => {
                    e.preventDefault()
                    const shift = reasonFor.split('|')[1] as RosterShift
                    setShift(d, shift, 'unavailable', reasonText)
                    setReasonFor(null)
                  }}
                >
                  <input
                    className="input !py-1 text-xs"
                    dir="auto"
                    autoFocus
                    placeholder="סיבה (חופשה, מילואים…)"
                    value={reasonText}
                    onChange={(e) => setReasonText(e.target.value)}
                  />
                  <button className="btn-secondary !px-2 !py-1 text-xs">אישור</button>
                </form>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
