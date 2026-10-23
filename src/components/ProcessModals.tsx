import { useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { useAgents, useHospitals } from '../lib/api'
import { useAuth } from '../context/AuthProvider'
import { toast } from '../lib/toast'
import { classNames, todayISO } from '../lib/utils'
import { KIND_LABELS, stepsFromTemplate, type ProcessKind, type ProcessSubject, type StepDraft, type TemplateStep } from '../lib/processLogic'
import { useSaveTemplate, useStartProcess, type Template, type TemplateDraft } from '../lib/processes'
import { Field, Modal } from './ui'

const SUBJECT_LABELS: Record<ProcessSubject, string> = { agent: 'סוכן', hospital: 'בית חולים', none: 'כללי (בלי נושא)' }

/** a template of a process: its name, what it is for and its steps (title, notes, the day it is due from the start, who does it) */
export function TemplateEditor({ template, onClose }: { template: (Omit<Template, 'id'> & { id?: string }) | null; onClose: () => void }) {
  const save = useSaveTemplate()
  const [d, setD] = useState<TemplateDraft>(() => ({
    id: template?.id,
    name: template?.name ?? '',
    description: template?.description ?? '',
    kind: template?.kind ?? 'other',
    subject: template?.subject ?? 'none',
    steps: template?.steps.map((s) => ({ title: s.title, notes: s.notes, day_offset: s.day_offset, owner: s.owner })) ?? [],
  }))
  const [error, setError] = useState('')
  const patchStep = (i: number, p: Partial<TemplateStep>) => setD((x) => ({ ...x, steps: x.steps.map((s, n) => (n === i ? { ...s, ...p } : s)) }))
  const move = (i: number, by: number) =>
    setD((x) => {
      const j = i + by
      if (j < 0 || j >= x.steps.length) return x
      const steps = [...x.steps]
      ;[steps[i], steps[j]] = [steps[j], steps[i]]
      return { ...x, steps }
    })

  async function submit() {
    if (!d.name.trim()) return setError('כתוב שם לתבנית')
    if (!d.steps.some((s) => s.title.trim())) return setError('הוסף לפחות שלב אחד')
    setError('')
    try {
      await save.mutateAsync(d)
      toast('התבנית נשמרה')
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'השמירה נכשלה')
    }
  }

  return (
    <Modal open onClose={onClose} title={template?.id ? 'עריכת תבנית' : 'תבנית חדשה'} size="xl">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="שם התבנית" className="col-span-2">
            <input className="input" dir="auto" autoFocus value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="למשל: הכשרת סוכן לרובוט MAKO" />
          </Field>
          <Field label="תיאור קצר" className="col-span-2">
            <input className="input" dir="auto" value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} />
          </Field>
          <Field label="מיועדת ל" className="col-span-2 sm:col-span-1">
            <select className="input" value={d.subject} onChange={(e) => setD({ ...d, subject: e.target.value as ProcessSubject })}>
              {(Object.keys(SUBJECT_LABELS) as ProcessSubject[]).map((k) => (
                <option key={k} value={k}>{SUBJECT_LABELS[k]}</option>
              ))}
            </select>
          </Field>
          <Field label="סוג" className="col-span-2 sm:col-span-1">
            <select className="input" value={d.kind} onChange={(e) => setD({ ...d, kind: e.target.value as ProcessKind })}>
              {(Object.keys(KIND_LABELS) as ProcessKind[]).map((k) => (
                <option key={k} value={k}>{KIND_LABELS[k]}</option>
              ))}
            </select>
          </Field>
        </div>
        <p className="-mt-2 text-xs text-slate-500">סוג "קליטת סוכן" ו"עזיבת סוכן" גורמים למערכת להציע למנהל להתחיל את התהליך כשסוכן מצטרף או עוזב.</p>

        <div>
          <p className="label">שלבים</p>
          <ul className="space-y-2">
            {d.steps.map((s, i) => (
              <li key={i} className="rounded-xl border border-slate-200 bg-slate-50/60 p-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-6 shrink-0 text-center text-sm text-slate-500">{i + 1}</span>
                  <input className="input min-w-0 flex-1" dir="auto" placeholder="שם השלב" aria-label={`שם שלב ${i + 1}`} value={s.title} onChange={(e) => patchStep(i, { title: e.target.value })} />
                  <button type="button" className="btn-ghost !min-h-10 !px-2" aria-label={`העלאת שלב ${i + 1}`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={16} aria-hidden /></button>
                  <button type="button" className="btn-ghost !min-h-10 !px-2" aria-label={`הורדת שלב ${i + 1}`} disabled={i === d.steps.length - 1} onClick={() => move(i, 1)}><ArrowDown size={16} aria-hidden /></button>
                  <button type="button" className="btn-ghost !min-h-10 !px-2 text-red-600" aria-label={`מחיקת שלב ${i + 1}`} onClick={() => setD({ ...d, steps: d.steps.filter((_, n) => n !== i) })}><Trash2 size={16} aria-hidden /></button>
                </div>
                <div className="mt-1.5 grid grid-cols-2 gap-2 ps-7">
                  <label className="flex items-center gap-1.5 text-xs text-slate-600">
                    <span className="shrink-0">יום</span>
                    <input type="number" className="input min-w-0" aria-label={`ימים מההתחלה לשלב ${i + 1}`} value={s.day_offset} onChange={(e) => patchStep(i, { day_offset: Number(e.target.value) || 0 })} />
                  </label>
                  <select className="input" aria-label={`אחראי לשלב ${i + 1}`} value={s.owner} onChange={(e) => patchStep(i, { owner: e.target.value as 'subject' | 'starter' })}>
                    <option value="starter">המנהל שמתחיל</option>
                    <option value="subject">הסוכן שהתהליך עליו</option>
                  </select>
                  <input className="input col-span-2" dir="auto" placeholder="הערות לשלב (לא חובה)" aria-label={`הערות לשלב ${i + 1}`} value={s.notes} onChange={(e) => patchStep(i, { notes: e.target.value })} />
                </div>
              </li>
            ))}
          </ul>
          <button type="button" className="btn-secondary mt-2" onClick={() => setD({ ...d, steps: [...d.steps, { title: '', notes: '', day_offset: d.steps.at(-1)?.day_offset ?? 0, owner: 'starter' }] })}>
            <Plus size={16} aria-hidden /> הוסף שלב
          </button>
          <p className="mt-1 text-xs text-slate-500">"יום" הוא מספר הימים מתחילת התהליך (0 = יום ההתחלה, מספר שלילי = לפני).</p>
        </div>

        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
          <button type="button" className="btn-secondary" onClick={onClose}>ביטול</button>
          <button type="button" className="btn-primary max-sm:flex-1" disabled={save.isPending} onClick={() => void submit()}>{save.isPending ? 'שומר…' : 'שמירה'}</button>
        </div>
      </div>
    </Modal>
  )
}

