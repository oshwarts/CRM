import { useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, FileText, Paperclip, Pencil, Trash2, X } from 'lucide-react'
import { openProjectFile, useAddProjectUpdate, useDeleteProjectUpdate, useProjectFiles, useEditProjectUpdate, useProjectUpdates } from '../lib/projectsApi'
import { useAuth } from '../context/AuthProvider'
import { ConfirmButton, Spinner } from './ui'
import { classNames, formatDate, todayISO } from '../lib/utils'
import type { ProjectFile, ProjectUpdate } from '../lib/types'

const timeOf = (iso: string) => new Intl.DateTimeFormat('he-IL', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
const dayTitle = (d: string) => new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${d}T12:00:00`))
const kb = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`)
const WEEKDAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']

/** month grid: days with updates carry a number; tapping a day filters the log to it */
function MonthCalendar({ counts, selected, onSelect }: { counts: Map<string, number>; selected: string | null; onSelect: (d: string | null) => void }) {
  const [month, setMonth] = useState(() => (selected ?? todayISO()).slice(0, 7))
  const [y, m] = month.split('-').map(Number)
  const first = new Date(y, m - 1, 1)
  const days = new Date(y, m, 0).getDate()
  const cells: (string | null)[] = [...Array(first.getDay()).fill(null), ...Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)]
  const shift = (n: number) => {
    const d = new Date(y, m - 1 + n, 1)
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const today = todayISO()
  const inMonth = [...counts.entries()].filter(([d]) => d.startsWith(month)).reduce((n, [, c]) => n + c, 0)

  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="mb-2 flex items-center justify-between">
        <button className="btn-ghost !px-2" onClick={() => shift(-1)} aria-label="חודש קודם">
          <ChevronRight size={16} />
        </button>
        <p className="text-sm font-semibold text-slate-700">
          {new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric' }).format(first)}
          <span className="mr-2 text-xs font-normal text-slate-400">{inMonth} עדכונים</span>
        </p>
        <button className="btn-ghost !px-2" onClick={() => shift(1)} aria-label="חודש הבא">
          <ChevronLeft size={16} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1 font-medium text-slate-400">
            {w}
          </div>
        ))}
        {cells.map((d, i) =>
          d ? (
            <button
              key={d}
              onClick={() => onSelect(selected === d ? null : d)}
              className={classNames(
                'relative aspect-square rounded-lg text-sm transition',
                selected === d ? 'bg-brand-500 text-white' : counts.has(d) ? 'bg-brand-50 font-semibold text-brand-700 hover:bg-brand-100' : 'text-slate-500 hover:bg-slate-50',
                d === today && selected !== d && 'ring-1 ring-brand-300',
              )}
            >
              {Number(d.slice(8))}
              {counts.has(d) && <span className={classNames('absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full', selected === d ? 'bg-white' : 'bg-brand-500')} />}
            </button>
          ) : (
            <div key={`e${i}`} />
          ),
        )}
      </div>
    </div>
  )
}

