import { ChevronLeft, ChevronRight } from 'lucide-react'
import { classNames } from '../../lib/utils'
import type { PeriodKind } from './useTeamModel'

/** month / quarter switch and the arrows between periods: one row on the phone, thumb-sized buttons */
export function PeriodControls({
  kind,
  label,
  onKind,
  onPrev,
  onNext,
  nextDisabled,
  onToday,
  className,
}: {
  kind: PeriodKind
  label: string
  onKind: (k: PeriodKind) => void
  onPrev: () => void
  onNext: () => void
  nextDisabled?: boolean
  /** shown when the period is not the current one */
  onToday?: () => void
  className?: string
}) {
  const seg = (k: PeriodKind, text: string) => (
    <button
      type="button"
      aria-pressed={kind === k}
      onClick={() => onKind(k)}
      className={classNames('min-h-9 rounded-full px-4 text-sm font-medium transition', kind === k ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600 hover:text-slate-800')}
    >
      {text}
    </button>
  )
  const arrow = 'grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-600 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-40'
  return (
    <div className={classNames('flex flex-wrap items-center gap-2 print:hidden', className)}>
      <div role="group" aria-label="סוג תקופה" className="inline-flex shrink-0 rounded-full bg-slate-100 p-0.5">
        {seg('month', 'חודשי')}
        {seg('quarter', 'רבעוני')}
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-between rounded-full border border-slate-200 bg-white px-0.5 sm:max-w-xs">
        <button type="button" className={arrow} onClick={onPrev} aria-label="תקופה קודמת">
          <ChevronRight size={18} />
        </button>
        <span aria-live="polite" className="min-w-0 truncate px-1 text-center text-sm font-semibold text-slate-800">
          {label}
        </span>
        <button type="button" className={arrow} onClick={onNext} aria-label="תקופה הבאה" disabled={nextDisabled}>
          <ChevronLeft size={18} />
        </button>
      </div>
      {onToday && (
        <button type="button" onClick={onToday} className="min-h-9 rounded-full px-3 text-sm font-medium text-brand-700 hover:bg-brand-50">
          לתקופה הנוכחית
        </button>
      )}
    </div>
  )
}
