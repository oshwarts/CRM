import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2 } from 'lucide-react'
import { useDoctors } from '../lib/api'
import { useDeleteStage, useMoveStage, useSaveStage, useSetWonStage, usePipelineStages, useStuckThresholds, STUCK_SETTING_KEY, type PipelineStage } from '../lib/pipeline'
import { useSaveAppSetting } from '../lib/api'
import { toast } from '../lib/toast'
import { Field, Spinner } from './ui'
import { Section } from './SettingsKit'

function StageRow({ stage, index, last, count, others, onMove }: { stage: PipelineStage; index: number; last: boolean; count: number; others: PipelineStage[]; onMove: (dir: -1 | 1) => void }) {
  const save = useSaveStage()
  const del = useDeleteStage()
  const won = useSetWonStage()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(stage.name)
  const [hint, setHint] = useState(stage.suggested_step ?? '')
  const [stuck, setStuck] = useState(stage.stuck_days ? String(stage.stuck_days) : '')

  async function remove() {
    let moveTo = ''
    if (count > 0) {
      const options = others.map((o) => o.name)
      const answer = window.prompt(`בשלב "${stage.name}" יש ${count} רופאים.\nלאיזה שלב להעביר אותם? כתוב את שם השלב (או השאר ריק כדי להשאיר אותם בלי שלב):\n\n${options.join('\n')}`, '')
      if (answer === null) return
      moveTo = answer.trim()
      if (moveTo && !options.includes(moveTo)) return toast('השלב שכתבת לא ברשימה — המחיקה בוטלה', { kind: 'error' })
    } else if (!window.confirm(`למחוק את השלב "${stage.name}"?`)) return
    del.mutate({ id: stage.id, moveTo })
  }

  function cancel() {
    setName(stage.name)
    setHint(stage.suggested_step ?? '')
    setStuck(stage.stuck_days ? String(stage.stuck_days) : '')
    setEditing(false)
  }

  function submit() {
    if (!name.trim()) return
    save.mutate(
      { id: stage.id, name, suggested_step: hint, stuck_days: stuck.trim() ? Math.min(365, Math.max(1, Math.floor(Number(stuck)) || 1)) : null },
      { onSuccess: () => setEditing(false), onError: (e) => toast(e instanceof Error ? e.message : 'השמירה נכשלה', { kind: 'error' }) },
    )
  }

  if (editing) {
    return (
      <li className="py-2">
        <form
          className="space-y-3 rounded-xl border border-brand-200 bg-brand-50/40 p-3"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <Field label="שם השלב">
            <input className="input" value={name} autoFocus onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="תקוע אחרי כמה ימים בשלב הזה">
            <input className="input" type="number" min={1} max={365} inputMode="numeric" value={stuck} placeholder="ריק = ברירת המחדל" onChange={(e) => setStuck(e.target.value)} />
          </Field>
          <Field label="צעד הבא מוצע בשלב הזה">
            <input className="input" value={hint} onChange={(e) => setHint(e.target.value)} />
          </Field>
          <label className="flex min-h-[40px] items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={stage.is_won} disabled={won.isPending} onChange={() => won.mutate(stage.is_won ? null : stage.id)} />
            <span>
              שלב הסגירה
              <span className="block text-xs text-slate-500">הגעה לשלב הזה = הרופא הפך ללקוח. השינוי נשמר מיד.</span>
            </span>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn-primary flex-1 sm:flex-none" disabled={!name.trim() || save.isPending}>
              <Check size={16} aria-hidden /> שמור
            </button>
            <button type="button" className="btn-secondary flex-1 sm:flex-none" onClick={cancel}>
              ביטול
            </button>
            <button type="button" className="btn-ghost text-red-600 max-sm:basis-full" onClick={() => void remove()}>
              <Trash2 size={16} aria-hidden /> מחק את השלב
            </button>
          </div>
        </form>
      </li>
    )
  }

  return (
    <li className="flex items-start gap-1 py-2 text-sm">
      <span className="mt-2 w-6 shrink-0 text-center text-xs text-slate-500" aria-hidden>
        {index + 1}
      </span>
      <div className="min-w-0 flex-1 py-1">
        <p className="font-medium text-slate-800 [overflow-wrap:anywhere]">
          {stage.name}
          {stage.is_won && <span className="chip mr-2 border-emerald-200 bg-emerald-50 !py-0 text-emerald-700">שלב הסגירה</span>}
        </p>
        <p className="text-xs text-slate-500">
          {count} רופאים
          {stage.stuck_days ? ` · תקוע אחרי ${stage.stuck_days} ימים` : ''}
        </p>
        {stage.suggested_step && <p className="text-xs text-slate-500">צעד מוצע: {stage.suggested_step}</p>}
      </div>
      <button type="button" className="btn-ghost !px-2 disabled:opacity-30" aria-label={`הזז את ${stage.name} למעלה`} disabled={index === 0} onClick={() => onMove(-1)}>
        <ArrowUp size={16} />
      </button>
      <button type="button" className="btn-ghost !px-2 disabled:opacity-30" aria-label={`הזז את ${stage.name} למטה`} disabled={last} onClick={() => onMove(1)}>
        <ArrowDown size={16} />
      </button>
      <button type="button" className="btn-ghost !px-2" aria-label={`עריכת השלב ${stage.name}`} onClick={() => setEditing(true)}>
        <Pencil size={16} />
      </button>
    </li>
  )
}

