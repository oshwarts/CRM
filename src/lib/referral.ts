import { supabase } from './supabase'
import { matchDoctors, matchHospitals } from './contactMatch'
import { normalizePhone } from './contactImport'
import { SCAN_PROCEDURE_LABELS, type PatientScanRow } from './types'
import { formatDate } from './utils'
import type { ScanDraft } from '../components/ScanFormModal'

export type ReferralExtract = {
  patient_name: string
  patient_id_number: string
  patient_phone: string
  patient_dob: string
  health_fund: string
  insurance: string
  procedure_type: '' | 'knee' | 'uni' | 'hip'
  side: '' | 'ימין' | 'שמאל'
  surgery_date: string
  surgeon_name: string
  hospital_name: string
  diagnosis: string
  notes: string
  warnings: string[]
}

const MAX_FILE_BYTES = 3 * 1024 * 1024

const ERRORS: Record<string, string> = {
  unauthorized: 'ההתחברות פגה — התחבר מחדש ונסה שוב.',
  not_configured: 'הניתוח האוטומטי עוד לא הופעל: חסר מפתח Claude API בהגדרות השרת (ANTHROPIC_API_KEY ב-Vercel).',
  bad_key: 'מפתח ה-Claude API שהוגדר בשרת לא תקין או שנחסם.',
  rate_limited: 'יותר מדי בקשות כרגע — נסה שוב בעוד דקה.',
  file_too_large: 'הקובץ גדול מדי (עד 3MB).',
  unsupported_file: 'סוג קובץ לא נתמך — אפשר PDF או Word (.docx).',
  unreadable_file: 'לא הצלחתי לקרוא את הקובץ.',
  empty: 'הדבק טקסט או צרף קובץ.',
}

async function toBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000)
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

export async function extractReferral(opts: { text: string; file?: File | null }): Promise<ReferralExtract> {
  if (opts.file && opts.file.size > MAX_FILE_BYTES) throw new Error(ERRORS.file_too_large)
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error(ERRORS.unauthorized)

  let res: Response
  try {
    res = await fetch('/api/extract-referral', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({
        text: opts.text,
        file: opts.file
          ? { name: opts.file.name, type: opts.file.type, base64: await toBase64(opts.file) }
          : undefined,
      }),
    })
  } catch {
    throw new Error('אין חיבור לשרת. נסה שוב.')
  }
  const json = (await res.json().catch(() => null)) as { extracted?: ReferralExtract; error?: string } | null
  if (!res.ok || !json?.extracted)
    throw new Error(ERRORS[json?.error ?? ''] ?? 'הניתוח נכשל. נסה שוב, או מלא ידנית.')
  return json.extracted
}

/** turns the extracted fields into a pre-filled scan form, matching names to the system's records */
export function referralToDraft(
  r: ReferralExtract,
  doctors: { id: string; name: string; title: string }[],
  hospitals: { id: string; name: string }[],
  existing: PatientScanRow[],
): { draft: Partial<ScanDraft>; notices: string[] } {
  const notices: string[] = [...r.warnings]
  const draft: Partial<ScanDraft> = {
    patient_name: r.patient_name,
    patient_id_number: r.patient_id_number,
    patient_phone: r.patient_phone ? normalizePhone(r.patient_phone) : '',
    patient_dob: r.patient_dob,
    health_fund: r.health_fund,
    insurance: r.insurance,
    surgery_date: r.surgery_date,
    side: r.side,
  }
  if (r.procedure_type) draft.procedure_type = r.procedure_type
  else notices.push('סוג הניתוח (ברך / יוני / ירך) לא זוהה — בחר ידנית.')

  const notes = [r.diagnosis && `אבחנה: ${r.diagnosis}`, r.notes].filter(Boolean).join('\n')
  if (notes) draft.notes = notes

  if (r.hospital_name) {
    const h = matchHospitals(r.hospital_name, hospitals.map((x) => ({ ...x, city: '' })))[0]
    if (h && h.score >= 2) draft.hospital_id = h.item.id
    else notices.push(`בית החולים "${r.hospital_name}" לא זוהה בין בתי החולים עם MAKO — בחר ידנית.`)
  } else notices.push('לא צוין בית חולים בהפנייה.')

  if (r.surgeon_name) {
    const d = matchDoctors(r.surgeon_name, doctors.map((x) => ({ ...x, phone: '', email: '' })))[0]
    if (d && d.score >= 2) draft.surgeon_id = d.item.id
    else if (d) {
      draft.surgeon_id = d.item.id
      notices.push(`המנתח "${r.surgeon_name}" הותאם חלקית ל-${d.item.title} ${d.item.name} — ודא שזה נכון.`)
    } else notices.push(`המנתח "${r.surgeon_name}" לא נמצא ברשימת הרופאים — בחר ידנית או הוסף אותו.`)
  }

  if (!r.surgery_date) notices.push('תאריך הניתוח לא צוין.')
  if (!r.patient_name) notices.push('שם המטופל לא זוהה.')

  const idd = r.patient_id_number
  if (idd.length >= 5) {
    const dup = existing.find((s) => s.patient_id_number.replace(/\D/g, '') === idd)
    if (dup)
      notices.push(
        `כבר קיים מטופל עם אותה ת״ז: ${dup.patient_name} (${SCAN_PROCEDURE_LABELS[dup.procedure_type] ?? ''}${dup.surgery_date ? `, ניתוח ${formatDate(dup.surgery_date)}` : ''}) — ודא שלא מדובר בכפילות.`,
      )
  }
  return { draft, notices }
}
