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

export function shortageText(opts: {
  hospital: string
  countedOn: string
  agent: string
  rows: CountRow[]
}): { subject: string; body: string } {
  const { missing, units } = summarize(opts.rows)
  const lines: string[] = [
    'שלום,',
    '',
    'רשימת חוסרים במתכלים MAKO',
    `בית חולים: ${opts.hospital}`,
    `תאריך ספירה: ${formatDate(opts.countedOn)}`,
  ]
  if (opts.agent) lines.push(`נספר ע״י: ${opts.agent}`)
  lines.push('')
  if (missing.length === 0) {
    lines.push('אין חוסרים — כל הפריטים במלאי המינימום או מעליו.')
  } else {
    for (const g of groupByCategory(missing)) {
      lines.push(g.category)
      for (const r of g.rows)
        lines.push(
          `• ${r.item.catalog_number ? `${r.item.catalog_number} — ` : ''}${r.item.name} — חסר ${shortageOf(r)} (מינימום ${r.min}, בפועל ${r.qty})`,
        )
      lines.push('')
    }
    lines.push(`סה״כ ${missing.length} פריטים חסרים, ${units} יחידות.`)
  }
  return {
    subject: `חוסרים במתכלים MAKO – ${opts.hospital} – ${formatDate(opts.countedOn)}`,
    body: lines.join('\n'),
  }
}

// Outlook / Windows drop mailto links longer than ~2000 characters
const MAILTO_LIMIT = 1900

/** returns 'full' when the whole list went into the draft, 'copied' when it was too long */
export function buildMailto(
  to: string,
  subject: string,
  body: string,
): { url: string; mode: 'full' | 'copied' } {
  const make = (b: string) =>
    `mailto:${encodeURIComponent(to).replace(/%40/g, '@')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(b).replace(/%0A/g, '%0D%0A')}`
  const full = make(body)
  if (full.length <= MAILTO_LIMIT) return { url: full, mode: 'full' }
  return {
    url: make('שלום,\n\nרשימת החוסרים המלאה הועתקה — הדבק אותה כאן (Ctrl+V).'),
    mode: 'copied',
  }
}

export const CONSUMABLES_EMAIL_KEY = 'consumables_email'