/** the stages of the funnel of potential doctors: rename, reorder, add, delete (managers) */
export function PipelineStagesSettings() {
  const { stages, isLoading } = usePipelineStages()
  const doctors = useDoctors()
  const save = useSaveStage()
  const move = useMoveStage()
  const [name, setName] = useState('')
  const thresholds = useStuckThresholds()
  const saveSetting = useSaveAppSetting()
  const [days, setDays] = useState(String(thresholds.defaultDays))
  useEffect(() => setDays(String(thresholds.defaultDays)), [thresholds.defaultDays])
  const daysDirty = Number(days) !== thresholds.defaultDays

  const counts = new Map<string, number>()
  for (const d of doctors.data ?? []) if (d.status === 'potential' && d.pipeline_stage) counts.set(d.pipeline_stage, (counts.get(d.pipeline_stage) ?? 0) + 1)

  return (
    <Section title="שלבי המשפך של רופאים פוטנציאליים" count={stages.length} className="lg:col-span-2">
      <p className="mb-3 text-sm text-slate-600">הסדר כאן הוא הסדר במשפך. שינוי שם של שלב מעדכן את כל הרופאים שנמצאים בו. מחיקת שלב מעבירה את הרופאים לשלב אחר.</p>
      <form
        className="mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm"
        onSubmit={(e) => {
          e.preventDefault()
          if (daysDirty && Number(days) >= 1) saveSetting.mutate({ key: STUCK_SETTING_KEY, value: String(Math.min(365, Math.max(1, Math.floor(Number(days))))) }, { onSuccess: () => toast('הסף עודכן') })
        }}
      >
        <label htmlFor="stuck-days" className="text-slate-700">
          רופא פוטנציאלי נחשב תקוע אחרי
        </label>
        <input id="stuck-days" type="number" min={1} max={365} inputMode="numeric" className="input !w-20 text-center" value={days} onChange={(e) => setDays(e.target.value)} />
        <span className="text-slate-700">ימים באותו שלב.</span>
        {daysDirty && (
          <button className="btn-primary" disabled={saveSetting.isPending || !(Number(days) >= 1)}>
            שמירה
          </button>
        )}
        <span className="w-full text-xs text-slate-500">אפשר להגדיר סף אחר לשלב מסוים בעריכת השלב.</span>
      </form>
      <form
        className="mb-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (!name.trim()) return
          save.mutate({ name, sort: Math.max(0, ...stages.map((s) => s.sort)) + 1 }, { onSuccess: () => setName(''), onError: (err) => toast(err instanceof Error ? err.message : 'ההוספה נכשלה (אולי השלב כבר קיים)', { kind: 'error' }) })
        }}
      >
        <input className="input" aria-label="שם שלב חדש" enterKeyHint="done" placeholder="שלב חדש, למשל: הצעת מחיר" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn-primary shrink-0" disabled={!name.trim() || save.isPending}>
          <Plus size={16} aria-hidden /> הוסף
        </button>
      </form>
      {isLoading ? (
        <Spinner />
      ) : (
        <ul className="divide-y divide-slate-100">
          {stages.map((s, i) => (
            <StageRow key={s.id} stage={s} index={i} last={i === stages.length - 1} count={counts.get(s.name) ?? 0} others={stages.filter((o) => o.id !== s.id)} onMove={(dir) => move.mutate({ a: s, b: stages[i + dir] })} />
          ))}
          {stages.length === 0 && <li className="py-5 text-center text-sm text-slate-500">עוד לא הוגדרו שלבים.</li>}
        </ul>
      )}
    </Section>
  )
}
