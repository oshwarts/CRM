import type { ConsumableItem } from './types'
import { formatDate } from './utils'

export type CountRow = { item: ConsumableItem; qty: number | null; min: number }

export const shortageOf = (r: CountRow): number =>
  r.qty === null ? 0 : Math.max(0, r.min - r.qty)

export function groupByCategory(rows: CountRow[]): { category: string; rows: CountRow[] }[] {
  const out: { category: string; rows: CountRow[] }[] = []
  for (const r of rows) {
    const cat = r.item.category || 'כללי'
    let g = out.find((x) => x.category === cat)
    if (!g) out.push((g = { category: cat, rows: [] }))
    g.rows.push(r)
  }
  return out
}

export function summarize(rows: CountRow[]) {
  const missing = rows.filter((r) => shortageOf(r) > 0)
  return { missing, units: missing.reduce((s, r) => s + shortageOf(r), 0) }
}

export const HOSPITAL_PLACEHOLDER = '{בית חולים}'
export const DEFAULT_INTRO = `נא להשלים מתכלים לבית החולים ${HOSPITAL_PLACEHOLDER}:`

export function shortageText(opts: {
  hospital: string
  countedOn: string
  agent: string
  rows: CountRow[]
  /** fixed sentence from Settings; {בית חולים} is replaced with the hospital name */
  intro?: string
}): { subject: string; body: string } {
  const { missing, units } = summarize(opts.rows)
  const intro = (opts.intro?.trim() || DEFAULT_INTRO).split(HOSPITAL_PLACEHOLDER).join(opts.hospital)
  const lines: string[] = ['שלום,', '', intro, '']
  if (missing.length === 0) {
    lines.push('אין חוסרים — כל הפריטים במלאי המינימום או מעליו.')
  } else {
    // catalog number + quantity to complete only (no descriptions)
    for (const r of missing)
      lines.push(`${r.item.catalog_number || r.item.name} — להשלים ${shortageOf(r)}`)
    lines.push('', `סה״כ ${missing.length} פריטים, ${units} יחידות.`)
  }
  return {
    subject: `חוסרים במתכלים MAKO – ${opts.hospital} – ${formatDate(opts.countedOn)}`,
    body: lines.join('\n'),
  }
}

export const CONSUMABLES_EMAIL_KEY = 'consumables_email'
export const CONSUMABLES_INTRO_KEY = 'consumables_email_intro'
