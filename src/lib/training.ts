import type { AgentTraining } from './types'

/** the fixed training ladder every procedure goes through */
export const TRAINING_STAGES = [
  { key: 'theory', label: 'תיאוריה' },
  { key: 'observe', label: 'צפייה בניתוח' },
  { key: 'guided', label: 'ניתוח בהדרכה' },
  { key: 'solo', label: 'ניתוח עצמאי' },
  { key: 'certified', label: 'מוסמך' },
] as const

export type TrainingStage = (typeof TRAINING_STAGES)[number]['key']

/** a training that started but did not move for this many days is "stuck" */
export const STUCK_DAYS = 30

export type TrainingState = {
  /** index of the highest stage completed, -1 when not started */
  top: number
  done: Map<string, AgentTraining>
  last: string | null
  certified: boolean
  stuck: boolean
  daysSince: number | null
}

export function trainingState(rows: AgentTraining[], today: string): TrainingState {
  const done = new Map(rows.map((r) => [r.stage, r]))
  let top = -1
  TRAINING_STAGES.forEach((s, i) => {
    if (done.has(s.key)) top = i
  })
  const last = rows.reduce<string | null>((m, r) => (!m || r.completed_on > m ? r.completed_on : m), null)
  const certified = done.has('certified')
  const daysSince = last ? Math.round((new Date(`${today}T12:00:00`).getTime() - new Date(`${last}T12:00:00`).getTime()) / 86_400_000) : null
  return { top, done, last, certified, stuck: top >= 0 && !certified && daysSince !== null && daysSince >= STUCK_DAYS, daysSince }
}

/** rows of one agent and one procedure, from the full list */
export const trainingOf = (all: AgentTraining[], agentId: string, procedureId: string) =>
  all.filter((r) => r.agent_id === agentId && r.procedure_id === procedureId)
