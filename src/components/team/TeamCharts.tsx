import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import type { Delta, MonthPoint } from '../../lib/teamStats'
import { classNames } from '../../lib/utils'

/** ▲ 12% / ▼ 5% against the period before; points for percentages that are themselves a share */
export function DeltaBadge({ d, points, className }: { d: Pick<Delta, 'pct'> & { prev?: number | null }; points?: boolean; className?: string }) {
  if (d.pct === null) return <span className={classNames('whitespace-nowrap text-xs text-slate-400', className)}>אין נתון להשוואה</span>
  const up = d.pct > 0
  const flat = d.pct === 0
  const Icon = flat ? Minus : up ? ArrowUp : ArrowDown
  return (
    <span className={classNames('inline-flex items-center gap-0.5 text-xs font-semibold', flat ? 'text-slate-500' : up ? 'text-emerald-600' : 'text-red-600', className)}>
      <Icon size={13} /> {Math.abs(d.pct)}
      {points ? ' נק׳' : '%'}
    </span>
  )
}

export function BigNumber({ label, value, suffix, delta, points, sub, inverse }: { label: string; value: number | string | null; suffix?: string; delta?: Pick<Delta, 'pct'> & { prev?: number | null }; points?: boolean; sub?: string; inverse?: boolean }) {
  const prevText = delta && delta.prev != null && delta.pct !== null ? `קודם: ${delta.prev}${suffix ?? ''}` : ''
  return (
    <div className={classNames('card p-4', inverse && 'border-0 bg-white/10 text-white shadow-none')}>
      <p className={classNames('text-sm font-medium', inverse ? 'text-white/80' : 'text-slate-500')}>{label}</p>
      <p className={classNames('mt-1 text-3xl font-semibold leading-none sm:text-4xl', inverse ? 'text-white' : 'text-brand-800')}>
        {value ?? '—'}
        {suffix && value != null && <span className="text-xl font-medium">{suffix}</span>}
      </p>
      <div className="mt-2 flex min-h-5 flex-wrap items-center gap-x-2 gap-y-0.5">
        {delta ? (
          <>
            <DeltaBadge d={delta} points={points} />
            {prevText && <span className="text-xs text-slate-500">{prevText}</span>}
          </>
        ) : sub ? (
          <span className="text-xs text-slate-500">{sub}</span>
        ) : null}
      </div>
    </div>
  )
}

/** bars per month for one number; the last month is the dark one */
export function TrendBars({ series, field, tone = 'bg-brand-500', height = 112 }: { series: MonthPoint[]; field: 'meetings' | 'surgeries' | 'tasks' | 'newDoctors'; tone?: string; height?: number }) {
  const max = Math.max(1, ...series.map((s) => s[field]))
  return (
    <div className="flex items-end gap-2" style={{ height: height + 36 }} role="img" aria-label={series.map((s) => `${s.label}: ${s[field]}`).join(', ')}>
      {series.map((s, i) => {
        const last = i === series.length - 1
        return (
          <div key={s.key} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
            <span className="text-xs font-semibold text-slate-700">{s[field]}</span>
            <div className={classNames('w-full max-w-10 rounded-t-md', last ? 'bg-[#00326d]' : tone)} style={{ height: Math.max(s[field] > 0 ? 4 : 1, (s[field] / max) * height) }} />
            <span className="text-[11px] text-slate-500">{s.label}</span>
          </div>
        )
      })}
    </div>
  )
}

/** a tiny trend line for a row or a card */
export function Spark({ values, className }: { values: number[]; className?: string }) {
  const max = Math.max(1, ...values)
  return (
    <span className={classNames('inline-flex h-6 items-end gap-0.5', className)} aria-hidden>
      {values.map((v, i) => (
        <span key={i} className={classNames('w-1.5 rounded-sm', i === values.length - 1 ? 'bg-[#00326d]' : 'bg-brand-300')} style={{ height: Math.max(v > 0 ? 3 : 1, (v / max) * 24) }} />
      ))}
    </span>
  )
}

export function Meter({ pct, label, tone }: { pct: number | null; label?: string; tone?: 'auto' | string }) {
  if (pct === null) return <span className="text-xs text-slate-300">—</span>
  const color = tone && tone !== 'auto' ? tone : pct >= 80 ? 'bg-emerald-500' : pct >= 40 ? 'bg-brand-500' : 'bg-red-500'
  return (
    <span className="flex items-center gap-2">
      <span className="h-2 min-w-16 flex-1 overflow-hidden rounded-full bg-slate-100">
        <span className={classNames('block h-full rounded-full', color)} style={{ width: `${Math.max(2, Math.min(100, pct))}%` }} />
      </span>
      <span className="w-10 text-xs font-semibold text-slate-700">{label ?? `${pct}%`}</span>
    </span>
  )
}

export function FunnelBars({ funnel, big }: { funnel: { stage: string; count: number }[]; big?: boolean }) {
  const max = Math.max(1, ...funnel.map((f) => f.count))
  return (
    <ul className={classNames('space-y-2', big && 'space-y-3')}>
      {funnel.map((f, i) => (
        <li key={f.stage} className="flex items-center gap-3">
          <span className={classNames('shrink-0 leading-tight text-slate-600', big ? 'w-40 text-lg' : 'w-28 text-sm sm:w-40')}>{f.stage}</span>
          <span className={classNames('flex-1 overflow-hidden rounded-full bg-slate-100', big ? 'h-4' : 'h-3')}>
            <span className={classNames('block h-full rounded-full', i >= funnel.length - 2 ? 'bg-emerald-500' : 'bg-brand-500')} style={{ width: `${(f.count / max) * 100}%`, minWidth: f.count > 0 ? 6 : 0 }} />
          </span>
          <span className={classNames('w-8 shrink-0 text-left font-semibold text-brand-800', big ? 'text-xl' : 'text-sm')}>{f.count}</span>
        </li>
      ))}
    </ul>
  )
}
