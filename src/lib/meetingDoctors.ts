// Doctors named in the text of a meeting (summary, decisions, subject, other participants) who are not in the system yet.
// Nothing is created from here: the person is asked, one doctor at a time.
import { matchDoctors, normalizeHe, type MatchDoctor } from './contactMatch'

export type MentionedDoctor = { title: 'ד״ר' | 'פרופ׳'; name: string }

// "ד"ר", "ד״ר", "דר", "דוקטור", "פרופ'", "פרופ׳", "פרופסור" and then the name: one word, or two (a first and a last name)
const WORD = "[א-ת][א-ת'׳״\"\\-]*"
const TITLE_RE = new RegExp(`(?:^|[\\s,;:(\\-–—])(ד["״'׳]?ר|דוקטור|פרופ(?:סור|["׳'.])?)\\s+(${WORD}(?:\\s+${WORD})?)`, 'g')

/** words that follow a surname in a sentence and are not part of the name ("ד"ר כהן ביקש", "פרופ׳ לוי אמר") */
const NOT_A_NAME = new Set([
  'ביקש', 'ביקשה', 'אמר', 'אמרה', 'הסכים', 'הסכימה', 'הציג', 'הציגה', 'הראה', 'התעניין', 'התעניינה', 'מעוניין', 'מעוניינת', 'יעביר', 'תעביר', 'יחזור', 'תחזור',
  'שלח', 'שלחה', 'ישלח', 'תשלח', 'עם', 'על', 'את', 'של', 'לא', 'גם', 'כבר', 'עוד', 'יהיה', 'תהיה', 'היה', 'היתה', 'הוא', 'היא', 'מנהל', 'מנהלת', 'מומחה', 'מומחית',
  'אורתופד', 'אורתופדית', 'ממחלקת', 'מבית', 'מהמחלקה', 'שאל', 'שאלה', 'השיב', 'ענה', 'מספר', 'ציין', 'הזכיר', 'הזכירה', 'ממליץ', 'ממליצה', 'רוצה', 'רוצים', 'צריך', 'צריכה', 'דר', 'פרופ', 'דוקטור', 'פרופסור',
])
/** a word that is not part of the name, also with the prefix "ו" / "ש" / "וש" ("ועם", "שביקש") */
const isNotName = (w: string) => {
  const n = normalizeHe(w)
  if (n.length < 2 || NOT_A_NAME.has(n)) return true
  const rest = n.replace(/^(?:וש|ו|ש)/, '')
  return rest !== n && NOT_A_NAME.has(rest)
}

const cleanName = (raw: string): string => {
  const words = raw.replace(/["״׳'.]+$/g, '').split(/\s+/).filter(Boolean)
  const kept: string[] = [words[0]]
  if (words[1] && !isNotName(words[1])) kept.push(words[1])
  return kept.join(' ').replace(/^[-־]+|[-־]+$/g, '')
}

/** every "title + name" in the text, without repeats (the same name once, whatever the title) */
export function mentionedDoctors(text: string): MentionedDoctor[] {
  const out: MentionedDoctor[] = []
  const seen = new Set<string>()
  for (const m of text.matchAll(TITLE_RE)) {
    const name = cleanName(m[2])
    const key = normalizeHe(name)
    if (!key || key.length < 2 || seen.has(key)) continue
    seen.add(key)
    out.push({ title: m[1].startsWith('פרופ') ? 'פרופ׳' : 'ד״ר', name })
  }
  return out
}

/** the mentioned doctors that match nobody in the system (a surname alone matches a doctor who has it, so a known doctor is not offered again) */
export function unknownDoctors(text: string, doctors: MatchDoctor[], dismissed: ReadonlySet<string> = new Set()): MentionedDoctor[] {
  return mentionedDoctors(text).filter((m) => !dismissed.has(normalizeHe(m.name)) && matchDoctors(m.name, doctors).length === 0)
}
