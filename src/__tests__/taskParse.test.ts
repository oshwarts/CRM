import { describe, expect, it } from 'vitest'
import { guessTask } from '../lib/taskParse'

// 2026-10-18 is a Sunday
const today = new Date('2026-10-18T10:00:00')
const doctors = [
  { id: 'd1', name: 'יוסי כהן', title: 'ד״ר' },
  { id: 'd2', name: 'דוד לוי', title: 'פרופ׳' },
  { id: 'd3', name: 'משה שוחט' },
  { id: 'd5', name: 'יוסי לוי' },
  { id: 'd6', name: 'רונית בר-לב' },
]
const hospitals = [
  { id: 'h1', name: 'שיבא – תל השומר', city: 'רמת גן' },
  { id: 'h2', name: 'איכילוב – מרכז רפואי תל אביב', city: 'תל אביב' },
  { id: 'h3', name: 'אסותא אשדוד', city: 'אשדוד' },
]
const g = (text: string) => guessTask(text, { today, doctors, hospitals })

describe('guessTask', () => {
  it('finds "tomorrow" and urgency and removes them from the text', () => {
    const r = guessTask('לשלוח הצעה לשוחט מחר דחוף', { today })
    expect(r.due_date).toBe('2026-10-19')
    expect(r.priority).toBe('urgent')
    expect(r.description).toContain('לשלוח הצעה')
    expect(r.description).not.toContain('דחוף')
  })
  it('understands a weekday: the next Thursday', () => {
    expect(guessTask('להתקשר ליום חמישי', { today }).due_date).toBe('2026-10-22')
  })
  it('understands repetition', () => {
    expect(guessTask('לספור מתכלים כל שבוע', { today }).recurrence).toBe('weekly')
    expect(guessTask('דוח כל חודש', { today }).recurrence).toBe('monthly')
  })
  it('keeps a clock time in the text', () => {
    expect(guessTask('פגישה ב14:30 במשרד', { today }).description).toContain('14:30')
  })
  it('finds the doctor and the hospital by name', () => {
    const r = guessTask('לעדכן את שוחט באיכילוב', { today, doctors: [{ id: 'd1', name: 'שוחט' }], hospitals: [{ id: 'h1', name: 'איכילוב' }] })
    expect(r.doctor_id).toBe('d1')
    expect(r.hospital_id).toBe('h1')
  })
  it('a text with nothing special has no date and no priority', () => {
    const r = guessTask('לבדוק את המלאי', { today })
    expect(r.due_date).toBeNull()
    expect(r.priority).toBeNull()
  })

  describe('dates', () => {
    it('"עד מחר" / "למחר" / "למחרתיים" take the preposition with them', () => {
      expect(g('לשלוח עד מחר הצעה לשוחט').description).toBe('לשלוח הצעה לשוחט')
      expect(g('להתקשר למחר')).toMatchObject({ due_date: '2026-10-19', description: 'להתקשר' })
      expect(g('להתקשר למחרתיים').due_date).toBe('2026-10-20')
    })
    it('"בעוד" with words and numbers', () => {
      expect(g('בעוד שלושה ימים להתקשר').due_date).toBe('2026-10-21')
      expect(g('להתקשר בעוד 10 ימים').due_date).toBe('2026-10-28')
      expect(g('להתקשר בעוד 2 שבועות').due_date).toBe('2026-11-01')
      expect(g('בעוד יומיים לחדש').due_date).toBe('2026-10-20')
      expect(g('בעוד חודשיים לחדש חוזה').due_date).toBe('2026-12-18')
      expect(g('בעוד חודש לחדש').due_date).toBe('2026-11-18')
    })
    it('a weekday, with and without "next" / "next week"', () => {
      expect(g('ביום חמישי הבא פגישה')).toMatchObject({ due_date: '2026-10-22', description: 'פגישה' })
      expect(g('חמישי בשבוע הבא להתקשר')).toMatchObject({ due_date: '2026-10-29', description: 'להתקשר' })
      expect(g('ביום ד׳ לשלוח').due_date).toBe('2026-10-21')
      expect(g("ביום ה' לשלוח").due_date).toBe('2026-10-22')
      expect(g('בשבת לנוח').due_date).toBe('2026-10-24')
      // the same weekday as today means next week, never today
      expect(g('להתקשר ביום ראשון').due_date).toBe('2026-10-25')
    })
    it('a bare "third" is an ordinal, not a weekday', () => {
      expect(g('להקים שלישי מרכז').due_date).toBeNull()
    })
    it('day + month, with and without a year, with "ביום"', () => {
      expect(g('לשלוח ב-31 בינואר').due_date).toBe('2027-01-31')
      expect(g('לשלוח 3 מערכות עד 20 בדצמבר 2026')).toMatchObject({ due_date: '2026-12-20', description: 'לשלוח 3 מערכות' })
      expect(g('להזמין ביום 1 בנובמבר')).toMatchObject({ due_date: '2026-11-01', description: 'להזמין' })
      // a date that already passed this year means next year
      expect(g('לשלוח ב-5 באוקטובר').due_date).toBe('2027-10-05')
    })
    it('an impossible date is not a date', () => {
      expect(g('32 בינואר').due_date).toBeNull()
      expect(g('30 בפברואר').due_date).toBeNull()
    })
    it('numeric dates: d/m, "עד d.m", but not a decimal or a fraction', () => {
      expect(g('לשלוח 5/12 הצעה')).toMatchObject({ due_date: '2026-12-05', description: 'לשלוח הצעה' })
      expect(g('לשלוח עד 5.12').due_date).toBe('2026-12-05')
      expect(g('לשלוח 5.12.27').due_date).toBe('2027-12-05')
      expect(g('להזמין 2.5 מטר כבל').due_date).toBeNull()
      expect(g('לקנות 1/2 קילו').due_date).toBeNull()
    })
    it('end of month / end of week', () => {
      expect(g('סוף החודש לשלוח דוח').due_date).toBe('2026-10-31')
      expect(g('עד סוף השבוע לסכם').due_date).toBe('2026-10-22')
    })
    it('a clock time is kept in the text and is not a date', () => {
      const r = g('להתקשר מחר ב-10:00')
      expect(r.due_date).toBe('2026-10-19')
      expect(r.description).toContain('10:00')
    })
    it('"3 בתי חולים" is not a date', () => {
      expect(g('לשלוח הצעת מחיר ל-3 בתי חולים').due_date).toBeNull()
    })
  })

  describe('urgency and repetition', () => {
    it('"לא דחוף" is not urgent; "דחוף מאוד" is, and "מאוד" goes with it', () => {
      expect(g('לא דחוף לבדוק מלאי').priority).toBeNull()
      expect(g('דחוף מאוד להתקשר')).toMatchObject({ priority: 'urgent', description: 'להתקשר' })
    })
    it('"every Sunday" repeats weekly and starts on the next Sunday', () => {
      expect(g('כל יום ראשון לספור מתכלים')).toMatchObject({ recurrence: 'weekly', due_date: '2026-10-25', description: 'לספור מתכלים' })
      expect(g('כל יום ד׳ בדיקה')).toMatchObject({ recurrence: 'weekly', due_date: '2026-10-21' })
    })
    it('other ways to say weekly / monthly', () => {
      expect(g('מדי שבוע לשלוח דוח').recurrence).toBe('weekly')
      expect(g('פעם בחודש לבדוק').recurrence).toBe('monthly')
      expect(g('דוח חודשי')).toMatchObject({ recurrence: 'monthly', description: 'דוח' })
      expect(g('דוח שבועית דחוף')).toMatchObject({ recurrence: 'weekly', priority: 'urgent' })
    })
  })

  describe('doctors and hospitals', () => {
    it('full name, first name only (when unique), title + short surname', () => {
      expect(g('להתקשר עם רונית בר-לב').doctor_id).toBe('d6')
      expect(g('להתקשר לדוד לוי מחר').doctor_id).toBe('d2')
      expect(g('להתקשר לד״ר כהן').doctor_id).toBe('d1')
      expect(g('להתקשר לשוחט!').doctor_id).toBe('d3')
    })
    it('an ambiguous name points at nobody', () => {
      expect(g('להתקשר ליוסי').doctor_id).toBeNull() // two Yossis
      expect(g('להתקשר ללוי').doctor_id).toBeNull() // two Levis
      expect(g('לפגוש את הכהן').doctor_id).toBeNull() // short surname without a title
    })
    it('a hospital by name; the city alone does not name a hospital', () => {
      expect(g('להגיע לשיבא ביום ג׳')).toMatchObject({ hospital_id: 'h1', due_date: '2026-10-20' })
      expect(g('להגיע לאסותא').hospital_id).toBe('h3')
      expect(g('פגישה בתל אביב').hospital_id).toBeNull()
      expect(g('להגיע לאשדוד').hospital_id).toBeNull()
      expect(g('פגישה באיכילוב').hospital_id).toBe('h2')
    })
  })

  describe('awkward input', () => {
    it('only the date → the description falls back to the text, never empty', () => {
      expect(g('  מחר  ').description).toBe('מחר')
      expect(g('עד היום').description).toBe('עד היום')
    })
    it('nothing found for plain text, empty text, emoji and English', () => {
      expect(g('').found).toEqual([])
      expect(g('Send MAKO quote 🚀 +2.5%').found).toEqual([])
      expect(g('שלום').description).toBe('שלום')
    })
  })
})
