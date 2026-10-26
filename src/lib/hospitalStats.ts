// The rows of the hospitals list: commercial status, last activity, surgeries, and what needs attention.
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { addDays, format } from 'date-fns'
import { supabase } from './supabase'
import type { MapHospital } from './api'
import type { MeetingWithRelations, PatientScanRow } from './types'
import type { PlannedSurgery } from './plannedSurgeries'
import { todayISO } from './utils'

export type CommercialStatus = 'client' | 'onboarding' | 'potential' | 'competitor' | 'irrelevant'

export const STATUS_LABELS: Record<CommercialStatus, string> = {
  client: 'לקוח',
  onboarding: 'בהקמה / בתהליך',
  potential: 'פוטנציאלי',
  competitor: 'מתחרה בלבד',
  irrelevant: 'לא רלוונטי',
}
export const STATUS_ORDER: CommercialStatus[] = ['client', 'onboarding', 'potential', 'competitor', 'irrelevant']

/** chip colours (the colour language of the system: blue = ours, amber = in motion, green = ours and working, red = theirs) */
export const STATUS_CHIP: Record<CommercialStatus, string> = {
  client: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  onboarding: 'border-amber-200 bg-amber-50 text-amber-700',
  potential: 'border-brand-200 bg-brand-50 text-brand-700',
  competitor: 'border-red-200 bg-red-50 text-red-700',
  irrelevant: 'border-slate-200 bg-slate-50 text-slate-500',
}
/** pin colours on the map */
export const STATUS_PIN: Record<CommercialStatus, string> = {
  client: '#1d9a6c',
  onboarding: '#d98e0a',
  potential: '#1863dc',
  competitor: '#c7403a',
  irrelevant: '#94a3b8',
}

/** a no-visit warning after this many days */
export const NO_VISIT_DAYS = 60

/** the status the hospital's robots suggest, used until a person sets one */
export function suggestStatus(robots: string[]): CommercialStatus {
  if (robots.some((r) => r.toUpperCase().includes('MAKO'))) return 'client'
  if (robots.length > 0) return 'competitor'
  return 'potential'
}

export type Warning = { key: 'no-visit' | 'no-agent' | 'no-contact' | 'quiet-client'; label: string }

export type HospitalRow = {
  h: MapHospital
  status: CommercialStatus
  /** true while the status is only the suggestion */
  suggested: boolean
  robots: string[]
  agents: { id: string; name: string }[]
  doctors: number
  contactPhone: { name: string; phone: string } | null
  lastMeeting: string | null
  daysSince: number | null
  /** surgeries in the last 30 days (MAKO from the scans + entered, with their counts) */
  surgeries30: number
  /** surgeries planned for the next 30 days */
  upcoming30: number
  warnings: Warning[]
}

const daysBetween = (a: string, b: string) => Math.round((new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / 86_400_000)

export function buildHospitalRows(input: { hospitals: MapHospital[]; meetings: MeetingWithRelations[]; scans: PatientScanRow[]; planned: PlannedSurgery[] }): HospitalRow[] {
  const today = todayISO()
  const back30 = format(addDays(new Date(), -30), 'yyyy-MM-dd')
  const ahead30 = format(addDays(new Date(), 30), 'yyyy-MM-dd')

  const lastMeeting = new Map<string, string>()
  for (const m of input.meetings) {
    if (!m.hospital_id || !m.meeting_date || m.meeting_date > today || (m.status !== 'done' && m.status !== 'needs_followup')) continue
    if ((lastMeeting.get(m.hospital_id) ?? '') < m.meeting_date) lastMeeting.set(m.hospital_id, m.meeting_date)
  }
  const past = new Map<string, number>()
  const next = new Map<string, number>()
  const add = (map: Map<string, number>, id: string | null, n: number) => id && map.set(id, (map.get(id) ?? 0) + n)
  for (const s of input.scans) {
    if (s.status === 'cancelled' || !s.surgery_date) continue
    if (s.surgery_date >= back30 && s.surgery_date <= today) add(past, s.hospital_id, 1)
    else if (s.surgery_date > today && s.surgery_date <= ahead30) add(next, s.hospital_id, 1)
  }
  for (const s of input.planned) {
    if (s.status === 'cancelled') continue
    if (s.surgery_date >= back30 && s.surgery_date <= today) add(past, s.hospital_id, s.cases ?? 1)
    else if (s.surgery_date > today && s.surgery_date <= ahead30) add(next, s.hospital_id, s.cases ?? 1)
  }

  return input.hospitals.map((h) => {
    const robots = h.hospital_robotic_systems.map((r) => r.system?.name).filter((x): x is string => !!x)
    const stored = (h.commercial_status ?? '') as CommercialStatus | ''
    const status = stored || suggestStatus(robots)
    const agents = h.hospital_agents.flatMap((a) => (a.agent ? [{ id: a.agent.id, name: a.agent.full_name }] : []))
    const last = lastMeeting.get(h.id) ?? null
    const daysSince = last ? daysBetween(last, today) : null
    const withPhone = h.contacts.find((c) => c.phone)
    const surgeries30 = past.get(h.id) ?? 0

    const warnings: Warning[] = []
    if (status !== 'irrelevant') {
      if (daysSince === null || daysSince > NO_VISIT_DAYS) warnings.push({ key: 'no-visit', label: daysSince === null ? 'לא נערכה פגישה' : `ללא ביקור ${daysSince} ימים` })
      if (agents.length === 0) warnings.push({ key: 'no-agent', label: 'אין סוכן מטפל' })
      if (h.contacts.length === 0) warnings.push({ key: 'no-contact', label: 'אין איש קשר' })
      if (status === 'client' && surgeries30 === 0) warnings.push({ key: 'quiet-client', label: 'לקוח בלי ניתוחים ב-30 יום' })
    }

    return {
      h,
      status,
      suggested: !stored,
      robots,
      agents,
      doctors: h.doctor_hospitals.filter((d) => d.doctor).length,
      contactPhone: withPhone ? { name: withPhone.name, phone: withPhone.phone } : null,
      lastMeeting: last,
      daysSince,
      surgeries30,
      upcoming30: next.get(h.id) ?? 0,
      warnings,
    }
  })
}

/** a few small settings of a hospital saved from its screens: commercial status, next step, surgery days, how scans are coordinated */
export function useSetHospitalCommercial() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string; commercial_status?: CommercialStatus | ''; next_step?: string; next_step_date?: string | null; surgery_days?: number[]; scan_contact_id?: string | null; scan_center_name?: string; scan_hours?: string; scan_notes?: string; scan_phone?: string; scan_email?: string; scan_whatsapp_name?: string; scan_whatsapp_url?: string }) => {
      const { error } = await supabase.from('hospitals').update(patch).eq('id', id)
      if (error) throw error
    },
    // the new status shows at once (the select does not jump back until the reload) and returns if the save fails
    onMutate: async ({ id, ...patch }) => {
      await qc.cancelQueries({ queryKey: ['map-data'] })
      const before = qc.getQueryData<MapHospital[]>(['map-data'])
      if (before) qc.setQueryData<MapHospital[]>(['map-data'], before.map((h) => (h.id === id ? ({ ...h, ...patch } as MapHospital) : h)))
      return { before }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.before) qc.setQueryData(['map-data'], ctx.before)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['map-data'] })
      qc.invalidateQueries({ queryKey: ['hospitals'] })
    },
  })
}
