import type { MeetingWithRelations } from './types'
import { formatDate, formatTime } from './utils'

/** subject + body for e-mailing a meeting summary */
export function meetingMailText(m: MeetingWithRelations, sender: string): { subject: string; body: string } {
  const doctors = m.meeting_doctors.flatMap((d) => (d.doctor ? [`${d.doctor.title} ${d.doctor.name}`] : []))
  const contacts = m.meeting_contacts.flatMap((c) =>
    c.contact ? [c.contact.role ? `${c.contact.name} (${c.contact.role})` : c.contact.name] : [],
  )
  // drop the "imported from e-mail" marker line added when old e-mails were loaded
  const summary = (m.summary ?? '').replace(/^יובא ממייל:[^\n]*\n+/, '').trim()

  const lines: string[] = ['שלום,', '', `סיכום פגישה: ${m.subject || 'פגישה'}`]
  if (m.meeting_date)
    lines.push(`תאריך: ${formatDate(m.meeting_date)}${m.meeting_time ? ` ${formatTime(m.meeting_time)}` : ''}`)
  if (m.hospital) lines.push(`בית חולים: ${m.hospital.name}`)
  if (m.location) lines.push(`מקום: ${m.location}`)
  if (doctors.length) lines.push(`רופאים: ${doctors.join(', ')}`)
  if (contacts.length) lines.push(`אנשי קשר: ${contacts.join(', ')}`)
  if (m.responsible_agent?.full_name) lines.push(`סוכן אחראי: ${m.responsible_agent.full_name}`)

  if (summary) lines.push('', 'סיכום:', summary)
  if (m.decisions?.trim()) lines.push('', 'החלטות:', m.decisions.trim())
  if (m.meeting_tasks.length) {
    lines.push('', 'משימות להמשך:')
    for (const t of m.meeting_tasks)
      lines.push(`• ${t.description}${t.due_date ? ` (עד ${formatDate(t.due_date)})` : ''}${t.is_done ? ' — בוצע' : ''}`)
  }
  if (m.next_followup_date) lines.push('', `מעקב הבא: ${formatDate(m.next_followup_date)}`)
  if (sender) lines.push('', 'בברכה,', sender)

  const where = m.hospital?.name || doctors[0] || ''
  return {
    subject: `סיכום פגישה${where ? ` – ${where}` : ''}${m.meeting_date ? ` – ${formatDate(m.meeting_date)}` : ''}`,
    body: lines.join('\n'),
  }
}
