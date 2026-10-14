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

/* ---------------- stock forecast from the planned surgeries ---------------- */

export type UsageMap = Map<string, Partial<Record<'knee' | 'uni' | 'hip', number>>>
export type ForecastRow = {
  item: ConsumableItem
  /** the quantity in the last stock count, null when the hospital was never counted */
  counted: number | null
  /** used by the surgeries done after the count, up to today */
  usedSince: number
  /** needed by the surgeries planned from tomorrow to the horizon */
  planned: number
  /** counted - usedSince - planned (null without a count) */
  projected: number | null
  min: number
  /** how many to bring so that the stock is back at the minimum after the planned surgeries */
  order: number
}

const TYPES = ['knee', 'uni', 'hip'] as const
const NONE = { knee: 0, uni: 0, hip: 0 }

/** surgeries of the hospital in a date window, counted per procedure type (cancelled ones are left out) */
export function surgeriesBetween(
  scans: { hospital_id: string; status: string; surgery_date: string | null; procedure_type: string }[],
  hospitalId: string,
  after: string,
  upTo: string,
): Record<'knee' | 'uni' | 'hip', number> {
  const out = { ...NONE }
  for (const s of scans) {
    if (s.hospital_id !== hospitalId || s.status === 'cancelled' || !s.surgery_date) continue
    if (s.surgery_date > after && s.surgery_date <= upTo && (TYPES as readonly string[]).includes(s.procedure_type)) out[s.procedure_type as 'knee']++
  }
  return out
}

export function forecastStock(opts: {
  items: ConsumableItem[]
  usage: UsageMap
  minOf: (itemId: string, fallback: number) => number
  lastCount: { counted_on: string; lines: { item_id: string; qty: number }[] } | undefined
  scans: Parameters<typeof surgeriesBetween>[0]
  hospitalId: string
  today: string
  horizon: string
}): { rows: ForecastRow[]; since: Record<'knee' | 'uni' | 'hip', number>; ahead: Record<'knee' | 'uni' | 'hip', number> } {
  const from = opts.lastCount?.counted_on ?? opts.today
  const since = opts.lastCount ? surgeriesBetween(opts.scans, opts.hospitalId, from, opts.today) : { ...NONE }
  const ahead = surgeriesBetween(opts.scans, opts.hospitalId, opts.today, opts.horizon)
  const lines = new Map((opts.lastCount?.lines ?? []).map((l) => [l.item_id, l.qty]))
  const rows: ForecastRow[] = []
  for (const item of opts.items) {
    const u = opts.usage.get(item.id)
    if (!u || !TYPES.some((t) => (u[t] ?? 0) > 0)) continue
    const per = (n: Record<'knee' | 'uni' | 'hip', number>) => TYPES.reduce((s, t) => s + n[t] * (u[t] ?? 0), 0)
    const usedSince = per(since)
    const planned = per(ahead)
    const counted = lines.has(item.id) ? lines.get(item.id)! : null
    const projected = counted === null ? null : counted - usedSince - planned
    const min = opts.minOf(item.id, item.default_min)
    const order = Math.ceil(Math.max(0, projected === null ? planned : min - projected) - 1e-9)
    rows.push({ item, counted, usedSince, planned, projected, min, order })
  }
  return { rows: rows.sort((a, b) => b.order - a.order), since, ahead }
}
