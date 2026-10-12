import { useRef, useState } from 'react'
import { FileUp, Sparkles } from 'lucide-react'
import { useDoctors, useMakoHospitals, usePatientScans } from '../lib/api'
import { analyzeReferral } from '../lib/referral'
import { isImageFile } from '../lib/ocr'
import type { ScanDraft } from './ScanFormModal'
import { Modal } from './ui'

export function ReferralImportModal({
  onClose,
  onResult,
}: {
  onClose: () => void
  onResult: (draft: Partial<ScanDraft>, notices: string[]) => void
}) {
  const doctors = useDoctors()
  const hospitals = useMakoHospitals()
  const scans = usePatientScans()
  const fileRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  // what is written by hand on the paper — OCR cannot read handwriting
  const [hSide, setHSide] = useState<'' | 'ימין' | 'שמאל'>('')
  const [hProc, setHProc] = useState<'' | 'knee' | 'uni' | 'hip'>('')
  const [hDate, setHDate] = useState('')
  const [hOrder, setHOrder] = useState('')
  const [error, setError] = useState('')

  async function run() {
    setError('')
    setBusy(true)
    try {
      const { draft, notices } = await analyzeReferral({
        message: text.trim(),
        file,
        doctors: doctors.data ?? [],
        hospitals: hospitals.data ?? [],
        existing: scans.data ?? [],
        hand: { side: hSide, procedure: hProc, date: hDate, order: hOrder },
        onStatus: setStatus,
      })
      onResult(draft, notices)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'הניתוח נכשל')
    } finally {
      setBusy(false)
      setStatus('')
    }
  }

  return (
    <Modal open onClose={onClose} title="ייבוא הפנייה למטופל" size="lg">
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          הדבק את ההודעה מהווטסאפ ו/או צרף את קובץ ההפנייה (PDF, Word או צילום תמונה). המערכת תקרא את הפרטים ותציג טופס
          ממולא לבדיקה — שום דבר לא נשמר עד שתאשר.
        </p>

        <label className="block">
          <span className="label">הודעה מהווטסאפ</span>
          <textarea
            className="input min-h-32"
            placeholder="הדבק כאן את הטקסט שהמזכירה שלחה…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>

        <div>
          <span className="label">קובץ הפנייה</span>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()}>
              <FileUp size={16} />
              {file ? 'החלף קובץ' : 'בחר קובץ או תמונה'}
            </button>
            {file && (
              <span className="text-sm text-slate-600">
                {file.name}{' '}
                <button type="button" className="text-red-500 underline" onClick={() => setFile(null)}>
                  הסר
                </button>
              </span>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.doc,.docx,image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null)
                e.target.value = ''
              }}
            />
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 p-3">
          <span className="label">כתוב בכתב יד על ההפנייה? (אופציונלי)</span>
          <p className="mb-2 text-xs text-slate-400">
            כתב יד (למשל "LT TKR", תאריך הניתוח והמספר המעוגל) לא נקרא אוטומטית — מלא כאן ונוסיף לטופס.
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <select className="input" value={hProc} onChange={(e) => setHProc(e.target.value as typeof hProc)}>
              <option value="">סוג ניתוח</option>
              <option value="knee">ברך מלאה (TKR)</option>
              <option value="uni">ברך חלקית (יוני)</option>
              <option value="hip">ירך (THR)</option>
            </select>
            <select className="input" value={hSide} onChange={(e) => setHSide(e.target.value as typeof hSide)}>
              <option value="">צד</option>
              <option value="שמאל">שמאל (LT)</option>
              <option value="ימין">ימין (RT)</option>
            </select>
            <input type="date" className="input" value={hDate} onChange={(e) => setHDate(e.target.value)} aria-label="תאריך ניתוח" />
            <input
              type="number"
              min={1}
              className="input"
              placeholder="ניתוח מס׳ ביום"
              value={hOrder}
              onChange={(e) => setHOrder(e.target.value)}
            />
          </div>
        </div>

        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          הקריאה נעשית בתוך המערכת, בלי שירות חיצוני ובלי עלות. הקובץ לא נשמר. הפרטים נאספים משם הקובץ,
          מההודעה ומתוכן המסמך. תמונות נקראות בטלפון עצמו (זיהוי טקסט) ולא נשלחות לשום מקום — עובד הכי טוב על
          צילום ישר וחד של מסמך מודפס; כתב יד לא נקרא טוב.
        </p>

        {busy && status && file && isImageFile(file) && <p className="text-sm text-slate-500">{status}</p>}
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
          <button className="btn-primary" onClick={run} disabled={busy || (!text.trim() && !file)}>
            <Sparkles size={16} />
            {busy ? 'קורא הפנייה…' : 'קרא הפנייה'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
