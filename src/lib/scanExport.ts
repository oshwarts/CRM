import { SCAN_PROCEDURE_LABELS, type ImplantField, type PatientScanRow } from './types'
import { implantFieldsOf } from './implants'
import { formatDate, formatTime } from './utils'

/** `fieldRows` = the implant fields set in Settings (useImplantFields); without them the built-in list is used */
export function implantSummary(s: PatientScanRow, fieldRows?: ImplantField[] | null): string {
  const fields = implantFieldsOf(s.procedure_type, fieldRows)
  const data = (s.implant_data as Record<string, string>) ?? {}
  return fields
    .map((f) => (data[f.key] ? `${f.label} ${data[f.key]}` : null))
    .filter(Boolean)
    .join(' · ')
}

/** plain-text block, ready to paste into WhatsApp / mail */
export function scansToText(list: PatientScanRow[]): string {
  const lines = list.map((s, i) => {
    const parts = [
      s.surgery_date ? `ניתוח ${formatDate(s.surgery_date)}` : null,
      s.surgeon ? `מנתח: ${s.surgeon.title} ${s.surgeon.name}` : null,
      s.ct_date
        ? `CT ${formatDate(s.ct_date)}${s.ct_time ? ` ${formatTime(s.ct_time)}` : ''}`
        : 'CT: לא נקבע',
      [SCAN_PROCEDURE_LABELS[s.procedure_type], s.side].filter(Boolean).join(' '),
    ].filter(Boolean)
    return `${i + 1}. ${s.patient_name}${s.hospital ? ` — ${s.hospital.name}` : ''}\n   ${parts.join(' | ')}`
  })
  return `סריקות MAKO (${list.length})\n\n${lines.join('\n')}`
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  }
}

export type CalEvent = {
  uid: string
  title: string
  date: string // yyyy-MM-dd
  time?: string | null // HH:mm[:ss]; missing => all-day
  durationMin?: number
  location?: string
  description?: string
}

const esc = (t: string) =>
  t.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

/** RFC 5545: lines are at most 75 BYTES; Hebrew takes 2 bytes a letter, and a split must not cut a character in half */
function fold(line: string): string {
  const enc = new TextEncoder()
  const out: string[] = []
  let cur = ''
  let bytes = 0
  for (const ch of line) {
    const n = enc.encode(ch).length
    if (bytes + n > (out.length ? 74 : 75)) {
      out.push(cur)
      cur = ''
      bytes = 0
    }
    cur += ch
    bytes += n
  }
  out.push(cur)
  return out.map((l, i) => (i ? ' ' : '') + l).join('\r\n')
}

const stamp = (d: Date) =>
  d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

/** floating local time: Outlook opens it as a new appointment in the user's own timezone */
export function buildIcs(events: CalEvent[]): string {
  const now = stamp(new Date())
  const out = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//A.M.I. CRM//Scans//HE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]
  for (const e of events) {
    const day = e.date.replace(/-/g, '')
    out.push('BEGIN:VEVENT', `UID:${e.uid}@ami-crm`, `DTSTAMP:${now}`)
    if (e.time) {
      const [h, m] = e.time.slice(0, 5).split(':').map(Number)
      const start = h * 60 + m
      const end = Math.min(start + (e.durationMin ?? 60), 23 * 60 + 59)
      const hm = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}${String(n % 60).padStart(2, '0')}00`
      out.push(`DTSTART:${day}T${hm(start)}`, `DTEND:${day}T${hm(end)}`)
    } else {
      const next = new Date(`${e.date}T00:00:00`)
      next.setDate(next.getDate() + 1)
      const nd = [
        next.getFullYear(),
        String(next.getMonth() + 1).padStart(2, '0'),
        String(next.getDate()).padStart(2, '0'),
      ].join('')
      out.push(`DTSTART;VALUE=DATE:${day}`, `DTEND;VALUE=DATE:${nd}`)
    }
    out.push(`SUMMARY:${esc(e.title)}`)
    if (e.location) out.push(`LOCATION:${esc(e.location)}`)
    if (e.description) out.push(`DESCRIPTION:${esc(e.description)}`)
    out.push('END:VEVENT')
  }
  out.push('END:VCALENDAR')
  return out.map(fold).join('\r\n') + '\r\n'
}

export function downloadIcs(events: CalEvent[], filename: string) {
  const blob = new Blob([buildIcs(events)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function scanEvents(s: PatientScanRow): CalEvent[] {
  const detail = [
    `מטופל: ${s.patient_name}`,
    s.patient_phone && `טלפון: ${s.patient_phone}`,
    s.surgeon && `מנתח: ${s.surgeon.title} ${s.surgeon.name}`,
    `סוג: ${[SCAN_PROCEDURE_LABELS[s.procedure_type], s.side].filter(Boolean).join(' ')}`,
    s.surgery_date && `תאריך ניתוח: ${formatDate(s.surgery_date)}`,
    s.anaesthesia_note && `מרדים: ${s.anaesthesia_note}`,
    s.notes && `הערות: ${s.notes}`,
  ]
    .filter(Boolean)
    .join('\n')
  const events: CalEvent[] = []
  if (s.ct_date)
    events.push({
      uid: `${s.id}-ct`,
      title: `סריקת CT — ${s.patient_name}`,
      date: s.ct_date,
      time: s.ct_time,
      location: s.hospital?.name,
      description: detail,
    })
  if (s.rescan && s.rescan_date)
    events.push({
      uid: `${s.id}-rescan`,
      title: `סריקה חוזרת — ${s.patient_name}`,
      date: s.rescan_date,
      location: s.hospital?.name,
      description: `${s.rescan_reason ? `סיבה: ${s.rescan_reason}\n` : ''}${detail}`,
    })
  return events
}
