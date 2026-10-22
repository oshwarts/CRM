// Rule-based reading of a surgery referral — no AI, nothing leaves the system.
// Details are scattered over three places, so all three are searched:
//   1. the file name   "אברג'ל תקוה, 051542207, מכבי, הראל LT TKR.doc"
//   2. the WhatsApp message  (name / phone / "ברך שמאל" / "22/10" / "אסותא תא")
//   3. the text of the attached document (surgeon signature, hospital, anesthesia, CT…)

import { looseKey, matchDoctors, matchHospitals, normalizeHe } from './contactMatch'
import { normalizePhone } from './contactImport'
import { HEALTH_FUNDS, SCAN_PROCEDURE_LABELS, type PatientScanRow } from './types'
import { formatDate } from './utils'

export type ParsedReferral = {
  patient_name: string
  patient_id_number: string
  patient_phone: string
  health_fund: string
  insurance: string
  procedure_type: '' | 'knee' | 'uni' | 'hip'
  side: '' | 'ימין' | 'שמאל'
  surgery_date: string
  hospital_id: string
  surgeon_id: string
  notes: string
}

type Doc = { id: string; name: string; title: string }
type Hosp = { id: string; name: string }

const INSURERS = ['הראל', 'הפניקס', 'מגדל', 'כלל', 'מנורה', 'איילון', 'הכשרה', 'שלמה', 'AIG', 'שירביט', 'ליברה', 'ביטוח ישיר']
const DOCTOR_TITLES = ['דר', 'פרופ', 'פרופסור', 'דוקטור']

