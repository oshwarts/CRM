// How a field in an offline-edit conflict is shown to a person: a Hebrew name for the field and a readable value
// (not "recurrence" / "normal" / a row id). Used by the panel of waiting changes.
import { MEETING_STATUS_LABELS, PROCEDURE_CATEGORY_LABELS } from './types'
import { FIELD_LABELS } from './fieldLabels'

const PRIORITY: Record<string, string> = { normal: 'רגילה', urgent: 'דחוף' }
const RECURRENCE: Record<string, string> = { none: 'לא', weekly: 'כל שבוע', monthly: 'כל חודש' }
const NAMED = new Set(['doctor_id', 'surgeon_id', 'hospital_id', 'assignee_id', 'responsible_agent_id', 'coordinator_contact_id', 'contact_id', 'project_id', 'area_id', 'meeting_id', 'review_id'])
const TASK_STATUS: Record<string, string> = { open: 'פתוחה', done: 'בוצעה', stuck: 'תקועה', waiting: 'ממתינה' }

/** the name of the field for a person (falls back to the generic labels, then to the raw name) */
export function conflictFieldLabel(field: string, generic: Record<string, string> = {}): string {
  return FIELD_LABELS[field] ?? generic[field] ?? field
}

/** `nameOf(field, id)` looks a row id up (a doctor, a hospital …) in what the app already loaded */
export function conflictValue(field: string, value: unknown, nameOf: (field: string, id: string) => string | undefined = () => undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'כן' : 'לא'
  if (field === 'priority') return PRIORITY[String(value)] ?? String(value)
  if (field === 'recurrence') return RECURRENCE[String(value)] ?? String(value)
  if (field === 'status') return MEETING_STATUS_LABELS[String(value)] ?? TASK_STATUS[String(value)] ?? String(value)
  if (field === 'procedure_type') return PROCEDURE_CATEGORY_LABELS[String(value)] ?? String(value)
  if (typeof value === 'object') return 'נתונים מורכבים'
  if (NAMED.has(field)) return nameOf(field, String(value)) ?? 'פריט שנבחר'
  const s = String(value)
  // a date (yyyy-mm-dd) as the rest of the app shows it; a time without seconds
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (date) return `${date[3]}/${date[2]}/${date[1]}`
  if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s.slice(0, 5)
  return s
}
