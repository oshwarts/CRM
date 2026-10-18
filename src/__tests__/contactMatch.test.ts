import { describe, expect, it } from 'vitest'
import { detectRole, hasTitle, matchDoctors, normalizeHe, stripTitle } from '../lib/contactMatch'

describe('normalizeHe', () => {
  it('ignores quotes, dots and dashes', () => {
    expect(normalizeHe('ד"ר  בן-לולו.')).toBe('דר בן לולו')
  })
})

describe('titles', () => {
  it('finds and strips a title word', () => {
    expect(hasTitle('דר בן לולו')).toBe(true)
    expect(stripTitle('דר בן לולו')).toBe('בן לולו')
    expect(hasTitle('בן לולו')).toBe(false)
  })
})

describe('detectRole', () => {
  it('knows a secretary and purchasing', () => {
    expect(detectRole('מזכירת ברזילי אורתופדיה')).not.toBe('')
    expect(detectRole('רכש העמק')).not.toBe('')
  })
  it('a nurse of the operating room is found, but "אחראי" (in charge) is not a nurse', () => {
    expect(detectRole('דנה אח חדר ניתוח')).toBe('אח חדר ניתוח')
    expect(detectRole('אחראי ניתוחים')).not.toBe('אח חדר ניתוח')
  })
  it('a plain name has no role', () => {
    expect(detectRole('יוסי כהן')).toBe('')
  })
})

describe('matchDoctors', () => {
  const doctors = [
    { id: '1', name: 'בן לולו', title: 'דר', phone: '', email: '' },
    { id: '2', name: 'כהן', title: 'דר', phone: '', email: '' },
  ]
  it('finds the doctor whose name is in the contact', () => {
    const r = matchDoctors('דר בן לולו', doctors)
    expect(r[0]?.item.id).toBe('1')
  })
  it('finds nothing for an unrelated name', () => {
    expect(matchDoctors('משה לוי', doctors).length).toBe(0)
  })
})
