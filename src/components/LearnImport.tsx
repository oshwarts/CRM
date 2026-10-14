import { useMemo, useState } from 'react'
import { FileUp } from 'lucide-react'
import { parseCards, type Separator } from '../lib/learnParse'
import { useImportCards } from '../lib/learnApi'
import { Modal } from './ui'

/** managers: add many questions at once from text they paste or a file they upload (their own material) */
export function LearnImport({ topicId, topicTitle, onClose }: { topicId: string; topicTitle: string; onClose: () => void }) {
  const importCards = useImportCards()
  const [raw, setRaw] = useState('')
  const [sep, setSep] = useState<Separator>('auto')
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ added: number; skipped: number } | null>(null)
  const cards = useMemo(() => parseCards(raw, sep), [raw, sep])

  async function onFile(f: File | undefined) {
    if (!f) return
    setRaw(await f.text())
  }

  return (
    <Modal open onClose={onClose} title={`ייבוא שאלות — ${topicTitle}`} size="xl">
      {result ? (
        <div className="space-y-3 text-center">
          <p className="text-lg font-bold text-emerald-700">נוספו {result.added} שאלות</p>
          {result.skipped > 0 && <p className="text-sm text-slate-500">{result.skipped} שאלות שכבר קיימות בנושא לא נוספו שוב.</p>}
          <button className="btn-primary" onClick={onClose}>
            סגור
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            הדבק רשימה, שורה לכל שאלה, כשהשאלה והתשובה מופרדות בטאב (כך נראה ייצוא מכרטיסיות), בפסיק, בנקודה-פסיק או במקף. אפשר גם להעלות קובץ CSV או טקסט.
            ייבא רק חומר שיש לך רשות להשתמש בו.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <label className="btn-secondary cursor-pointer">
              <FileUp size={15} /> העלאת קובץ
              <input type="file" accept=".csv,.tsv,.txt,text/*" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
            </label>
            <select className="input !w-auto" value={sep} onChange={(e) => setSep(e.target.value as Separator)} aria-label="מפריד">
              <option value="auto">מפריד: זיהוי אוטומטי</option>
              <option value="tab">טאב</option>
              <option value="comma">פסיק</option>
              <option value="semicolon">נקודה-פסיק</option>
              <option value="dash">מקף ( - )</option>
            </select>
          </div>
          <textarea
            className="input min-h-48 font-mono text-xs"
            dir="ltr"
            placeholder={'Question 1\tAnswer 1\nQuestion 2\tAnswer 2'}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
          />
          {cards.length > 0 && (
            <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
              <p className="mb-1 font-medium">זוהו {cards.length} שאלות. דוגמאות:</p>
              <ul dir="ltr" className="space-y-1 text-left">
                {cards.slice(0, 3).map((c, i) => (
                  <li key={i}>
                    <b>{c.question.slice(0, 100)}</b> → {c.answer.slice(0, 100)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {raw.trim() && cards.length === 0 && <p className="text-sm text-amber-600">לא זוהו שאלות. בדוק את המפריד.</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={onClose}>
              ביטול
            </button>
            <button
              className="btn-primary"
              disabled={cards.length === 0 || importCards.isPending}
              onClick={() => importCards.mutate({ topicId, cards }, { onSuccess: setResult, onError: (e) => setError(e instanceof Error ? e.message : 'הייבוא נכשל') })}
            >
              {importCards.isPending ? 'מייבא…' : `ייבא ${cards.length} שאלות`}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
