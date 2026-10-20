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
      <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-brand-700">
        <Target size={13} aria-hidden /> היעדים שלי
      </h3>
      <GoalBars goals={mine} data={data} />
    </div>
  )
}
