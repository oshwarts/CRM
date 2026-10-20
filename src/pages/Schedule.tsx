import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { addDays, format, startOfWeek } from 'date-fns'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import {
  useAgents,
  useHospitalAgents,
  useMeetings,
  usePatientScans,
} from '../lib/api'
import { SCAN_PROCEDURE_LABELS } from '../lib/types'
import { classNames, todayISO } from '../lib/utils'
import { EmptyState, ErrorState, Spinner } from '../components/ui'
import { PlannedSurgeryModal } from '../components/PlannedSurgeryModal'
import { usePlannedSurgeries, type PlannedSurgery } from '../lib/plannedSurgeries'

type Kind = 'meeting' | 'surgery' | 'ct' | 'rescan' | 'followup'

type Item = {
  id: string
  date: string
  time: string
  kind: Kind
  title: string
  sub: string
  to: string
  /** an entered (not scanned) surgery: opens the quick-entry form instead of a page */
  surgery?: PlannedSurgery
  muted?: boolean
  agentIds: string[]
}

const KINDS: Record<Kind, { label: string; chip: string }> = {
  meeting: { label: 'פגישה', chip: 'border-brand-200 bg-brand-50 text-brand-700' },
  surgery: { label: 'ניתוח', chip: 'border-violet-200 bg-violet-50 text-violet-700' },
  ct: { label: 'CT', chip: 'border-sky-200 bg-sky-50 text-sky-700' },
  rescan: { label: 'סריקה חוזרת', chip: 'border-rose-200 bg-rose-50 text-rose-700' },
  followup: { label: 'מעקב', chip: 'border-amber-200 bg-amber-50 text-amber-700' },
}

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
const iso = (d: Date) => format(d, 'yyyy-MM-dd')
const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : '')

