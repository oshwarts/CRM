import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { addMonths, endOfMonth, format, startOfMonth } from 'date-fns'
import { AlertTriangle, CalendarCheck, Download, ScanLine, Stethoscope, Users } from 'lucide-react'
import { useDoctors, useMeetings, usePatientScans, useTasks } from '../lib/api'
import { usePipelineStages } from '../lib/pipeline'
import { classNames, csvCell, formatDate, todayISO } from '../lib/utils'
import { EmptyState, Spinner } from './ui'

const MONTHS_OPTIONS = [3, 6, 12] as const
/** a meeting that really took place (a "scheduled" one whose date passed was never closed) */
const HELD = new Set(['done', 'needs_followup'])
const monthLabel = (d: Date) => new Intl.DateTimeFormat('he-IL', { month: 'short', year: '2-digit' }).format(d)

function Bar({ value, max, tone = 'bg-brand-500' }: { value: number; max: number; tone?: string }) {
  return (
    <div className="h-2 w-full min-w-16 overflow-hidden rounded-full bg-slate-100">
      <div className={classNames('h-full rounded-full', tone)} style={{ width: `${max > 0 ? Math.max(value > 0 ? 4 : 0, (value / max) * 100) : 0}%` }} />
    </div>
  )
}

function Kpi({ icon, value, label, warn }: { icon: React.ReactNode; value: number; label: string; warn?: boolean }) {
  return (
    <div className={classNames('card flex items-center gap-3 p-3.5', warn && value > 0 && 'border-amber-300 bg-amber-50')}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">{icon}</span>
      <span>
        <span className="block text-2xl font-semibold leading-none text-brand-800">{value}</span>
        <span className="mt-1 block text-xs leading-tight text-slate-600">{label}</span>
      </span>
    </div>
  )
}

