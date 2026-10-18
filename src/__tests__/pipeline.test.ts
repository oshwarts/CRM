import { afterEach, describe, expect, it, vi } from 'vitest'
import { funnelStats, lostSummary, stageSinceMap, stuckPotentials, type HistoryRow } from '../lib/pipelineStats'

const NOW = new Date('2026-10-18T10:00:00')
const day = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString().slice(0, 10)
const H = (doctor_id: string, stage: string, previous_stage: string, n: number): HistoryRow => ({ doctor_id, stage, previous_stage, changed_at: `${day(n)}T10:00:00Z` })
const names = ['א', 'ב', 'ג']

afterEach(() => vi.useRealTimers())

describe('funnelStats', () => {
  const history = [H('1', 'א', '', -100), H('1', 'ב', 'א', -80), H('1', 'ג', 'ב', -50), H('2', 'א', '', -90), H('2', 'ב', 'א', -60), H('3', 'א', '', -40), H('4', 'א', '', -10)]
  const stats = funnelStats(names, history)
  it('counts who reached each stage (a doctor who reached C also passed A and B)', () => {
    expect(stats.map((s) => s.reached)).toEqual([4, 2, 1])
  })
  it('gives the share that moved on', () => {
    expect(stats[0].toNextPct).toBe(50)
    expect(stats[1].toNextPct).toBe(50)
    expect(stats[2].toNextPct).toBeNull()
  })
  it('averages the days in a stage over those who left it', () => {
    expect(stats[0].avgDays).toBe(25)
    expect(stats[1].avgDays).toBe(30)
    expect(stats[2].avgDays).toBeNull()
  })
  it('an empty history gives zeros and no averages', () => {
    expect(funnelStats(names, []).every((s) => s.reached === 0 && s.avgDays === null)).toBe(true)
  })
})

describe('stuckPotentials', () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  const doc = (id: string, stage: string, step: string, date: string | null, status = 'potential') => ({ id, name: id, title: '', status, pipeline_stage: stage, next_step: step, next_step_date: date, created_by: null, doctor_hospitals: [] })
  const since = new Map([
    ['a', { stage: 'ב', since: day(-20) }],
    ['b', { stage: 'ב', since: day(-40) }],
  ])
  it('flags no stage, no next step, a late next step and too long in a stage', () => {
    const r = stuckPotentials([doc('a', 'ב', 'x', day(5)), doc('b', 'ב', 'x', day(5)), doc('c', '', '', null), doc('d', 'א', 'x', day(-2))], since)
    const byId = Object.fromEntries(r.map((x) => [x.d.id, x.reasons.map((y) => y.key)]))
    expect(byId.a).toBeUndefined()
    expect(byId.b).toEqual(['long'])
    expect(byId.c).toEqual(['no-stage', 'no-step'])
    expect(byId.d).toEqual(['overdue'])
  })
  it('uses the threshold of the stage, or the default', () => {
    const t = { defaultDays: 30, byStage: new Map([['ב', 14]]) }
    expect(stuckPotentials([doc('a', 'ב', 'x', day(5))], since, t).map((x) => x.d.id)).toEqual(['a'])
    expect(stuckPotentials([doc('a', 'ב', 'x', day(5))], since, { defaultDays: 30, byStage: new Map() })).toEqual([])
  })
  it('ignores clients and closed doctors', () => {
    expect(stuckPotentials([doc('x', '', '', null, 'client'), doc('y', '', '', null, 'lost')], since)).toEqual([])
  })
})

describe('stageSinceMap and lostSummary', () => {
  it('takes the latest change as the stage a doctor is in', () => {
    const m = stageSinceMap([H('1', 'א', '', -50), H('1', 'ב', 'א', -10)])
    expect(m.get('1')?.stage).toBe('ב')
  })
  it('counts closed doctors by reason', () => {
    const lost = (reason: string) => ({ id: reason, name: '', title: '', status: 'lost', pipeline_stage: '', next_step: '', next_step_date: null, created_by: null, lost_reason: reason, doctor_hospitals: [] })
    const s = lostSummary([lost('מחיר'), lost('מחיר'), lost('')])
    expect(s.count).toBe(3)
    expect(s.reasons[0]).toEqual(['מחיר', 2])
  })
})
