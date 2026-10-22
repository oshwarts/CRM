import { format } from 'date-fns'
import { iso, monthWeeks } from '../../lib/calendar'
import { classNames } from '../../lib/utils'
import { DAY_NAMES, KINDS, type Item } from './shared'

/** the month as a grid of days: on the phone a day shows coloured dots and a count, wider screens show the first events; a press on a day opens it */
export function MonthGrid({ anchor, items, today, onDay, onItem }: { anchor: Date; items: Item[]; today: string; onDay: (date: string) => void; onItem: (item: Item) => void }) {
  const weeks = monthWeeks(anchor)
  const month = anchor.getMonth()
  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-medium text-slate-600">
        {DAY_NAMES.map((n) => (
          <div key={n} className="py-1.5">
            <span className="md:hidden">{n.slice(0, 1)}׳</span>
            <span className="hidden md:inline">{n}</span>
          </div>
        ))}
      </div>
      {weeks.map((week) => (
        <div key={iso(week[0])} className="grid grid-cols-7 border-b border-slate-100 last:border-b-0">
          {week.map((d) => {
            const date = iso(d)
            const list = items.filter((it) => it.date === date)
            const isToday = date === today
            const outside = d.getMonth() !== month
            return (
              <div key={date} className={classNames('min-h-[3.75rem] min-w-0 border-r border-slate-100 p-0.5 first:border-r-0 md:min-h-[6.5rem] md:p-1', outside && 'bg-slate-50/70')}>
                <button
                  type="button"
                  onClick={() => onDay(date)}
                  className="flex w-full flex-col items-center gap-0.5 rounded-md py-0.5 hover:bg-brand-50 md:items-stretch md:px-1"
                  aria-label={`יום ${DAY_NAMES[d.getDay()]} ${format(d, 'dd/MM')}${list.length ? `, ${list.length} אירועים` : ''}`}
                >
                  <span className={classNames('grid h-6 min-w-[1.5rem] place-items-center rounded-full px-1 text-xs font-semibold md:self-end', isToday ? 'bg-brand-500 text-white' : outside ? 'text-slate-400' : 'text-slate-800')}>{d.getDate()}</span>
                  {list.length > 0 && (
                    <span className="flex flex-wrap justify-center gap-0.5 md:hidden" aria-hidden>
                      {list.slice(0, 4).map((it) => (
                        <span key={it.id} className={classNames('h-1.5 w-1.5 rounded-full', it.muted ? 'bg-slate-300' : KINDS[it.kind].dot)} />
                      ))}
                    </span>
                  )}
                </button>
                <ul className="hidden space-y-0.5 md:block">
                  {list.slice(0, 3).map((it) => (
                    <li key={it.id}>
                      <button type="button" onClick={() => onItem(it)} className={classNames('block min-h-[24px] w-full truncate rounded border px-1 py-0.5 text-right text-[11px]', it.muted ? 'border-slate-200 bg-slate-50 text-slate-500' : KINDS[it.kind].chip)} title={`${it.time ? `${it.time} ` : ''}${it.title}`}>
                        {it.time && <span dir="ltr">{it.time} </span>}
                        {it.title}
                      </button>
                    </li>
                  ))}
                  {list.length > 3 && (
                    <li>
                      <button type="button" onClick={() => onDay(date)} className="w-full text-right text-[11px] font-medium text-brand-700 hover:underline">
                        ועוד {list.length - 3}
                      </button>
                    </li>
                  )}
                </ul>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
