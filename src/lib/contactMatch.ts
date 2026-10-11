// Suggests where a phone contact belongs: an existing doctor, a hospital, or a new record.
// People save contacts as "דר בן לולו", "מזכירת ברזילי אורתופדיה", "רכש העמק"… so we look for
// doctor / hospital names inside the contact's name and for role words (secretary, nurse, purchasing).

export type MatchDoctor = { id: string; name: string; title: string; phone: string; email: string }
export type MatchHospital = { id: string; name: string; city: string }

const TITLE_WORDS = new Set(['דר', 'דוקטור', 'פרופ', 'פרופסור', 'ד', 'מר', 'גברת', 'dr', 'prof'])
const STOP_WORDS = new Set(['של', 'ה', 'בית', 'חולים', 'מרכז', 'רפואי', 'הרפואי', 'מחלקת', 'מחלקה', 'את', 'עם'])

/** ignore case, quotes / geresh, dots; dashes become spaces */
export function normalizeHe(s: string): string {
  return s
    .toLowerCase()
    .replace(/["'`.׳״‘’“”]/g, '')
    .replace(/[-־–—_,()/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const tokens = (s: string) => normalizeHe(s).split(' ').filter(Boolean)
const nameTokens = (s: string) => tokens(s).filter((t) => !TITLE_WORDS.has(t))

export type Scored<T> = { item: T; score: number; why: string }

export function matchDoctors(contactName: string, doctors: MatchDoctor[]): Scored<MatchDoctor>[] {
  const c = nameTokens(contactName)
  const cSet = new Set(c)
  const out: Scored<MatchDoctor>[] = []
  for (const d of doctors) {
    const dt = nameTokens(d.name)
    if (dt.length === 0) continue
    const overlap = dt.filter((t) => cSet.has(t))
    let score = 0
    if (overlap.length === dt.length) score = dt.length >= 2 ? 3 : dt[0].length >= 3 ? 2 : 0
    else if (dt.length >= 2 && overlap.length >= 2) score = 2
    else if (overlap.length >= 1 && overlap.some((t) => t.length >= 3)) score = 1
    if (score > 0) out.push({ item: d, score, why: `השם "${d.name}" מופיע בשם איש הקשר` })
  }
  return out.sort((a, b) => b.score - a.score)
}

export function matchHospitals(contactName: string, hospitals: MatchHospital[]): Scored<MatchHospital>[] {
  const padded = ` ${tokens(contactName).join(' ')} `
  const out: Scored<MatchHospital>[] = []
  for (const h of hospitals) {
    // "שמיר – אסף הרופא" can be written as either part
    const variants = h.name
      .split(/[–—-]/)
      .map((v) => tokens(v).filter((t) => !STOP_WORDS.has(t)).join(' '))
      .filter((v) => v.length >= 3)
    let score = 0
    let why = ''
    for (const v of variants) {
      if (padded.includes(` ${v} `)) {
        score = 3
        why = `שם בית החולים "${h.name}" מופיע בשם איש הקשר`
        break
      }
    }
    const city = normalizeHe(h.city || '')
    if (!score && city.length >= 3 && padded.includes(` ${city} `)) {
      score = 1
      why = `העיר "${h.city}" מופיעה בשם איש הקשר`
    }
    if (score) out.push({ item: h, score, why })
  }
  return out.sort((a, b) => b.score - a.score)
}

const ROLE_RULES: { re: RegExp; role: string }[] = [
  { re: /מזכיר/, role: 'מזכירה רפואית' },
  { re: /אחות.*ניתוח|ניתוח.*אחות|חדר ניתוח/, role: 'אחות חדר ניתוח' },
  { re: /אחות|אחים/, role: 'אחות אחראית' },
  { re: /רכש/, role: 'מנהל רכש' },
  { re: /טכנאי|מהנדס/, role: 'טכנאי / מהנדס' },
  { re: /מנהל(ת)? מחלקה/, role: 'מנהל מחלקה' },
  { re: /רכז/, role: 'רכזת ניתוחים' },
]

/** a role word in the name means the contact is a staff member, not the doctor himself */
export function detectRole(contactName: string): string {
  const n = normalizeHe(contactName)
  return ROLE_RULES.find((r) => r.re.test(n))?.role ?? ''
}

export const hasTitle = (name: string) => tokens(name).some((t) => TITLE_WORDS.has(t))

/** drops a leading title word: "דר בן לולו" → "בן לולו" */
export function stripTitle(name: string): string {
  const parts = name.trim().split(/\s+/)
  while (parts.length > 1 && TITLE_WORDS.has(normalizeHe(parts[0]))) parts.shift()
  return parts.join(' ')
}

export type Destination = 'doctor_update' | 'doctor_contact' | 'hospital_contact' | 'new_doctor' | 'free_contact'

export type Suggestion = {
  destination: Destination
  doctorId: string
  hospitalId: string
  role: string
  reasons: string[]
  doctorMatches: Scored<MatchDoctor>[]
  hospitalMatches: Scored<MatchHospital>[]
}

export function suggest(
  contactName: string,
  doctors: MatchDoctor[],
  hospitals: MatchHospital[],
): Suggestion {
  const dm = matchDoctors(contactName, doctors)
  const hm = matchHospitals(contactName, hospitals)
  const role = detectRole(contactName)
  const d = dm.find((x) => x.score >= 2) ?? dm[0]
  const h = hm[0]
  const reasons: string[] = []
  let destination: Destination = 'free_contact'

  if (role && d) {
    destination = 'doctor_contact'
    reasons.push(d.why, `בשם איש הקשר זוהה תפקיד (${role}) — כנראה איש צוות של הרופא`)
  } else if (role && h) {
    destination = 'hospital_contact'
    reasons.push(h.why, `בשם איש הקשר זוהה תפקיד (${role}) — כנראה איש צוות בבית החולים`)
  } else if (d && d.score >= 2) {
    destination = 'doctor_update'
    reasons.push(d.why)
  } else if (h && h.score >= 2) {
    destination = 'hospital_contact'
    reasons.push(h.why)
  } else if (d) {
    destination = 'doctor_update'
    reasons.push(`${d.why} (התאמה חלקית — כדאי לבדוק)`)
  } else if (hasTitle(contactName)) {
    destination = 'new_doctor'
    reasons.push('בשם איש הקשר יש תואר (דר / פרופ) ואין רופא תואם במערכת')
  } else if (h) {
    destination = 'hospital_contact'
    reasons.push(h.why)
  }

  return {
    destination,
    doctorId: d?.item.id ?? '',
    hospitalId: h?.item.id ?? '',
    role,
    reasons,
    doctorMatches: dm,
    hospitalMatches: hm,
  }
}
