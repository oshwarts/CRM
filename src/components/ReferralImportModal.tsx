import { useRef, useState } from 'react'
import { FileUp, Sparkles } from 'lucide-react'
import { useDoctors, useMakoHospitals, usePatientScans } from '../lib/api'
import { extractReferral, referralToDraft } from '../lib/referral'
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
  const [error, setError] = useState('')

  async function run() {
    setError('')
    setBusy(true)
    try {
      const r = await extractReferral({ text: text.trim(), file })
      const { draft, notices } = referralToDraft(r, doctors.data ?? [], hospitals.data ?? [], scans.data ?? [])
      onResult(draft, notices)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'הניתוח נכשל')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="ייבוא הפנייה למטופל" size="lg">
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          הדבק את ההודעה מהווטסאפ ו/או צרף את קובץ ההפנייה (PDF או Word). המערכת תחלץ את הפרטים ותציג טופס
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
              {file ? 'החלף קובץ' : 'בחר קובץ (PDF / Word)'}
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
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null)
                e.target.value = ''
              }}
            />
          </div>
        </div>

        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          פרטי ההפנייה, כולל פרטי המטופל, נשלחים לעיבוד בשירות ה-AI של Anthropic (Claude) ואינם נשמרים בשרת
          המערכת. הקובץ המקורי לא נשמר.
        </p>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
          <button className="btn-primary" onClick={run} disabled={busy || (!text.trim() && !file)}>
            <Sparkles size={16} />
            {busy ? 'מנתח הפנייה…' : 'נתח הפנייה'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