function download(filename: string, headers: string[], rows: (string | number)[][]) {
  const csv = [headers, ...rows].map((r) => r.map(csvCell).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** sales activity of the team: visits, doctors reached, MAKO surgeries, the funnel of potential doctors, who needs attention */
export function SalesReports() {
  const meetings = useMeetings()
  const scans = usePatientScans()
  const doctors = useDoctors()
  const tasks = useTasks()
  const [monthsBack, setMonthsBack] = useState<number>(6)
  const { names: stageNames } = usePipelineStages()

  const model = useMemo(() => {
    const today = todayISO()
    const first = startOfMonth(addMonths(new Date(), -(monthsBack - 1)))
    const start = format(first, 'yyyy-MM-dd')
    const months = Array.from({ length: monthsBack }, (_, i) => {
      const d = addMonths(first, i)
      return { key: format(d, 'yyyy-MM'), label: monthLabel(d) }
    })
    const mk = (date: string | null | undefined) => (date ? date.slice(0, 7) : '')
    const inRange = (date: string | null | undefined) => !!date && date >= start && date <= today

    const held = (meetings.data ?? []).filter((m) => HELD.has(m.status) && inRange(m.meeting_date))
    const surgeries = (scans.data ?? []).filter((s) => s.status !== 'cancelled' && !!s.surgery_date && s.surgery_date >= start && s.surgery_date <= format(endOfMonth(new Date()), 'yyyy-MM-dd'))
    const doneTasks = (tasks.data ?? []).filter((t) => t.is_done && inRange(t.done_at?.slice(0, 10)))

    const perMonth = months.map((m) => {
      const mm = held.filter((x) => mk(x.meeting_date) === m.key)
      const docs = new Set(mm.flatMap((x) => x.meeting_doctors.flatMap((d) => (d.doctor ? [d.doctor.id] : []))))
      return {
        ...m,
        meetings: mm.length,
        doctors: docs.size,
        surgeries: surgeries.filter((s) => mk(s.surgery_date) === m.key).length,
        tasks: doneTasks.filter((t) => mk(t.done_at) === m.key).length,
      }
    })

    // per hospital
    const hosp = new Map<string, { name: string; meetings: number; surgeries: number }>()
    const row = (id: string, name: string) => hosp.get(id) ?? hosp.set(id, { name, meetings: 0, surgeries: 0 }).get(id)!
    for (const m of held) if (m.hospital) row(m.hospital.id, m.hospital.name).meetings++
    for (const s of surgeries) if (s.hospital) row(s.hospital.id, s.hospital.name).surgeries++
    const hospitals = [...hosp.values()].sort((a, b) => b.surgeries + b.meetings - (a.surgeries + a.meetings))

    // last real meeting of every doctor
    const last = new Map<string, string>()
    for (const m of meetings.data ?? [])
      if (HELD.has(m.status) && m.meeting_date && m.meeting_date <= today)
        for (const d of m.meeting_doctors) if (d.doctor && m.meeting_date > (last.get(d.doctor.id) ?? '')) last.set(d.doctor.id, m.meeting_date)

    const allDoctors = doctors.data ?? []
    const clients = allDoctors.filter((d) => d.status === 'client')
    const potential = allDoctors.filter((d) => d.status === 'potential')
    const metIds = new Set(held.flatMap((m) => m.meeting_doctors.flatMap((d) => (d.doctor ? [d.doctor.id] : []))))
    const sixty = format(new Date(Date.now() - 60 * 86400000), 'yyyy-MM-dd')
    const attention = allDoctors
      .map((d) => ({ d, last: last.get(d.id) ?? null }))
      .filter((x) => !x.last || x.last < sixty)
      .sort((a, b) => (a.last ?? '').localeCompare(b.last ?? ''))

    const funnel = stageNames.map((stage) => ({ stage, count: potential.filter((d) => d.pipeline_stage === stage).length }))
    const noStage = potential.filter((d) => !stageNames.includes(d.pipeline_stage)).length
    const stuck = potential.filter((d) => d.next_step_date && d.next_step_date < today).length

    return {
      perMonth,
      hospitals,
      attention,
      funnel,
      noStage,
      stuck,
      totals: {
        meetings: held.length,
        doctorsMet: metIds.size,
        surgeries: surgeries.filter((s) => (s.surgery_date as string) <= today).length,
        clients: clients.length,
        potential: potential.length,
        notMet: allDoctors.filter((d) => !metIds.has(d.id)).length,
      },
    }
  }, [meetings.data, scans.data, doctors.data, tasks.data, monthsBack, stageNames])

  if ([meetings, scans, doctors].some((q) => q.isLoading)) return <Spinner />
  if (!meetings.data && !doctors.data) return <EmptyState title="אין נתונים להצגה" />

  const maxMeet = Math.max(1, ...model.perMonth.map((m) => m.meetings))
  const maxSurg = Math.max(1, ...model.perMonth.map((m) => m.surgeries))
  const maxFunnel = Math.max(1, ...model.funnel.map((f) => f.count), model.noStage)
  const t = model.totals

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">פעילות הצוות: ביקורים שהתקיימו (פגישה שסומנה כבוצעה), ניתוחי MAKO והמשפך של רופאים פוטנציאליים.</p>
        <div className="flex items-center gap-2">
          <select className="input !w-auto" value={monthsBack} onChange={(e) => setMonthsBack(Number(e.target.value))} aria-label="תקופה">
            {MONTHS_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} חודשים אחרונים
              </option>
            ))}
          </select>
          <button
            className="btn-secondary"
            onClick={() => {
              download(
                `דוח-פעילות-חודשי.csv`,
                ['חודש', 'פגישות שהתקיימו', 'רופאים שנפגשו', 'ניתוחי MAKO', 'משימות שהושלמו'],
                model.perMonth.map((m) => [m.label, m.meetings, m.doctors, m.surgeries, m.tasks]),
              )
            }}
          >
            <Download size={16} />
            CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Kpi icon={<CalendarCheck size={20} />} value={t.meetings} label="פגישות שהתקיימו" />
        <Kpi icon={<Stethoscope size={20} />} value={t.doctorsMet} label="רופאים שנפגשו" />
        <Kpi icon={<ScanLine size={20} />} value={t.surgeries} label="ניתוחי MAKO שבוצעו" />
        <Kpi icon={<Users size={20} />} value={t.potential} label="רופאים פוטנציאליים" />
        <div className="col-span-2 md:col-span-1"><Kpi icon={<AlertTriangle size={20} />} value={t.notMet} label="רופאים בלי פגישה בתקופה" warn /></div>
      </div>

      <section className="card p-4">
        <h2 className="mb-3 text-base font-semibold text-brand-800">לפי חודש</h2>
        <div tabIndex={0} className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="p-2 text-right font-medium">חודש</th>
                <th className="p-2 text-right font-medium">פגישות</th>
                <th className="p-2 text-center font-medium">רופאים</th>
                <th className="p-2 text-right font-medium">ניתוחים</th>
                <th className="p-2 text-center font-medium">משימות</th>
              </tr>
            </thead>
            <tbody>
              {model.perMonth.map((m) => (
                <tr key={m.key} className="border-b border-slate-100">
                  <td className="whitespace-nowrap p-2 text-slate-700">{m.label}</td>
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 text-center font-semibold text-slate-800">{m.meetings}</span>
                      <Bar value={m.meetings} max={maxMeet} />
                    </div>
                  </td>
                  <td className="p-2 text-center text-slate-600">{m.doctors}</td>
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 text-center font-semibold text-slate-800">{m.surgeries}</span>
                      <Bar value={m.surgeries} max={maxSurg} tone="bg-emerald-500" />
                    </div>
                  </td>
                  <td className="p-2 text-center text-slate-600">{m.tasks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="mb-1 text-base font-semibold text-brand-800">משפך הרופאים הפוטנציאליים</h2>
          <p className="mb-3 text-xs text-slate-500">
            {t.potential} פוטנציאליים · {t.clients} לקוחות{model.stuck > 0 ? ` · ${model.stuck} עם "הצעד הבא" שעבר` : ''}
          </p>
          <ul className="space-y-2">
            {model.funnel.map((f) => (
              <li key={f.stage} className="flex items-center gap-2 text-sm">
                <span className="w-36 shrink-0 text-slate-700">{f.stage}</span>
                <Bar value={f.count} max={maxFunnel} tone="bg-violet-500" />
                <span className="w-6 text-center font-semibold text-slate-800">{f.count}</span>
              </li>
            ))}
            {model.noStage > 0 && (
              <li className="flex items-center gap-2 text-sm">
                <span className="w-36 shrink-0 text-slate-400">ללא שלב</span>
                <Bar value={model.noStage} max={maxFunnel} tone="bg-slate-300" />
                <span className="w-6 text-center font-semibold text-slate-500">{model.noStage}</span>
              </li>
            )}
          </ul>
        </section>

        <section className="card p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-brand-800">לפי בית חולים</h2>
            <button
              className="btn-ghost !px-2 text-xs"
              onClick={() => download('דוח-בתי-חולים.csv', ['בית חולים', 'פגישות', 'ניתוחי MAKO'], model.hospitals.map((h) => [h.name, h.meetings, h.surgeries]))}
            >
              <Download size={14} /> CSV
            </button>
          </div>
          {model.hospitals.length === 0 ? (
            <p className="text-sm text-slate-400">אין פעילות בתקופה.</p>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="p-2 text-right font-medium">בית חולים</th>
                    <th className="p-2 text-center font-medium">פגישות</th>
                    <th className="p-2 text-center font-medium">ניתוחים</th>
                  </tr>
                </thead>
                <tbody>
                  {model.hospitals.map((h) => (
                    <tr key={h.name} className="border-b border-slate-100">
                      <td className="p-2 text-slate-700">{h.name}</td>
                      <td className="p-2 text-center text-slate-600">{h.meetings}</td>
                      <td className="p-2 text-center font-semibold text-slate-800">{h.surgeries}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <section className="card p-4">
        <h2 className="mb-1 text-base font-semibold text-brand-800">רופאים שלא נפגשנו איתם מעל 60 יום</h2>
        <p className="mb-3 text-xs text-slate-500">לפי פגישות שסומנו כבוצעו. {model.attention.length} רופאים.</p>
        {model.attention.length === 0 ? (
          <p className="text-sm text-slate-400">כל הרופאים בקשר שוטף.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {model.attention.slice(0, 20).map(({ d, last }) => (
              <li key={d.id}>
                <Link to={`/doctors/${d.id}`} className="flex items-center justify-between gap-3 px-1 py-2 hover:bg-slate-50">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-800">
                      {d.title} {d.name}
                    </span>
                    <span className="block truncate text-xs text-slate-500">{d.doctor_hospitals.map((h) => h.hospital?.name).filter(Boolean).join(', ') || '—'}</span>
                  </span>
                  <span className="chip shrink-0 border-amber-200 bg-amber-50 text-amber-700">{last ? `פגישה אחרונה ${formatDate(last)}` : 'אין פגישה מתועדת'}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {model.attention.length > 20 && <p className="mt-2 text-xs text-slate-400">מוצגים 20 הראשונים (הוותיקים ביותר).</p>}
      </section>
    </div>
  )
}
