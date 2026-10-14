import { useState } from 'react'
import { useSaveGoal, useDeleteGoal, type GoalInput } from '../lib/agentsApi'
import { AUTO_METRICS, CATEGORY_LABELS, monthPeriod, quarterPeriod, type Period } from '../lib/agentMetrics'
import type { AgentGoal } from '../lib/types'
import { ConfirmButton, Field, Modal } from './ui'

type Kind = 'auto' | 'manual' | 'text'

/** create / edit a personal goal of an agent: measured from the system, a number the manager types, or a free goal with a progress % */
export function GoalFormModal({ agentId, goal, period, onClose }: { agentId: string; goal?: AgentGoal | null; period: Period; onClose: () => void }) {
  const save = useSaveGoal()
  const del = useDeleteGoal()
  const [kind, setKind] = useState<Kind>(goal ? (goal.metric === 'text' ? 'text' : goal.metric === 'manual' ? 'manual' : 'auto') : 'auto')
  const [d, setD] = useState<GoalInput>(() => ({
    id: goal?.id,
    agent_id: agentId,
    title: goal?.title ?? '',
    category: goal?.category ?? 'activity',
    metric: goal?.metric ?? 'meetings_held',
    target: goal?.target ?? null,
    current_value: goal?.current_value ?? 0,
    unit: goal?.unit ?? '',
    progress_pct: goal?.progress_pct ?? 0,
    period_start: goal?.period_start ?? period.start,
    period_end: goal?.period_end ?? period.end,
    notes: goal?.notes ?? '',
  }))
  const [error, setError] = useState('')
  const set = (p: Partial<GoalInput>) => setD((x) => ({ ...x, ...p }))

  async function submit() {
    setError('')
    const metric = kind === 'auto' ? (d.metric !== 'manual' && d.metric !== 'text' ? d.metric : 'meetings_held') : kind
    const title = d.title.trim() || (kind === 'auto' ? AUTO_METRICS[metric]?.label : '')
    if (!title) return setError('כתוב שם ליעד')
    if (kind !== 'text' && !d.target) return setError('הגדר ערך יעד')
    try {
      await save.mutateAsync({ ...d, title, metric, unit: kind === 'auto' ? (AUTO_METRICS[metric]?.unit ?? '') : d.unit })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : 'השמירה נכשלה')
    }
  }

  const quick = (p: Period) => set({ period_start: p.start, period_end: p.end })

  return (
    <Modal open onClose={onClose} title={goal ? 'עריכת יעד' : 'יעד חדש'} size="lg">
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="סוג יעד">
            <select className="input" value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
              <option value="auto">נמדד אוטומטית מהמערכת</option>
              <option value="manual">מספר שהמנהל מעדכן (למשל מכירות)</option>
              <option value="text">יעד חופשי עם אחוז התקדמות</option>
            </select>
          </Field>
          <Field label="קטגוריה">
            <select className="input" value={d.category} onChange={(e) => set({ category: e.target.value })}>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {kind === 'auto' && (
          <Field label="מה נמדד">
            <select className="input" value={d.metric} onChange={(e) => set({ metric: e.target.value })}>
              {Object.entries(AUTO_METRICS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label={kind === 'auto' ? 'שם היעד (אופציונלי — ברירת מחדל: שם המדד)' : 'שם היעד'}>
          <input className="input" dir="auto" value={d.title} onChange={(e) => set({ title: e.target.value })} placeholder={kind === 'manual' ? 'למשל: הכנסות מניתוחי MAKO' : kind === 'text' ? 'למשל: ללמוד את מערכת התכנון החדשה' : ''} />
        </Field>

        {kind !== 'text' && (
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="ערך יעד">
              <input type="number" min={0} step="any" className="input" value={d.target ?? ''} onChange={(e) => set({ target: e.target.value === '' ? null : Number(e.target.value) })} />
            </Field>
            {kind === 'manual' && (
              <>
                <Field label="ערך נוכחי (מעדכן המנהל)">
                  <input type="number" min={0} step="any" className="input" value={d.current_value} onChange={(e) => set({ current_value: Number(e.target.value) || 0 })} />
                </Field>
                <Field label="יחידה">
                  <input className="input" dir="auto" value={d.unit} onChange={(e) => set({ unit: e.target.value })} placeholder="₪ / ניתוחים / יח׳" />
                </Field>
              </>
            )}
          </div>
        )}
        {kind === 'text' && (
          <Field label={`אחוז התקדמות: ${d.progress_pct}%`}>
            <input type="range" min={0} max={100} step={5} className="w-full" value={d.progress_pct} onChange={(e) => set({ progress_pct: Number(e.target.value) })} />
          </Field>
        )}

        <div>
          <span className="label">תקופה</span>
          <div className="mb-2 flex flex-wrap gap-2">
            <button type="button" className="chip border-slate-200 bg-white text-slate-600 hover:bg-slate-50" onClick={() => quick(monthPeriod(0))}>
              החודש
            </button>
            <button type="button" className="chip border-slate-200 bg-white text-slate-600 hover:bg-slate-50" onClick={() => quick(monthPeriod(1))}>
              החודש הבא
            </button>
            <button type="button" className="chip border-slate-200 bg-white text-slate-600 hover:bg-slate-50" onClick={() => quick(quarterPeriod(0))}>
              הרבעון
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input type="date" className="input" value={d.period_start} onChange={(e) => set({ period_start: e.target.value })} aria-label="מתאריך" />
            <input type="date" className="input" value={d.period_end} onChange={(e) => set({ period_end: e.target.value })} aria-label="עד תאריך" />
          </div>
        </div>

        <Field label="הערות (אופציונלי)">
          <textarea className="input min-h-14" dir="auto" value={d.notes} onChange={(e) => set({ notes: e.target.value })} />
        </Field>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div className="flex items-center justify-between border-t border-slate-200 pt-3">
          <div>
            {goal && (
              <ConfirmButton message="למחוק את היעד?" onConfirm={() => del.mutate(goal.id, { onSuccess: onClose })}>
                מחיקה
              </ConfirmButton>
            )}
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={onClose}>
              ביטול
            </button>
            <button className="btn-primary" onClick={submit} disabled={save.isPending}>
              {save.isPending ? 'שומר…' : 'שמירה'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
