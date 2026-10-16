// Analysis of the funnel of potential doctors: who is stuck, how many reach each stage, how long they stay, who was closed and why.
import { todayISO } from './utils'

export const STUCK_STAGE_DAYS = 30

/** how long in a stage counts as stuck: a default and a value of its own for some stages */
export type StuckThresholds = { defaultDays: number; byStage: Map<string, number> }
export const DEFAULT_THRESHOLDS: StuckThresholds = { defaultDays: STUCK_STAGE_DAYS, byStage: new Map() }
export const stuckDaysOf = (t: StuckThresholds, stage: string) => t.byStage.get(stage) ?? t.defaultDays

/** the usual reasons for closing a potential doctor (a free text can be added) */
export const LOST_REASONS = ['בחר מתחרה', 'אין תקציב', 'לא מעוניין ברובוט', 'עבר מקום עבודה', 'לא פעיל בניתוחים']

export type HistoryRow = { doctor_id: string; stage: string; previous_stage: string; changed_at: string }

type DoctorLike = {
  id: string
  name: string
  title: string
  status: string
  pipeline_stage: string
  next_step: string
  next_step_date: string | null
  created_by: string | null
  lost_reason?: string
  lost_at?: string | null
  doctor_hospitals: { hospital_id: string }[]
}

export type StuckReason = { key: 'no-stage' | 'no-step' | 'overdue' | 'long'; label: string }
export type StuckDoctor = { d: DoctorLike; reasons: StuckReason[]; daysInStage: number | null }

const days = (from: string, to: string) => Math.round((new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) / 86_400_000)

/** the stage each doctor is in now and since when (the latest change of stage) */
export function stageSinceMap(history: HistoryRow[]): Map<string, { stage: string; since: string }> {
  const m = new Map<string, { stage: string; since: string }>()
  for (const r of [...history].sort((a, b) => b.changed_at.localeCompare(a.changed_at))) if (!m.has(r.doctor_id)) m.set(r.doctor_id, { stage: r.stage, since: r.changed_at.slice(0, 10) })
  return m
}

/** potential doctors that need a push: no stage, no next step, a next step whose date passed, or too long in one stage */
export function stuckPotentials(doctors: DoctorLike[], since: Map<string, { stage: string; since: string }>, thresholds: StuckThresholds = DEFAULT_THRESHOLDS): StuckDoctor[] {
  const today = todayISO()
  const out: StuckDoctor[] = []
  for (const d of doctors) {
    if (d.status !== 'potential') continue
    const reasons: StuckReason[] = []
    const s = since.get(d.id)
    const inStage = s && s.stage === d.pipeline_stage ? days(s.since, today) : null
    if (!d.pipeline_stage) reasons.push({ key: 'no-stage', label: 'לא נקבע שלב' })
    if (!d.next_step && !d.next_step_date) reasons.push({ key: 'no-step', label: 'אין צעד הבא' })
    if (d.next_step_date && d.next_step_date < today) reasons.push({ key: 'overdue', label: `הצעד הבא באיחור ${days(d.next_step_date, today)} ימים` })
    if (inStage !== null && inStage > stuckDaysOf(thresholds, d.pipeline_stage)) reasons.push({ key: 'long', label: `${inStage} ימים באותו שלב` })
    if (reasons.length > 0) out.push({ d, reasons, daysInStage: inStage })
  }
  // the most reasons first, then the longest in the stage
  return out.sort((a, b) => b.reasons.length - a.reasons.length || (b.daysInStage ?? 0) - (a.daysInStage ?? 0))
}

export type StageStat = {
  stage: string
  /** doctors who were in this stage at some time (or went further) */
  reached: number
  /** the share of those who moved on to the next stage, null for the last stage or when nobody reached it */
  toNextPct: number | null
  /** average days spent in the stage, over the doctors who already left it (null: nobody left yet) */
  avgDays: number | null
  left: number
}

/** how many reach each stage, how many move on, and how long they stay — from the recorded changes of stage */
export function funnelStats(stageNames: string[], history: HistoryRow[]): StageStat[] {
  const byDoctor = new Map<string, HistoryRow[]>()
  for (const r of history) byDoctor.set(r.doctor_id, [...(byDoctor.get(r.doctor_id) ?? []), r])
  const idx = new Map(stageNames.map((n, i) => [n, i]))

  const reachedSets = stageNames.map(() => new Set<string>())
  const spent = stageNames.map(() => ({ sum: 0, n: 0 }))
  for (const [doctor, rows] of byDoctor) {
    const sorted = [...rows].sort((a, b) => a.changed_at.localeCompare(b.changed_at))
    // a doctor who reached stage k has also passed the stages before it
    let furthest = -1
    for (const r of sorted) {
      const i = idx.get(r.stage)
      if (i !== undefined && i > furthest) furthest = i
    }
    for (let i = 0; i <= furthest; i++) reachedSets[i].add(doctor)
    // the time in a stage: from entering it to the next change
    for (let k = 0; k < sorted.length - 1; k++) {
      const i = idx.get(sorted[k].stage)
      if (i === undefined) continue
      const d = days(sorted[k].changed_at.slice(0, 10), sorted[k + 1].changed_at.slice(0, 10))
      spent[i].sum += d
      spent[i].n += 1
    }
  }
  return stageNames.map((stage, i) => {
    const reached = reachedSets[i].size
    const next = i + 1 < stageNames.length ? reachedSets[i + 1].size : null
    return {
      stage,
      reached,
      toNextPct: next !== null && reached > 0 ? Math.round((next / reached) * 100) : null,
      avgDays: spent[i].n > 0 ? Math.round(spent[i].sum / spent[i].n) : null,
      left: spent[i].n,
    }
  })
}

/** doctors closed as "not relevant": how many, and the reasons most given */
export function lostSummary(doctors: DoctorLike[]): { count: number; reasons: [string, number][] } {
  const lost = doctors.filter((d) => d.status === 'lost')
  const m = new Map<string, number>()
  for (const d of lost) m.set(d.lost_reason?.trim() || 'לא צוינה סיבה', (m.get(d.lost_reason?.trim() || 'לא צוינה סיבה') ?? 0) + 1)
  return { count: lost.length, reasons: [...m.entries()].sort((a, b) => b[1] - a[1]) }
}
