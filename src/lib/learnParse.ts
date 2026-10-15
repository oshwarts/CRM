// Reads question/answer pairs from text the user pastes or uploads (a Quizlet export, a CSV, a tab-separated list).
// Everything happens in the browser.

/** wrong answers and an explanation are present when the row has the extended columns */
export type ParsedCard = { question: string; answer: string; wrong?: string[]; explanation?: string }

/** splits delimited text into rows of cells; quoted cells may hold the separator and line breaks ("" = a quote) */
function parseDelimited(text: string, sep: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"' && cell === '') quoted = true
    else if (c === sep) {
      row.push(cell)
      cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += c
  }
  if (cell !== '' || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

export type Separator = 'auto' | 'tab' | 'comma' | 'semicolon' | 'dash'

/** guesses the separator: a tab if any line has one (the Quizlet export default), else a semicolon, else a comma */
function detect(text: string): Exclude<Separator, 'auto' | 'dash'> {
  if (text.includes('\t')) return 'tab'
  const first = text.split(/\r?\n/).filter(Boolean).slice(0, 5)
  if (first.length && first.every((l) => l.includes(';'))) return 'semicolon'
  return 'comma'
}

export function parseCards(text: string, sep: Separator = 'auto'): ParsedCard[] {
  const clean = text.replace(/^﻿/, '').trim()
  if (!clean) return []
  let rows: string[][]
  if (sep === 'dash') {
    rows = clean.split(/\r?\n/).flatMap((l) => {
      const i = l.search(/\s[-–—]\s/)
      return i > 0 ? [[l.slice(0, i), l.slice(i).replace(/^\s[-–—]\s/, '')]] : []
    })
  } else {
    const s = sep === 'auto' ? detect(clean) : sep
    rows = parseDelimited(clean, { tab: '\t', comma: ',', semicolon: ';' }[s])
  }
  const seen = new Set<string>()
  const out: ParsedCard[] = []
  for (const r of rows) {
    const question = (r[0] ?? '').trim()
    const key = question.toLowerCase()
    if (!question || seen.has(key)) continue
    // extended row: question, correct answer, 3 wrong answers, explanation (tab-separated, 5 or 6 columns)
    if (r.length >= 5 && (sep === 'tab' || (sep === 'auto' && clean.includes('\t')))) {
      const answer = (r[1] ?? '').trim()
      if (!answer) continue
      seen.add(key)
      out.push({ question, answer, wrong: r.slice(2, 5).map((w) => w.trim()).filter(Boolean), explanation: (r[5] ?? '').trim() })
      continue
    }
    // more than two cells: the answer is everything after the first cell (an unquoted comma inside the answer)
    const answer = r.slice(1).join(sep === 'comma' || (sep === 'auto' && !clean.includes('\t')) ? ', ' : ' ').trim()
    if (!answer) continue
    seen.add(key)
    out.push({ question, answer })
  }
  return out
}