export default function Schedule() {
  const meetings = useMeetings()
  const scans = usePatientScans()
  const planned = usePlannedSurgeries()
  const [entry, setEntry] = useState<{ surgery?: PlannedSurgery; date?: string } | null>(null)
  const agents = useAgents()
  const hospitalAgents = useHospitalAgents()

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }))
  const [agentId, setAgentId] = useState('')
  const [shown, setShown] = useState<Record<Kind, boolean>>({
    meeting: true,
    surgery: true,
    ct: true,
    rescan: true,
    followup: true,
  })

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const from = iso(days[0])
  const to = iso(days[6])
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
          id: `m-${m.id}`, date: m.meeting_date, time: hhmm(m.meeting_time), kind: 'meeting',
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
          id: `c-${s.id}`, date: s.ct_date, time: hhmm(s.ct_time), kind: 'ct',
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
    return out
  }, [meetings.data, scans.data, planned.data, agentsOfHospital])

  const weekItems = useMemo(
    () =>
      items
        .filter((it) => it.date >= from && it.date <= to && shown[it.kind])
        .filter((it) => !agentId || it.agentIds.includes(agentId))
        .sort((a, b) => a.date.localeCompare(b.date) || (a.time || '99').localeCompare(b.time || '99') || a.kind.localeCompare(b.kind)),
    [items, from, to, shown, agentId],
  )

  const byDay = (d: Date) => weekItems.filter((it) => it.date === iso(d))

  // how many events of each kind the week holds (for the agent chosen), shown on the type chips
  const counts = useMemo(() => {
    const c: Record<Kind, number> = { meeting: 0, surgery: 0, ct: 0, rescan: 0, followup: 0 }
    for (const it of items) if (it.date >= from && it.date <= to && (!agentId || it.agentIds.includes(agentId))) c[it.kind]++
    return c
  }, [items, from, to, agentId])
  const thisWeek = iso(startOfWeek(new Date(), { weekStartsOn: 0 }))

  if (meetings.isLoading || scans.isLoading) return <Spinner />
  if (meetings.error && !meetings.data) return <ErrorState error={meetings.error} /> // cached data stays visible when only a background refresh failed

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-brand-800 sm:text-3xl">לוז שבועי</h1>
          <p className="text-sm text-slate-500">פגישות, ניתוחים, CT ומעקבים</p>
        </div>
        <button className="btn-primary shrink-0" onClick={() => setEntry({})}>
          <Plus size={16} /> ניתוח
        </button>
      </div>

      <div className="card space-y-2.5 p-3 sm:p-4">
        <div className="flex items-center gap-2">
          <button className="btn-secondary !px-2" onClick={() => setWeekStart((w) => addDays(w, -7))} aria-label="שבוע קודם">
            <ChevronRight size={18} />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="font-semibold text-slate-800">
              <span dir="ltr">
                {format(days[0], 'dd/MM')} – {format(days[6], 'dd/MM')}
              </span>
            </p>
            {from === thisWeek ? (
              <p className="text-xs text-brand-700">השבוע הנוכחי</p>
            ) : (
              <button type="button" className="text-xs font-medium text-brand-700 underline" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }))}>
                חזרה להשבוע
              </button>
            )}
          </div>
          <button className="btn-secondary !px-2" onClick={() => setWeekStart((w) => addDays(w, 7))} aria-label="שבוע הבא">
            <ChevronLeft size={18} />
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
            <button
              key={k}
              type="button"
              aria-pressed={shown[k]}
              onClick={() => setShown((s) => ({ ...s, [k]: !s[k] }))}
              className={classNames('chip transition', shown[k] ? KINDS[k].chip : 'border-slate-200 bg-white text-slate-500 line-through')}
            >
              {KINDS[k].label}
              {counts[k] > 0 && <span className="font-semibold">{counts[k]}</span>}
            </button>
          ))}
        </div>
      </div>

      {weekItems.length === 0 && <EmptyState title="אין אירועים בשבוע הזה" hint="נסה שבוע אחר או שנה את הסינון" />}

      <div className="grid gap-2 sm:gap-3 md:grid-cols-2 xl:grid-cols-7">
        {days.map((d) => {
          const list = byDay(d)
          const isToday = iso(d) === today
          const dayName = DAY_NAMES[d.getDay()]
          return (
            <section
              key={iso(d)}
              aria-label={`יום ${dayName} ${format(d, 'dd/MM')}`}
              className={classNames(
                'card min-w-0',
                list.length === 0 ? 'p-1.5 xl:p-3' : 'p-2.5 sm:p-3',
                isToday && 'border-brand-400 ring-2 ring-brand-200',
              )}
            >
              <h2
                className={classNames(
                  'flex items-center justify-between gap-2 rounded-lg px-2 py-0.5 text-base font-semibold',
                  list.length > 0 && 'mb-2',
                  isToday ? 'bg-brand-500 text-white' : list.length === 0 ? 'text-slate-600' : 'bg-brand-50 text-brand-800',
                )}
              >
                <span className="flex flex-wrap items-baseline gap-x-1.5">
                  יום {dayName}
                  <span className={classNames('text-xs font-normal', isToday ? 'text-white' : 'text-slate-500')}>{format(d, 'dd/MM')}</span>
                  {isToday && <span className="rounded-full bg-white/25 px-1.5 text-xs font-medium">היום</span>}
                </span>
                <button
                  type="button"
                  className={classNames('inline-flex min-h-[32px] shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-medium', isToday ? 'hover:bg-white/20' : 'text-brand-700 hover:bg-brand-100')}
                  aria-label={`הוסף ניתוח ליום ${dayName}`}
                  onClick={() => setEntry({ date: iso(d) })}
                >
                  <Plus size={14} />
                  <span className="md:hidden">ניתוח</span>
                </button>
              </h2>
              {list.length > 0 && (
                <ul className="space-y-1.5">
                  {list.map((it) => {
                    const cls = classNames(
                      'block w-full rounded-xl border px-2.5 py-2 text-right text-sm transition hover:shadow-sm lg:text-xs',
                      it.muted ? 'border-slate-200 bg-slate-50 text-slate-500' : KINDS[it.kind].chip,
                    )
                    const body = (
                      <>
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
                      </>
                    )
                    return (
                      <li key={it.id}>
                        {it.surgery ? (
                          <button type="button" className={cls} onClick={() => setEntry({ surgery: it.surgery })}>
                            {body}
                          </button>
                        ) : (
                          <Link to={it.to} className={cls}>
                            {body}
                          </Link>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          )
        })}
      </div>
      {entry && <PlannedSurgeryModal surgery={entry.surgery} date={entry.date} onClose={() => setEntry(null)} />}
    </div>
  )
}
