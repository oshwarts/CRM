// The rows of the doctors list: contact rhythm, who needs contact now, surgeries in a chosen window, loyalty, missing details.
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { addDays, format } from 'date-fns'
import { contactState, type ContactState } from './cadence'
import { supabase } from './supabase'
import type { DoctorListItem, MeetingWithRelations, PatientScanRow, CompetitorIntelRow } from './types'
import type { PlannedSurgery } from './plannedSurgeries'
import { todayISO } from './utils'

/** a doctor without a cadence who was not met for this long needs contact too */
export const STALE_DAYS = 60

export const WINDOWS: { days: number; label: string }[] = [
  { days: 30, label: 'חודש' },
  { days: 90, label: '3 חודשים' },
  { days: 180, label: 'חצי שנה' },
  { days: 365, label: 'שנה' },
]

// the same meaning as in the competitor record (lib/competitors.ts): loyal = loyal to the competitor, open = open to a switch,
// leaning = leaning towards US (green)
export const LOYALTY_SHORT: Record<string, string> = { loyal: 'נאמן למתחרה', open: 'פתוח למעבר', leaning: 'נוטה אלינו' }
export const LOYALTY_CHIP: Record<string, string> = {
  loyal: 'border-red-200 bg-red-50 text-red-700',
  open: 'border-amber-200 bg-amber-50 text-amber-700',
  leaning: 'border-emerald-200 bg-emerald-50 text-emerald-700',
}

export type Need = 'due' | 'stale' | 'soon' | ''

export type DoctorRow = {
  d: DoctorListItem
  hospitals: string[]
  robots: string[]
  companies: string[]
  contact: ContactState
  daysSince: number | null
  /** due: past the cadence · stale: no cadence and not met for STALE_DAYS · soon: due within a week */
  need: Need
  surgeries: number
  loyalty: '' | 'loyal' | 'leaning' | 'open'
  missing: string[]
}

const daysBetween = (a: string, b: string) => Math.round((new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / 86_400_000)

export function buildDoctorRows(input: {
  doctors: DoctorListItem[]
  meetings: MeetingWithRelations[]
  scans: PatientScanRow[]
  planned: PlannedSurgery[]
  intel: CompetitorIntelRow[]
  robotNames: Map<string, string>
  companyNames: Map<string, string>
  windowDays: number
}): DoctorRow[] {
  const today = todayISO()
  const since = format(addDays(new Date(), -input.windowDays), 'yyyy-MM-dd')

  const surgeries = new Map<string, number>()
  const add = (id: string | null, n: number) => id && surgeries.set(id, (surgeries.get(id) ?? 0) + n)
  for (const s of input.scans) if (s.status !== 'cancelled' && s.surgery_date && s.surgery_date >= since && s.surgery_date <= today) add(s.surgeon_id, 1)
  for (const s of input.planned) if (s.status !== 'cancelled' && s.surgery_date >= since && s.surgery_date <= today) add(s.doctor_id, s.cases ?? 1)

  // the latest stated loyalty of every doctor (records come newest first)
  const loyalty = new Map<string, DoctorRow['loyalty']>()
  for (const i of input.intel) if (i.doctor_id && i.loyalty && !loyalty.has(i.doctor_id)) loyalty.set(i.doctor_id, i.loyalty as DoctorRow['loyalty'])

  return input.doctors.map((d) => {
    const contact = contactState(d, input.meetings)
    const daysSince = contact.lastDate ? daysBetween(contact.lastDate, today) : null
    let need: Need = ''
    if (!contact.nextMeeting) {
      if (contact.status === 'due') need = 'due'
      else if (contact.status === 'none' && (daysSince === null || daysSince >= STALE_DAYS)) need = 'stale'
      else if (contact.status === 'soon') need = 'soon'
    }
    const missing: string[] = []
    if (!d.phone) missing.push('טלפון')
    if (d.doctor_hospitals.length === 0) missing.push('בית חולים')
    if (d.doctor_procedures.length === 0) missing.push('הליכים')
    return {
      d,
      hospitals: d.doctor_hospitals.map((h) => h.hospital?.name).filter((x): x is string => !!x),
      robots: d.doctor_robotic_systems.map((r) => input.robotNames.get(r.system_id)).filter((x): x is string => !!x),
      companies: d.doctor_companies.map((c) => input.companyNames.get(c.company_id)).filter((x): x is string => !!x),
      contact,
      daysSince,
      need,
      surgeries: surgeries.get(d.id) ?? 0,
      loyalty: loyalty.get(d.id) ?? '',
      missing,
    }
  })
}

/** a quick change of the status or the contact rhythm of a doctor, straight from the list */
export function usePatchDoctor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string; status?: string; contact_cadence_days?: number | null; lost_reason?: string; lost_at?: string | null }) => {
      const { error } = await supabase.from('doctors').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doctors'] })
      qc.invalidateQueries({ queryKey: ['doctor'] })
      qc.invalidateQueries({ queryKey: ['pipeline-doctors'] })
    },
  })
}
