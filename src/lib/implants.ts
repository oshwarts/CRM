import { IMPLANT_FIELDS } from './types'
import type { ImplantField, ImplantOption } from './types'

/** one field of the implant form of a procedure type */
export type ImplantFieldDef = { key: string; label: string; category: string; depends_on: string | null }

/** the fields of a procedure type: the ones set in Settings, or the built-in list until those are loaded */
export function implantFieldsOf(procedure: string, rows: ImplantField[] | null | undefined): ImplantFieldDef[] {
  if (rows && rows.length) {
    return rows
      .filter((r) => r.procedure_type === procedure)
      .sort((a, b) => a.sort - b.sort)
      .map((r) => ({ key: r.key, label: r.label, category: r.category, depends_on: r.depends_on }))
  }
  return (IMPLANT_FIELDS[procedure] ?? []).map((f) => ({ ...f, depends_on: f.category === 'hip_neck' ? 'hip_head' : null }))
}

const bySort = (a: ImplantOption, b: ImplantOption) => a.sort - b.sort || a.value.localeCompare(b.value, 'he', { numeric: true })

/** the general list of a field (the options that do not belong to one option of another field) */
export const generalOptions = (category: string, options: ImplantOption[]) => options.filter((o) => o.category === category && !o.parent_id).sort(bySort)

/**
 * The sizes offered for a field now. A field that depends on another one (neck on head) offers the list of the chosen
 * parent value when that value has its own list ("head 36 → 0, +2.5, +5"); otherwise the general list of the field.
 */
export function optionsForField(
  field: ImplantFieldDef,
  data: Record<string, string>,
  fields: ImplantFieldDef[],
  options: ImplantOption[],
): { values: string[]; narrowedBy: string | null } {
  const general = generalOptions(field.category, options).map((o) => o.value)
  if (!field.depends_on) return { values: general, narrowedBy: null }
  const parent = fields.find((f) => f.category === field.depends_on)
  const chosen = parent ? (data[parent.key] ?? '').trim() : ''
  if (!parent || !chosen) return { values: general, narrowedBy: null }
  const parentOption = options.find((o) => o.category === parent.category && !o.parent_id && o.value.trim() === chosen)
  const own = parentOption ? options.filter((o) => o.parent_id === parentOption.id).sort(bySort) : []
  return own.length ? { values: own.map((o) => o.value), narrowedBy: `${parent.label} ${chosen}` } : { values: general, narrowedBy: null }
}
