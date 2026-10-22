import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { CalendarPlus, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useAgents, useHospitalAgents, useMeetings, usePatientScans, useTasks } from '../lib/api'
import { classNames, todayISO } from '../lib/utils'
import { ErrorState, Spinner } from '../components/ui'
import { PlannedSurgeryModal } from '../components/PlannedSurgeryModal'
import { MeetingFormModal } from '../components/MeetingFormModal'
import { TaskFormModal } from '../components/TaskFormModal'
import { usePlannedSurgeries, type PlannedSurgery } from '../lib/plannedSurgeries'
import { iso, nextHalfHour, parseISO, rangeFor, shiftAnchor, titleFor, type CalView } from '../lib/calendar'
import { buildItems, countKinds, visibleItems } from '../lib/scheduleItems'
import { usePersisted } from '../lib/usePersisted'
import { DAY_NAMES, KINDS, type Item, type Kind } from '../components/schedule/shared'
import { TimeGrid } from '../components/schedule/TimeGrid'
import { MonthGrid } from '../components/schedule/MonthGrid'
import { EventSheet, addToOutlook } from '../components/schedule/EventSheet'
import { SlotMenu } from '../components/schedule/SlotMenu'
import type { TaskRow } from '../lib/types'

const VIEWS: [CalView, string][] = [['day', 'יומי'], ['week', 'שבועי'], ['month', 'חודשי']]

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

  const items = useMemo(
    () => buildItems({ meetings: meetings.data ?? [], scans: scans.data ?? [], planned: planned.data ?? [], tasks: tasks.data ?? [], agentsOfHospital }),
    [meetings.data, scans.data, planned.data, tasks.data, agentsOfHospital],
  )
  const visible = useMemo(() => visibleItems(items, from, to, shown, agentId), [items, from, to, shown, agentId])
  // how many of each kind the range holds (for the agent chosen), shown on the type chips
  const counts = useMemo(() => countKinds(items, from, to, agentId), [items, from, to, agentId])

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

  if (meetings.isLoading || scans.isLoading) return <Spinner /> // the surgeries entered by hand and the tasks join in when they arrive
  if (meetings.error && !meetings.data) return <ErrorState error={meetings.error} /> // cached data stays visible when only a background refresh failed

  // a source that could not be read (and has nothing cached) leaves the calendar incomplete: say so instead of showing it as empty
  const missing = [
    scans.error && !scans.data ? 'ניתוחי MAKO והסריקות' : '',
    planned.error && !planned.data ? 'ניתוחים שהוזנו' : '',
    tasks.error && !tasks.data ? 'משימות' : '',
  ].filter(Boolean)
  const isCurrent = view === 'month' ? anchorISO.slice(0, 7) === today.slice(0, 7) : from <= today && today <= to
  // the week on the phone: the days one under the other
  const agenda = (
    <div className="space-y-2 xl:hidden">
      {days.map((d) => {
        const date = iso(d)
        const list = visible.filter((it) => it.date === date)
        const isToday = date === today
        return (
          <section key={date} aria-label={`יום ${DAY_NAMES[d.getDay()]} ${format(d, 'dd/MM')}`} className={classNames('card p-2.5', isToday && 'border-brand-400 ring-2 ring-brand-200')}>
            <h2 className={classNames('flex items-center justify-between gap-2 rounded-lg px-2 py-0.5 text-base font-semibold', isToday ? 'bg-brand-500 text-white' : list.length ? 'bg-brand-50 text-brand-800' : 'text-slate-600')}>
              <button type="button" className="flex min-h-[40px] flex-wrap items-center gap-x-1.5 text-right" onClick={() => goDay(date)}>
                יום {DAY_NAMES[d.getDay()]}
                <span className={classNames('text-xs font-normal', isToday ? 'text-white' : 'text-slate-500')}>{format(d, 'dd/MM')}</span>
                {isToday && <span className="rounded-full bg-white/25 px-1.5 text-xs font-medium">היום</span>}
              </button>
              <button type="button" className={classNames('inline-flex min-h-[40px] shrink-0 items-center gap-1 rounded-full px-3 text-xs font-medium', isToday ? 'hover:bg-white/20' : 'text-brand-700 hover:bg-brand-100')} aria-label={`אירוע חדש ביום ${DAY_NAMES[d.getDay()]}`} onClick={() => setSlot({ date, time: '09:00' })}>
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
        <button className="btn-primary shrink-0" onClick={() => setSlot({ date: view === 'month' ? today : anchorISO, time: nextHalfHour(new Date()) })}>
          <Plus size={16} aria-hidden /> חדש
        </button>
      </div>

      <div className="card space-y-2.5 p-3 sm:p-4">
        <div role="group" aria-label="תצוגת היומן" className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
          {VIEWS.map(([v, label]) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={classNames('min-h-[40px] rounded-lg text-sm font-medium transition', view === v ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary !px-2" onClick={() => setAnchorISO(iso(shiftAnchor(view, anchor, -1)))} aria-label={view === 'day' ? 'היום הקודם' : view === 'week' ? 'השבוע הקודם' : 'החודש הקודם'}>
            <ChevronRight size={18} />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="text-sm font-semibold text-slate-800 sm:text-base">
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
            <button key={k} type="button" aria-pressed={shown[k]} onClick={() => setShown((s) => ({ ...s, [k]: !s[k] }))} className={classNames('chip transition max-sm:!min-h-10', shown[k] ? KINDS[k].chip : 'border-slate-200 bg-white text-slate-500 line-through')}>
              {KINDS[k].label}
              {counts[k] > 0 && <span className="font-semibold">{counts[k]}</span>}
            </button>
          ))}
        </div>
      </div>

      {missing.length > 0 && (
        <p role="alert" className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
          לא הצלחנו לטעון: {missing.join(', ')}. היומן חלקי — נסה לרענן.
        </p>
      )}
      {view === 'day' && <TimeGrid days={days} items={visible} today={today} onSlot={(date, time) => setSlot({ date, time })} onItem={openItem} />}
      {view === 'week' && (
        <>
          {agenda}
          <div className="hidden xl:block">
            <TimeGrid days={days} items={visible} today={today} onSlot={(date, time) => setSlot({ date, time })} onItem={openItem} onDay={goDay} />
          </div>
        </>
      )}
      {view === 'month' && <MonthGrid anchor={anchor} items={visible} today={today} onDay={goDay} onItem={openItem} />}
      {visible.length === 0 && (
        <p className="text-center text-sm text-slate-500">
          {agentId || Object.values(shown).some((v) => !v) ? 'אין אירועים שמתאימים לסינון' : 'אין אירועים'} {view === 'day' ? 'ביום הזה' : view === 'week' ? 'בשבוע הזה' : 'בחודש הזה'}.
          {' '}לחץ על &quot;חדש&quot; כדי להוסיף פגישה, משימה או ניתוח.
        </p>
      )}
      <p className="text-center text-xs text-slate-500">
        <Link to="/tasks" className="inline-flex min-h-[40px] items-center px-2 underline sm:min-h-[28px]">
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
