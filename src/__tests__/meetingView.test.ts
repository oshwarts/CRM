import { describe, expect, it } from 'vitest'
import { buildMailto, buildOutlookWebUrl, composeMail, normalizeRecipients } from '../lib/mail'
import { meetingMailText } from '../lib/meetingMail'
import type { MeetingWithRelations } from '../lib/types'

const meeting = (o: Record<string, unknown> = {}) =>
  ({
    id: 'm', subject: 'הדגמה', meeting_date: '2026-10-24', meeting_time: '09:30:00', status: 'scheduled', location: '', summary: '', decisions: '',
    next_followup_date: null, hospital: { id: 'h', name: 'שיבא' }, responsible_agent: { id: 'u', full_name: 'דנה' },
    meeting_doctors: [{ doctor: { id: 'd', name: 'יוסי כהן', title: 'ד״ר' } }], meeting_contacts: [], meeting_agents: [], meeting_tasks: [], extra_participants: '',
    ...o,
  }) as unknown as MeetingWithRelations

describe('normalizeRecipients', () => {
  it('splits on comma, semicolon and spaces and keeps a clean comma list', () => {
    expect(normalizeRecipients('a@x.co.il ; b@y.com,  c@z.org').list).toBe('a@x.co.il,b@y.com,c@z.org')
  })
  it('reports what is not an address', () => {
    expect(normalizeRecipients('a@x.co, bad, @x.co, a@b').invalid).toEqual(['bad', '@x.co', 'a@b'])
  })
  it('empty input is an empty list with nothing invalid', () => {
    expect(normalizeRecipients('  ')).toEqual({ list: '', invalid: [] })
  })
})

describe('mail links', () => {
  it('keeps the comma between recipients readable in both links', () => {
    expect(buildMailto('a@x.co,b@y.co', 's', 'b').url.startsWith('mailto:a@x.co,b@y.co?subject=')).toBe(true)
    expect(buildOutlookWebUrl('a@x.co,b@y.co', 's', 'b')).toContain('compose?to=a@x.co,b@y.co&subject=')
  })
  it('a short body goes in full, a long one falls back to the paste note in each link on its own limit', () => {
    const short = composeMail('', 's', 'שלום')
    expect(short.mailto.mode).toBe('full')
    expect(short.outlook.mode).toBe('full')
    const mid = composeMail('', 's', 'א'.repeat(400)) // ~4800 chars encoded: too long for mailto, fine for Outlook web
    expect(mid.mailto.mode).toBe('copied')
    expect(mid.outlook.mode).toBe('full')
    const long = composeMail('', 's', 'א'.repeat(2000))
    expect(long.outlook.mode).toBe('copied')
    expect(long.outlook.url.length).toBeLessThan(1000)
  })
  it('line breaks become CRLF and nothing breaks the query string', () => {
    const u = buildMailto('', 'a&b=c', 'x&y\nz').url
    expect(u).toContain('subject=a%26b%3Dc')
    expect(u).toContain('body=x%26y%0D%0Az')
  })
})

describe('meetingMailText', () => {
  it('subject: place and date; body: the facts of the meeting in Hebrew', () => {
    const r = meetingMailText(meeting({ summary: 'סיכום', decisions: 'להחליט', next_followup_date: '2026-11-01' }), 'עומר')
    expect(r.subject).toBe('סיכום פגישה – שיבא – 24/10/2026')
    expect(r.body).toContain('סיכום פגישה: הדגמה')
    expect(r.body).toContain('תאריך: 24/10/2026 09:30')
    expect(r.body).toContain('רופאים: ד״ר יוסי כהן')
    expect(r.body).toContain('מעקב הבא: 01/11/2026')
    expect(r.body.endsWith('בברכה,\nעומר')).toBe(true)
  })
  it('drops the "imported from e-mail" marker line and never mentions competitors', () => {
    const r = meetingMailText(meeting({ summary: 'יובא ממייל: from=a@b.co\n\nהתוכן', competitor_notes: 'המתחרה נותן הנחה' }), '')
    expect(r.body).not.toContain('יובא ממייל')
    expect(r.body).not.toContain('a@b.co')
    expect(r.body).toContain('התוכן')
    expect(r.body).not.toContain('המתחרה')
    expect(r.body).not.toContain('בברכה')
  })
  it('no hospital: the doctor names the subject; nothing at all: a bare subject; tasks show their state', () => {
    expect(meetingMailText(meeting({ hospital: null }), '').subject).toBe('סיכום פגישה – ד״ר יוסי כהן – 24/10/2026')
    expect(meetingMailText(meeting({ hospital: null, meeting_doctors: [], meeting_date: null }), '').subject).toBe('סיכום פגישה')
    const t = meetingMailText(
      meeting({ meeting_tasks: [{ description: 'א', is_done: true, due_date: '2026-10-25' }, { description: 'ב', is_done: false, due_date: null }] }),
      '',
    )
    expect(t.body).toContain('• א (עד 25/10/2026) — בוצע')
    expect(t.body).toContain('• ב')
  })
  it('a broken doctor join is skipped, an empty subject says "פגישה"', () => {
    const r = meetingMailText(meeting({ subject: '', meeting_doctors: [{ doctor: null }] }), '')
    expect(r.body).toContain('סיכום פגישה: פגישה')
    expect(r.body).not.toContain('רופאים:')
  })
})
