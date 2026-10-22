import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, ListChecks, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import {
  useCreateCourse,
  useDeleteCourse,
  useDoctorCourses,
  useProcedures,
  useSaveCourse,
  type CourseDraft,
} from '../lib/api'
import type { SurgicalCourse as Course } from '../lib/types'
import { classNames } from '../lib/utils'
import { ConfirmButton, EmptyState, Spinner } from './ui'
import { StickyActions } from './StickyActions'

const checkKey = (courseId: string) => `ami.course.checked.${courseId}`

function loadChecked(courseId: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(checkKey(courseId)) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

function move<T>(list: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir
  if (j < 0 || j >= list.length) return list
  const next = [...list]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

/* ---------------- checklist (view) ---------------- */

function Checklist({ course }: { course: Course }) {
  const [checked, setChecked] = useState(() => loadChecked(course.id))

  function toggle(id: string) {
    setChecked((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      try {
        localStorage.setItem(checkKey(course.id), JSON.stringify([...next]))
      } catch {
        // checks just won't be remembered
      }
      return next
    })
  }

  function reset() {
    setChecked(new Set())
    try {
      localStorage.removeItem(checkKey(course.id))
    } catch {
      // ignore
    }
  }

  const total = course.stages.reduce((n, s) => n + s.items.length, 0)
  const done = course.stages.reduce((n, s) => n + s.items.filter((i) => checked.has(i.id)).length, 0)

  if (total === 0)
    return <p className="text-sm text-slate-400">עוד לא הוזנו שורות במהלך הזה — לחץ "עריכה" כדי למלא.</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 text-sm text-slate-500">
        <span>
          סומנו {done} מתוך {total}
        </span>
        {done > 0 && (
          <button className="inline-flex items-center gap-1 text-brand-600 hover:underline" onClick={reset}>
            <RotateCcw size={14} />
            אפס סימונים
          </button>
        )}
      </div>

      {course.stages.map((st) => {
        const stDone = st.items.filter((i) => checked.has(i.id)).length
        return (
          <section key={st.id} className="rounded-xl border border-slate-200">
            <h3 className="flex items-center justify-between rounded-t-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
              <span>{st.title}</span>
              {st.items.length > 0 && (
                <span className={classNames('text-xs font-normal', stDone === st.items.length ? 'text-emerald-700' : 'text-slate-500')}>
                  {stDone}/{st.items.length}
                </span>
              )}
            </h3>
            {st.items.length === 0 ? (
              <p className="px-3 py-2 text-sm text-slate-500">אין שורות בשלב הזה</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {st.items.map((it) => (
                  <li key={it.id}>
                    <label className="flex cursor-pointer items-start gap-3 px-3 py-3 active:bg-slate-50">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-6 w-6 shrink-0"
                        checked={checked.has(it.id)}
                        onChange={() => toggle(it.id)}
                      />
                      <span
                        dir="auto"
                        className={classNames(
                          'whitespace-pre-wrap text-[15px] leading-relaxed',
                          checked.has(it.id) ? 'text-slate-500 line-through' : 'text-slate-800',
                        )}
                      >
                        {it.text}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}

/* ---------------- editor ---------------- */

function Editor({
  course,
  onCancel,
  onSaved,
  doctorId,
}: {
  course: Course
  onCancel: () => void
  onSaved: () => void
  doctorId: string
}) {
  const save = useSaveCourse(doctorId)
  const [draft, setDraft] = useState<CourseDraft>(() =>
    course.stages.map((s) => ({ title: s.title, items: s.items.map((i) => i.text) })),
  )
  const [error, setError] = useState('')
  const busy = useRef(false) // a second tap before the screen re-renders must not save twice

  const setStage = (i: number, p: Partial<CourseDraft[number]>) =>
    setDraft((d) => d.map((s, x) => (x === i ? { ...s, ...p } : s)))

  async function submit() {
    if (busy.current) return
    busy.current = true
    setError('')
    try {
      await save.mutateAsync({ courseId: course.id, draft })
      try {
        localStorage.removeItem(checkKey(course.id)) // item ids change on save
      } catch {
        // ignore
      }
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'השמירה נכשלה')
    } finally {
      busy.current = false
    }
  }

  return (
    <div className="space-y-4">
      {draft.map((st, i) => (
        <section key={i} className="space-y-2 rounded-xl border border-brand-200 bg-brand-50/30 p-3">
          <div className="flex items-center gap-1">
            <input
              className="input min-w-0 flex-1 font-semibold"
              placeholder="שם השלב"
              aria-label={`שם שלב ${i + 1}`}
              value={st.title}
              onChange={(e) => setStage(i, { title: e.target.value })}
            />
            <button type="button" className="btn-ghost !px-2" onClick={() => setDraft((d) => move(d, i, -1))} aria-label={`הזז שלב ${i + 1} למעלה`}>
              <ArrowUp size={16} />
            </button>
            <button type="button" className="btn-ghost !px-2" onClick={() => setDraft((d) => move(d, i, 1))} aria-label={`הזז שלב ${i + 1} למטה`}>
              <ArrowDown size={16} />
            </button>
            <button
              type="button"
              className="btn-ghost !px-2 text-red-600"
              onClick={() => setDraft((d) => d.filter((_, x) => x !== i))}
              aria-label={`מחק שלב ${i + 1}`}
            >
              <Trash2 size={16} />
            </button>
          </div>

          {st.items.map((text, k) => (
            <div key={k} className="space-y-1 rounded-lg bg-white/70 p-2">
              <textarea
                dir="auto"
                className="input min-h-10 w-full"
                aria-label={`שורה ${k + 1} בשלב ${i + 1}`}
                rows={Math.min(5, Math.max(1, Math.ceil(text.length / 40)))}
                value={text}
                onChange={(e) => setStage(i, { items: st.items.map((t, x) => (x === k ? e.target.value : t)) })}
              />
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs text-slate-500">שורה {k + 1}</span>
                <div className="flex gap-1">
                  <button type="button" className="btn-ghost !px-2.5" onClick={() => setStage(i, { items: move(st.items, k, -1) })} aria-label={`שורה ${k + 1} למעלה`}>
                    <ArrowUp size={15} />
                  </button>
                  <button type="button" className="btn-ghost !px-2.5" onClick={() => setStage(i, { items: move(st.items, k, 1) })} aria-label={`שורה ${k + 1} למטה`}>
                    <ArrowDown size={15} />
                  </button>
                  <button
                    type="button"
                    className="btn-ghost !px-2.5 text-red-600"
                    onClick={() => setStage(i, { items: st.items.filter((_, x) => x !== k) })}
                    aria-label={`מחק שורה ${k + 1}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}

          <button type="button" className="btn-secondary" onClick={() => setStage(i, { items: [...st.items, ''] })}>
            <Plus size={15} />
            הוסף שורה
          </button>
        </section>
      ))}

      <button type="button" className="btn-secondary" onClick={() => setDraft((d) => [...d, { title: '', items: [''] }])}>
        <Plus size={16} />
        הוסף שלב
      </button>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <StickyActions>
        <button type="button" className="btn-secondary flex-1 sm:flex-none" onClick={onCancel}>
          ביטול
        </button>
        <button type="button" className="btn-primary flex-1 sm:flex-none" onClick={submit} disabled={save.isPending}>
          {save.isPending ? 'שומר…' : 'שמירה'}
        </button>
      </StickyActions>
    </div>
  )
}

/* ---------------- doctor tab ---------------- */

export function SurgicalCourseSection({ doctorId }: { doctorId: string }) {
  const courses = useDoctorCourses(doctorId)
  const procedures = useProcedures()
  const create = useCreateCourse(doctorId)
  const del = useDeleteCourse(doctorId)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pick, setPick] = useState('')
  const [error, setError] = useState('')

  const used = new Set((courses.data ?? []).map((c) => c.procedure_id))
  const free = (procedures.data ?? []).filter((p) => !used.has(p.id))

  useEffect(() => {
    if (!pick && free.length) setPick(free[0].id)
    if (pick && !free.some((p) => p.id === pick)) setPick(free[0]?.id ?? '')
  }, [free, pick])

  async function add() {
    if (!pick) return
    setError('')
    try {
      const id = await create.mutateAsync(pick)
      setEditingId(id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'יצירת המהלך נכשלה')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-slate-300 p-3">
        <label className="block min-w-48 flex-1">
          <span className="label">הוספת מהלך ניתוחי לפרוצדורה</span>
          <select className="input" value={pick} onChange={(e) => setPick(e.target.value)} disabled={free.length === 0}>
            {free.length === 0 && <option value="">{(procedures.data ?? []).length === 0 ? 'אין פרוצדורות במערכת' : 'כל הפרוצדורות כבר מוגדרות'}</option>}
            {free.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <button className="btn-primary" onClick={add} disabled={!pick || create.isPending}>
          <Plus size={16} />
          הוסף מהלך
        </button>
        <p className="w-full text-xs text-slate-400">
          המהלך נפתח עם שלבי התבנית של הפרוצדורה (ניתנת לשינוי בהגדרות ← מהלך ניתוחי), ואפשר לערוך אותם לרופא הזה בלבד.
        </p>
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {courses.isLoading && <Spinner />}
      {courses.data && courses.data.length === 0 && (
        <EmptyState title="עוד לא הוגדר מהלך ניתוחי לרופא" hint="בחר פרוצדורה למעלה ולחץ 'הוסף מהלך'" />
      )}

      {(courses.data ?? []).map((c) => (
        <div key={c.id} className="card space-y-3 p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-semibold text-slate-800">
              <ListChecks size={18} className="text-brand-500" />
              {c.procedure?.name ?? 'פרוצדורה'}
            </h2>
            <div className="flex gap-1">
              {editingId !== c.id && (
                <button className="btn-ghost !px-2" onClick={() => setEditingId(c.id)} aria-label={`עריכת המהלך: ${c.procedure?.name ?? 'פרוצדורה'}`}>
                  <Pencil size={16} />
                </button>
              )}
              <ConfirmButton
                className="btn-ghost !px-2 text-red-600"
                label={`מחיקת המהלך: ${c.procedure?.name ?? 'פרוצדורה'}`}
                message={`למחוק את המהלך הניתוחי "${c.procedure?.name ?? 'פרוצדורה'}" של הרופא? כל השלבים והשורות שהוזנו יימחקו.`}
                onConfirm={() => del.mutate(c.id)}
              >
                <Trash2 size={16} />
              </ConfirmButton>
            </div>
          </div>
          {editingId === c.id ? (
            <Editor course={c} doctorId={doctorId} onCancel={() => setEditingId(null)} onSaved={() => setEditingId(null)} />
          ) : (
            <Checklist course={c} />
          )}
        </div>
      ))}
    </div>
  )
}
