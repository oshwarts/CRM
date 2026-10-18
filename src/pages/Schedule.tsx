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
import { classNames, formatDate, todayISO } from '../lib/utils'
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

  if (meetings.isLoading || scans.isLoading) return <Spinner />
  if (meetings.error && !meetings.data) return <ErrorState error={meetings.error} /> // cached data stays visible when only a background refresh failed

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-brand-800 sm:text-3xl">לוז שבועי</h1>
          <p className="text-sm text-slate-400">פגישות, ניתוחים, CT, סריקות חוזרות ותאריכי מעקב — במקום אחד</p>
        </div>
        <button className="btn-primary" onClick={() => setEntry({})}>
          <Plus size={16} /> ניתוח
        </button>
      </div>

      <div className="card space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button className="btn-secondary !px-2" onClick={() => setWeekStart((w) => addDays(w, -7))} aria-label="שבוע קודם">
              <ChevronRight size={18} />
            </button>
            <button className="btn-secondary" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }))}>
              השבוע
            </button>
            <button className="btn-secondary !px-2" onClick={() => setWeekStart((w) => addDays(w, 7))} aria-label="שבוע הבא">
              <ChevronLeft size={18} />
            </button>
          </div>
          <p className="font-semibold text-slate-700">
            {formatDate(from)} – {formatDate(to)}
          </p>
          <select className="input !w-auto" aria-label="סינון לפי סוכן" value={agentId} onChange={(e) => setAgentId(e.target.value)}>
            <option value="">כל הסוכנים</option>
            {(agents.data ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.full_name || a.email}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(KINDS) as Kind[]).map((k) => (
            <button
              key={k}
              onClick={() => setShown((s) => ({ ...s, [k]: !s[k] }))}
              className={classNames(
                'chip transition',
                shown[k] ? KINDS[k].chip : 'border-slate-200 bg-white text-slate-300 line-through',
              )}
            >
              {KINDS[k].label}
            </button>
          ))}
        </div>
      </div>

      {weekItems.length === 0 && <EmptyState title="אין אירועים בשבוע הזה" hint="נסה שבוע אחר או שנה את הסינון" />}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
        {days.map((d) => {
          const list = byDay(d)
          const isToday = iso(d) === today
          return (
            <section
              key={iso(d)}
              className={classNames(
                'card min-w-0 p-3',
                isToday && 'border-brand-400 ring-2 ring-brand-200',
                // on a phone only days with something in them (and today) take up room
                list.length === 0 && !isToday && 'hidden lg:block',
              )}
            >
              <h2 className={classNames('mb-2 flex items-baseline justify-between rounded-lg px-2 py-1 text-base font-semibold', isToday ? 'bg-brand-500 text-white' : 'bg-brand-50 text-brand-800')}>
                <span>יום {DAY_NAMES[d.getDay()]}</span>
                <span className={classNames('flex items-center gap-1 text-xs font-normal', isToday ? 'text-white' : 'text-slate-500')}>
                  {format(d, 'dd/MM')}
                  <button
                    type="button"
                    className={classNames('rounded-full p-1', isToday ? 'hover:bg-white/20' : 'hover:bg-brand-100')}
                    title="הוסף ניתוח ליום הזה"
                    aria-label={`הוסף ניתוח ליום ${DAY_NAMES[d.getDay()]}`}
                    onClick={() => setEntry({ date: iso(d) })}
                  >
                    <Plus size={14} />
                  </button>
                </span>
              </h2>
              {list.length === 0 ? (
                <p className="py-2 text-center text-xs text-slate-400">—</p>
              ) : (
                <ul className="space-y-1.5">
                  {list.map((it) => (
                    <li key={it.id}>
                      {(() => {
                        const cls = classNames(
                          'block w-full rounded-xl border px-2.5 py-2 text-right text-sm transition hover:shadow-sm lg:text-xs',
                          KINDS[it.kind].chip,
                          it.muted && 'opacity-50',
                        )
                        const body = (
                          <>
                            <span className="flex items-center justify-between gap-1">
                              <span className="font-semibold">{KINDS[it.kind].label}</span>
                              {it.time && <span dir="ltr">{it.time}</span>}
                            </span>
                            <span className="block break-words font-medium text-slate-800">{it.title}</span>
                            {it.sub && <span className="block break-words text-slate-500">{it.sub}</span>}
                          </>
                        )
                        return it.surgery ? (
                          <button type="button" className={cls} onClick={() => setEntry({ surgery: it.surgery })}>
                            {body}
                          </button>
                        ) : (
                          <Link to={it.to} className={cls}>
                            {body}
                          </Link>
                        )
                      })()}
                    </li>
                  ))}
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
