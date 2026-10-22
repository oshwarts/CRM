import type { PlannedSurgery } from '../../lib/plannedSurgeries'
import type { TaskRow } from '../../lib/types'

export type Kind = 'meeting' | 'surgery' | 'ct' | 'rescan' | 'followup' | 'task'

/** one thing on the calendar, whatever it came from */
export type Item = {
  id: string
  date: string
  /** "HH:mm", empty for something that has a day but no hour (it goes to the all-day row) */
  time: string
  durationMin?: number
  kind: Kind
  title: string
  sub: string
  /** the page it opens (empty when it opens a form instead) */
  to: string
  /** a surgery entered by hand: opens the quick-entry form */
  surgery?: PlannedSurgery
  /** a task: opens the task form */
  task?: TaskRow
  muted?: boolean
  agentIds: string[]
}

export const KINDS: Record<Kind, { label: string; chip: string; dot: string }> = {
  meeting: { label: 'פגישה', chip: 'border-brand-200 bg-brand-50 text-brand-700', dot: 'bg-brand-500' },
  surgery: { label: 'ניתוח', chip: 'border-violet-200 bg-violet-50 text-violet-700', dot: 'bg-violet-500' },
  ct: { label: 'CT', chip: 'border-sky-200 bg-sky-50 text-sky-700', dot: 'bg-sky-500' },
  rescan: { label: 'סריקה חוזרת', chip: 'border-rose-200 bg-rose-50 text-rose-700', dot: 'bg-rose-500' },
  followup: { label: 'מעקב', chip: 'border-amber-200 bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  task: { label: 'משימה', chip: 'border-emerald-200 bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
}

export const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
