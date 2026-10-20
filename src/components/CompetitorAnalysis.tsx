import { useMemo, useState } from 'react'
import { findDefaultCompany, useAllCaseVolumes, useCompanies, useCompetitorIntel, useHospitals, useRoboticSystems } from '../lib/api'
import { LOSS_REASONS } from '../lib/competitors'
import { classNames } from '../lib/utils'
import { EmptyState, Spinner } from './ui'

function Bar({ value, max, tone = 'bg-brand-500' }: { value: number; max: number; tone?: string }) {
  return (
    <div className="h-2 w-full min-w-12 overflow-hidden rounded-full bg-slate-100">
      <div className={classNames('h-full rounded-full', tone)} style={{ width: `${max > 0 ? Math.max(value > 0 ? 4 : 0, (value / max) * 100) : 0}%` }} />
    </div>
  )
}

/** wins and losses against the competitors, the reasons for losing, the market share and who has a robot where */
export function CompetitorAnalysis() {
  const intel = useCompetitorIntel()
  const volumes = useAllCaseVolumes()
  const hospitals = useHospitals()
  const systems = useRoboticSystems()
  const companies = useCompanies()
  const [year, setYear] = useState<number | null>(null)

  const outcomes = useMemo(() => {
    const all = intel.data ?? []
    const lost = all.filter((i) => i.outcome === 'lost')
    const reasons = new Map<string, number>()
    for (const i of lost) reasons.set(i.loss_reason || 'לא צוין', (reasons.get(i.loss_reason || 'לא צוין') ?? 0) + 1)
    const byCompetitor = new Map<string, { won: number; lost: number; open: number }>()
    for (const i of all) {
      const e = byCompetitor.get(i.competitor) ?? { won: 0, lost: 0, open: 0 }
      e[i.outcome === 'won' ? 'won' : i.outcome === 'lost' ? 'lost' : 'open']++
      byCompetitor.set(i.competitor, e)
    }
    return {
      won: all.filter((i) => i.outcome === 'won').length,
      lost: lost.length,
      open: all.filter((i) => i.outcome === 'open').length,
      reasons: [...reasons.entries()].sort((a, b) => b[1] - a[1]),
      byCompetitor: [...byCompetitor.entries()].sort((a, b) => b[1].lost + b[1].won - (a[1].lost + a[1].won)),
    }
  }, [intel.data])

  const years = useMemo(() => [...new Set((volumes.data ?? []).map((v) => v.year))].sort((a, b) => b - a), [volumes.data])
  const shownYear = year ?? years[0] ?? null
  const ours = findDefaultCompany(companies.data)?.id

  const share = useMemo(() => {
    const byCompany = new Map<string, { name: string; count: number; id: string | null }>()
    for (const v of volumes.data ?? []) {
      if (v.year !== shownYear) continue
      const key = v.company?.id ?? 'none'
      const e = byCompany.get(key) ?? { name: v.company?.name ?? 'ללא חברה', count: 0, id: v.company?.id ?? null }
      e.count += v.count
      byCompany.set(key, e)
    }
    const rows = [...byCompany.values()].sort((a, b) => b.count - a.count)
    return { rows, total: rows.reduce((n, r) => n + r.count, 0) }
  }, [volumes.data, shownYear])

  // per company and year (the trend)
  const trend = useMemo(() => {
    const m = new Map<string, Map<number, number>>()
    for (const v of volumes.data ?? []) {
      const name = v.company?.name ?? 'ללא חברה'
      const row = m.get(name) ?? new Map<number, number>()
      row.set(v.year, (row.get(v.year) ?? 0) + v.count)
      m.set(name, row)
    }
    return [...m.entries()]
  }, [volumes.data])

  // who has which robot in which hospital, and how many cases there were there in the shown year
  const matrix = useMemo(() => {
    const sys = new Map((systems.data ?? []).map((s) => [s.id, s.name]))
    const cases = new Map<string, { total: number; ours: number }>()
    for (const v of volumes.data ?? []) {
      if (v.year !== shownYear || !v.hospital) continue
      const e = cases.get(v.hospital.id) ?? { total: 0, ours: 0 }
      e.total += v.count
      if (ours && v.company?.id === ours) e.ours += v.count
      cases.set(v.hospital.id, e)
    }
    return (hospitals.data ?? [])
      .map((h) => ({
        id: h.id,
        name: h.name,
        systems: h.hospital_robotic_systems.map((x) => sys.get(x.system_id)).filter((x): x is string => !!x),
        cases: cases.get(h.id) ?? { total: 0, ours: 0 },
      }))
      .filter((h) => h.systems.length > 0 || h.cases.total > 0)
      .sort((a, b) => b.cases.total - a.cases.total || a.name.localeCompare(b.name, 'he'))
  }, [hospitals.data, systems.data, volumes.data, shownYear, ours])

  if (intel.isLoading || volumes.isLoading) return <Spinner />
  const decided = outcomes.won + outcomes.lost
  const maxReason = Math.max(1, ...outcomes.reasons.map((r) => r[1]))
  const maxShare = Math.max(1, ...share.rows.map((r) => r.count))
  const trendYears = years.slice(0, 4).reverse()

  return (
    <div className="space-y-5">
      <section className="card p-4">
        <h2 className="mb-1 text-base font-semibold text-brand-800">ניצחונות והפסדים</h2>
        <p className="mb-3 text-xs text-slate-500">
          {decided === 0 ? 'עדיין לא סומנו תוצאות. בעריכת רישום אפשר לסמן "ניצחנו" או "הפסדנו" ולבחור סיבה.' : `${outcomes.won} ניצחונות · ${outcomes.lost} הפסדים · ${outcomes.open} פתוחים · אחוז הצלחה ${Math.round((outcomes.won / decided) * 100)}%`}
        </p>
        {outcomes.lost > 0 && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">למה הפסדנו</p>
              <ul className="space-y-1.5">
                {[...outcomes.reasons, ...LOSS_REASONS.filter((r) => !outcomes.reasons.some(([x]) => x === r)).map((r) => [r, 0] as [string, number])].map(([reason, n]) => (
                  <li key={reason} className="flex items-center gap-2 text-sm">
                    <span className="w-28 shrink-0 text-slate-700 sm:w-40">{reason}</span>
                    <Bar value={n} max={maxReason} tone="bg-red-400" />
                    <span className="w-6 text-center font-semibold text-slate-800">{n}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div tabIndex={0} className="overflow-x-auto">
              <p className="mb-2 text-sm font-medium text-slate-700">לפי מתחרה</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="p-1.5 text-right font-medium">מתחרה</th>
                    <th className="p-1.5 text-center font-medium">ניצחנו</th>
                    <th className="p-1.5 text-center font-medium">הפסדנו</th>
                    <th className="p-1.5 text-center font-medium">פתוח</th>
                  </tr>
                </thead>
                <tbody>
                  {outcomes.byCompetitor.map(([name, e]) => (
                    <tr key={name} className="border-b border-slate-100">
                      <td className="p-1.5 text-slate-700">{name}</td>
                      <td className="p-1.5 text-center text-emerald-700">{e.won || ''}</td>
                      <td className="p-1.5 text-center text-red-600">{e.lost || ''}</td>
                      <td className="p-1.5 text-center text-slate-500">{e.open || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section className="card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-brand-800">נתח שוק לפי כמויות מקרים</h2>
            <p className="text-xs text-slate-500">לפי נתוני "כמויות מקרים" (דוחות) — כל חברה לפי מספר המקרים בשנה.</p>
          </div>
          {years.length > 0 && (
            <select className="input !w-auto" value={shownYear ?? ''} onChange={(e) => setYear(Number(e.target.value))} aria-label="שנה">
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          )}
        </div>
        {share.rows.length === 0 ? (
          <EmptyState title="אין נתוני כמויות" hint="הזן כמויות מקרים בדוחות כדי לראות נתח שוק" />
        ) : (
          <>
            <ul className="space-y-1.5">
              {share.rows.map((r) => (
                <li key={r.name} className="text-sm sm:flex sm:items-center sm:gap-2">
                  <div className="mb-1 flex items-baseline justify-between gap-2 sm:mb-0 sm:contents">
                    <span className={classNames('sm:w-36 sm:shrink-0', r.id === ours ? 'font-semibold text-brand-700' : 'text-slate-700')}>
                      {r.name}
                      {r.id === ours ? ' (אנחנו)' : ''}
                    </span>
                    <span className="shrink-0 text-xs text-slate-600 sm:order-last sm:w-20 sm:text-left">
                      {r.count} · {share.total ? Math.round((r.count / share.total) * 100) : 0}%
                    </span>
                  </div>
                  <Bar value={r.count} max={maxShare} tone={r.id === ours ? 'bg-brand-500' : 'bg-slate-400'} />
                </li>
              ))}
            </ul>
            {trendYears.length > 1 && (
              <div tabIndex={0} className="mt-4 overflow-x-auto">
                <p className="mb-1 text-sm font-medium text-slate-700">מגמה שנתית (מקרים)</p>
                <table className="w-full min-w-[320px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="p-1.5 text-right font-medium">חברה</th>
                      {trendYears.map((y) => (
                        <th key={y} className="p-1.5 text-center font-medium">
                          {y}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {trend.map(([name, row]) => (
                      <tr key={name} className="border-b border-slate-100">
                        <td className="p-1.5 text-slate-700">{name}</td>
                        {trendYears.map((y) => (
                          <td key={y} className="p-1.5 text-center text-slate-600">
                            {row.get(y) ?? ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>

      <section className="card p-4">
        <h2 className="mb-1 text-base font-semibold text-brand-800">מי משתמש במה, לפי בית חולים</h2>
        <p className="mb-3 text-xs text-slate-500">הרובוטים שמסומנים בכל בית חולים (בהגדרות → בתי חולים) וכמות המקרים בשנה שנבחרה{shownYear ? ` (${shownYear})` : ''}.</p>
        {matrix.length === 0 ? (
          <p className="text-sm text-slate-400">אין עדיין נתונים.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {matrix.map((h) => (
              <li key={h.id} className="py-2">
                <div className="flex items-start justify-between gap-3">
                  <p dir="auto" className="min-w-0 text-sm font-medium text-slate-800">{h.name}</p>
                  {h.cases.total > 0 && (
                    <p className="shrink-0 text-left text-xs text-slate-600">
                      {h.cases.total} מקרים
                      <span className="block font-semibold text-slate-800">{Math.round((h.cases.ours / h.cases.total) * 100)}% אצלנו</span>
                    </p>
                  )}
                </div>
                {h.systems.length > 0 && (
                  <span className="mt-1 flex flex-wrap gap-1">
                    {h.systems.map((s) => (
                      <span key={s} className={classNames('chip !px-2 !py-0', /mako/i.test(s) ? 'border-brand-200 bg-brand-50 text-brand-700' : 'border-slate-200 bg-slate-50 text-slate-600')}>
                        {s}
                      </span>
                    ))}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
