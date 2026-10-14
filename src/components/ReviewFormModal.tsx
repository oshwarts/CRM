import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useSaveReview, type ReviewInput } from '../lib/agentsApi'
import { todayISO } from '../lib/utils'
import { Field, Modal } from './ui'

export const REVIEW_KINDS: Record<string, string> = { one_on_one: 'שיחת מעקב (1:1)', monthly: 'סיכום חודשי', quarterly: 'סיכום רבעוני' }

/** a 1:1 or a monthly / quarterly review: summary, agreements and follow-up tasks that become the agent's real tasks */
export function ReviewFormModal({ agentId, agentName, onClose }: { agentId: string; agentName: string; onClose: () => void }) {
  const save = useSaveReview()
  const [d, setD] = useState<ReviewInput>({ agent_id: agentId, kind: 'one_on_one', review_date: todayISO(), summary: '', agreements: '', rating: null, tasks: [] })
  const [error, setError] = useState('')
  const set = (p: Partial<ReviewInput>) => setD((x) => ({ ...x, ...p }))

  async function submit() {
    setError('')
    if (!d.summary.trim() && !d.agreements.trim() && d.tasks.every((t) => !t.description.trim())) return setError('כתוב סיכום, הסכמות או משימה')
    try {
      await save.mutateAsync(d)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : 'השמירה נכשלה')
    }
  }

  return (
    <Modal open onClose={onClose} title={`סיכום שיחה — ${agentName}`} size="lg">
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="סוג">
            <select className="input" value={d.kind} onChange={(e) => set({ kind: e.target.value, rating: e.target.value === 'one_on_one' ? null : d.rating })}>
              {Object.entries(REVIEW_KINDS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="תאריך">
            <input type="date" className="input" value={d.review_date} onChange={(e) => set({ review_date: e.target.value })} />
          </Field>
          {d.kind !== 'one_on_one' && (
            <Field label="הערכת ביצועים">
              <select className="input" value={d.rating ?? ''} onChange={(e) => set({ rating: e.target.value ? Number(e.target.value) : null })}>
                <option value="">—</option>
                <option value="5">5 — מצוין</option>
                <option value="4">4 — טוב מאוד</option>
                <option value="3">3 — טוב</option>
                <option value="2">2 — טעון שיפור</option>
                <option value="1">1 — נמוך</option>
              </select>
            </Field>
          )}
        </div>
        <Field label="סיכום השיחה">
          <textarea className="input min-h-24" dir="auto" autoFocus value={d.summary} onChange={(e) => set({ summary: e.target.value })} placeholder="מה נדון, מה עבד, מה פחות…" />
        </Field>
        <Field label="הסכמות והחלטות">
          <textarea className="input min-h-16" dir="auto" value={d.agreements} onChange={(e) => set({ agreements: e.target.value })} />
        </Field>

        <div>
          <span className="label">משימות להמשך — נוצרות כמשימות של הסוכן</span>
          <ul className="space-y-2">
            {d.tasks.map((t, i) => (
              <li key={i} className="flex items-center gap-2">
                <input className="input" dir="auto" placeholder="משימה" value={t.description} onChange={(e) => set({ tasks: d.tasks.map((x, k) => (k === i ? { ...x, description: e.target.value } : x)) })} />
                <input type="date" className="input !w-40 shrink-0" value={t.due_date ?? ''} onChange={(e) => set({ tasks: d.tasks.map((x, k) => (k === i ? { ...x, due_date: e.target.value || null } : x)) })} aria-label="תאריך יעד" />
                <button type="button" className="btn-ghost !px-2 text-slate-400" onClick={() => set({ tasks: d.tasks.filter((_, k) => k !== i) })} aria-label="הסר">
                  <X size={16} />
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="btn-ghost mt-1" onClick={() => set({ tasks: [...d.tasks, { description: '', due_date: null }] })}>
            <Plus size={16} />
            הוסף משימה
          </button>
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
          <button className="btn-secondary" onClick={onClose}>
            ביטול
          </button>
          <button className="btn-primary" onClick={submit} disabled={save.isPending}>
            {save.isPending ? 'שומר…' : 'שמירה'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
