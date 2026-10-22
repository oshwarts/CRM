// Understands a task written (or dictated) in free Hebrew: finds the due date, urgency, repetition, the doctor
// and the hospital. Rule-based and local — nothing is sent anywhere. The user always sees what was found
// before it is applied.
import { addDays, addMonths, endOfMonth, format } from 'date-fns'
import { normalizeHe } from './contactMatch'

export type TaskGuess = {
  /** the text without the phrases that became fields (date, "urgent", repetition) */
  description: string
  due_date: string | null
  priority: 'urgent' | null
  recurrence: 'weekly' | 'monthly' | null
  doctor_id: string | null
  hospital_id: string | null
  found: { kind: 'date' | 'priority' | 'repeat' | 'doctor' | 'hospital'; label: string }[]
}

const iso = (d: Date) => format(d, 'yyyy-MM-dd')
const MONTHS: Record<string, number> = {
  ינואר: 1, פברואר: 2, מרץ: 3, מארס: 3, אפריל: 4, מאי: 5, יוני: 6, יולי: 7, אוגוסט: 8, ספטמבר: 9, אוקטובר: 10, נובמבר: 11, דצמבר: 12,
}
const MONTH_RE = Object.keys(MONTHS).join('|')
const WEEKDAYS: Record<string, number> = { ראשון: 0, שני: 1, שלישי: 2, רביעי: 3, חמישי: 4, שישי: 5, שבת: 6 }
const LETTER_DAY: Record<string, number> = { א: 0, ב: 1, ג: 2, ד: 3, ה: 4, ו: 5 }
const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

/** the next date (after today) that falls on this weekday */
function nextWeekday(today: Date, wd: number, weeksAhead = 0): Date {
  let diff = (wd - today.getDay() + 7) % 7
  if (diff === 0) diff = 7
  return addDays(today, diff + weeksAhead * 7)
}

function validDate(y: number, m: number, d: number): Date | null {
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d ? dt : null
}

/** a date written as day + month; when the year is missing, the next time that date comes around */
function dayMonth(today: Date, d: number, m: number, y?: number): Date | null {
  if (y !== undefined) return validDate(y < 100 ? 2000 + y : y, m, d)
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  let dt = validDate(today.getFullYear(), m, d)
  if (dt && dt < t0) dt = validDate(today.getFullYear() + 1, m, d)
  return dt
}

// d/m or d.m.y; a quantity such as "1/2 קילו" is not a date
const NUMERIC_DATE = /\s(עד\s+|ב-?|ל-?)?(\d{1,2})([./])(\d{1,2})(?:[./](\d{2,4}))?\s(?!(?:קילו|קג|ק״ג|מטר|מטרים|ס״מ|סמ|ליטר|שעה|שעות|דקות|גרם|אחוז|כוס|כוסות|מ״ל|מל|ימים|יום)(?:\s|$))/

/** is there a real numeric date in the text (valid day/month, and not a bare "2.5" decimal)? */
function numericDate(text: string, today: Date): boolean {
  const m = text.match(NUMERIC_DATE)
  if (!m) return false
  if (m[3] === '.' && !m[1] && !m[5]) return false
  return dayMonth(today, Number(m[2]), Number(m[4]), m[5] ? Number(m[5]) : undefined) !== null
}

const STOP = new Set(['מרכז', 'רפואי', 'בית', 'חולים', 'מרפאה', 'המרכז', 'הרפואי', 'ד״ר', 'דר', 'פרופ', 'פרופסור', 'דוקטור', 'של', 'את', 'עם', 'אל'])
const TITLES = new Set(['דר', 'פרופ', 'פרופסור', 'דוקטור'])
const PREFIX = 'ובלמהכש'

/** the words of a text as a set, each also without a one-letter prefix (בבילינסון → בילינסון) */
function wordSet(text: string): Set<string> {
  const out = new Set<string>()
  for (const w of normalizeHe(text.replace(/[!?:;()]/g, ' ')).split(' ').filter(Boolean)) {
    out.add(w)
    if (w.length > 3 && PREFIX.includes(w[0])) out.add(w.slice(1))
    if (w.length > 4 && w.startsWith('וב')) out.add(w.slice(2))
  }
  return out
}