/** inline editor of one written update: text, date, files */
function UpdateEditor({ u, attached, taskId, onDone }: { u: ProjectUpdate; attached: ProjectFile[]; taskId: string | null; onDone: () => void }) {
  const edit = useEditProjectUpdate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [body, setBody] = useState(u.body)
  const [date, setDate] = useState(u.event_date)
  const [remove, setRemove] = useState<Set<string>>(new Set())
  const [added, setAdded] = useState<File[]>([])
  const [error, setError] = useState('')

  async function save() {
    setError('')
    if (!body.trim() && attached.length - remove.size + added.length === 0) return setError('אי אפשר להשאיר עדכון ריק')
    try {
      await edit.mutateAsync({
        id: u.id,
        projectId: u.project_id,
        taskId: u.task_id ?? taskId,
        body,
        eventDate: date,
        removeFiles: attached.filter((f) => remove.has(f.id)),
        newFiles: added,
      })
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : 'השמירה נכשלה')
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm text-slate-500">תאריך האירוע</label>
        <input type="date" className="input !w-auto !py-1" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
      </div>
      <textarea className="input min-h-20" dir="auto" autoFocus value={body} onChange={(e) => setBody(e.target.value)} />
      <ul className="flex flex-wrap gap-2">
        {attached.map((f) => (
          <li key={f.id} className={classNames('chip border-slate-200 bg-slate-50 text-slate-600', remove.has(f.id) && 'line-through opacity-50')}>
            <FileText size={12} /> {f.file_name}
            <button
              type="button"
              aria-label={remove.has(f.id) ? 'החזר קובץ' : 'הסר קובץ'}
              onClick={() =>
                setRemove((x) => {
                  const n = new Set(x)
                  if (n.has(f.id)) n.delete(f.id)
                  else n.add(f.id)
                  return n
                })
              }
            >
              {remove.has(f.id) ? '↺' : <X size={12} />}
            </button>
          </li>
        ))}
        {added.map((f, i) => (
          <li key={i} className="chip border-brand-200 bg-brand-50 text-brand-700">
            <FileText size={12} /> {f.name}
            <button type="button" aria-label="הסר" onClick={() => setAdded((x) => x.filter((_, k) => k !== i))}>
              <X size={12} />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" className="btn-ghost" onClick={() => fileRef.current?.click()}>
          <Paperclip size={16} />
          צרף קובץ
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            setAdded((x) => [...x, ...Array.from(e.target.files ?? [])])
            e.target.value = ''
          }}
        />
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={onDone}>
            ביטול
          </button>
          <button className="btn-primary" onClick={save} disabled={edit.isPending}>
            {edit.isPending ? 'שומר…' : 'שמירה'}
          </button>
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}

/** the project's log: dated notes (a call, a mail, an approval) with files; for the whole project (with a calendar) or for one task */
export function ProjectUpdates({ projectId, taskId, taskNames }: { projectId: string; taskId?: string; taskNames?: Map<string, string> }) {
  const { profile, isAdmin, user } = useAuth()
  const updates = useProjectUpdates(projectId)
  const files = useProjectFiles(projectId)
  const add = useAddProjectUpdate()
  const [editing, setEditing] = useState<string | null>(null)
  const del = useDeleteProjectUpdate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [body, setBody] = useState('')
  const [date, setDate_] = useState(todayISO())
  const [picked, setPicked] = useState<File[]>([])
  const [day, setDay] = useState<string | null>(null)
  const [error, setError] = useState('')

  const mine = useMemo(() => (updates.data ?? []).filter((u) => !taskId || u.task_id === taskId), [updates.data, taskId])
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const u of mine) m.set(u.event_date, (m.get(u.event_date) ?? 0) + 1)
    return m
  }, [mine])
  const list = day ? mine.filter((u) => u.event_date === day) : mine
  // newest day first; inside a day, in the order they were written
  const groups = useMemo(() => {
    const m = new Map<string, typeof list>()
    for (const u of [...list].sort((a, b) => b.event_date.localeCompare(a.event_date) || a.created_at.localeCompare(b.created_at))) m.set(u.event_date, [...(m.get(u.event_date) ?? []), u])
    return [...m.entries()]
  }, [list])

  async function post() {
    setError('')
    if (!body.trim() && picked.length === 0) return
    try {
      await add.mutateAsync({ projectId, taskId: taskId ?? null, body, files: picked, authorName: profile?.full_name || profile?.email || '', eventDate: date || todayISO() })
      setBody('')
      setPicked([])
      setDate_(todayISO())
    } catch (e) {
      setError(e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : 'השמירה נכשלה')
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2 rounded-xl border border-slate-200 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm text-slate-500">תאריך האירוע</label>
          <input type="date" className="input !w-auto !py-1" value={date} onChange={(e) => setDate_(e.target.value)} />
          {date !== todayISO() && (
            <button type="button" className="text-xs text-brand-600 hover:underline" onClick={() => setDate_(todayISO())}>
              היום
            </button>
          )}
        </div>
        <textarea className="input min-h-16" dir="auto" placeholder="מה קרה? שיחה, מייל, אישור, חסם…" value={body} onChange={(e) => setBody(e.target.value)} />
        {picked.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {picked.map((f, i) => (
              <li key={i} className="chip border-slate-200 bg-slate-50 text-slate-600">
                <FileText size={12} /> {f.name}
                <button type="button" onClick={() => setPicked((x) => x.filter((_, k) => k !== i))} aria-label="הסר">
                  <X size={12} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center justify-between gap-2">
          <button type="button" className="btn-ghost" onClick={() => fileRef.current?.click()}>
            <Paperclip size={16} />
            צרף קובץ או תמונה
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              setPicked((x) => [...x, ...Array.from(e.target.files ?? [])])
              e.target.value = ''
            }}
          />
          <button className="btn-primary" onClick={post} disabled={add.isPending || (!body.trim() && picked.length === 0)}>
            {add.isPending ? 'שומר…' : 'הוסף עדכון'}
          </button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      {!taskId && mine.length > 0 && <MonthCalendar counts={counts} selected={day} onSelect={setDay} />}
      {day && (
        <p className="flex items-center justify-between rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">
          מוצגים עדכונים מ-{dayTitle(day)}
          <button className="underline" onClick={() => setDay(null)}>
            הצג הכול
          </button>
        </p>
      )}

      {updates.isLoading ? (
        <Spinner />
      ) : groups.length === 0 ? (
        <p className="text-sm text-slate-400">{day ? 'אין עדכונים ביום זה.' : 'עדיין אין עדכונים.'}</p>
      ) : (
        <div className="space-y-4">
          {groups.map(([d, items]) => (
            <section key={d}>
              <h3 className="mb-1.5 flex items-baseline gap-2 text-sm font-semibold text-slate-600">
                {dayTitle(d)}
                <span className="text-xs font-normal text-slate-400">{items.length} עדכונים</span>
              </h3>
              <ul className="space-y-2 border-r-2 border-brand-200 pr-3">
                {items.map((u) => {
                  const attached = (files.data ?? []).filter((f) => f.update_id === u.id)
                  const canEdit = isAdmin || u.author_id === user?.id
                  return (
                    <li key={u.id} className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs text-slate-400">
                          {u.author_name || 'משתמש'} · נרשם {timeOf(u.created_at)}
                          {u.edited_at && <span className="mr-1">· נערך {formatDate(u.edited_at.slice(0, 10))}</span>}
                          {!taskId && u.task_id && taskNames?.get(u.task_id) && <span className="mr-2 text-slate-500">· משימה: {taskNames.get(u.task_id)}</span>}
                        </p>
                        {canEdit && (
                          <span className="flex items-center gap-1">
                            <button className="btn-ghost !px-1.5 text-xs text-slate-400 hover:text-brand-600" onClick={() => setEditing(u.id)}>
                              <Pencil size={13} /> ערוך
                            </button>
                            <ConfirmButton className="btn-ghost !px-1.5 text-slate-300 hover:text-red-500" message="למחוק את העדכון והקבצים שצורפו אליו?" onConfirm={() => del.mutate(u.id)}>
                              <Trash2 size={14} />
                            </ConfirmButton>
                          </span>
                        )}
                      </div>
                      {editing === u.id ? (
                        <div className="mt-2">
                          <UpdateEditor u={u} attached={attached} taskId={taskId ?? null} onDone={() => setEditing(null)} />
                        </div>
                      ) : (
                        <>
                      {u.body && (
                        <p dir="auto" className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                          {u.body}
                        </p>
                      )}
                      {attached.length > 0 && (
                        <ul className="mt-2 flex flex-wrap gap-2">
                          {attached.map((f) => (
                            <li key={f.id}>
                              <button
                                className="chip border-brand-200 bg-brand-50 text-brand-700 hover:underline"
                                onClick={async () => {
                                  const err = await openProjectFile(f)
                                  if (err) setError(err)
                                }}
                              >
                                <FileText size={12} /> {f.file_name} <span className="text-slate-400">{kb(f.file_size)}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                        </>
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
