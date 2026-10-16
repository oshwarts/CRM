import { useMemo } from 'react'
import { useAgents, useProcedures } from '../../lib/api'
import { useAgentGoals, useMetricData, useTraining, useTrainingStages } from '../../lib/agentsApi'
import { monthPeriod, quarterPeriod } from '../../lib/agentMetrics'
import { buildTeamModel, type TeamModel } from '../../lib/teamStats'
import { usePipelineStages } from '../../lib/pipeline'

export type PeriodKind = 'month' | 'quarter'

/** everything the team views show, for a month or a quarter (offset 0 = this one, -1 = the one before …) */
export function useTeamModel(kind: PeriodKind, offset: number): { model: TeamModel | null; loading: boolean } {
  const agents = useAgents()
  const goals = useAgentGoals()
  const procedures = useProcedures()
  const stages = useTrainingStages()
  const training = useTraining()
  const { data, loading: dataLoading } = useMetricData()
  const { names: pipelineStages } = usePipelineStages()
  const loading = dataLoading || [agents, goals, procedures, stages, training].some((q) => q.isLoading)

  const model = useMemo(() => {
    if (loading || !data) return null
    const make = kind === 'month' ? monthPeriod : quarterPeriod
    return buildTeamModel({
      period: make(offset),
      prevPeriod: make(offset - 1),
      agents: agents.data ?? [],
      data,
      goals: goals.data ?? [],
      stages: stages.data ?? [],
      training: training.data ?? [],
      procedures: procedures.data ?? [],
      pipelineStages,
    })
  }, [loading, data, kind, offset, agents.data, goals.data, stages.data, training.data, procedures.data, pipelineStages])

  return { model, loading }
}
