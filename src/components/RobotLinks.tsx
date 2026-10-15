import { Bot } from 'lucide-react'
import { useRoboticSystems } from '../lib/api'
import { useRobotLinks, useToggleRobotLink, type RobotOwner } from '../lib/robotLinks'
import { classNames } from '../lib/utils'

/**
 * The robots (from the list of robotic systems in Settings) that a company or a competitor works with.
 * Managers tap a robot to add or remove it; everyone else just sees the chips.
 */
export function RobotLinks({ kind, ownerId, editable, label = 'עובד עם רובוט' }: { kind: RobotOwner; ownerId: string; editable: boolean; label?: string }) {
  const systems = useRoboticSystems()
  const links = useRobotLinks(kind)
  const toggle = useToggleRobotLink(kind)
  const mine = links.data?.[ownerId] ?? []
  const all = systems.data ?? []

  if (all.length === 0) return <p className="text-xs text-slate-400">אין מערכות רובוטיקה ברשימה (הגדרות ← רשימות)</p>

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="flex items-center gap-1 text-xs font-medium text-slate-500">
        <Bot size={13} /> {label}:
      </span>
      {editable ? (
        all.map((s) => {
          const on = mine.includes(s.id)
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={on}
              disabled={toggle.isPending}
              onClick={() => toggle.mutate({ ownerId, systemId: s.id, on: !on })}
              className={classNames(
                'rounded-full border px-2.5 py-0.5 text-xs font-medium transition disabled:opacity-60',
                on ? 'border-brand-500 bg-brand-500 text-white' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50',
              )}
            >
              {s.name}
            </button>
          )
        })
      ) : mine.length === 0 ? (
        <span className="text-xs text-slate-400">לא הוגדר</span>
      ) : (
        all
          .filter((s) => mine.includes(s.id))
          .map((s) => (
            <span key={s.id} className="chip border-brand-200 bg-brand-50 text-brand-700">
              {s.name}
            </span>
          ))
      )}
    </div>
  )
}