export function guessTask(
  raw: string,
  ctx: { today?: Date; doctors?: { id: string; name: string; title?: string }[]; hospitals?: { id: string; name: string; city?: string | null }[] } = {},
): TaskGuess {
  const today = ctx.today ?? new Date()
  // punctuation (comma, colon …) becomes a space so the patterns below can rely on whitespace between words
  // (a clock time such as 14:30 keeps its colon — it is not date punctuation and must survive in the description)
  let rest = ` ${raw.replace(/(\d{1,2}):(\d{2})/g, '$1\u0001$2').replace(/[,;:!?()]/g, ' ')} `
  const found: TaskGuess['found'] = []
  const take = (re: RegExp): RegExpMatchArray | null => {
    const m = rest.match(re)
    if (m && m.index !== undefined) rest = rest.slice(0, m.index) + ' ' + rest.slice(m.index + m[0].length)
    return m
  }
  const dateLabel = (d: Date) => `${DAY_NAMES[d.getDay()]} ${format(d, 'dd/MM')}`

  /* ---- repetition ---- */
  let recurrence: TaskGuess['recurrence'] = null
  let weeklyDay: number | null = null // "every Sunday" repeats weekly and is also the first due date
  const every = take(new RegExp(`\\s(?:כל|בכל)\\s+(?:יום\\s+)?(${Object.keys(WEEKDAYS).join('|')}|[א-ו][׳'])\\s`))
  if (every) {
    recurrence = 'weekly'
    weeklyDay = /[׳']$/.test(every[1]) ? LETTER_DAY[every[1][0]] : WEEKDAYS[every[1]]
  } else if (take(/\s(?:(?:כל|בכל|מדי)\s+שבוע|פעם\s+בשבוע)\s|\sשבועי(?:ת)?\s/)) recurrence = 'weekly'
  else if (take(/\s(?:(?:כל|בכל|מדי)\s+חודש|פעם\s+בחודש)\s|\sחודשי(?:ת)?\s/)) recurrence = 'monthly'
  if (recurrence) found.push({ kind: 'repeat', label: recurrence === 'weekly' ? 'חוזרת כל שבוע' : 'חוזרת כל חודש' })

  /* ---- urgency ---- */
  let priority: TaskGuess['priority'] = null
  const urgentRe = /\s(?:בדחיפות|דחוף|דחופה|דחופים|מיידי|מיידית|עדיפות\s+גבוהה|בהקדם\s+האפשרי)(?:\s+מאוד)?\s/
  const um = rest.match(urgentRe)
  // "לא דחוף" (not urgent) must not become urgent
  if (um && um.index !== undefined && !/\sלא$/.test(rest.slice(0, um.index))) {
    take(urgentRe)
    priority = 'urgent'
    found.push({ kind: 'priority', label: 'דחוף' })
  }

  /* ---- due date ---- */
  let due: Date | null = null
  let m: RegExpMatchArray | null

  if ((m = take(new RegExp(`\\s(?:עד\\s+)?(?:[בל]?יום\\s+)?(?:[בל]-?)?(?:ה-?)?(\\d{1,2})\\s*[בל]?-?\\s*(${MONTH_RE})(?:\\s+(\\d{4}))?\\s`)))) {
    due = dayMonth(today, Number(m[1]), MONTHS[m[2]], m[3] ? Number(m[3]) : undefined)
  } else if (numericDate(rest, today)) {
    // 5/12, 5.12.26, "עד 5.12" — but not a decimal quantity like "2.5 מטר" (a bare d.m needs a "by / on" word or a year)
    const nm = take(NUMERIC_DATE)!
    due = dayMonth(today, Number(nm[2]), Number(nm[4]), nm[5] ? Number(nm[5]) : undefined)
  } else if (take(/\s(?:עד\s+)?ל?מחרתיים\s/)) due = addDays(today, 2)
  else if (take(/\s(?:עד\s+)?ל?מחר\s/)) due = addDays(today, 1)
  else if (take(/\s(?:עד\s+)?היום\s/)) due = today
  else if ((m = take(/\sבעוד\s+(\d+|יומיים|שבועיים|חודשיים|שלושה|שלוש|ארבעה|ארבע|חמישה|חמש)\s*(ימים|יום|שבועות|שבוע|חודשים|חודש)?\s/))) {
    const word: Record<string, number> = { יומיים: 2, שבועיים: 2, חודשיים: 2, שלושה: 3, שלוש: 3, ארבעה: 4, ארבע: 4, חמישה: 5, חמש: 5 }
    const n = /^\d+$/.test(m[1]) ? Number(m[1]) : word[m[1]]
    const unit = m[2] ?? (m[1] === 'שבועיים' ? 'שבועות' : m[1] === 'חודשיים' ? 'חודשים' : 'ימים')
    due = /חודש/.test(unit) ? addMonths(today, n) : addDays(today, /שבוע|שבועות/.test(unit) ? n * 7 : n)
  } else if (take(/\sבעוד\s+שבוע\s/)) due = addDays(today, 7)
  else if (take(/\sבעוד\s+חודש\s/)) due = addMonths(today, 1)
  else if (take(/\s(?:עד\s+)?סוף\s+החודש\s/)) due = endOfMonth(today)
  else if (take(/\s(?:עד\s+)?סוף\s+השבוע\s/)) due = nextWeekday(addDays(today, -1), 4) // the coming Thursday
  else {
    // "יום חמישי", "ביום ה׳", "בחמישי", optionally "בשבוע הבא"
    // (a bare day name such as "חמישי" is a weekday only when "next week" follows — "שני" and "שלישי" are also ordinals)
    const names = Object.keys(WEEKDAYS).join('|')
    const weekdayRe = new RegExp(
      `\\s(?:עד\\s+)?(?:(?:[בל])?יום\\s+(${names}|[א-ו][׳'])|ב(ראשון|חמישי|שישי|רביעי|שלישי|שבת)|[בל]?(${names})(?=\\s+ב?שבוע\\s+הבא\\s))(?:\\s+הבא)?(\\s+ב?שבוע\\s+הבא)?\\s`,
    )
    if ((m = take(weekdayRe))) {
      const name = m[1] ?? m[2] ?? m[3]
      const wd = /[׳']$/.test(name) ? LETTER_DAY[name[0]] : WEEKDAYS[name]
      // "next week" = that day of the coming Sunday-to-Saturday week
      due = m[4] ? addDays(today, 7 - today.getDay() + wd) : nextWeekday(today, wd)
    } else if (take(/\s(?:ב)?שבוע\s+הבא\s/)) due = addDays(today, 7)
  }
  if (!due && weeklyDay !== null) due = nextWeekday(today, weeklyDay)
  if (due) found.push({ kind: 'date', label: dateLabel(due) })

  /* ---- doctor and hospital (by name, with or without a title; one-letter prefixes allowed) ---- */
  const words = wordSet(raw)
  let doctor_id: string | null = null
  const docs = ctx.doctors ?? []
  const docTokens = (name: string) => normalizeHe(name).split(' ').filter((t) => t.length >= 2 && !STOP.has(t))
  const full = docs.filter((d) => {
    const t = docTokens(d.name)
    return t.length >= 2 && t.every((x) => words.has(x))
  })
  let doc = full.length === 1 ? full[0] : null
  if (!doc && full.length === 0) {
    // only one name was said: accept it when it points at a single doctor. A short name (כהן, לוי) counts after a title ("ד״ר כהן")
    const spoken = normalizeHe(raw).split(' ')
    const isTitle = (w: string) => TITLES.has(w) || (w.length > 2 && PREFIX.includes(w[0]) && TITLES.has(w.slice(1))) // "לד״ר"
    const titled = new Set(spoken.filter((_, i) => i > 0 && isTitle(spoken[i - 1])))
    const bySurname = docs.filter((d) => docTokens(d.name).some((t) => words.has(t) && (t.length >= 4 || titled.has(t))))
    if (bySurname.length === 1) doc = bySurname[0]
  }
  if (doc) {
    doctor_id = doc.id
    found.push({ kind: 'doctor', label: `${doc.title ? `${doc.title} ` : ''}${doc.name}`.trim() })
  }

  let hospital_id: string | null = null
  const tokensOf = (v: string) => normalizeHe(v).split(' ').filter((t) => t.length >= 2 && !STOP.has(t))
  const hospitalVariants = (ctx.hospitals ?? []).map((h) => {
    const city = new Set(tokensOf(h.city ?? ''))
    return {
      h,
      city,
      // a part of the name that is only the name of the city ("מרכז רפואי תל אביב") does not name the hospital: several share the city
      variants: h.name
        .split(/[–—-]/)
        .map(tokensOf)
        .filter((v) => v.length > 0 && !(city.size > 0 && v.every((t) => city.has(t)))),
    }
  })
  // how many hospitals each word belongs to: a word that belongs to one hospital alone is enough to name it ("אסותא אשדוד" → "אשדוד" is a city, "איכילוב" is not)
  const owners = new Map<string, number>()
  for (const { variants } of hospitalVariants) for (const t of new Set(variants.flat())) owners.set(t, (owners.get(t) ?? 0) + 1)
  const named = hospitalVariants.filter(({ variants, city }) => {
    const whole = variants.some((v) => v.join('').length >= 4 && v.every((t) => words.has(t)))
    // words only this hospital has (never its city): one long word, or two short ones together ("עין כרם")
    const mine = new Set(variants.flat().filter((t) => words.has(t) && owners.get(t) === 1 && !city.has(t)))
    const unique = [...mine].some((t) => t.length >= 4) || [...mine].join('').length >= 6
    return whole || unique
  })
  // two hospitals fit ("הדסה", "אסותא"): ask nobody to guess — the user picks in the form
  if (named.length === 1) {
    hospital_id = named[0].h.id
    found.push({ kind: 'hospital', label: named[0].h.name })
  }

  const description = rest
    .replace(/\u0001/g, ':') // eslint-disable-line no-control-regex
    .replace(/\s+/g, ' ')
    .replace(/^[\s,.:;–-]+|[\s,.:;–-]+$/g, '')
    .replace(/\s+[,.]/g, (x) => x.trim())
    .replace(/^(?:עד|ב|ל)\s+/, '')
    .replace(/\s+(?:עד|ב|ל)$/, '')
    .trim()

  return { description: description || raw.trim(), due_date: due ? iso(due) : null, priority, recurrence, doctor_id, hospital_id, found }
}
