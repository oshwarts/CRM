import { addDays, format } from 'date-fns'
import { classNames } from '../lib/utils'

const iso = (d: Date) => format(d, 'yyyy-MM-dd')

/** the next date that falls on this weekday (0 = Sunday), never today */
function next(weekday: number): Date {
  const t = new Date()
  const diff = ((weekday - t.getDay() + 7) % 7) || 7
  return addDays(t, diff)
}

/** one-tap dates under a date field: today, tomorrow, next Sunday, in a week, in two weeks */
export function QuickDates({ value, onPick, clearable = true }: { value: string | null; onPick: (iso: string | null) => void; clearable?: boolean }) {
  const today = new Date()
  const options: { label: string; date: string }[] = [
    { label: 'היום', date: iso(today) },
    { label: 'מחר', date: iso(addDays(today, 1)) },
    { label: 'ראשון הבא', date: iso(next(0)) },
    { label: 'בעוד שבוע', date: iso(addDays(today, 7)) },
    { label: 'בעוד שבועיים', date: iso(addDays(today, 14)) },
  ]
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.label}
          type="button"
          onClick={() => onPick(o.date)}
          aria-pressed={value === o.date}
          className={classNames('rounded-full border px-2.5 py-0.5 text-xs font-medium transition max-sm:!min-h-10', value === o.date ? 'border-brand-500 bg-brand-500 text-white' : 'border-brand-200 bg-white text-brand-700 hover:bg-brand-50')}
        >
          {o.label}
        </button>
      ))}
      {clearable && value && (
        <button type="button" onClick={() => onPick(null)} className="rounded-full px-2.5 py-0.5 text-xs text-slate-500 hover:bg-slate-100 max-sm:!min-h-10">
          נקה
        </button>
      )}
    </div>
  )
}
