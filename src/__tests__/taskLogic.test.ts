import { describe, expect, it } from 'vitest'
import { bucketOf, compareOpen, dueLabel, nextDue, taskError } from '../lib/taskLogic'

// Tuesday 2026-10-20, a quarter past midnight: the local day must be used (not UTC)
const now = new Date(2026, 9, 20, 0, 15)

describe('bucketOf', () => {
  it('splits at the day boundaries', () => {
    expect(bucketOf('2026-10-19', now)).toBe('overdue')
    expect(bucketOf('2026-10-20', now)).toBe('today')
    expect(bucketOf('2026-10-21', now)).toBe('week')
    expect(bucketOf('2026-10-27', now)).toBe('week') // +7 is still "this week"
    expect(bucketOf('2026-10-28', now)).toBe('later') // +8
    expect(bucketOf(null, now)).toBe('none')
    expect(bucketOf('', now)).toBe('none')
    expect(bucketOf('not a date', now)).toBe('none')
  })
  it('is the same just before midnight', () => {
    const late = new Date(2026, 9, 20, 23, 59)
    expect(bucketOf('2026-10-20', late)).toBe('today')
    expect(bucketOf('2026-10-19', late)).toBe('overdue')
  })
  it('handles a daylight-saving change (clocks go back 2026-10-25 in Israel)', () => {
    expect(bucketOf('2026-10-26', new Date(2026, 9, 25, 12))).toBe('week')
    expect(bucketOf('2026-10-25', new Date(2026, 9, 25, 0, 30))).toBe('today')
  })
})

describe('dueLabel', () => {
  it('names the near days', () => {
    expect(dueLabel('2026-10-20', now)).toBe('היום')
    expect(dueLabel('2026-10-21', now)).toBe('מחר')
    expect(dueLabel('2026-10-19', now)).toBe('אתמול')
    expect(dueLabel('2026-10-17', now)).toBe('לפני 3 ימים · 17/10')
    expect(dueLabel('2026-10-22', now)).toBe('יום חמישי 22/10')
    expect(dueLabel('2026-10-26', now)).toBe('יום שני 26/10')
    expect(dueLabel('2026-11-09', now)).toBe('09/11/2026')
    expect(dueLabel('2026-01-02', now)).toBe('02/01/2026')
    expect(dueLabel(null, now)).toBe('')
  })
})

describe('compareOpen', () => {
  const t = (priority: string, due_date: string | null, created_at = '2026-01-01') => ({ priority, due_date, created_at })
  it('urgent first, then the nearest date, no date last, then the newest', () => {
    const rows = [t('normal', null), t('normal', '2026-10-25'), t('urgent', '2026-10-30'), t('normal', '2026-10-21'), t('urgent', null), t('normal', '2026-10-21', '2026-02-01')]
    const sorted = [...rows].sort(compareOpen).map((r) => `${r.priority[0]}${r.due_date ?? '-'}${r.created_at === '2026-02-01' ? '*' : ''}`)
    expect(sorted).toEqual(['u2026-10-30', 'u-', 'n2026-10-21*', 'n2026-10-21', 'n2026-10-25', 'n-'])
  })
})

describe('nextDue', () => {
  it('weekly: a week after the due date', () => {
    expect(nextDue('2026-10-23', 'weekly', now)).toBe('2026-10-30')
  })
  it('weekly: an overdue task counts from today', () => {
    expect(nextDue('2026-09-01', 'weekly', now)).toBe('2026-10-27')
  })
  it('monthly clamps to the end of the month (31 Jan → 28 Feb, leap year 29 Feb)', () => {
    expect(nextDue('2027-01-31', 'monthly', new Date(2027, 0, 5))).toBe('2027-02-28')
    expect(nextDue('2028-01-31', 'monthly', new Date(2028, 0, 5))).toBe('2028-02-29')
    expect(nextDue('2026-12-15', 'monthly', new Date(2026, 11, 1))).toBe('2027-01-15') // year change
  })
  it('monthly from a 30th into a 31-day month', () => {
    expect(nextDue('2026-10-30', 'monthly', now)).toBe('2026-11-30')
  })
  it('a task due today repeats from today', () => {
    expect(nextDue('2026-10-20', 'weekly', now)).toBe('2026-10-27')
  })
})

describe('taskError', () => {
  it('turns the database wording into Hebrew', () => {
    expect(taskError({ message: 'new row violates row-level security policy for table "meeting_tasks"' }, 'x')).toBe('אין לך הרשאה לבצע את הפעולה הזו')
    expect(taskError(new Error('permission denied for table meeting_tasks'), 'x')).toBe('אין לך הרשאה לבצע את הפעולה הזו')
  })
  it('keeps a Hebrew message and falls back for other English ones', () => {
    expect(taskError(new Error('הרשומה נמחקה על ידי משתמש אחר'), 'x')).toBe('הרשומה נמחקה על ידי משתמש אחר')
    expect(taskError({ message: 'duplicate key value' }, 'השמירה נכשלה')).toBe('השמירה נכשלה')
    expect(taskError(undefined, 'השמירה נכשלה')).toBe('השמירה נכשלה')
  })
})
