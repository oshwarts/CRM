import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { useProcedures, useSaveTemplateStages, useTemplateStages } from '../lib/api'
import { Spinner } from './ui'

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

  useEffect(() => {
    if (!procedureId && procedures.data?.length) setProcedureId(procedures.data[0].id)
  }, [procedureId, procedures.data])

  useEffect(() => {
    if (!procedureId || !templates.data) return
    setTitles(templates.data.filter((t) => t.procedure_id === procedureId).sort((a, b) => a.sort - b.sort).map((t) => t.title))
  }, [procedureId, templates.data])

  async function submit() {
    await save.mutateAsync({ procedureId, titles })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (procedures.isLoading || templates.isLoading) return <Spinner />

  return (
    <div className="card space-y-4 p-4">
      <div>
        <h3 className="font-semibold text-slate-800">שלבי ברירת מחדל למהלך ניתוחי</h3>
        <p className="text-sm text-slate-400">
          לכל פרוצדורה רשימת שלבים משלה. כשמוסיפים מהלך ניתוחי לרופא, הוא נפתח עם השלבים האלה ואפשר לשנות אותם
          לרופא ספציפי. שינוי כאן לא משפיע על מהלכים שכבר נוצרו.
        </p>
      </div>

      <label className="block max-w-sm">
        <span className="label">פרוצדורה</span>
        <select className="input" value={procedureId} onChange={(e) => setProcedureId(e.target.value)}>
          {(procedures.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <div className="space-y-2">
        {titles.map((t, i) => (
          <div key={i} className="flex items-center gap-1">
            <span className="w-5 text-center text-xs text-slate-400">{i + 1}</span>
            <input
              className="input max-w-sm"
              placeholder="שם השלב"
              value={t}
              onChange={(e) => setTitles((x) => x.map((v, k) => (k === i ? e.target.value : v)))}
            />
            <button type="button" className="btn-ghost !px-2" onClick={() => setTitles((x) => move(x, i, -1))} aria-label="למעלה">
              <ArrowUp size={16} />
            </button>
            <button type="button" className="btn-ghost !px-2" onClick={() => setTitles((x) => move(x, i, 1))} aria-label="למטה">
              <ArrowDown size={16} />
            </button>
            <button
              type="button"
              className="btn-ghost !px-2 text-red-500"
              onClick={() => setTitles((x) => x.filter((_, k) => k !== i))}
              aria-label="מחק"
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

      <div className="flex items-center gap-2 border-t border-slate-200 pt-3">
        <button className="btn-primary" onClick={submit} disabled={save.isPending || !procedureId}>
          {saved ? 'נשמר ✓' : 'שמירה'}
        </button>
      </div>
    </div>
  )
}
