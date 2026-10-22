import type { PatientScanRow } from './types'
import { daysUntil } from './utils'

/** what is still open for a scan whose CT date falls in the coming 7 days */
export function weekMissing(s: PatientScanRow): string[] {
  if (s.status === 'cancelled' || !s.ct_date) return []
  const d = daysUntil(s.ct_date)
  if (d === null || d < 0 || d > 7) return []
  const out: string[] = []
  if (!s.scanned) out.push('CT טרם בוצע')
  else if (!s.disk_collected) out.push('דיסק לא הועלה')
  if (!s.plan_ready) out.push('תוכנית לא מוכנה')
  return out
}

export function rowFlags(s: PatientScanRow) {
  const active = s.status !== 'cancelled'
  const surgerySoon = !!s.surgery_date && (daysUntil(s.surgery_date) ?? -1) >= 0 && (daysUntil(s.surgery_date) ?? 99) <= 7
  const ctDays = s.ct_date ? daysUntil(s.ct_date) : null
  return {
    overdueRow: active && ctDays !== null && ctDays < 0 && !s.scanned,
    soon: active && ctDays !== null && ctDays >= 0 && ctDays <= 3 && !s.scanned,
    noCtSoon: active && surgerySoon && !s.ct_date,
    noDiskSoon: active && surgerySoon && !!s.ct_date && !s.disk_collected,
    missing: weekMissing(s),
    rescanKind: rescanAlert(s),
    hasEvents: !!s.ct_date || (s.rescan && !!s.rescan_date),
  }
}

export type ScanQuick = 'week' | 'overdue' | 'noct' | 'nodisk' | 'open' | 'rescan' | 'postponed' | 'nodate'

const within7 = (date: string | null) => {
  const n = daysUntil(date)
  return n !== null && n >= 0 && n <= 7
}

/** the alert chips above the scans list: who belongs to each one (days are counted from the local day) */
export const QUICK_TESTS: Record<ScanQuick, (s: PatientScanRow) => boolean> = {
  overdue: (s) => s.status !== 'cancelled' && (daysUntil(s.ct_date) ?? 0) < 0 && !s.scanned,
  noct: (s) => s.status !== 'cancelled' && within7(s.surgery_date) && !s.ct_date,
  nodisk: (s) => s.status !== 'cancelled' && within7(s.surgery_date) && !!s.ct_date && !s.disk_collected,
  week: (s) => s.status !== 'cancelled' && within7(s.ct_date) && !s.scanned,
  open: (s) => weekMissing(s).length > 0,
  rescan: (s) => s.rescan && !s.rescan_done && s.status !== 'cancelled',
  postponed: (s) => s.status === 'postponed',
  nodate: (s) => s.status === 'planned' && !s.surgery_date,
}

export type RescanKind = 'today' | 'soon' | 'overdue' | 'nodate'

/** an open re-scan that needs the agent to make sure the patient shows up */
export function rescanAlert(s: PatientScanRow): RescanKind | null {
  if (s.status === 'cancelled' || !s.rescan || s.rescan_done) return null
  if (!s.rescan_date) return 'nodate'
  const d = daysUntil(s.rescan_date)
  if (d === null || d > 7) return null
  if (d < 0) return 'overdue'
  return d === 0 ? 'today' : 'soon'
}
