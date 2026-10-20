import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { useProcedures, useSaveTemplateStages, useTemplateStages } from '../lib/api'
import { Field, Spinner } from './ui'
import { classNames } from '../lib/utils'

function move<T>(list: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir
  if (j < 0 || j >= list.length) return list
  const next = [...list]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

export function CourseTemplatesSettings() {
  const procedures = useProcedures()
  const templates = useTemplateStages()
  const save = useSaveTemplateStages()
  const [procedureId, setProcedureId] = useState('')
  const [titles, setTitles] = useState<string[]>([])
  const [saved, setSaved] = useState(false)
  const [base, setBase] = useState<string[]>([])

  useEffect(() => {
    if (!procedureId && procedures.data?.length) setProcedureId(procedures.data[0].id)
  }, [procedureId, procedures.data])

  useEffect(() => {
    if (!procedureId || !templates.data) return
    const list = templates.data.filter((t) => t.procedure_id === procedureId).sort((a, b) => a.sort - b.sort).map((t) => t.title)
    setTitles(list)
    setBase(list)
  }, [procedureId, templates.data])

  async function submit() {
    await save.mutateAsync({ procedureId, titles })
    setBase(titles)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const dirty = JSON.stringify(titles) !== JSON.stringify(base)
  function pick(id: string) {
    if (dirty && !window.confirm('יש שינויים שלא נשמרו. לעבור בלי לשמור?')) return
    setProcedureId(id)
  }

  if (procedures.isLoading || templates.isLoading) return <Spinner />

  return (
    <div className="card space-y-4 p-4">
      <div>
        <h2 className="text-base font-semibold text-slate-800">שלבי ברירת מחדל למהלך ניתוחי</h2>
        <p className="text-sm text-slate-600">
          לכל פרוצדורה רשימת שלבים משלה. כשמוסיפים מהלך ניתוחי לרופא, הוא נפתח עם השלבים האלה ואפשר לשנות אותם
          לרופא ספציפי. שינוי כאן לא משפיע על מהלכים שכבר נוצרו.
        </p>
      </div>

      <Field label="פרוצדורה" className="sm:max-w-sm">
        <select className="input" value={procedureId} onChange={(e) => pick(e.target.value)}>
          {(procedures.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>

      <div className="space-y-2">
        {titles.map((t, i) => (
          <div key={i} className="flex items-center gap-1">
            <span className="w-5 shrink-0 text-center text-xs text-slate-500" aria-hidden>{i + 1}</span>
            <input
              className="input min-w-0 flex-1 sm:max-w-sm"
              aria-label={`שם שלב ${i + 1}`}
              placeholder="שם השלב"
              value={t}
              onChange={(e) => setTitles((x) => x.map((v, k) => (k === i ? e.target.value : v)))}
            />
            <button type="button" className="btn-ghost !px-2" onClick={() => setTitles((x) => move(x, i, -1))} aria-label={`הזז את שלב ${i + 1} למעלה`} disabled={i === 0}>
              <ArrowUp size={16} />
            </button>
            <button type="button" className="btn-ghost !px-2" onClick={() => setTitles((x) => move(x, i, 1))} aria-label={`הזז את שלב ${i + 1} למטה`} disabled={i === titles.length - 1}>
              <ArrowDown size={16} />
            </button>
            <button
              type="button"
              className="btn-ghost !px-2 text-red-600"
              onClick={() => setTitles((x) => x.filter((_, k) => k !== i))}
              aria-label={`מחק את שלב ${i + 1}`}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <button type="button" className="btn-secondary" onClick={() => setTitles((x) => [...x, ''])}>
          <Plus size={16} />
          הוסף שלב
        </button>
      </div>

      <div className={classNames('z-10 flex flex-wrap items-center gap-2', dirty ? 'sticky bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] rounded-2xl border border-brand-100 bg-white p-2 shadow-pop md:bottom-4' : 'border-t border-slate-200 pt-3')}>
        <span className="flex-1 px-2 text-sm text-amber-700">{dirty ? 'יש שינויים שלא נשמרו' : ''}</span>
        <button className="btn-primary" onClick={submit} disabled={save.isPending || !procedureId || !dirty}>
          {saved ? 'נשמר ✓' : 'שמירה'}
        </button>
      </div>
    </div>
  )
}
