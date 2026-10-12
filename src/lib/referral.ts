import { supabase } from './supabase'
import { isImageFile, ocrImage } from './ocr'
import { parseReferral } from './referralParse'
import type { PatientScanRow } from './types'
import type { ScanDraft } from '../components/ScanFormModal'

const MAX_FILE_BYTES = 3 * 1024 * 1024

const ERRORS: Record<string, string> = {
  unauthorized: 'ההתחברות פגה',
  file_too_large: 'הקובץ גדול מדי (עד 3MB)',
  unsupported_file: 'סוג קובץ לא נתמך (אפשר PDF, Word או תמונה)',
  unreadable_file: 'לא הצלחתי לקרוא את הקובץ',
}

async function toBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000)
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

/** asks the server to pull the text out of a .doc / .docx / .pdf (no AI, nothing is stored) */
async function readFileText(file: File): Promise<string> {
  if (file.size > MAX_FILE_BYTES) throw new Error(ERRORS.file_too_large)
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error(ERRORS.unauthorized)
  const res = await fetch('/api/read-referral', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: file.name, base64: await toBase64(file) }),
  })
  const json = (await res.json().catch(() => null)) as { text?: string; error?: string } | null
  if (!res.ok || json?.text === undefined) throw new Error(ERRORS[json?.error ?? ''] ?? 'קריאת הקובץ נכשלה')
  return json.text
}

/** reads the message + file and returns a pre-filled scan draft with things to double-check */
export async function analyzeReferral(opts: {
  message: string
  file: File | null
  doctors: { id: string; name: string; title: string }[]
  hospitals: { id: string; name: string }[]
  existing: PatientScanRow[]
  /** what is written by hand on the paper (not readable by OCR) — typed by the user, overrides the reading */
  hand?: { side?: '' | 'ימין' | 'שמאל'; procedure?: '' | 'knee' | 'uni' | 'hip'; date?: string; order?: string }
  onStatus?: (text: string) => void
}): Promise<{ draft: Partial<ScanDraft>; notices: string[] }> {
  let fileText = ''
  let altTexts: string[] = []
  let fileNote = ''
  if (opts.file) {
    try {
      if (isImageFile(opts.file)) {
        ;[fileText, ...altTexts] = await ocrImage(opts.file, opts.onStatus)
      } else fileText = await readFileText(opts.file)
      if (isImageFile(opts.file)) fileNote = 'הטקסט נקרא מתמונה — ייתכנו טעויות זיהוי, בדוק היטב את הפרטים (במיוחד ת"ז, טלפון ותאריכים).'
    } catch (e) {
      fileNote = `תוכן הקובץ לא נקרא (${e instanceof Error ? e.message : 'שגיאה'}) — חולצו רק פרטים מההודעה ומשם הקובץ.`
    }
  }
  const { draft, notices } = parseReferral({
    fileName: opts.file?.name ?? '',
    message: opts.message,
    fileText,
    altTexts,
    today: new Date(),
    doctors: opts.doctors,
    hospitals: opts.hospitals,
    existing: opts.existing,
  })
  const d = draft as Partial<ScanDraft>
  const h = opts.hand
  let rest = notices
  if (h?.side) {
    d.side = h.side
    rest = rest.filter((n) => !n.startsWith('הצד'))
  }
  if (h?.procedure) {
    d.procedure_type = h.procedure
    rest = rest.filter((n) => !n.startsWith('סוג הניתוח'))
  }
  if (h?.date) {
    d.surgery_date = h.date
    rest = rest.filter((n) => !n.startsWith('תאריך הניתוח'))
  }
  if (h?.order?.trim()) d.notes = [d.notes, `ניתוח מס׳ ${h.order.trim()} באותו יום`].filter(Boolean).join('\n')
  return { draft: d, notices: fileNote ? [fileNote, ...rest] : rest }
}
