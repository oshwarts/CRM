import { useEffect, useRef, useState } from 'react'
import { useDraft } from '../lib/useDraft'
import { QuickDates } from './QuickDates'
import { SearchSelect } from './SearchSelect'
import { Bell, BellOff, BellRing, ChevronDown, ChevronUp, Plus, X } from 'lucide-react'
import { useAgents, useDeleteTask, useDoctors, useHospitals, useSaveTask, type TaskFormData } from '../lib/api'
import { useAuth } from '../context/AuthProvider'
import type { TaskRow } from '../lib/types'
import { ConfirmButton, Field, Modal } from './ui'
import { TaskSuggestions, useTaskGuess } from './TaskSuggestions'
import { CoordinatorField } from './CoordinatorField'
import { taskError } from '../lib/taskLogic'
import { isoToLocalInput, localInputToIso } from '../lib/utils'
import { enablePush, pushStatus } from '../lib/push'

const emptyForm = (assignee: string | null): TaskFormData => ({
  description: '',
  notes: '',
  due_date: null,
  priority: 'normal',
  doctor_id: null,
  hospital_id: null,
  recurrence: 'none',
  assignee_id: assignee,
  reminder_at: null,
  subtasks: [],
})

/** create / edit a task. `defaults` pre-fills a new task (e.g. the doctor to follow up with). */
export function TaskFormModal({
  task,
  defaults,
  onClose,
}: {
  task?: TaskRow | null
  defaults?: Partial<TaskFormData>
  onClose: () => void
}) {
  const { user, isAdmin } = useAuth()
  const agents = useAgents()
  const doctors = useDoctors()
  const hospitals = useHospitals()
  const save = useSaveTask()
  const del = useDeleteTask()

  const initialData: TaskFormData =
    task
      ? {
          id: task.id,
          description: task.description,
          notes: task.notes,
          due_date: task.due_date,
          priority: task.priority === 'urgent' ? 'urgent' : 'normal',
          doctor_id: task.doctor_id,
          hospital_id: task.hospital_id,
          recurrence: (task.recurrence as TaskFormData['recurrence']) ?? 'none',
          assignee_id: task.assignee_id,
          coordinator_contact_id: task.coordinator_contact_id,
          coordinator_text: task.coordinator_text,
          reminder_at: task.reminder_at,
          subtasks: task.subtasks.map((s) => ({ id: s.id, text: s.text, is_done: s.is_done, due_date: s.due_date })),
        }
      : { ...emptyForm(user?.id ?? null), ...defaults }
  // a new task is kept as a draft on the device while it is written (not when it starts from a doctor's card)
  const draft = useDraft<TaskFormData>('task', initialData, !task && !defaults)
  const d = draft.value
  const setD = draft.setValue
  const [more, setMore] = useState(!!task || !!defaults)
  const [error, setError] = useState('')
  const [triedSave, setTriedSave] = useState(false)
  const guess = useTaskGuess(task ? '' : d.description) // suggestions only for a new task
  const set = (p: Partial<TaskFormData>) => setD((x) => ({ ...x, ...p }))

  const [notif, setNotif] = useState<'unsupported' | 'denied' | 'subscribed' | 'off' | 'loading'>('loading')
  useEffect(() => {
    pushStatus().then(setNotif)
  }, [])
  async function turnOnNotifications() {
    setNotif(await enablePush())
  }

  // focus the text field after the dialog has noted which button opened it (React's autoFocus runs earlier and would hide the opener,
  // so that closing the dialog could not give the focus back to it)
  const descRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => descRef.current?.focus({ preventScroll: true }), [])
  const sending = useRef(false) // a second tap before the screen has re-rendered must not create a second task
  async function submit() {
    if (sending.current) return
    setError('')
    if (!d.description.trim()) return setTriedSave(true)
    sending.current = true
    try {
      await save.mutateAsync(d)
      draft.clear()
      onClose()
    } catch (e) {
      setError(taskError(e, 'השמירה נכשלה'))
    } finally {
      sending.current = false
    }
  }

  const setSub = (i: number, p: Partial<TaskFormData['subtasks'][number]>) =>
    set({ subtasks: d.subtasks.map((s, k) => (k === i ? { ...s, ...p } : s)) })

  return (
    <Modal open onClose={onClose} title={task ? 'עריכת משימה' : 'משימה חדשה'} size="lg">
      <div className="space-y-4">
        <Field label="המשימה" error={triedSave && !d.description.trim() ? 'כתוב מה המשימה' : undefined}>
          <textarea
            className="input min-h-20"
            dir="auto"
            ref={descRef}
            placeholder="מה צריך לעשות?"
            value={d.description}
            onChange={(e) => set({ description: e.target.value })}
          />
          <p className="mt-1 text-xs text-slate-500">
            אפשר להכתיב במיקרופון. למשל "לשלוח הצעה לשוחט עד יום חמישי, דחוף" — המערכת תזהה תאריך, עדיפות, רופא ובית חולים.
          </p>
        </Field>
        {draft.restored && (
          <p className="flex items-center justify-between gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
            שוחזרה טיוטה שלא נשמרה
            <button type="button" className="font-medium underline" onClick={() => { setD(initialData); draft.clear() }}>
              התחל מחדש
            </button>
          </p>
        )}
        <TaskSuggestions
          guess={guess}
          onApply={(g) =>
            set({
              description: g.description,
              due_date: g.due_date ?? d.due_date,
              priority: g.priority ?? d.priority,
              recurrence: g.recurrence ?? d.recurrence,
              doctor_id: g.doctor_id ?? d.doctor_id,
              hospital_id: g.hospital_id ?? d.hospital_id,
            })
          }
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="תאריך יעד">
            <input type="date" className="input" value={d.due_date ?? ''} onChange={(e) => set({ due_date: e.target.value || null })} />
            <QuickDates value={d.due_date} onPick={(iso) => set({ due_date: iso })} />
          </Field>
          <Field label="עדיפות">
            <select className="input" value={d.priority} onChange={(e) => set({ priority: e.target.value as TaskFormData['priority'] })}>
              <option value="normal">רגילה</option>
              <option value="urgent">דחוף</option>
            </select>
          </Field>
        </div>

        <Field label="תזכורת בטלפון (אופציונלי)">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="datetime-local"
              className="input !w-auto"
              value={isoToLocalInput(d.reminder_at)}
              onChange={(e) => set({ reminder_at: localInputToIso(e.target.value) })}
            />
            {d.reminder_at && (
              <button type="button" className="btn-ghost !px-2 text-slate-500" onClick={() => set({ reminder_at: null })} aria-label="הסר תזכורת">
                <X size={16} />
              </button>
            )}
          </div>
          {d.reminder_at && notif !== 'loading' && notif !== 'subscribed' && (
            <p className="mt-1.5 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
              {notif === 'unsupported' ? (
                <>
                  <BellOff size={13} aria-hidden /> הדפדפן הזה לא תומך בהתראות פוש
                </>
              ) : notif === 'denied' ? (
                <>
                  <BellOff size={13} aria-hidden /> ההתראות חסומות בדפדפן — יש לאשר אותן בהגדרות הדפדפן כדי שהתזכורת תקפוץ
                </>
              ) : (
                <>
                  <Bell size={13} aria-hidden /> כדי שהתזכורת תקפוץ בטלפון צריך להפעיל התראות למכשיר הזה
                  <button type="button" className="font-medium underline" onClick={turnOnNotifications}>
                    הפעלת התראות
                  </button>
                </>
              )}
            </p>
          )}
          {d.reminder_at && notif === 'subscribed' && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-emerald-700">
              <BellRing size={13} aria-hidden /> התראות פעילות במכשיר הזה
            </p>
          )}
        </Field>

        <button type="button" className="flex min-h-[40px] w-full items-center justify-between gap-2 rounded-xl border border-brand-200 bg-white px-3 text-right text-sm font-medium text-brand-700 hover:bg-brand-50" onClick={() => setMore((m) => !m)} aria-expanded={more}>
          <span>{more ? 'פחות פרטים' : 'עוד פרטים'}</span>
          {!more && <span className="text-xs font-normal text-slate-500">רופא, בית חולים, חזרה, מתאם, שלבים</span>}
          {more ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {more && (
          <div className="space-y-4 rounded-2xl border border-brand-100 bg-brand-50/30 p-3">
        <div className="grid gap-3 sm:grid-cols-1">
          <Field label="חוזרת">
            <select className="input" value={d.recurrence} onChange={(e) => set({ recurrence: e.target.value as TaskFormData['recurrence'] })}>
              <option value="none">לא</option>
              <option value="weekly">כל שבוע</option>
              <option value="monthly">כל חודש</option>
            </select>
          </Field>
        </div>
        {d.recurrence !== 'none' && (
          <p className="-mt-2 text-xs text-slate-500">אחרי סימון "בוצע" תיווצר אוטומטית המשימה הבאה (דורש תאריך יעד).</p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="רופא (אופציונלי)">
            <SearchSelect
              options={(doctors.data ?? []).map((x) => ({ id: x.id, label: `${x.title} ${x.name}`.trim(), hint: x.position }))}
              value={d.doctor_id}
              onChange={(id) => set({ doctor_id: id })}
              placeholder="בחר רופא…"
            />
          </Field>
          <Field label="בית חולים (אופציונלי)">
            <SearchSelect options={(hospitals.data ?? []).map((x) => ({ id: x.id, label: x.name }))} value={d.hospital_id} onChange={(id) => set({ hospital_id: id })} placeholder="בחר בית חולים…" />
          </Field>
        </div>

        {isAdmin && (
          <Field label="סוכן אחראי">
            <select className="input" value={d.assignee_id ?? ''} onChange={(e) => set({ assignee_id: e.target.value || null })}>
              {(agents.data ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.full_name || a.email}
                  {a.id === user?.id ? ' (אני)' : ''}
                </option>
              ))}
            </select>
          </Field>
        )}

        <CoordinatorField contactId={d.coordinator_contact_id ?? null} text={d.coordinator_text ?? ''} onChange={set} />

        <Field label="פרטים והערות (אופציונלי)">
          <textarea className="input min-h-16" dir="auto" value={d.notes} onChange={(e) => set({ notes: e.target.value })} />
        </Field>

        <div>
          <span className="label">שלבים / תתי-משימות</span>
          <ul className="space-y-2">
            {d.subtasks.map((s, i) => (
              <li key={s.id ?? i} className="flex flex-wrap items-center gap-2">
                <input type="checkbox" className="h-6 w-6 shrink-0 accent-emerald-600" aria-label={`שלב ${i + 1} בוצע`} checked={s.is_done} onChange={(e) => setSub(i, { is_done: e.target.checked })} />
                <input
                  className="input min-w-0 flex-1 !py-1.5"
                  dir="auto"
                  value={s.text}
                  aria-label={`שלב ${i + 1}`}
                  enterKeyHint="next"
                  placeholder="שלב"
                  onChange={(e) => setSub(i, { text: e.target.value })}
                />
                <input type="date" className="input !w-auto !py-1.5 text-sm" aria-label={`תאריך יעד לשלב ${i + 1}`} value={s.due_date ?? ''} onChange={(e) => setSub(i, { due_date: e.target.value || null })} />
                <button type="button" className="btn-ghost !px-2 text-slate-500" onClick={() => set({ subtasks: d.subtasks.filter((_, k) => k !== i) })} aria-label="הסר שלב">
                  <X size={16} />
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="btn-ghost mt-2" onClick={() => set({ subtasks: [...d.subtasks, { text: '', is_done: false }] })}>
            <Plus size={16} />
            הוסף שלב
          </button>
        </div>

          </div>
        )}

        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-4">
          <div className="me-auto">
            {task && (
              <ConfirmButton
                message={`למחוק את המשימה "${task.description.length > 40 ? `${task.description.slice(0, 40)}…` : task.description}"${task.subtasks.length ? ` ואת ${task.subtasks.length} השלבים שלה` : ''}? הפעולה אינה הפיכה.`}
                onConfirm={() => del.mutate(task.id, { onSuccess: onClose, onError: (e) => setError(taskError(e, 'המחיקה נכשלה')) })}
              >
                מחיקה
              </ConfirmButton>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={onClose}>
              ביטול
            </button>
            <button type="button" className="btn-primary" onClick={submit} disabled={save.isPending}>
              {save.isPending ? 'שומר…' : 'שמירה'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