const pad = (n: number) => String(n).padStart(2, '0')
const toIso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`

/** Israeli ID check digit */
export function validIsraeliId(id: string): boolean {
  if (!/^\d{9}$/.test(id)) return false
  let sum = 0
  for (let i = 0; i < 9; i++) {
    let v = Number(id[i]) * ((i % 2) + 1)
    if (v > 9) v -= 9
    sum += v
  }
  return sum % 10 === 0
}

const firstMatch = (sources: string[], re: RegExp): string => {
  for (const s of sources) {
    const m = s.match(re)
    if (m) return m[0]
  }
  return ''
}

function findSurgeryDate(sources: string[], today: Date): string {
  for (const s of sources) {
    for (const m of s.matchAll(/(?<![\d/.])(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?(?![\d/.])/g)) {
      const d = Number(m[1])
      const mo = Number(m[2])
      if (d < 1 || d > 31 || mo < 1 || mo > 12) continue
      let y: number
      if (m[3]) y = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3])
      else {
        y = today.getFullYear()
        // no year written: the next time this date comes around
        if (new Date(y, mo - 1, d) < new Date(today.getFullYear(), today.getMonth(), today.getDate())) y += 1
      }
      // 31/4 or 30/2 is not a day: keep looking
      const real = new Date(y, mo - 1, d)
      if (real.getMonth() !== mo - 1 || real.getDate() !== d) continue
      return toIso(y, mo, d)
    }
  }
  return ''
}

function findProcedure(sources: string[]): ParsedReferral['procedure_type'] {
  const text = sources.join('\n')
  const uni = /\b(UKR|UKA|PKA)\b|יוני|חלקית|unicompartmental/i.test(text)
  const knee = /\b(TKR|TKA)\b|החלפת ברך|ברך\s*(שמאל|ימין)|ברך מלאה/i.test(text)
  const hip = /\b(THR|THA)\b|החלפת ירך|ירך\s*(שמאל|ימין)|פרוטזת ירך/i.test(text)
  if (uni && !hip) return 'uni'
  if (knee && !hip) return 'knee'
  if (hip && !knee && !uni) return 'hip'
  return ''
}

function findSide(sources: string[]): ParsedReferral['side'] {
  const text = sources.join('\n')
  const named = text.match(/(?:ברך|ירך)\s*(שמאל|ימין)/)
  if (named) return named[1] as 'שמאל' | 'ימין'
  if (/(^|[^A-Za-z])(LT|Left)([^A-Za-z]|$)/i.test(text)) return 'שמאל'
  if (/(^|[^A-Za-z])(RT|Right)([^A-Za-z]|$)/i.test(text)) return 'ימין'
  return ''
}

// first plain line that looks like a person's name: Hebrew only, 2–4 words
const NOT_A_NAME = /ברך|ירך|יוני|שמאל|ימין|אסותא|בית חולים|מכבי|כללית|לאומית|מאוחדת|ניתוח|הפני|שלום|תודה|דר|פרופ/
function nameFromMessage(msg: string): string {
  for (const raw of msg.split(/\r?\n/)) {
    const line = raw.trim()
    if (!/^[֐-׿'"׳\- ]+$/.test(line)) continue
    const words = line.split(/\s+/)
    if (words.length < 2 || words.length > 4 || NOT_A_NAME.test(line)) continue
    return line
  }
  return ''
}

/** most frequent value (first one wins ties) */
function mode(values: string[]): string {
  const count = new Map<string, number>()
  for (const v of values) count.set(v, (count.get(v) ?? 0) + 1)
  let best = ''
  let n = 0
  for (const [v, c] of count) if (c > n) [best, n] = [v, c]
  return best
}

function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return dp[a.length][b.length]
}

// Maccabi-style header box:  "שם משפחה: כהן  שם פרטי: אהרון  ת.ז.: 50572775"
function nameFromBox(texts: string[]): string {
  const fam = texts.flatMap((t) => [...t.matchAll(/שם\s*משפחה\s*[:：]\s*([֐-׿'׳-]{2,15})/g)].map((m) => m[1]))
  const first = texts.flatMap((t) => [...t.matchAll(/שם\s*פרטי\s*[:：]\s*([֐-׿'׳-]{2,15})/g)].map((m) => m[1]))
  const f = mode(first)
  return f ? [f, mode(fam)].filter(Boolean).join(' ') : ''
}

function idFromLabel(texts: string[]): string {
  const ids = texts
    .flatMap((t) => [...t.matchAll(/ת\.?\s?ז\.?\s*[:：]?\s*(\d{7,9})(?!\d)/g)].map((m) => m[1].padStart(9, '0')))
  const valid = ids.filter(validIsraeliId)
  return mode(valid.length ? valid : ids)
}

// "שם המטופל: ישראל ישראלי" / "מטופל: …" / "שם: …" written inside the document
function nameFromLabel(text: string): string {
  const m = text.match(/(?:שם\s+ה?מטופל(?:ת)?|מטופל(?:ת)?|שם\s+מלא|שם)\s*[:：]\s*([֐-׿'"׳\- ]{3,40})/)
  if (!m) return ''
  const name = m[1].trim()
  const words = name.split(/\s+/)
  return words.length >= 2 && words.length <= 4 && !NOT_A_NAME.test(name) ? name : ''
}

function nameFromFile(fileName: string): string {
  const base = fileName.replace(/\.[a-z0-9]+$/i, '')
  const part = base.split(',')[0].replace(/[\d]+/g, '').trim()
  return /^[֐-׿'"׳\- ]{3,}$/.test(part) ? part : ''
}

export function parseReferral(opts: {
  fileName: string
  message: string
  fileText: string
  /** the same document read again (other OCR passes) — used to vote on digits */
  altTexts?: string[]
  today: Date
  doctors: Doc[]
  hospitals: Hosp[]
  existing: PatientScanRow[]
}): { draft: Partial<ParsedReferral>; notices: string[] } {
  const { message, today } = opts
  const altTexts = opts.altTexts ?? []
  const allTexts = [opts.fileText, ...altTexts]
  // the imaging institute named on a referral is not the hospital of the surgery
  const fileText = opts.fileText.replace(/שם המכון\s*[:：]?[^\n]*\n?[^\n]*\n?/, '')
  const fname = opts.fileName.replace(/\.[a-z0-9]+$/i, '')
  const notices: string[] = []
  const out: Partial<ParsedReferral> = {}

  // ---- ID
  const ids = [fname, fileText, message].flatMap((s) => [...s.matchAll(/(?<!\d)\d{9}(?!\d)/g)].map((m) => m[0]))
  // the number under "ת.ז." wins; other 9-digit numbers on the paper (referral code, barcodes) only if it is missing
  const labeledId = idFromLabel(allTexts)
  const id = [labeledId, ...ids].find((x) => x && validIsraeliId(x)) || ids[0] || labeledId
  if (id) {
    out.patient_id_number = id
    if (!validIsraeliId(id)) notices.push(`מספר הת״ז ${id} לא עובר בדיקת תקינות — ודא אותו מול ההפנייה.`)
  } else notices.push('ת״ז לא נמצאה.')

  // ---- phone (the anesthesiologist's number sits on a line that says "מרדים")
  const bodyNoAnesthesia = fileText.split(/\r?\n/).filter((l) => !/מרדים/.test(l)).join('\n')
  const phoneRe = /(?<!\d)(?:\+?972[-\s]?|0)5\d[-\s]?\d{3}[-\s]?\d{4}(?!\d)/
  const phone =
    firstMatch([message, fname], phoneRe) ||
    mode(
      [bodyNoAnesthesia, ...altTexts.map((t) => t.split(/\r?\n/).filter((l) => !/מרדים/.test(l)).join('\n'))]
        .flatMap((t) => [...t.matchAll(new RegExp(phoneRe.source, 'g'))].map((m) => normalizePhone(m[0]))),
    )
  if (phone) out.patient_phone = normalizePhone(phone)
  else notices.push('טלפון המטופל לא נמצא.')

  // ---- name
  const nm = nameFromMessage(message) || nameFromBox(allTexts) || nameFromLabel(message + '\n' + fileText)
  const nf = nameFromFile(opts.fileName)
  out.patient_name = nm || nf
  if (!out.patient_name) notices.push('שם המטופל לא זוהה.')
  else if (nm && nf && looseKey(nm) !== looseKey(nf))
    notices.push(`השם שונה בין ההודעה ("${nm}") לשם הקובץ ("${nf}") — נבחר השם מההודעה.`)

  // ---- health fund / insurance
  const fundSources = [fname, message, fileText]
  const fund = HEALTH_FUNDS.find((f) => fundSources.some((s) => s.includes(f)))
  if (fund) out.health_fund = fund
  const firstBodyLines = fileText.split(/\r?\n/).slice(0, 3).join(' ')
  const insurer = INSURERS.find((i) => [fname, message, firstBodyLines].some((s) => new RegExp(`(^|[\\s,])${i}([\\s,]|$)`).test(s)))
  if (insurer) out.insurance = insurer

  // ---- procedure / side (message and file name outrank the long clinical text)
  const near = [message, fname]
  out.procedure_type = findProcedure(near) || findProcedure([fileText])
  if (!out.procedure_type) notices.push('סוג הניתוח (ברך / יוני / ירך) לא זוהה — בחר ידנית.')
  out.side =
    findSide(near) ||
    findSide([fileText.match(/החלפת (?:ברך|ירך)\s*(?:שמאל|ימין)/)?.[0] ?? '']) ||
    // the examination findings ("ממצאים: ברך שמאל – טווח…") name the operated side
    findSide([fileText.match(/ממצאים[\s\S]{0,250}?(?:ברך|ירך)\s*(?:שמאל|ימין)/)?.[0] ?? ''])
  if (!out.side) notices.push('הצד (ימין / שמאל) לא זוהה.')

  // ---- surgery date: from the message / file name; the date at the top of the document is its own date
  const date = findSurgeryDate([message, fname], today)
  if (date) out.surgery_date = date
  else notices.push('תאריך הניתוח לא נמצא בהודעה.')

  // ---- hospital
  const hm = matchHospitals(message, opts.hospitals.map((h) => ({ ...h, city: '' })))[0]
  const hb = matchHospitals(fileText, opts.hospitals.map((h) => ({ ...h, city: '' })))[0]
  const hosp = hm && hm.score >= 2 ? hm : hb && hb.score >= 2 ? hb : null
  if (hosp) out.hospital_id = hosp.item.id
  else notices.push('בית החולים לא זוהה בין בתי החולים עם MAKO — בחר ידנית.')

  // ---- surgeon: every name token present; one-word names only after a title ("דר רותם")
  const allText = `${message}\n${fileText}`
  const norm = ` ${normalizeHe(allText)} `
  const found = matchDoctors(allText, opts.doctors.map((d) => ({ ...d, phone: '', email: '' })))
    .filter((m) => {
      const tokens = normalizeHe(m.item.name).split(' ')
      return tokens.length >= 2
        ? m.score >= 3
        : DOCTOR_TITLES.some((t) => norm.includes(` ${t} ${tokens[0]} `))
    })
    // the signature is usually last — prefer the doctor mentioned latest in the text
    .sort((a, b) => norm.lastIndexOf(normalizeHe(b.item.name).split(' ')[0]) - norm.lastIndexOf(normalizeHe(a.item.name).split(' ')[0]))
  if (found[0]) {
    out.surgeon_id = found[0].item.id
    if (found.length > 1)
      notices.push(`בהפנייה מופיעים כמה רופאים (${found.map((f) => f.item.name).join(', ')}) — נבחר ${found[0].item.name}, ודא שהוא המנתח.`)
  } else {
    // OCR misreads a letter now and then (קדנסקי → קזנסקי): look for the surgeon in the signature block, allowing one wrong letter
    const head = allTexts.flatMap((t) => t.split(/\r?\n/).slice(0, 14)).filter((l) => /[דר]["״]ר|דר |פרופ/.test(l))
    const words = head.flatMap((l) => normalizeHe(l).split(' ')).filter((w) => w.length >= 3)
    const fuzzy = opts.doctors.find((d) => {
      const toks = normalizeHe(d.name).split(' ').filter((t) => t.length >= 2)
      return toks.length >= 2 && toks.every((t) => words.some((w) => editDistance(w, t) <= (t.length >= 5 ? 1 : 0)))
    })
    if (fuzzy) {
      out.surgeon_id = fuzzy.id
      notices.push(`המנתח זוהה לפי השם בראש ההפנייה (${fuzzy.name}) — ודא שזה נכון.`)
    } else {
      // a doctor named in the message who is not in the list: never added on its own — the person decides
      const named = message.match(/(?:ד["״]?ר|דר|פרופ['׳.]?)\s+([֐-׿'׳-]{2,}(?:\s+[֐-׿'׳-]{2,})?)/)?.[1]
      notices.push(named ? `המנתח לא זוהה — "${named}" לא נמצא ברשימת הרופאים. בחר מנתח קיים, או הוסף אותו קודם במסך הרופאים.` : 'המנתח לא זוהה — בחר ידנית.')
    }
  }

  // ---- notes: anesthesia and CT instructions from the document
  const noteLines = fileText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /מרדים|CT|פרוטוקול/.test(l))
  if (noteLines.length) out.notes = noteLines.join('\n')

  // ---- duplicate?
  if (out.patient_id_number) {
    const dup = opts.existing.find((s) => s.patient_id_number.replace(/\D/g, '') === out.patient_id_number)
    if (dup)
      notices.push(
        `כבר קיים מטופל עם אותה ת״ז: ${dup.patient_name} (${SCAN_PROCEDURE_LABELS[dup.procedure_type] ?? ''}${dup.surgery_date ? `, ניתוח ${formatDate(dup.surgery_date)}` : ''}) — ודא שלא מדובר בכפילות.`,
      )
  }

  return { draft: out, notices }
}
