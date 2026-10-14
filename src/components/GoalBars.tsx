import { Pencil } from 'lucide-react'
import { AUTO_METRICS, CATEGORY_LABELS, goalProgress, type MetricData } from '../lib/agentMetrics'
import type { AgentGoal } from '../lib/types'
import { classNames, formatDate } from '../lib/utils'

const tone = (pct: number) => (pct >= 100 ? 'bg-emerald-500' : pct >= 60 ? 'bg-sky-500' : pct >= 30 ? 'bg-amber-500' : 'bg-red-400')

/** goals with their progress: a bar per goal; `onEdit` shows the pencil (managers) */
export function GoalBars({ goals, data, onEdit, empty }: { goals: AgentGoal[]; data: MetricData | null; onEdit?: (g: AgentGoal) => void; empty?: string }) {
  if (goals.length === 0) return <p className="text-sm text-slate-400">{empty ?? 'אין יעדים לתקופה זו.'}</p>
  return (
    <ul className="space-y-3">
      {goals.map((g) => {
        const { value, pct } = goalProgress(g, data)
        const unit = g.metric === 'manual' ? g.unit : (AUTO_METRICS[g.metric]?.unit ?? '')
        return (
          <li key={g.id}>
            <div className="mb-1 flex items-start justify-between gap-2 text-sm">
              <div className="min-w-0">
                <p dir="auto" className="font-medium text-slate-800">
                  {g.title}
                  <span className="mr-2 text-xs font-normal text-slate-400">{CATEGORY_LABELS[g.category]}</span>
                </p>
                <p className="text-xs text-slate-400">
                  {formatDate(g.period_start)}–{formatDate(g.period_end)}
                  {g.notes ? ` · ${g.notes}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-slate-600">
                  {g.metric === 'text' ? `${pct}%` : `${value ?? '—'}${unit === '%' ? '%' : ''} / ${g.target ?? '—'}${unit && unit !== '%' ? ` ${unit}` : ''}`}
                </span>
                {onEdit && (
                  <button className="btn-ghost !px-1.5" aria-label="עריכה" onClick={() => onEdit(g)}>
                    <Pencil size={13} />
                  </button>
                )}
              </div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className={classNames('h-full transition-all', tone(pct))} style={{ width: `${pct}%` }} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
