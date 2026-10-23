import { SettingsLink } from './SettingsLink'
import { useMemo, useState } from 'react'
import { addDays, format } from 'date-fns'
import { Copy, TrendingDown } from 'lucide-react'
import { useConsumableItems, usePatientScans } from '../lib/api'
import { useConsumableUsage } from '../lib/forecastApi'
import { forecastStock, type UsageMap } from '../lib/consumables'
import { copyText } from '../lib/scanExport'
import { SCAN_PROCEDURE_LABELS } from '../lib/types'
import { classNames, formatDate, todayISO } from '../lib/utils'

type Count = { counted_on: string; lines: { item_id: string; qty: number }[] }
const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

/** what will be missing in this hospital after the planned surgeries, from the last stock count */
export function StockForecast({ hospitalId, lastCount, minOf }: { hospitalId: string; lastCount: Count | undefined; minOf: (itemId: string, fallback: number) => number }) {
  const items = useConsumableItems()
  const usage = useConsumableUsage()
  const scans = usePatientScans()
  const [days, setDays] = useState(30)
  const [notice, setNotice] = useState('')
  const today = todayISO()

  const usageMap: UsageMap = useMemo(() => {
    const m: UsageMap = new Map()
    for (const u of usage.data ?? []) m.set(u.item_id, { ...m.get(u.item_id), [u.procedure_type]: u.qty_per_case })
    return m
  }, [usage.data])

  const result = useMemo(
    () =>
      forecastStock({
        items: items.data ?? [],
        usage: usageMap,
        minOf,
        lastCount,
        scans: scans.data ?? [],
        hospitalId,
        today,
        horizon: format(addDays(new Date(`${today}T12:00:00`), days), 'yyyy-MM-dd'),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items.data, usageMap, lastCount, scans.data, hospitalId, today, days],
  )

  if ((usage.data ?? []).length === 0) {
    return (
      <section className="card p-4">
        <h2 className="mb-1 flex items-center gap-1.5 font-semibold text-slate-800">
          <TrendingDown size={16} className="text-brand-500" /> תחזית מלאי
        </h2>
        <p className="text-sm text-slate-400">
          כדי לחשב תחזית צריך להגדיר כמה מכל מתכלה נצרך בניתוח (ברך / יוני / ירך).{' '}
          <SettingsLink className="font-medium text-brand-600 underline">הגדרות ← מתכלים ← צריכה לניתוח</SettingsLink>
        </p>
      </section>
    )
  }

  const needed = result.rows.filter((r) => r.order > 0)
  const typesText = (n: Record<'knee' | 'uni' | 'hip', number>) =>
    (['knee', 'uni', 'hip'] as const)
      .filter((t) => n[t] > 0)
      .map((t) => `${SCAN_PROCEDURE_LABELS[t]} ${n[t]}`)
      .join(', ')
  const totalAhead = result.ahead.knee + result.ahead.uni + result.ahead.hip

  async function copy() {
    const text = [`תחזית מתכלים — ${days} ימים קדימה`, ...needed.map((r) => `${r.item.catalog_number ? `${r.item.catalog_number} ` : ''}${r.item.name} — להזמין ${r.order}`)].join('\n')
    setNotice((await copyText(text)) ? 'הרשימה הועתקה.' : 'ההעתקה נכשלה.')
  }

  return (
    <section className="card space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 font-semibold text-slate-800">
          <TrendingDown size={16} className="text-brand-500" /> תחזית מלאי
        </h2>
        <select className="input !w-auto" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="אופק התחזית">
          {[14, 30, 60, 90].map((d) => (
            <option key={d} value={d}>
              {d} ימים קדימה
            </option>
          ))}
        </select>
      </div>
      <p className="text-xs text-slate-500">
        {lastCount ? `לפי הספירה האחרונה מ-${formatDate(lastCount.counted_on)}` : 'עוד לא בוצעה ספירה בבית החולים — מוצג רק מה שנדרש לניתוחים המתוכננים'}
        {Object.values(result.since).some((n) => n > 0) && ` · מאז הספירה בוצעו ${typesText(result.since)}`}
        {' · '}
        {totalAhead > 0 ? `מתוכננים ב-${days} הימים הקרובים: ${typesText(result.ahead)}` : `אין ניתוחים מתוכננים ב-${days} הימים הקרובים בסריקות`}
      </p>

      {result.rows.length === 0 ? (
        <p className="text-sm text-slate-400">לא הוגדרה צריכה לפריטים. הגדרה בהגדרות ← מתכלים.</p>
      ) : (
        <>
          {needed.length === 0 ? (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">המלאי מספיק לניתוחים המתוכננים.</p>
          ) : (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {needed.length} פריטים ידרשו הזמנה · {needed.reduce((s, r) => s + r.order, 0)} יחידות
            </p>
          )}
          {/* a phone: one card per item instead of a seven-column table that scrolls sideways */}
          <ul className="space-y-2 sm:hidden" aria-label="תחזית מלאי לפי פריט">
            {[...result.rows].sort((a, b) => b.order - a.order).map((r) => (
              <li key={r.item.id} className={classNames('rounded-xl border p-3', r.order > 0 ? 'border-red-200 bg-red-50/50' : 'border-slate-200 bg-white')}>
                <div className="flex items-start justify-between gap-2">
                  <div dir="ltr" className="min-w-0 text-left [overflow-wrap:anywhere]">
                    <p className="font-medium text-slate-800">{r.item.name}</p>
                    {r.item.catalog_number && <p className="text-xs text-slate-500">{r.item.catalog_number}</p>}
                  </div>
                  {r.order > 0 ? <span className="shrink-0 rounded-lg bg-red-100 px-2.5 py-1 text-sm font-bold text-red-700">להזמין {r.order}</span> : <span className="shrink-0 text-sm text-emerald-600">✓ מספיק</span>}
                </div>
                <dl className="mt-2 grid grid-cols-5 gap-1 text-center">
                  {([['נספר', r.counted ?? '—'], ['נצרך', num(r.usedSince)], ['מתוכנן', num(r.planned)], ['צפוי', r.projected === null ? '—' : num(r.projected)], ['מינימום', r.min]] as const).map(([k, v]) => (
                    <div key={k} className="rounded-lg bg-white/70 py-1">
                      <dt className="text-[11px] text-slate-500">{k}</dt>
                      <dd dir="ltr" className={classNames('text-sm font-medium', k === 'צפוי' && r.projected !== null && r.projected < 0 ? 'text-red-600' : 'text-slate-800')}>{v}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>
          <div tabIndex={0} className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-right text-xs text-slate-500">
                  <th className="py-1.5 font-medium">פריט</th>
                  <th className="py-1.5 text-center font-medium">נספר</th>
                  <th className="py-1.5 text-center font-medium">נצרך מאז</th>
                  <th className="py-1.5 text-center font-medium">מתוכנן</th>
                  <th className="py-1.5 text-center font-medium">צפוי</th>
                  <th className="py-1.5 text-center font-medium">מינימום</th>
                  <th className="py-1.5 text-center font-medium">להזמין</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r) => (
                  <tr key={r.item.id} className="border-b border-slate-100">
                    <td dir="ltr" className="py-1.5 text-left text-slate-800 [overflow-wrap:anywhere]">
                      {r.item.name}
                      {r.item.catalog_number && <span className="block text-xs text-slate-400">{r.item.catalog_number}</span>}
                    </td>
                    <td className="text-center text-slate-600">{r.counted ?? '—'}</td>
                    <td className="text-center text-slate-600">{num(r.usedSince)}</td>
                    <td className="text-center text-slate-600">{num(r.planned)}</td>
                    <td className={classNames('text-center font-medium', r.projected !== null && r.projected < 0 ? 'text-red-600' : 'text-slate-800')}>
                      {r.projected === null ? '—' : num(r.projected)}
                    </td>
                    <td className="text-center text-slate-500">{r.min}</td>
                    <td className="text-center">
                      {r.order > 0 ? <span className="rounded-lg bg-red-50 px-2 py-0.5 font-bold text-red-600">{r.order}</span> : <span className="text-emerald-600">✓</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-3">
            <button className="btn-secondary" onClick={copy} disabled={needed.length === 0}>
              <Copy size={15} /> העתק רשימת הזמנה
            </button>
            {notice && <span className="text-xs text-slate-500">{notice}</span>}
          </div>
          <p className="text-xs text-slate-400">
            התחזית מניחה שכל הניתוחים בסריקות (שלא בוטלו) מתקיימים ושהצריכה היא כפי שהוגדרה. "להזמין" = כמה צריך כדי לחזור למינימום אחרי הניתוחים המתוכננים.
          </p>
        </>
      )}
    </section>
  )
}
