import { useState } from 'react'
import { Sparkles, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAddGeneratedCards } from '../lib/learnApi'
import { Modal } from './ui'

type Draft = { question: string; correct: string; wrong: string[]; explanation: string; keep: boolean }

/** drafts questions from a document with AI; the editor reviews and edits them, they are saved as drafts for approval */
export function GenerateQuestions({
  topicId,
  topicTitle,
  lessonId,
  docTitle,
  text,
  onClose,
}: {
  topicId: string
  topicTitle: string
  lessonId: string | null
  docTitle: string
  text: string
  onClose: () => void
}) {
  const add = useAddGeneratedCards()
  const [count, setCount] = useState(10)
  const [busy, setBusy] = useState(false)
  const [drafts, setDrafts] = useState<Draft[] | null>(null)
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ added: number; skipped: number } | null>(null)

  async function generate() {
    if (!window.confirm('טקסט המסמך יישלח לשירות הבינה המלאכותית (Anthropic) כדי לנסח שאלות. לא להשתמש במסמכים עם פרטי מטופלים או מידע חסוי. להמשיך?')) return
    setBusy(true)
    setError('')
    const { data, error: err } = await supabase.functions.invoke('generate-questions', { body: { text, count, topic: topicTitle } })
    setBusy(false)
    if (err || !data?.questions) {
      // on a non-2xx answer the client gives no data: the reason is in the response the error carries
      let info = (data ?? null) as { error?: string; status?: number; detail?: string } | null
      const ctx = (err as { context?: unknown } | null)?.context
      if (!info && ctx instanceof Response) info = await ctx.clone().json().catch(() => null)
      const code = info?.error
      setError(
        code === 'not_configured'
          ? 'שירות הבינה המלאכותית עוד לא חובר: צריך להוסיף מפתח ANTHROPIC_API_KEY ב-Supabase (Edge Functions ← Secrets).'
          : code === 'text_too_short'
            ? 'לא נמצא מספיק טקסט במסמך (ייתכן שזה סריקה או תמונות).'
            : code === 'forbidden'
              ? 'אין הרשאה: רק מנהל או עורך תוכן.'
              : code === 'ai_failed'
                ? `שירות הבינה המלאכותית החזיר שגיאה (${info?.status ?? ''}). ${info?.detail ?? ''}`
                : `יצירת השאלות נכשלה${code ? ` (${code})` : err ? ` (${err.message})` : ''}. נסה שוב.`,
      )
      return
    }
    setDrafts((data.questions as Omit<Draft, 'keep'>[]).map((q) => ({ ...q, keep: true })))
  }

  const patch = (i: number, p: Partial<Draft>) => setDrafts((d) => d!.map((x, k) => (k === i ? { ...x, ...p } : x)))
  const chosen = (drafts ?? []).filter((d) => d.keep && d.question.trim() && d.correct.trim())

  return (
    <Modal open onClose={onClose} title={`שאלות מהמסמך — ${docTitle}`} size="xl">
      {done ? (
        <div className="space-y-3 text-center">
          <p className="text-lg font-bold text-emerald-700">נשמרו {done.added} שאלות כטיוטה</p>
          {done.skipped > 0 && <p className="text-sm text-slate-500">{done.skipped} שאלות כבר קיימות בנושא ולא נוספו.</p>}
          <p className="text-sm text-slate-500">השאלות ממתינות לאישור מנהל, ואפשר לערוך אותן ברשימת השאלות של הנושא.</p>
          <button className="btn-primary" onClick={onClose}>
            סגור
          </button>
        </div>
      ) : !drafts ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            המערכת תנסח שאלות אמריקאיות מתוך תוכן המסמך בלבד, עם תשובות שגויות הגיוניות והסבר. אחרי היצירה תוכל לערוך, למחוק ולהוסיף, והשאלות יישמרו כטיוטה שמנהל מאשר לפני שסוכנים רואים אותן.
          </p>
          <label className="flex items-center gap-2 text-sm">
            מספר שאלות
            <select className="input !w-auto" value={count} onChange={(e) => setCount(Number(e.target.value))}>
              {[5, 10, 15, 20, 25].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            לשם יצירת השאלות טקסט המסמך נשלח לשירות חיצוני (Anthropic). השתמש רק בחומרי הדרכה של החברה שמותר לשתף, ולא במסמכים עם פרטי מטופלים.
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={onClose}>
              ביטול
            </button>
            <button className="btn-primary" disabled={busy} onClick={generate}>
              <Sparkles size={15} /> {busy ? 'מנסח שאלות… (עד דקה)' : 'צור שאלות'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">בדוק כל שאלה: ערוך, בטל סימון, או מחק. מה שמסומן יישמר כטיוטה לאישור מנהל.</p>
          <ul className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
            {drafts.map((d, i) => (
              <li key={i} className={`rounded-xl border p-3 ${d.keep ? 'border-slate-200' : 'border-slate-100 opacity-50'}`}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                    <input type="checkbox" checked={d.keep} onChange={(e) => patch(i, { keep: e.target.checked })} /> שאלה {i + 1}
                  </label>
                  <button className="text-slate-300 hover:text-red-500" aria-label="מחק" onClick={() => setDrafts((x) => x!.filter((_, k) => k !== i))}>
                    <Trash2 size={14} />
                  </button>
                </div>
                <textarea className="input min-h-14 text-sm" dir="auto" value={d.question} onChange={(e) => patch(i, { question: e.target.value })} aria-label="שאלה" />
                <div className="mt-2 space-y-1.5">
                  <input className="input !border-emerald-300 text-sm" dir="auto" value={d.correct} onChange={(e) => patch(i, { correct: e.target.value })} aria-label="תשובה נכונה" />
                  {d.wrong.map((w, k) => (
                    <input key={k} className="input text-sm" dir="auto" value={w} onChange={(e) => patch(i, { wrong: d.wrong.map((v, j) => (j === k ? e.target.value : v)) })} aria-label={`תשובה שגויה ${k + 1}`} />
                  ))}
                  <textarea className="input min-h-12 text-xs" dir="auto" placeholder="הסבר" value={d.explanation} onChange={(e) => patch(i, { explanation: e.target.value })} />
                </div>
              </li>
            ))}
          </ul>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={onClose}>
              ביטול
            </button>
            <button
              className="btn-primary"
              disabled={chosen.length === 0 || add.isPending}
              onClick={() =>
                add.mutate(
                  { topicId, lessonId, items: chosen },
                  { onSuccess: setDone, onError: (e) => setError(e instanceof Error ? e.message : 'השמירה נכשלה') },
                )
              }
            >
              {add.isPending ? 'שומר…' : `שמור ${chosen.length} שאלות כטיוטה`}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
