import type { LearnCard } from './types'

// Builds practice items from the cards of a topic — all in the browser, no AI: true/false statements, fill-in-the-blank
// questions and matching rounds.

export function shuffle<T>(list: T[]): T[] {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const norm = (s: string) => s.trim().toLowerCase()

/* ---------------------------------------------------------------- true / false */

export type TFItem = { card: LearnCard; shown: string; truth: boolean }

/** half of the statements pair the question with its own answer, half with a wrong one (the card's own or another card's) */
export function buildTrueFalse(cards: LearnCard[], count: number): TFItem[] {
  if (cards.length < 2) return []
  const pick = shuffle(cards).slice(0, count)
  return pick.map((card, i) => {
    const truth = i % 2 === 0
    if (truth) return { card, shown: card.answer, truth }
    const own = (card.wrong_options ?? []).filter((w) => w.trim() && norm(w) !== norm(card.answer))
    const others = cards.filter((c) => c.id !== card.id && norm(c.answer) !== norm(card.answer)).map((c) => c.answer)
    const wrong = own.length ? shuffle(own)[0] : shuffle(others)[0]
    return wrong ? { card, shown: wrong, truth: false } : { card, shown: card.answer, truth: true }
  }).sort(() => Math.random() - 0.5)
}

/* ---------------------------------------------------------------- fill in the blank */

export type ClozeItem = { card: LearnCard; text: string; correct: string; options: string[] }

type Token = { text: string; start: number; end: number; kind: 'num' | 'term' | 'word' }

const NUM = /(?<![\p{L}\d])\d+(?:[.,]\d+)?(?:\s?(?:%|°|mm|MRad|MRads|years?|degrees?|kg|N))?/gu
const TERM = /\b[A-Z][A-Za-z0-9\-]{2,}\b/g
const WORD = /[\p{L}]{8,}/gu

function tokensOf(text: string): Token[] {
  const out: Token[] = []
  for (const m of text.matchAll(NUM)) out.push({ text: m[0], start: m.index!, end: m.index! + m[0].length, kind: 'num' })
  for (const m of text.matchAll(TERM)) if (m.index! > 0) out.push({ text: m[0], start: m.index!, end: m.index! + m[0].length, kind: 'term' })
  for (const m of text.matchAll(WORD)) out.push({ text: m[0], start: m.index!, end: m.index! + m[0].length, kind: 'word' })
  return out
}

/** other numbers close to this one (when the topic has too few numbers of its own) */
function nearNumbers(n: string): string[] {
  const m = n.match(/^(\d+(?:[.,]\d+)?)(.*)$/)
  if (!m) return []
  const v = Number(m[1].replace(',', '.'))
  const unit = m[2]
  const cands = [v * 2, Math.round(v / 2), v + 10, Math.max(1, v - 10), v + 5, Math.round(v * 1.5)].filter((x) => x > 0 && x !== v)
  return [...new Set(cands.map((x) => `${Number.isInteger(x) ? x : x.toFixed(1)}${unit}`))]
}

export function buildCloze(cards: LearnCard[], count: number): ClozeItem[] {
  // the pool of possible wrong answers, per kind of token, from all the answers of the topic
  const pool: Record<Token['kind'], Set<string>> = { num: new Set(), term: new Set(), word: new Set() }
  for (const c of cards) for (const t of tokensOf(c.answer)) pool[t.kind].add(t.text.trim())
  const items: ClozeItem[] = []
  for (const card of shuffle(cards)) {
    if (items.length >= count) break
    if (card.answer.length < 25) continue
    const toks = tokensOf(card.answer)
    // the most informative blank first: a number, then a term, then a long word
    const order: Token['kind'][] = ['num', 'term', 'word']
    let chosen: Token | undefined
    for (const kind of order) {
      const options = toks.filter((t) => t.kind === kind)
      if (options.length) {
        chosen = shuffle(options)[0]
        break
      }
    }
    if (!chosen) continue
    const correct = chosen.text.trim()
    let wrong = shuffle([...pool[chosen.kind]].filter((x) => norm(x) !== norm(correct)))
    if (chosen.kind === 'num' && wrong.length < 3) wrong = [...wrong, ...nearNumbers(correct)].filter((x, i, a) => norm(x) !== norm(correct) && a.indexOf(x) === i)
    if (wrong.length < 3) continue
    const text = card.answer.slice(0, chosen.start) + '_____' + card.answer.slice(chosen.end)
    items.push({ card, text, correct, options: shuffle([correct, ...wrong.slice(0, 3)]) })
  }
  return items
}

/* ---------------------------------------------------------------- matching */

/** one round: a few cards whose question and answer are short enough to be matched on screen */
export function buildMatchRound(cards: LearnCard[], size = 5): LearnCard[] {
  const short = shuffle(cards.filter((c) => c.question.length <= 160 && c.answer.length <= 160))
  const pool = short.length >= 3 ? short : shuffle(cards)
  const seen = new Set<string>()
  const round: LearnCard[] = []
  for (const c of pool) {
    // two cards with the same answer cannot be told apart
    if (seen.has(norm(c.answer))) continue
    seen.add(norm(c.answer))
    round.push(c)
    if (round.length >= size) break
  }
  return round
}
