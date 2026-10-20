import { DAY_NAMES, DAY_SHORT, toggleDay } from '../lib/clinics'
import { classNames } from '../lib/utils'

/** the days of the week as seven toggles (Sunday first); `label` names the group for screen readers */
export function DayPicker({ value, onChange, label }: { value: number[]; onChange: (days: number[]) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="grid grid-cols-7 gap-1">
      {DAY_SHORT.map((short, day) => {
        const on = value.includes(day)
        return (
          <button
            key={day}
            type="button"
            aria-pressed={on}
            aria-label={`יום ${DAY_NAMES[day]}`}
            title={`יום ${DAY_NAMES[day]}`}
            onClick={() => onChange(toggleDay(value, day))}
            className={classNames(
              'grid min-h-[40px] place-items-center rounded-lg border text-sm font-semibold transition',
              on ? 'border-brand-500 bg-brand-500 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
            )}
          >
            {short}
          </button>
        )
      })}
    </div>
  )
}
