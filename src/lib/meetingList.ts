import type { MeetingWithRelations } from './types'

export type MeetingTab = 'all' | 'upcoming' | 'past' | 'followup'

/** does this meeting belong to the tab (`today` = the local date, yyyy-mm-dd) */
export function inTab(m: MeetingWithRelations, key: MeetingTab, today: string): boolean {
  switch (key) {
    case 'upcoming':
      return (m.meeting_date ?? '') >= today && m.status === 'scheduled'
    case 'past':
      return (m.meeting_date ?? '') < today || m.status === 'done'
    case 'followup':
      return m.status === 'needs_followup' || (!!m.next_followup_date && m.status !== 'done' && m.status !== 'cancelled')
    default:
      return true
  }
}

/**
 * What is coming is listed soonest first (follow-ups: the most urgent follow-up date first); everything else newest first.
 * Meetings without a date go last - except one still waiting to be sent (`pending`): a meeting just saved offline stays at the top,
 * where its owner looks for it.
 */
export function sortMeetings(list: MeetingWithRelations[], tab: MeetingTab, pending?: ReadonlySet<string>): MeetingWithRelations[] {
  const dir = tab === 'upcoming' || tab === 'followup' ? 1 : -1
  const key = (m: MeetingWithRelations) => (tab === 'followup' ? (m.next_followup_date ?? m.meeting_date) : m.meeting_date)
  return [...list].sort((a, b) => {
    const ka = key(a)
    const kb = key(b)
    if (!ka && !kb) return Number(!!pending?.has(b.id)) - Number(!!pending?.has(a.id)) || b.created_at.localeCompare(a.created_at)
    if (!ka) return pending?.has(a.id) ? -1 : 1
    if (!kb) return pending?.has(b.id) ? 1 : -1
    return dir * (ka.localeCompare(kb) || (a.meeting_time ?? '').localeCompare(b.meeting_time ?? '') || a.created_at.localeCompare(b.created_at))
  })
}
