import { useState } from 'react'
import { usePatchPatientScan } from '../lib/api'
import { SCAN_STATUS_LABELS, type PatientScanRow } from '../lib/types'
import { toast } from '../lib/toast'
import { classNames, formatDate } from '../lib/utils'
import { Field, Modal } from './ui'

type Choice = 'postponed' | 'cancelled' | 'done' | 'planned'

const CHOICES: { key: Choice; label: string; hint: string }[] = [
  { key: 'postponed', label: 'נדחה', hint: 'הניתוח נדחה. אפשר לתת תאריך חדש, או להשאיר בלי תאריך עד שיתברר' },
  { key: 'cancelled', label: 'בוטל', hint: 'הניתוח בוטל ולא יופיע ברשימת הניתוחים הקרובים' },
  { key: 'done', label: 'בוצע', hint: 'הניתוח התקיים' },
  { key: 'planned', label: 'חזרה למתוכנן', hint: 'הניתוח שוב מתוכנן' },
]

/** the quick answer to "what happened to this surgery": postponed (with a new date if there is one), cancelled, done, or planned again */
export function ScanStatusModal({ scan, onClose }: { scan: PatientScanRow; onClose: () => void }) {
  const patch = usePatchPatientScan()
  const [choice, setChoice] = useState<Choice>(scan.status === 'planned' ? 'postponed' : (scan.status as Choice))
  const [newDate, setNewDate] = useState('')
  const [reason, setReason] = useState('')

  function save() {
    const was = scan.surgery_date ? ` מ-${formatDate(scan.surgery_date)}` : ''
    const stamp = (what: string) => [`${what}${was}`, reason.trim()].filter(Boolean).join(': ')
    // the reason is kept in the notes of the patient, with what happened
    const note = choice === 'postponed' ? stamp('נדחה') : choice === 'cancelled' ? stamp('בוטל') : ''
    const notes = note ? [note, scan.notes].filter(Boolean).join('\n') : scan.notes
    const p =
      choice === 'postponed'
        ? newDate
          ? { status: 'planned', surgery_date: newDate, notes }
          : { status: 'postponed', surgery_date: null, notes }
        : choice === 'cancelled'
          ? { status: 'cancelled', notes }
          : { status: choice }
    patch.mutate(
      { id: scan.id, patch: p as never },
      {
        onSuccess: () => {
          toast(choice === 'postponed' ? (newDate ? `הניתוח נדחה ל-${formatDate(newDate)}` : 'הניתוח סומן כנדחה') : `הסטטוס עודכן: ${SCAN_STATUS_LABELS[choice]}`)
          onClose()
        },
        onError: (e) => toast(/status_check|violates/i.test(e instanceof Error ? e.message : String((e as { message?: string })?.message ?? '')) ? 'הסטטוס "נדחה" עוד לא פעיל במסד הנתונים' : 'העדכון נכשל', { kind: 'error' }),
      },
    )
  }

  return (
    <Modal open onClose={onClose} title={`מה קרה לניתוח של ${scan.patient_name}?`} size="md">
      <div className="space-y-3">
        <div role="radiogroup" aria-label="מה קרה לניתוח" className="grid grid-cols-2 gap-2">
          {CHOICES.map((c) => (
            <button
              key={c.key}
              type="button"
              role="radio"
              aria-checked={choice === c.key}
              onClick={() => setChoice(c.key)}
              className={classNames('min-h-[44px] rounded-xl border px-3 text-sm font-medium transition', choice === c.key ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}
            >
              {c.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">{CHOICES.find((c) => c.key === choice)?.hint}</p>
        {choice === 'postponed' && (
          <Field label="תאריך חדש (לא חובה)">
            <input type="date" className="input" value={newDate} min={scan.surgery_date ?? undefined} onChange={(e) => setNewDate(e.target.value)} />
          </Field>
        )}
        {(choice === 'postponed' || choice === 'cancelled') && (
          <Field label="סיבה (לא חובה)">
            <input className="input" dir="auto" placeholder={choice === 'postponed' ? 'למשל: המטופל חולה, חדר ניתוח תפוס' : 'למשל: המטופל ויתר'} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        )}
        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
          <button type="button" className="btn-secondary" onClick={onClose}>
            ביטול
          </button>
          <button type="button" className="btn-primary max-sm:flex-1" disabled={patch.isPending} onClick={save}>
            שמירה
          </button>
        </div>
      </div>
    </Modal>
  )
}
