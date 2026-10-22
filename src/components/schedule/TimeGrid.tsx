import { useEffect, useMemo, useRef } from 'react'
import { format } from 'date-fns'
import { Plus } from 'lucide-react'
import { fromMinutes, hourRange, iso, layoutOverlaps, toMinutes } from '../../lib/calendar'
import { classNames } from '../../lib/utils'
import { DAY_NAMES, KINDS, type Item } from './shared'

const HOUR_PX = 52
const DEFAULT_MIN = 60

/**
 * The day or week as Outlook shows it: a row for what has a day but no hour, then the hours. Events that overlap stand side by side;
 * a press on a free place of a column (at its half hour) starts something new at that time.
 */
export function TimeGrid({
  days,
  items,
  today,
  onSlot,
  onItem,
  onDay,
}: {
  days: Date[]
  items: Item[]
  today: string
  onSlot: (date: string, time: string) => void
  onItem: (item: Item) => void
  /** a press on the heading of a day (the week view opens that day) */
  onDay?: (date: string) => void
}) {
  const timed = items.filter((it) => it.time)
  const range = useMemo(() => hourRange(timed.map((it) => ({ id: it.id, start: toMinutes(it.time), end: toMinutes(it.time) + (it.durationMin ?? DEFAULT_MIN) }))), [timed])
  const hours = Array.from({ length: range.to - range.from }, (_, i) => range.from + i)
  const height = hours.length * HOUR_PX
  const scroller = useRef<HTMLDivElement>(null)

  // open on the working day: the first event of the range, or the morning
  const firstStart = timed.length ? Math.min(...timed.map((it) => toMinutes(it.time))) : 8 * 60
  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTop = Math.max(0, ((firstStart - range.from * 60) / 60) * HOUR_PX - 12)
    // only when the range of days changes, not on every event
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days[0]?.getTime(), days.length])

  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()

  return (
    <div className="card overflow-hidden">
      <div className="grid border-b border-slate-200" style={{ gridTemplateColumns: `2.75rem repeat(${days.length}, minmax(0, 1fr))` }}>
        <div />
        {days.map((d) => {
          const date = iso(d)
          const isToday = date === today
          const allDay = items.filter((it) => it.date === date && !it.time)
          return (
            <div key={date} className={classNames('min-w-0 border-r border-slate-100 p-1', isToday && 'bg-brand-50/60')}>
              <button
                type="button"
                disabled={!onDay}
                onClick={() => onDay?.(date)}
                className={classNames('flex w-full flex-col items-center rounded-lg px-1 py-1 text-center', onDay && 'hover:bg-brand-50')}
                aria-label={`יום ${DAY_NAMES[d.getDay()]} ${format(d, 'dd/MM')}`}
              >
                <span className="text-xs text-slate-500">{days.length > 1 ? DAY_NAMES[d.getDay()] : `יום ${DAY_NAMES[d.getDay()]}`}</span>
                <span className={classNames('grid h-7 min-w-[1.75rem] place-items-center rounded-full px-1 text-sm font-semibold', isToday ? 'bg-brand-500 text-white' : 'text-slate-800')}>{format(d, days.length > 1 ? 'd' : 'dd/MM')}</span>
              </button>
              <ul className="mt-1 space-y-0.5">
                {allDay.map((it) => (
                  <li key={it.id}>
                    <button type="button" onClick={() => onItem(it)} className={classNames('block min-h-[28px] w-full truncate rounded-md border px-1.5 py-1 text-right text-[11px] font-medium', it.muted ? 'border-slate-200 bg-slate-50 text-slate-500' : KINDS[it.kind].chip)} title={`${KINDS[it.kind].label}: ${it.title}`}>
                      {it.title}
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" className="mt-0.5 hidden min-h-[26px] w-full items-center justify-center gap-1 rounded-md text-[11px] text-brand-700 hover:bg-brand-50 md:flex" onClick={() => onSlot(date, '09:00')} aria-label={`אירוע חדש ביום ${DAY_NAMES[d.getDay()]} ${format(d, 'dd/MM')}`}>
                <Plus size={12} aria-hidden /> חדש
              </button>
            </div>
          )
        })}
      </div>

      <div ref={scroller} className="max-h-[68vh] overflow-y-auto" tabIndex={0} role="region" aria-label="לוח שעות">
        <div className="grid" style={{ gridTemplateColumns: `2.75rem repeat(${days.length}, minmax(0, 1fr))`, height }}>
          <div className="relative">
            {hours.map((h) => (
              <span key={h} className="absolute right-1 -translate-y-1/2 text-[11px] text-slate-500" dir="ltr" style={{ top: (h - range.from) * HOUR_PX + (h === range.from ? 8 : 0) }}>
                {fromMinutes(h * 60)}
              </span>
            ))}
          </div>
          {days.map((d) => {
            const date = iso(d)
            const mine = timed.filter((it) => it.date === date)
            const layout = layoutOverlaps(mine.map((it) => ({ id: it.id, start: toMinutes(it.time), end: toMinutes(it.time) + (it.durationMin ?? DEFAULT_MIN) })))
            const isToday = date === today
            return (
              <div
                key={date}
                className={classNames('relative cursor-cell border-r border-slate-100', isToday && 'bg-brand-50/30')}
                style={{ backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR_PX - 1}px, rgb(var(--slate-200)) ${HOUR_PX - 1}px, rgb(var(--slate-200)) ${HOUR_PX}px)` }}
                onClick={(e) => {
                  if (e.target !== e.currentTarget) return
                  const rect = e.currentTarget.getBoundingClientRect()
                  const min = range.from * 60 + Math.floor(((e.clientY - rect.top) / HOUR_PX) * 2) * 30
                  onSlot(date, fromMinutes(Math.min(min, 23 * 60 + 30)))
                }}
              >
                {mine.map((it) => {
                  const start = toMinutes(it.time)
                  const dur = it.durationMin ?? DEFAULT_MIN
                  const pos = layout.get(it.id) ?? { col: 0, cols: 1 }
                  return (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => onItem(it)}
                      className={classNames('absolute overflow-hidden rounded-md border px-1 py-0.5 text-right text-[11px] leading-tight shadow-sm hover:z-10 hover:shadow-md', it.muted ? 'border-slate-200 bg-slate-50 text-slate-500' : KINDS[it.kind].chip)}
                      style={{
                        top: ((start - range.from * 60) / 60) * HOUR_PX + 1,
                        height: Math.max((dur / 60) * HOUR_PX - 2, 24),
                        width: `calc(${100 / pos.cols}% - 3px)`,
                        insetInlineStart: `${(pos.col * 100) / pos.cols}%`,
                      }}
                      title={`${it.time} ${KINDS[it.kind].label}: ${it.title}${it.sub ? ` — ${it.sub}` : ''}`}
                    >
                      <span className={classNames('block font-semibold [overflow-wrap:anywhere]', dur >= 45 ? 'line-clamp-2' : 'truncate')}>
                        <span dir="ltr">{it.time}</span> {it.title}
                      </span>
                      {dur >= 60 && it.sub && <span className="block truncate opacity-80">{it.sub}</span>}
                    </button>
                  )
                })}
                {isToday && nowMin >= range.from * 60 && nowMin <= range.to * 60 && (
                  <span aria-hidden className="pointer-events-none absolute inset-x-0 z-20 h-0.5 bg-red-500" style={{ top: ((nowMin - range.from * 60) / 60) * HOUR_PX }} />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
