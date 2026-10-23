// The rules of the processes screens: dates of the steps from the start of a process, progress, and when the app suggests starting one.
// No data access here.
import { addDays, format } from 'date-fns'

export type ProcessKind = 'agent_in' | 'agent_out' | 'hospital_in' | 'training' | 'other'
export type ProcessSubject = 'agent' | 'hospital' | 'none'

export const KIND_LABELS: Record<ProcessKind, string> = {
  agent_in: 'קליטת סוכן',
  agent_out: 'עזיבת סוכן',
  hospital_in: 'קבלת בית חולים',
  training: 'הכשרה',
  other: 'אחר',
}

export type TemplateStep = { title: string; notes: string; day_offset: number; owner: 'subject' | 'starter' }
export type StepDraft = { title: string; notes: string; due_date: string; assignee_id: string | null }

export const dateFrom = (start: string, offsetDays: number) => format(addDays(new Date(`${start}T12:00:00`), offsetDays), 'yyyy-MM-dd')

/** the steps of a new process: each step's date is counted from the start, its owner is the agent the process is about or the manager who starts it */
export function stepsFromTemplate(steps: TemplateStep[], start: string, subjectAgentId: string | null, starterId: string | null): StepDraft[] {
  return steps.map((s) => ({
    title: s.title,
    notes: s.notes,
    due_date: dateFrom(start, s.day_offset),
    assignee_id: s.owner === 'subject' && subjectAgentId ? subjectAgentId : starterId,
  }))
}

type StepLike = { is_done: boolean; due_date: string | null }

export function progress(steps: StepLike[], today: string) {
  const total = steps.length
  const done = steps.filter((s) => s.is_done).length
  const overdue = steps.filter((s) => !s.is_done && s.due_date && s.due_date < today).length
  return { total, done, percent: total ? Math.round((100 * done) / total) : 0, overdue }
}

export type AgentLike = { id: string; full_name: string; active?: boolean | null; created_at: string; is_test?: boolean | null; role?: string | null }
export type ProcessLike = { kind: string; subject_agent_id: string | null; status: string }

export type Suggestion = { agent: AgentLike; kind: 'agent_in' | 'agent_out' }

/** an agent who joined lately without a process of onboarding, and an agent who left without a process of leaving: the manager is asked, nothing starts by itself */
export function suggestions(agents: AgentLike[], processes: ProcessLike[], today: string, windowDays = 45): Suggestion[] {
  const has = (id: string, kind: string) => processes.some((p) => p.subject_agent_id === id && p.kind === kind)
  const since = dateFrom(today, -windowDays)
  const out: Suggestion[] = []
  for (const a of agents) {
    if (a.is_test) continue
    if (a.active === false) {
      if (!has(a.id, 'agent_out')) out.push({ agent: a, kind: 'agent_out' })
    } else if (a.created_at.slice(0, 10) >= since && !has(a.id, 'agent_in')) out.push({ agent: a, kind: 'agent_in' })
  }
  return out
}

/** a process can be closed when every step is done */
export const canClose = (steps: StepLike[]) => steps.length > 0 && steps.every((s) => s.is_done)