/** starts a process from a template: who or what it is about, the start date, and a last look at the steps (owner, date) before they become tasks */
export function StartProcessModal({ templates, template: first, agentId, onClose, onStarted }: { templates: Template[]; template?: Template | null; agentId?: string | null; onClose: () => void; onStarted: (id: string) => void }) {
  const { user } = useAuth()
  const agents = useAgents()
  const hospitals = useHospitals()
  const start = useStartProcess()
  const [template, setTemplate] = useState<Template | null>(first ?? null)
  const [subjectId, setSubjectId] = useState(agentId ?? '')
  const [startDate, setStartDate] = useState(todayISO())
  const [name, setName] = useState(first?.name ?? '')
  const [steps, setSteps] = useState<(StepDraft & { off: boolean })[]>(() => (first ? stepsFromTemplate(first.steps, todayISO(), first.subject === 'agent' ? (agentId ?? null) : null, user?.id ?? null).map((s) => ({ ...s, off: false })) : []))
  const [error, setError] = useState('')

  const subjectName = (t: Template, id: string) => (t.subject === 'agent' ? agents.data?.find((a) => a.id === id)?.full_name : t.subject === 'hospital' ? hospitals.data?.find((h) => h.id === id)?.name : '') ?? ''
  const rebuild = (t: Template, sid: string, date: string) => setSteps(stepsFromTemplate(t.steps, date, t.subject === 'agent' ? sid || null : null, user?.id ?? null).map((s) => ({ ...s, off: false })))
  const pick = (t: Template) => {
    setTemplate(t)
    setName(t.name)
    rebuild(t, subjectId, startDate)
  }
  const patchStep = (i: number, p: Partial<StepDraft & { off: boolean }>) => setSteps((x) => x.map((s, n) => (n === i ? { ...s, ...p } : s)))

  async function submit() {
    if (!template) return
    if (template.subject !== 'none' && !subjectId) return setError(template.subject === 'agent' ? 'בחר את הסוכן' : 'בחר את בית החולים')
    if (!name.trim()) return setError('כתוב שם לתהליך')
    setError('')
    try {
      const id = await start.mutateAsync({
        template,
        name: `${name.trim()}${subjectName(template, subjectId) && !name.includes(subjectName(template, subjectId)) ? ` – ${subjectName(template, subjectId)}` : ''}`,
        kind: template.kind,
        subject_agent_id: template.subject === 'agent' ? subjectId : null,
        subject_hospital_id: template.subject === 'hospital' ? subjectId : null,
        start_date: startDate,
        steps: steps.filter((s) => !s.off),
      })
      toast('התהליך התחיל והשלבים נוספו למשימות')
      onStarted(id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ההתחלה נכשלה')
    }
  }

  return (
    <Modal open onClose={onClose} title="התחלת תהליך" size="xl">
      <div className="space-y-4">
        {!template ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {templates.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => pick(t)} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-start hover:bg-slate-50">
                  <span className="block font-semibold text-slate-800">{t.name}</span>
                  <span className="block text-xs text-slate-500">{t.steps.length} שלבים · {KIND_LABELS[t.kind]}</span>
                  {t.description && <span dir="auto" className="mt-0.5 block text-sm text-slate-600">{t.description}</span>}
                </button>
              </li>
            ))}
            {templates.length === 0 && <li className="text-sm text-slate-500">אין תבניות. צור תבנית בלשונית "תבניות".</li>}
          </ul>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="שם התהליך" className="col-span-2">
                <input className="input" dir="auto" value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              {template.subject !== 'none' && (
                <Field label={template.subject === 'agent' ? 'הסוכן' : 'בית החולים'} className="col-span-2 sm:col-span-1">
                  <select className="input" value={subjectId} onChange={(e) => (setSubjectId(e.target.value), rebuild(template, e.target.value, startDate))}>
                    <option value="">בחר…</option>
                    {template.subject === 'agent'
                      ? (agents.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.full_name || a.email}</option>)
                      : (hospitals.data ?? []).map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                  </select>
                </Field>
              )}
              <Field label="תאריך התחלה" className="col-span-2 sm:col-span-1">
                <input type="date" className="input" value={startDate} onChange={(e) => (setStartDate(e.target.value || todayISO()), rebuild(template, subjectId, e.target.value || todayISO()))} />
              </Field>
            </div>
            <div>
              <p className="label">השלבים שייווצרו כמשימות</p>
              <ul className="space-y-1.5">
                {steps.map((s, i) => (
                  <li key={i} className={classNames('rounded-xl border p-2', s.off ? 'border-slate-100 bg-slate-50 opacity-60' : 'border-slate-200 bg-white')}>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" className="h-5 w-5 shrink-0" checked={!s.off} aria-label={`לכלול את שלב ${i + 1}`} onChange={(e) => patchStep(i, { off: !e.target.checked })} />
                      <input className="input min-w-0 flex-1" dir="auto" aria-label={`שם שלב ${i + 1}`} value={s.title} onChange={(e) => patchStep(i, { title: e.target.value })} />
                    </div>
                    <div className="mt-1.5 grid grid-cols-2 gap-2 ps-7">
                      <select className="input" aria-label={`אחראי לשלב ${i + 1}`} value={s.assignee_id ?? ''} onChange={(e) => patchStep(i, { assignee_id: e.target.value || null })}>
                        {(agents.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.full_name || a.email}</option>)}
                      </select>
                      <input type="date" className="input" aria-label={`תאריך שלב ${i + 1}`} value={s.due_date} onChange={(e) => patchStep(i, { due_date: e.target.value })} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
          {template && !first && <button type="button" className="btn-ghost" onClick={() => setTemplate(null)}>חזרה לבחירה</button>}
          <button type="button" className="btn-secondary" onClick={onClose}>ביטול</button>
          {template && (
            <button type="button" className="btn-primary max-sm:flex-1" disabled={start.isPending} onClick={() => void submit()}>{start.isPending ? 'מתחיל…' : 'התחל תהליך'}</button>
          )}
        </div>
      </div>
    </Modal>
  )
}
