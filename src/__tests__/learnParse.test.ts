import { describe, expect, it } from 'vitest'
import { parseCards } from '../lib/learnParse'

describe('parseCards', () => {
  it('reads tab-separated question and answer, and drops duplicates and empty lines', () => {
    const cards = parseCards('מה זה?\tתשובה\nמה זה?\tאחרת\n\nשאלה שנייה\tתשובה ב')
    expect(cards.map((c) => c.question)).toEqual(['מה זה?', 'שאלה שנייה'])
    expect(cards[0].answer).toBe('תשובה')
  })
  it('reads an extended row: question, correct, three wrong, explanation', () => {
    const [c] = parseCards('Q\tright\tw1\tw2\tw3\tbecause')
    expect(c.answer).toBe('right')
    expect(c.wrong).toEqual(['w1', 'w2', 'w3'])
    expect(c.explanation).toBe('because')
  })
  it('reads the "question - answer" format', () => {
    const [c] = parseCards('מה הבירה - ירושלים', 'dash')
    expect(c.question).toBe('מה הבירה')
    expect(c.answer).toBe('ירושלים')
  })
  it('an empty text gives nothing', () => {
    expect(parseCards('   ')).toEqual([])
  })
})
