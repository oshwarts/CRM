import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Bell, Building2, CalendarDays, CalendarCheck, ChevronDown, ChevronLeft, ChevronRight, ClipboardCopy, Lightbulb, Lock, LockOpen, Pencil, Sparkles, Table2, UserCog, Users } from 'lucide-react'
import {
  useAgents,
  useBulkSaveAssignments,
  useCloseWeek,
  useFetchWeekAssignments,
  useFetchWeekAvailability,
  useHospitalAgents,
  useHospitals,
  useMarkNotificationRead,
  useMeetings,
  usePatientScans,
  useRosterNotifications,
  useRosterWeek,
  useSaveAvailability,
  useTasks,
  useWeekAssignments,
  useWeekAvailability,
} from '../lib/api'
import { useAuth } from '../context/AuthProvider'
import { DAY_NAMES, DAY_SHORT } from '../lib/clinics'
import {
  SHIFTS,
  SHIFT_LABELS,
  WORK_TYPE_LABELS,
  assignmentConflicts,
  assignmentShort,
  assignmentsToCopy,
  availabilityToCopy,
  coverageGaps,
  dayAvailability,
  fillableShift,
  groupByHospital,
  shiftLine,
  overloaded,
  suggestionsFor,
  teamLoad,
  unreportedShifts,
  weekDates,
  type AssignmentRow,
  type AvailabilityRow,
  type AvailabilityStatus,
  type CoverageGap,
  type RecMeeting,
  type RecScan,
  type RecTask,
  type RosterShift,
} from '../lib/roster'
import { RosterAssignmentModal, type LinkOption } from '../components/RosterAssignmentModal'
import { ConfirmButton, Spinner, ErrorState } from '../components/ui'
import { classNames, formatDate, todayISO } from '../lib/utils'
import { toast } from '../lib/toast'

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
  const weekStart = dates[0]
  const today = todayISO()
  const [day, setDay] = useState(dates.includes(today) ? today : dates[0])
  useEffect(() => {
    if (!dates.includes(day)) setDay(dates[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-pick the day when the week itself changes
  }, [dates[0]])

  const avail = useWeekAvailability(dates)
  const assignments = useWeekAssignments(dates)
  const saveAvail = useSaveAvailability()
  const week = useRosterWeek(weekStart)
  const closeWeek = useCloseWeek()
  const isClosed = !!week.data
  const notifications = useRosterNotifications()
  const markRead = useMarkNotificationRead()
  const fetchPrevAvail = useFetchWeekAvailability()
  const fetchPrevAssign = useFetchWeekAssignments()
  const bulkAssign = useBulkSaveAssignments()
  const prevDates = useMemo(() => weekDates(addDaysISO(weekStart, -7)), [weekStart])

  // a closed week is the published roster — the week-at-a-glance view is the sensible default for it; an agent who has not reported
  // anything yet for an open week lands straight on "my availability"; otherwise the day being looked at, for everyone else
  const [view, setView] = useState<'day' | 'week' | 'mine'>('day')
  const myUnreported = useMemo(
    () => (user?.id ? unreportedShifts(dates, (date, shift) => (avail.data ?? []).some((r) => r.agent_id === user.id && r.date === date && r.shift === shift)) : []),
    [dates, avail.data, user?.id],
  )
  useEffect(() => setView(isClosed ? 'week' : myUnreported.length > 0 ? 'mine' : 'day'), [isClosed, weekStart]) // eslint-disable-line react-hooks/exhaustive-deps -- only the deliberate re-pick on a week change, not every time myUnreported recomputes
  // within day view: "who is where" grouped by agent (default) or by site
  const [dayGroupBy, setDayGroupBy] = useState<'agent' | 'hospital'>('agent')

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
  const agentNameMap = useMemo(() => new Map((agents.data ?? []).map((a) => [a.id, a.full_name])), [agents.data])
  const dayByHospital = useMemo(
    () => groupByHospital([...assignByKey.values()].filter((a) => a.date === day), (id) => agentNameMap.get(id), (id) => hospitalMap.get(id)),
    [assignByKey, day, agentNameMap, hospitalMap],
  )

  // who to notify when the week is closed: everyone who already has something on it this week
  const agentsInWeek = useMemo(() => {
    const s = new Set<string>()
    for (const r of avail.data ?? []) s.add(r.agent_id)
    for (const r of assignments.data ?? []) s.add(r.agent_id)
    return [...s]
  }, [avail.data, assignments.data])

  function doCloseWeek() {
    if (closeWeek.isPending) return // a second tap on the confirm dialog, before the first close lands
    closeWeek.mutate({
      weekStart,
      agentIds: agentsInWeek,
      message: `הלוז שלך לשבוע ${formatDate(dates[0]).slice(0, 5)}–${formatDate(dates[6]).slice(0, 5)} פורסם`,
    })
  }

  function openEditor(agentId: string, agentName: string, shift: RosterShift) {
    setEditing({ agentId, agentName, shift })
  }

  // "copy last week": for me (availability), or for the whole roster (assignments) — only into slots nothing is reported/assigned for yet
  function copyMyAvailability() {
    if (fetchPrevAvail.isPending) return
    const myId = user?.id ?? ''
    fetchPrevAvail.mutate(prevDates, {
      onSuccess: (rows) => {
        const mine = rows.filter((r) => r.agent_id === myId).map((r) => ({ date: r.date, shift: r.shift as RosterShift, status: r.status as AvailabilityStatus, reason: r.reason }))
        const toCopy = availabilityToCopy(mine, dates, prevDates, (date, shift) => (availByAgentDay.get(`${myId}|${date}`) ?? []).some((r) => r.shift === shift))
        if (toCopy.length === 0) return toast('אין מה להעתיק — כבר דיווחת על כל ימי השבוע', { kind: 'info' })
        saveAvail.mutate(toCopy.map((c) => ({ agent_id: myId, ...c, note: '' })))
      },
      onError: () => toast('ההעתקה נכשלה', { kind: 'error' }),
    })
  }
  function copyLastWeekAssignments() {
    if (fetchPrevAssign.isPending || bulkAssign.isPending) return
    fetchPrevAssign.mutate(prevDates, {
      onSuccess: (rows) => {
        const typed = rows.map((r) => ({ agent_id: r.agent_id, date: r.date, shift: r.shift as RosterShift, hospital_id: r.hospital_id, area: r.area, work_type: r.work_type as AssignmentRow['work_type'], note: r.note }))
        const plan = assignmentsToCopy(typed, dates, prevDates, (agentId, date, shift) => assignByKey.has(`${agentId}|${date}|${shift}`))
        if (plan.length === 0) return toast('אין שיבוצים חדשים להעתיק מהשבוע הקודם', { kind: 'info' })
        if (!window.confirm(`להעתיק ${plan.length} שיבוצים מהשבוע הקודם לשבוע הנוכחי?`)) return
        bulkAssign.mutate(plan)
      },
      onError: () => toast('ההעתקה נכשלה', { kind: 'error' }),
    })
  }
  function autoFillBySuggestions() {
    if (bulkAssign.isPending) return
    const plan: Parameters<typeof bulkAssign.mutate>[0] = []
    for (const a of agentList)
      for (const d of dates)
        for (const shift of SHIFTS) {
          const assigned = assignByKey.has(`${a.id}|${d}|${shift}`)
          const row = (availByAgentDay.get(`${a.id}|${d}`) ?? []).find((r) => r.shift === shift)
          if (!fillableShift(assigned, row?.status ?? 'unset')) continue
          const top = suggestionsFor({ agentId: a.id, date: d, tasks: recTasks, meetings: recMeetings, scans: recScans, hospitalsOfAgent: hospitalsOfAgent.get(a.id) ?? [] })[0]
          if (top) plan.push({ agent_id: a.id, date: d, shift, hospital_id: top.hospitalId, area: '', work_type: 'field', task_id: null, meeting_id: null, note: '' })
        }
    if (plan.length === 0) return toast('אין כרגע הצעות למשמרות פנויות', { kind: 'info' })
    if (!window.confirm(`למלא ${plan.length} משמרות פנויות לפי ההמלצות החזקות ביותר?`)) return
    bulkAssign.mutate(plan)
  }

  const gaps = useMemo(() => {
    if (!isAdmin) return []
    const covered = new Set((hospitalAgents.data ?? []).map((r) => r.hospital_id))
    const hospList = (hospitals.data ?? []).map((h) => ({ id: h.id, name: h.name, covered: covered.has(h.id) }))
    const isAssigned = (hospitalId: string, date: string) => [...assignByKey.values()].some((a) => a.date === date && a.hospital_id === hospitalId)
    return coverageGaps({ dates, hospitals: hospList, scans: recScans, isAssigned })
  }, [isAdmin, hospitals.data, hospitalAgents.data, assignByKey, dates, recScans])

  if (loading) return <Spinner />
  if (failed) return <ErrorState error={agents.error ?? tasks.error ?? meetings.error} />

  const linkOptionsFor = (agentId: string, date: string) => {
    const taskOptions: LinkOption[] = (tasks.data ?? [])
      .filter((t) => !t.is_done && t.assignee_id === agentId && t.due_date === date)
      .map((t) => ({ id: t.id, label: t.description.slice(0, 60) || 'משימה', hospitalId: t.hospital?.id ?? null }))
    const meetingOptions: LinkOption[] = (meetings.data ?? [])
      .filter((m) => m.status !== 'cancelled' && m.meeting_date === date && (m.responsible_agent_id === agentId || m.meeting_agents.some((a) => a.agent?.id === agentId)))
      .map((m) => ({ id: m.id, label: m.subject.slice(0, 60) || 'פגישה', hospitalId: m.hospital?.id ?? null }))
    return { taskOptions, meetingOptions }
  }

  // a one-line orientation before the full list: how full is this day, at a glance
  const dayStats = { total: agentList.length * SHIFTS.length, assigned: 0, unavailable: 0 }
  for (const a of agentList)
    for (const shift of SHIFTS) {
      if (assignByKey.has(`${a.id}|${day}|${shift}`)) dayStats.assigned++
      if ((availByAgentDay.get(`${a.id}|${day}`) ?? []).find((r) => r.shift === shift)?.status === 'unavailable') dayStats.unavailable++
    }

  return (
    <div className="space-y-4">
      <WeekHeader
        dates={dates}
        isClosed={isClosed}
        isAdmin={isAdmin}
        closing={closeWeek.isPending}
        copying={fetchPrevAssign.isPending || bulkAssign.isPending}
        filling={bulkAssign.isPending}
        onShift={setAnchor}
        onToday={() => setAnchor(todayISO())}
        onClose={doCloseWeek}
        onCopyLastWeek={copyLastWeekAssignments}
        onAutoFill={autoFillBySuggestions}
        view={view}
        onViewChange={setView}
        myUnreportedCount={myUnreported.length}
      />

      {(notifications.data ?? []).length > 0 || gaps.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <RosterInbox myId={user?.id ?? ''} notifications={notifications.data ?? []} markRead={markRead} onOpenDate={(d) => { setAnchor(d); setDay(d); setView('day') }} />
          {isAdmin && <CoverageGapsBanner gaps={gaps} onOpenDate={(d) => { setDay(d); setView('day') }} />}
        </div>
      ) : null}

      {view === 'mine' ? (
        <MyAvailability
          dates={dates}
          myId={user?.id ?? ''}
          isAdmin={isAdmin}
          isClosed={isClosed}
          availByAgentDay={availByAgentDay}
          saveAvail={saveAvail}
          onCopyLastWeek={copyMyAvailability}
          copying={fetchPrevAvail.isPending}
        />
      ) : view === 'week' ? (
        <WeekMatrix
          dates={dates}
          agents={agentList}
          availByAgentDay={availByAgentDay}
          assignByKey={assignByKey}
          hospitalMap={hospitalMap}
          overloadedIds={overloadedIds}
          onPick={(d) => {
            setDay(d)
            setView('day')
          }}
        />
      ) : (
        <>
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-slate-800">
                  {DAY_NAMES[new Date(day).getDay()]}, {formatDate(day)}
                </h2>
                {dayStats.total > 0 && (
                  <p className="text-xs text-slate-500">
                    {dayStats.assigned}/{dayStats.total} משמרות משובצות
                    {dayStats.unavailable > 0 ? ` · ${dayStats.unavailable} דיווחי אי-זמינות` : ''}
                  </p>
                )}
              </div>
              <div role="tablist" aria-label="קיבוץ תצוגה יומית" className="flex gap-1 rounded-xl bg-slate-100 p-1">
                <button
                  type="button"
                  role="tab"
                  aria-selected={dayGroupBy === 'agent'}
                  className={classNames('inline-flex min-h-[32px] items-center gap-1 rounded-lg px-2.5 text-xs font-medium', dayGroupBy === 'agent' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500')}
                  onClick={() => setDayGroupBy('agent')}
                >
                  <Users size={13} aria-hidden /> לפי סוכן
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={dayGroupBy === 'hospital'}
                  className={classNames('inline-flex min-h-[32px] items-center gap-1 rounded-lg px-2.5 text-xs font-medium', dayGroupBy === 'hospital' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500')}
                  onClick={() => setDayGroupBy('hospital')}
                >
                  <Building2 size={13} aria-hidden /> לפי בית חולים
                </button>
              </div>
            </div>
            {dayGroupBy === 'hospital' ? (
              <div className="space-y-2">
                {dayByHospital.map((g) => (
                  <section key={g.hospitalId ?? '—'} className="card space-y-2 p-3.5 sm:p-4" aria-label={g.hospitalName}>
                    <h3 className="flex items-center gap-1.5 text-sm font-semibold text-brand-800">
                      <Building2 size={14} aria-hidden /> {g.hospitalName}
                    </h3>
                    <ul className="divide-y divide-slate-100">
                      {g.entries.map((e, i) => (
                        <li key={`${e.agentId}-${e.shift}-${i}`} className="flex items-center justify-between gap-2 py-2 text-sm">
                          <span className="font-medium text-slate-800">{e.agentName}</span>
                          <span className="text-xs text-slate-500">
                            {SHIFT_LABELS[e.shift]}
                            {e.area ? ` · ${e.area}` : ''}
                            {g.hospitalId === null ? ` · ${WORK_TYPE_LABELS[e.workType]}` : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
                {dayByHospital.length === 0 && <p className="card p-4 text-center text-sm text-slate-400">אין שיבוצים ביום זה</p>}
              </div>
            ) : (
              <>
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
                            <span aria-hidden className={classNames('h-1.5 w-1.5 shrink-0 rounded-full', !shiftRow ? DOT.unset : unavailable ? DOT.none : DOT.full)} />
                            {shiftLine(shiftRow)}
                          </p>
                          {assignment && (assignment.hospital_id || assignment.area || assignment.work_type !== 'field') && (
                            <p className="text-xs font-medium text-brand-700">
                              {assignment.hospital_id ? hospitalMap.get(assignment.hospital_id) ?? '—' : WORK_TYPE_LABELS[assignment.work_type]}
                              {assignment.area ? ` · ${assignment.area}` : ''}
                            </p>
                          )}
                          {assignmentConflicts(!!assignment, shiftRow?.status ?? 'unset') && (
                            <p className="flex items-center gap-1 text-xs font-medium text-red-600">
                              <AlertTriangle size={11} aria-hidden /> סותר דיווח אי-זמינות
                            </p>
                          )}
                          {!assignment && sugg[0] && (
                            <p className="flex items-center gap-1 text-xs text-amber-700">
                              <Lightbulb size={11} aria-hidden /> מוצע: {sugg[0].hospitalName}
                            </p>
                          )}
                        </div>
                        {isAdmin && (
                          <button type="button" className="btn-ghost !px-2" onClick={() => openEditor(a.id, a.full_name, shift)} aria-label={`שיבוץ ${a.full_name}`}>
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
              </>
            )}
          </div>
        </>
      )}

      {editing &&
        (() => {
          const { taskOptions, meetingOptions } = linkOptionsFor(editing.agentId, day)
          const availRow = (availByAgentDay.get(`${editing.agentId}|${day}`) ?? []).find((r) => r.shift === editing.shift)
          return (
            <RosterAssignmentModal
              agentId={editing.agentId}
              agentName={editing.agentName}
              date={day}
              shift={editing.shift}
              weekStart={weekStart}
              isClosed={isClosed}
              current={assignByKey.get(`${editing.agentId}|${day}|${editing.shift}`) ?? null}
              availability={availRow ? { status: availRow.status, reason: availRow.reason } : null}
              suggestions={suggestionsFor({ agentId: editing.agentId, date: day, tasks: recTasks, meetings: recMeetings, scans: recScans, hospitalsOfAgent: hospitalsOfAgent.get(editing.agentId) ?? [] })}
              taskOptions={taskOptions}
              meetingOptions={meetingOptions}
              onClose={() => setEditing(null)}
            />
          )
        })()}
    </div>
  )
}

function WeekHeader({
  dates,
  isClosed,
  isAdmin,
  closing,
  copying,
  filling,
  onShift,
  onToday,
  onClose,
  onCopyLastWeek,
  onAutoFill,
  view,
  onViewChange,
  myUnreportedCount,
}: {
  dates: string[]
  isClosed: boolean
  isAdmin: boolean
  closing: boolean
  copying: boolean
  filling: boolean
  onShift: (d: string) => void
  onToday: () => void
  onClose: () => void
  onCopyLastWeek: () => void
  onAutoFill: () => void
  view: 'day' | 'week' | 'mine'
  onViewChange: (v: 'day' | 'week' | 'mine') => void
  myUnreportedCount: number
}) {
  const [tools, setTools] = useState(false)
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-lg font-semibold text-brand-800 sm:text-xl">
          שבוע {formatDate(dates[0]).slice(0, 5)}–{formatDate(dates[6]).slice(0, 5)}
          {isClosed && (
            <span className="chip border-slate-300 bg-slate-100 text-slate-600" title="הלוז לשבוע זה פורסם ונסגר">
              <Lock size={11} aria-hidden /> סגור
            </span>
          )}
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label="תצוגה" className="flex gap-1 rounded-xl bg-slate-100 p-1">
          <ViewTab view={view} v="day" icon={CalendarDays} label="יומי" onViewChange={onViewChange} />
          <ViewTab view={view} v="week" icon={Table2} label="שבועי" onViewChange={onViewChange} />
          <ViewTab view={view} v="mine" icon={UserCog} label="הזמינות שלי" badge={myUnreportedCount} onViewChange={onViewChange} />
        </div>
        {isAdmin && !isClosed && (
          <div className="relative">
            <button type="button" className="btn-ghost !py-1.5 text-sm" aria-expanded={tools} onClick={() => setTools((v) => !v)}>
              כלי ניהול <ChevronDown size={14} className={classNames('transition', tools && 'rotate-180')} aria-hidden />
            </button>
            {tools && (
              <div className="absolute right-0 top-full z-10 mt-1 w-64 max-w-[calc(100vw-2rem)] space-y-1 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                <button type="button" className="btn-ghost !w-full !justify-start text-sm" disabled={copying} onClick={onCopyLastWeek}>
                  <ClipboardCopy size={15} aria-hidden /> {copying ? 'מעתיק…' : 'העתק שיבוצים משבוע שעבר'}
                </button>
                <button type="button" className="btn-ghost !w-full !justify-start text-sm" disabled={filling} onClick={onAutoFill}>
                  <Sparkles size={15} aria-hidden /> {filling ? 'ממלא…' : 'מלא לפי המלצות'}
                </button>
                <ConfirmButton
                  className="btn-secondary !w-full !justify-start text-sm"
                  message="לסגור את הלוז לשבוע זה? הוא יפורסם, וכל סוכן שיש לו משהו בשבוע הזה יקבל על כך הודעה. עריכה אחרי הסגירה עדיין אפשרית ותתריע לסוכן על כל שינוי."
                  onConfirm={onClose}
                >
                  <LockOpen size={15} aria-hidden /> {closing ? 'סוגר…' : 'סגור שבוע'}
                </ConfirmButton>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/** hospitals with a MAKO scan or surgery today and nobody assigned there — the system's own flag that the roster still needs attention */
function CoverageGapsBanner({ gaps, onOpenDate }: { gaps: CoverageGap[]; onOpenDate: (date: string) => void }) {
  if (gaps.length === 0) return null
  return (
    <section className="card space-y-1.5 border border-amber-200 bg-amber-50 p-3" aria-label="פערי כיסוי">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-800">
        <AlertTriangle size={15} aria-hidden /> פערי כיסוי השבוע
      </p>
      <ul className="space-y-1">
        {gaps.map((g) => (
          <li key={`${g.hospitalId}-${g.date}`}>
            <button type="button" className="flex min-h-[36px] w-full items-center justify-between gap-2 rounded-lg px-2 py-1 text-start text-sm hover:bg-amber-100/60" onClick={() => onOpenDate(g.date)}>
              <span className="min-w-0 [overflow-wrap:anywhere]">
                <span className="font-medium text-slate-800">{g.hospitalName}</span>
                <span className="text-slate-600"> · {formatDate(g.date)} · {g.reasons.join(', ')} ואין שיבוץ</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** one tab of the view switcher (day / week / my availability), with an optional count badge */
function ViewTab<V extends string>({ view, v, icon: Icon, label, badge, onViewChange }: { view: V; v: V; icon: typeof CalendarDays; label: string; badge?: number; onViewChange: (v: V) => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={view === v}
      className={classNames('inline-flex min-h-[36px] items-center gap-1 rounded-lg px-2.5 text-sm font-medium', view === v ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500')}
      onClick={() => onViewChange(v)}
    >
      <Icon size={14} aria-hidden /> {label}
      {!!badge && <span className="chip !min-h-0 border-amber-200 bg-amber-100 px-1.5 py-0 text-amber-800">{badge}</span>}
    </button>
  )
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/** the signed-in agent's own roster inbox: when a manager closes the week, or changes an assignment after it closed */
function RosterInbox({
  myId,
  notifications,
  markRead,
  onOpenDate,
}: {
  myId: string
  notifications: { id: string; message: string; date: string | null; read_at: string | null; created_at: string }[]
  markRead: ReturnType<typeof useMarkNotificationRead>
  onOpenDate: (date: string) => void
}) {
  const [open, setOpen] = useState(false)
  if (!myId) return null
  const unread = notifications.filter((n) => !n.read_at)
  if (notifications.length === 0) return null
  return (
    <section className="card p-3" aria-label="התראות הלוז שלי">
      <button type="button" className="flex min-h-[40px] w-full items-center justify-between gap-2" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="flex items-center gap-1.5 text-sm font-semibold text-brand-800">
          <Bell size={15} aria-hidden /> עדכונים על הלוז שלי
          {unread.length > 0 && <span className="chip border-red-200 bg-red-50 text-red-700">{unread.length} חדשים</span>}
        </span>
        <span className="text-xs text-slate-400">{open ? 'סגור' : 'פתח'}</span>
      </button>
      {open && (
        <ul className="mt-2 space-y-1.5 border-t border-slate-100 pt-2">
          {notifications.slice(0, 15).map((n) => (
            <li key={n.id}>
              <button
                type="button"
                className={classNames('flex w-full min-h-[40px] items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-start text-sm hover:bg-slate-50', !n.read_at && 'bg-amber-50/70')}
                onClick={() => {
                  if (!n.read_at) markRead.mutate(n.id)
                  if (n.date) onOpenDate(n.date)
                }}
              >
                <span className="min-w-0 [overflow-wrap:anywhere]">{n.message}</span>
                <span className="shrink-0 text-xs text-slate-400">{formatDate(n.created_at.slice(0, 10))}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** the published roster at a glance: who is around, and roughly where, across all seven days */
function WeekMatrix({
  dates,
  agents,
  availByAgentDay,
  assignByKey,
  hospitalMap,
  overloadedIds,
  onPick,
}: {
  dates: string[]
  agents: { id: string; full_name: string }[]
  availByAgentDay: Map<string, AvailabilityRow[]>
  assignByKey: Map<string, AssignmentRow>
  hospitalMap: Map<string, string>
  overloadedIds: Set<string>
  onPick: (date: string) => void
}) {
  const hospitalName = (id: string) => hospitalMap.get(id)
  const cellOf = (agentId: string, d: string) => {
    const rows = availByAgentDay.get(`${agentId}|${d}`) ?? []
    const morning = assignByKey.get(`${agentId}|${d}|morning`)
    const evening = assignByKey.get(`${agentId}|${d}|evening`)
    const mShort = assignmentShort(morning, hospitalName)
    const eShort = assignmentShort(evening, hospitalName)
    const mStatus = rows.find((r) => r.shift === 'morning')?.status ?? 'unset'
    const eStatus = rows.find((r) => r.shift === 'evening')?.status ?? 'unset'
    const conflict = assignmentConflicts(!!morning, mStatus) || assignmentConflicts(!!evening, eStatus)
    return {
      dot: DOT[dayAvailability(rows)],
      mShort,
      eShort,
      conflict,
      title: [mShort && `בוקר: ${mShort}`, eShort && eShort !== mShort && `אחה״צ: ${eShort}`, conflict && 'סותר דיווח אי-זמינות'].filter(Boolean).join(' · '),
    }
  }

  if (agents.length === 0)
    return (
      <section className="card p-4 text-center text-sm text-slate-400" aria-label="תצוגה שבועית">
        אין סוכנים פעילים
      </section>
    )

  return (
    <>
      {/* phone: a card per agent, the week's seven days as chips that wrap — nothing to scroll sideways through */}
      <div className="space-y-2 sm:hidden" aria-label="תצוגה שבועית">
        {agents.map((a) => (
          <section key={a.id} className="card space-y-2 p-3" aria-label={a.full_name}>
            <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
              {a.full_name}
              {overloadedIds.has(a.id) && (
                <span className="chip border-amber-200 bg-amber-50 text-amber-700" title="עומס שטח גבוה מהממוצע השבוע">
                  עומס
                </span>
              )}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {dates.map((d, i) => {
                const c = cellOf(a.id, d)
                return (
                  <button
                    key={d}
                    type="button"
                    title={c.title || undefined}
                    onClick={() => onPick(d)}
                    className={classNames('flex min-h-[52px] w-[23%] min-w-[70px] flex-col items-center justify-center gap-0.5 rounded-lg border px-1 py-1 text-center hover:bg-slate-50', c.conflict ? 'border-red-300 bg-red-50/60' : 'border-slate-200')}
                  >
                    <span className="text-[11px] font-medium text-slate-500">
                      {DAY_SHORT[i]} {formatDate(d).slice(0, 5)}
                    </span>
                    <span aria-hidden className={classNames('h-2 w-2 rounded-full', c.dot)} />
                    {c.conflict && <AlertTriangle size={11} className="text-red-600" aria-hidden />}
                    {c.mShort && <span className="w-full truncate text-[10px] leading-tight text-brand-700">{c.mShort}</span>}
                    {c.eShort && c.eShort !== c.mShort && <span className="w-full truncate text-[10px] leading-tight text-brand-500">{c.eShort}</span>}
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      {/* wider screens: everyone in one table */}
      <section className="card hidden overflow-x-auto p-2 sm:block" aria-label="תצוגה שבועית">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr>
              <th className="p-2 text-start text-xs font-semibold text-slate-500">סוכן</th>
              {dates.map((d, i) => (
                <th key={d} className="p-2 text-center text-xs font-semibold text-slate-500">
                  <button type="button" className="rounded-lg px-1.5 py-1 hover:bg-slate-100" onClick={() => onPick(d)}>
                    {DAY_SHORT[i]} {formatDate(d).slice(0, 5)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {agents.map((a) => (
              <tr key={a.id}>
                <td className="whitespace-nowrap p-2 font-medium text-slate-800">
                  {a.full_name}
                  {overloadedIds.has(a.id) && <span className="mr-1 text-amber-600">●</span>}
                </td>
                {dates.map((d) => {
                  const c = cellOf(a.id, d)
                  return (
                    <td key={d} className="w-20 min-w-[80px] p-1 text-center align-top">
                      <button type="button" title={c.title || undefined} className={classNames('mx-auto flex min-h-[44px] w-full flex-col items-center gap-0.5 rounded-lg px-1 py-1 hover:bg-slate-50', c.conflict && 'bg-red-50/60 ring-1 ring-red-300')} onClick={() => onPick(d)}>
                        <span aria-hidden className={classNames('h-2 w-2 rounded-full', c.dot)} />
                        {c.conflict && <AlertTriangle size={11} className="text-red-600" aria-hidden />}
                        {c.mShort && <span className="w-full truncate text-[11px] leading-tight text-brand-700">{c.mShort}</span>}
                        {c.eShort && c.eShort !== c.mShort && <span className="w-full truncate text-[11px] leading-tight text-brand-500">{c.eShort}</span>}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  )
}

/** the signed-in agent reports their own week: a day is a whole-day toggle, or morning/evening separately with a reason when they can't */
function MyAvailability({
  dates,
  myId,
  isAdmin,
  isClosed,
  availByAgentDay,
  saveAvail,
  onCopyLastWeek,
  copying,
}: {
  dates: string[]
  myId: string
  isAdmin: boolean
  isClosed: boolean
  availByAgentDay: Map<string, AvailabilityRow[]>
  saveAvail: ReturnType<typeof useSaveAvailability>
  onCopyLastWeek: () => void
  copying: boolean
}) {
  const [reasonFor, setReasonFor] = useState<string | null>(null) // `${date}|${shift}` currently editing a reason
  const [reasonText, setReasonText] = useState('')
  if (!myId) return null
  // a closed week is locked for the agent's own editing; a manager can still change it here too
  const locked = isClosed && !isAdmin

  const setShift = (date: string, shift: RosterShift, status: AvailabilityStatus, reason = '') =>
    saveAvail.mutate([{ agent_id: myId, date, shift, status, reason, note: '' }])
  const setWholeDay = (date: string, status: AvailabilityStatus) =>
    saveAvail.mutate(SHIFTS.map((shift) => ({ agent_id: myId, date, shift, status, reason: '', note: '' })))
  // only fills what nobody reported yet — a day already marked unavailable, with a reason, is never touched
  function markWeekAvailable() {
    const toFill = unreportedShifts(dates, (date, shift) => (availByAgentDay.get(`${myId}|${date}`) ?? []).some((r) => r.shift === shift))
    if (toFill.length === 0) return toast('כל השבוע כבר מדווח', { kind: 'info' })
    saveAvail.mutate(toFill.map((s) => ({ agent_id: myId, date: s.date, shift: s.shift, status: 'available' as const, reason: '', note: '' })))
  }

  return (
    <section className="card space-y-2 p-3.5 sm:p-4" aria-label="הזמינות שלי">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-brand-800">
          הזמינות שלי
          {locked && (
            <span className="chip border-slate-300 bg-slate-100 text-slate-600" title="השבוע נסגר — פנה למנהל אם משהו צריך להשתנות">
              <Lock size={11} aria-hidden /> נעול
            </span>
          )}
        </h2>
        {!locked && (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-ghost !py-1 text-xs" onClick={markWeekAvailable}>
              <CalendarCheck size={13} aria-hidden /> כל השבוע זמין
            </button>
            <button type="button" className="btn-ghost !py-1 text-xs" disabled={copying} onClick={onCopyLastWeek}>
              <ClipboardCopy size={13} aria-hidden /> {copying ? 'מעתיק…' : 'העתק מהשבוע שעבר'}
            </button>
          </div>
        )}
      </div>
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
                  disabled={locked}
                  className={classNames('chip min-h-[32px]', full === 'full' ? 'border-emerald-300 bg-emerald-100 text-emerald-800' : 'border-slate-200 bg-white text-slate-600', locked && 'opacity-60')}
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
                      disabled={locked}
                      aria-pressed={on}
                      className={classNames('chip min-h-[32px]', on ? 'border-emerald-300 bg-emerald-100 text-emerald-800' : off ? 'border-red-300 bg-red-100 text-red-700' : 'border-slate-200 bg-white text-slate-600', locked && 'opacity-60')}
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
