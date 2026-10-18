import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2 } from 'lucide-react'
import { useDoctors } from '../lib/api'
import { useDeleteStage, useMoveStage, useSaveStage, useSetWonStage, usePipelineStages, useStuckThresholds, STUCK_SETTING_KEY, type PipelineStage } from '../lib/pipeline'
import { useSaveAppSetting } from '../lib/api'
import { toast } from '../lib/toast'
import { classNames } from '../lib/utils'
import { Spinner } from './ui'

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

  return (
    <li className="flex flex-wrap items-center gap-2 py-2 text-sm">
      <span className="w-6 shrink-0 text-center text-xs text-slate-400">{index + 1}</span>
      {editing ? (
        <div className="flex min-w-0 flex-1 flex-wrap gap-2">
          <input className="input !w-auto max-w-xs flex-1" value={name} autoFocus aria-label="שם השלב" onChange={(e) => setName(e.target.value)} />
          <input className="input !w-24" type="number" min={1} max={365} inputMode="numeric" value={stuck} aria-label="תקוע אחרי כמה ימים (ריק = ברירת המחדל)" placeholder="ימים" title="תקוע אחרי כמה ימים בשלב הזה (ריק = ברירת המחדל)" onChange={(e) => setStuck(e.target.value)} />
          <input className="input !w-auto min-w-48 flex-1" value={hint} aria-label="צעד הבא מוצע בשלב" placeholder="צעד הבא מוצע בשלב הזה" onChange={(e) => setHint(e.target.value)} />
        </div>
      ) : (
        <span className="min-w-0 flex-1 font-medium text-slate-800">
          {stage.name} <span className="mr-1 text-xs font-normal text-slate-400">{count} רופאים</span>
          {stage.suggested_step && <span className="block text-xs font-normal text-slate-500">צעד מוצע: {stage.suggested_step}</span>}
          {stage.stuck_days ? <span className="block text-xs font-normal text-slate-500">תקוע אחרי {stage.stuck_days} ימים בשלב</span> : null}
          {stage.is_won && <span className="chip mr-1 border-emerald-200 bg-emerald-50 !py-0 text-emerald-700">הפך ללקוח</span>}
        </span>
      )}
      {editing ? (
        <>
          <button
            type="button"
            className="btn-ghost !px-2 text-brand-600"
            disabled={!name.trim() || save.isPending}
            onClick={() => save.mutate({ id: stage.id, name, suggested_step: hint, stuck_days: stuck.trim() ? Math.min(365, Math.max(1, Math.floor(Number(stuck)) || 1)) : null }, { onSuccess: () => setEditing(false), onError: (e) => toast(e instanceof Error ? e.message : 'השמירה נכשלה', { kind: 'error' }) })}
          >
            <Check size={15} /> שמור
          </button>
          <button type="button" className="btn-ghost !px-2 text-slate-500" onClick={() => (setName(stage.name), setHint(stage.suggested_step ?? ''), setStuck(stage.stuck_days ? String(stage.stuck_days) : ''), setEditing(false))}>
            ביטול
          </button>
        </>
      ) : (
        <>
          <button type="button" className={classNames('rounded-full border px-2.5 py-0.5 text-xs', stage.is_won ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50')} aria-pressed={stage.is_won} title="הגעה לשלב הזה = הרופא הפך ללקוח" onClick={() => won.mutate(stage.is_won ? null : stage.id)}>
            {stage.is_won ? 'שלב הסגירה' : 'סמן כשלב הסגירה'}
          </button>
          <button type="button" className="rounded-lg p-1.5 hover:bg-slate-100 disabled:opacity-30" aria-label={`הזז את ${stage.name} למעלה`} disabled={index === 0} onClick={() => onMove(-1)}>
            <ArrowUp size={15} />
          </button>
          <button type="button" className="rounded-lg p-1.5 hover:bg-slate-100 disabled:opacity-30" aria-label={`הזז את ${stage.name} למטה`} disabled={last} onClick={() => onMove(1)}>
            <ArrowDown size={15} />
          </button>
          <button type="button" className="btn-ghost !px-2" aria-label={`שנה שם של ${stage.name}`} onClick={() => setEditing(true)}>
            <Pencil size={15} />
          </button>
          <button type="button" className="btn-ghost !px-2 text-red-500" aria-label={`מחק את ${stage.name}`} onClick={() => void remove()}>
            <Trash2 size={15} />
          </button>
        </>
      )}
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
    <div className="card p-5">
      <h2 className="mb-1 font-semibold text-slate-800">שלבי המשפך של רופאים פוטנציאליים</h2>
      <p className="mb-3 text-xs text-slate-500">הסדר כאן הוא הסדר במשפך. שינוי שם של שלב מעדכן את כל הרופאים שנמצאים בו. מחיקת שלב מעבירה את הרופאים לשלב אחר.</p>
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm">
        <span className="text-slate-700">רופא פוטנציאלי נחשב תקוע אחרי</span>
        <input type="number" min={1} max={365} inputMode="numeric" className="input !w-20 text-center" aria-label="ימים לתקוע — ברירת מחדל" value={days} onChange={(e) => setDays(e.target.value)} />
        <span className="text-slate-700">ימים באותו שלב.</span>
        {daysDirty && (
          <button type="button" className="btn-primary !py-1" disabled={saveSetting.isPending || !(Number(days) >= 1)} onClick={() => saveSetting.mutate({ key: STUCK_SETTING_KEY, value: String(Math.min(365, Math.max(1, Math.floor(Number(days))))) }, { onSuccess: () => toast('הסף עודכן') })}>
            שמירה
          </button>
        )}
        <span className="w-full text-xs text-slate-500">אפשר להגדיר סף אחר לשלב מסוים בעריכת השלב (העיפרון).</span>
      </div>
      <form
        className="mb-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (!name.trim()) return
          save.mutate({ name, sort: Math.max(0, ...stages.map((s) => s.sort)) + 1 }, { onSuccess: () => setName(''), onError: (err) => toast(err instanceof Error ? err.message : 'ההוספה נכשלה (אולי השלב כבר קיים)', { kind: 'error' }) })
        }}
      >
        <input className="input" placeholder="שם שלב חדש, למשל: הצעת מחיר" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn-primary shrink-0" disabled={!name.trim() || save.isPending}>
          <Plus size={16} /> הוסף
        </button>
      </form>
      {isLoading ? (
        <Spinner />
      ) : (
        <ul className="divide-y divide-slate-100">
          {stages.map((s, i) => (
            <StageRow key={s.id} stage={s} index={i} last={i === stages.length - 1} count={counts.get(s.name) ?? 0} others={stages.filter((o) => o.id !== s.id)} onMove={(dir) => move.mutate({ a: s, b: stages[i + dir] })} />
          ))}
        </ul>
      )}
    </div>
  )
}
