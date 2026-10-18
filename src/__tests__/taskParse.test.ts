import { describe, expect, it } from 'vitest'
import { guessTask } from '../lib/taskParse'

// 2026-10-18 is a Sunday
const today = new Date('2026-10-18T10:00:00')

describe('guessTask', () => {
  it('finds "tomorrow" and urgency and removes them from the text', () => {
    const g = guessTask('לשלוח הצעה לשוחט מחר דחוף', { today })
    expect(g.due_date).toBe('2026-10-19')
    expect(g.priority).toBe('urgent')
    expect(g.description).toContain('לשלוח הצעה')
    expect(g.description).not.toContain('דחוף')
  })
  it('understands a weekday: the next Thursday', () => {
    const g = guessTask('להתקשר ליום חמישי', { today })
    expect(g.due_date).toBe('2026-10-22')
  })
  it('understands repetition', () => {
    expect(guessTask('לספור מתכלים כל שבוע', { today }).recurrence).toBe('weekly')
    expect(guessTask('דוח כל חודש', { today }).recurrence).toBe('monthly')
  })
  it('keeps a clock time in the text', () => {
    expect(guessTask('פגישה ב14:30 במשרד', { today }).description).toContain('14:30')
  })
  it('finds the doctor and the hospital by name', () => {
    const g = guessTask('לעדכן את שוחט באיכילוב', { today, doctors: [{ id: 'd1', name: 'שוחט' }], hospitals: [{ id: 'h1', name: 'איכילוב' }] })
    expect(g.doctor_id).toBe('d1')
    expect(g.hospital_id).toBe('h1')
  })
  it('a text with nothing special has no date and no priority', () => {
    const g = guessTask('לבדוק את המלאי', { today })
    expect(g.due_date).toBeNull()
    expect(g.priority).toBeNull()
  })
})
