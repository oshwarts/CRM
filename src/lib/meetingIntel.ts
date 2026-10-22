// What a meeting says about competitors is also a record on the competitors side: one competitor_intel row tied to the meeting
// (meeting_id), so the competitor's page, the doctor's and the hospital's lists show it, and it leads back to the meeting.
// The meeting's own text stays the source of what was written; the record is kept in line with it every time the meeting is saved.
import { supabase } from './supabase'

type Input = {
  competitor_notes: string
  competitorId?: string | null // undefined = the person did not touch the competitor: the record keeps its competitor
  meeting_date: string | null
  doctorIds: string[]
  hospitalId: string | null
}

const ok = <T,>(r: { data: T | null; error: { message: string } | null }): T => {
  if (r.error) throw new Error(r.error.message)
  return r.data as T
}

/** a record with details of its own (a price, a tender, a picture...) is never deleted because the meeting text was cleared */
const hasOwnDetails = (r: Record<string, unknown>) =>
  !!(r.product || r.offer || r.payment_terms || r.tender_name || r.price_per_case !== null || r.implant_price !== null || r.contract_end || (Array.isArray(r.image_paths) && r.image_paths.length) || r.outcome !== 'open')

export async function syncMeetingIntel(meetingId: string, d: Input): Promise<void> {
  const notes = d.competitor_notes.trim()
  const existing = ok<Record<string, unknown>[]>(await supabase.from('competitor_intel').select('*').eq('meeting_id', meetingId).order('created_at').limit(1))[0]

  if (!notes) {
    if (existing && !hasOwnDetails(existing)) ok(await supabase.from('competitor_intel').delete().eq('id', existing.id as string))
    return
  }

  const competitorId = d.competitorId === undefined ? ((existing?.competitor_id as string | null | undefined) ?? null) : d.competitorId
  let competitorName = (existing?.competitor as string | undefined) ?? ''
  if (d.competitorId !== undefined) {
    competitorName = ''
    if (competitorId) competitorName = ok<{ name: string }>(await supabase.from('competitors').select('name').eq('id', competitorId).single()).name
  }
  const row = {
    competitor_id: competitorId,
    competitor: competitorName,
    notes,
    intel_date: d.meeting_date ?? new Date().toLocaleDateString('sv-SE'),
    doctor_id: d.doctorIds[0] ?? null,
    hospital_id: d.hospitalId,
    meeting_id: meetingId,
  }
  if (existing) ok(await supabase.from('competitor_intel').update(row).eq('id', existing.id as string))
  else ok(await supabase.from('competitor_intel').insert(row))
}
