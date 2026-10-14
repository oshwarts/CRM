import { Target } from 'lucide-react'
import { useAgentGoals, useMetricData } from '../lib/agentsApi'
import { useAuth } from '../context/AuthProvider'
import { todayISO } from '../lib/utils'
import { GoalBars } from './GoalBars'

/** the signed-in agent's own goals for today's period, with progress (read-only) */
export function MyGoals() {
  const { user } = useAuth()
  const goals = useAgentGoals()
  const mine = (goals.data ?? []).filter((g) => g.agent_id === user?.id && g.period_start <= todayISO() && g.period_end >= todayISO())
  const { data } = useMetricData()
  if (mine.length === 0) return null
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
        <Target size={12} /> היעדים שלי
      </p>
      <GoalBars goals={mine} data={data} />
    </div>
  )
}
