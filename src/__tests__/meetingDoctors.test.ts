import { describe, expect, it } from 'vitest'
import { mentionedDoctors, unknownDoctors } from '../lib/meetingDoctors'

const doctors = [
  { id: 'd1', name: 'יוסי כהן', title: 'דוקטור', phone: '', email: '' },
  { id: 'd2', name: 'בן לולו אבישלום', title: 'דוקטור', phone: '', email: '' },
]

describe('doctors named in a meeting text', () => {
  it('finds a title and a name, with the usual ways of writing ד"ר and פרופ׳', () => {
    expect(mentionedDoctors('נפגשתי עם ד"ר לוי ועם פרופ׳ שפירא')).toEqual([{ title: 'ד״ר', name: 'לוי' }, { title: 'פרופ׳', name: 'שפירא' }])
    expect(mentionedDoctors('דר מזרחי הציג')).toEqual([{ title: 'ד״ר', name: 'מזרחי' }])
    expect(mentionedDoctors("פרופ' אברמוביץ")).toEqual([{ title: 'פרופ׳', name: 'אברמוביץ' }])
  })
  it('takes a first and a last name, but not the verb that follows the name', () => {
    expect(mentionedDoctors('ד"ר דוד לוי אמר שהוא מעוניין')).toEqual([{ title: 'ד״ר', name: 'דוד לוי' }])
    expect(mentionedDoctors('ד"ר לוי ביקש הצעה')).toEqual([{ title: 'ד״ר', name: 'לוי' }])
    expect(mentionedDoctors('נפגשנו עם ד"ר רוזנברג שביקש הדגמה')).toEqual([{ title: 'ד״ר', name: 'רוזנברג' }])
    expect(mentionedDoctors('ד"ר דוד לוי ושלח מייל')).toEqual([{ title: 'ד״ר', name: 'דוד לוי' }])
    expect(mentionedDoctors('פרופ׳ שפירא')).toEqual([{ title: 'פרופ׳', name: 'שפירא' }])
  })
  it('lists a name once', () => {
    expect(mentionedDoctors('ד"ר לוי, ושוב ד"ר לוי')).toHaveLength(1)
  })
  it('does not take a title without a name or a title inside a word', () => {
    expect(mentionedDoctors('הוא רופא ודר')).toEqual([])
    expect(mentionedDoctors('אנדרטה פרופיל')).toEqual([])
  })
})

describe('doctors that are not in the system', () => {
  it('a doctor who exists is not offered, also by his last name only', () => {
    expect(unknownDoctors('ד"ר כהן ביקש הצעה', doctors)).toEqual([])
    expect(unknownDoctors('ד"ר יוסי כהן', doctors)).toEqual([])
  })
  it('a doctor who does not exist is offered', () => {
    expect(unknownDoctors('ד"ר לוי ביקש הצעה', doctors)).toEqual([{ title: 'ד״ר', name: 'לוי' }])
  })
  it('a name the person said no to is not offered again', () => {
    expect(unknownDoctors('ד"ר לוי', doctors, new Set(['לוי']))).toEqual([])
  })
})
