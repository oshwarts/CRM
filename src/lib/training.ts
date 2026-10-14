import type { AgentTraining, TrainingStage } from './types'

/** a training that started but did not move for this many days is "stuck" */
export const STUCK_DAYS = 30

export type StageProgress = { stage: TrainingStage; rows: AgentTraining[]; count: number; done: boolean }

export type ScopeState = {
  stages: StageProgress[]
  /** how many stages are complete / how many there are */
  doneCount: number
  total: number
  complete: boolean
  started: boolean
  /** the first stage that is not complete yet */
  current: StageProgress | null
  last: string | null
  daysSince: number | null
  stuck: boolean
}

/** the stages of one scope (a procedure, or null = general) in their order */
export const stagesOf = (all: TrainingStage[], procedureId: string | null) =>
  all.filter((s) => (s.procedure_id ?? null) === procedureId).sort((a, b) => a.sort - b.sort || a.created_at.localeCompare(b.created_at))

/** where one agent stands in the stages of a scope; rows = the completions of that agent */
export function scopeState(stages: TrainingStage[], rows: AgentTraining[], today: string): ScopeState {
  const list: StageProgress[] = stages.map((stage) => {
    const mine = rows.filter((r) => r.stage_id === stage.id).sort((a, b) => a.completed_on.localeCompare(b.completed_on))
    return { stage, rows: mine, count: mine.length, done: mine.length >= stage.required_count }
  })
  const used = list.flatMap((l) => l.rows)
  const last = used.reduce<string | null>((m, r) => (!m || r.completed_on > m ? r.completed_on : m), null)
  const doneCount = list.filter((l) => l.done).length
  const complete = list.length > 0 && doneCount === list.length
  const started = used.length > 0
  const daysSince = last ? Math.round((new Date(`${today}T12:00:00`).getTime() - new Date(`${last}T12:00:00`).getTime()) / 86_400_000) : null
  return {
    stages: list,
    doneCount,
    total: list.length,
    complete,
    started,
    current: list.find((l) => !l.done) ?? null,
    last,
    daysSince,
    stuck: started && !complete && daysSince !== null && daysSince >= STUCK_DAYS,
  }
}
