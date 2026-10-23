import { describe, expect, it } from 'vitest'
import { canClose, dateFrom, progress, stepsFromTemplate, suggestions } from '../lib/processLogic'

describe('steps of a new process', () => {
  it('counts each date from the start and gives a step to the agent or to the manager who starts', () => {
    const steps = stepsFromTemplate(
      [
        { title: 'א', notes: '', day_offset: 0, owner: 'starter' },
        { title: 'ב', notes: 'הערה', day_offset: 7, owner: 'subject' },
        { title: 'ג', notes: '', day_offset: -2, owner: 'subject' },
      ],
      '2026-12-01',
      'agent1',
      'boss',
    )
    expect(steps.map((s) => s.due_date)).toEqual(['2026-12-01', '2026-12-08', '2026-11-29'])
    expect(steps.map((s) => s.assignee_id)).toEqual(['boss', 'agent1', 'agent1'])
  })
  it('a step "of the agent" goes to the manager when the process is not about an agent', () => {
    expect(stepsFromTemplate([{ title: 'א', notes: '', day_offset: 0, owner: 'subject' }], '2026-12-01', null, 'boss')[0].assignee_id).toBe('boss')
    expect(dateFrom('2026-12-30', 3)).toBe('2027-01-02')
  })
})

describe('progress', () => {
  it('counts done and late steps', () => {
    const p = progress([{ is_done: true, due_date: '2026-10-01' }, { is_done: false, due_date: '2026-10-01' }, { is_done: false, due_date: '2026-12-01' }, { is_done: false, due_date: null }], '2026-10-22')
    expect(p).toEqual({ total: 4, done: 1, percent: 25, overdue: 1 })
    expect(progress([], '2026-10-22').percent).toBe(0)
  })
  it('closes only when every step is done', () => {
    expect(canClose([])).toBe(false)
    expect(canClose([{ is_done: true, due_date: null }, { is_done: false, due_date: null }])).toBe(false)
    expect(canClose([{ is_done: true, due_date: null }])).toBe(true)
  })
})

describe('suggestions for the manager', () => {
  const agents = [
    { id: 'new', full_name: 'חדש', active: true, created_at: '2026-10-10T08:00:00Z' },
    { id: 'old', full_name: 'ותיק', active: true, created_at: '2025-01-10T08:00:00Z' },
    { id: 'gone', full_name: 'עזב', active: false, created_at: '2025-01-10T08:00:00Z' },
    { id: 'test', full_name: 'בדיקה', active: false, created_at: '2026-10-10T08:00:00Z', is_test: true },
  ]
  it('suggests onboarding for a new agent and leaving for an agent who left, not for old active agents or test users', () => {
    expect(suggestions(agents, [], '2026-10-22').map((s) => `${s.agent.id}:${s.kind}`)).toEqual(['new:agent_in', 'gone:agent_out'])
  })
  it('does not suggest again when there is such a process already', () => {
    const procs = [{ kind: 'agent_in', subject_agent_id: 'new', status: 'open' }, { kind: 'agent_out', subject_agent_id: 'gone', status: 'closed' }]
    expect(suggestions(agents, procs, '2026-10-22')).toEqual([])
  })
})
