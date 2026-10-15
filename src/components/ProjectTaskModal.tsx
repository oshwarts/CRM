import { useState } from 'react'
import { CoordinatorField } from './CoordinatorField'
import { useAgents, useContacts } from '../lib/api'
import { useDeleteProjectTask, useSaveProjectTask, type ProjectTaskInput } from '../lib/projectsApi'
import { STATUS_ORDER, TASK_STATUS } from '../lib/projects'
import type { ProjectArea, ProjectWithRelations, TaskRow } from '../lib/types'
import { ConfirmButton, Field, Modal } from './ui'
import { ProjectUpdates } from './ProjectUpdates'

/** one task of a project: area, status, owner (a team member or an outside party), what it waits for, dates and its own updates */
export function ProjectTaskModal({
  project,
  areas,
  task,
  defaultAreaId,
  onClose,
}: {
  project: ProjectWithRelations
  areas: ProjectArea[]
  task?: TaskRow | null
  defaultAreaId?: string | null
  onClose: () => void
}) {
  const agents = useAgents()
  const contacts = useContacts()
  const save = useSaveProjectTask()
  const del = useDeleteProjectTask()
  const [d, setD] = useState<ProjectTaskInput>(() => ({
    id: task?.id,
    project_id: project.id,
    area_id: task?.area_id ?? defaultAreaId ?? areas[0]?.id ?? null,
    description: task?.description ?? '',
    notes: task?.notes ?? '',
    status: task?.status ?? 'todo',
    assignee_id: task?.assignee_id ?? project.owner_id,
    external_owner: task?.external_owner ?? (areas.find((a) => a.id === (defaultAreaId ?? areas[0]?.id))?.contact_text ?? ''),
    contact_id: task?.contact_id ?? areas.find((a) => a.id === (defaultAreaId ?? areas[0]?.id))?.contact_id ?? null,
    coordinator_contact_id: task?.coordinator_contact_id ?? null,
    coordinator_text: task?.coordinator_text ?? '',
    waiting_for: task?.waiting_for ?? '',
    due_date: task?.due_date ?? null,
    priority: task?.priority ?? 'normal',
    hospital_id: task?.hospital_id ?? project.hospital_id,
  }))
  const [error, setError] = useState('')
  const set = (p: Partial<ProjectTaskInput>) => setD((x) => ({ ...x, ...p }))

  // only the responsible agent and the managers can open the project, so only they can be given its tasks
  const team = (agents.data ?? []).filter((a) => a.id === project.owner_id || a.role === 'admin' || a.id === d.assignee_id)
  const hospitalContacts = (contacts.data ?? []).filter((c) => !project.hospital_id || c.hospital_id === project.hospital_id)

  async function submit() {
    setError('')
    if (!d.description.trim()) return setError('כתוב מה המשימה')
    try {
      await save.mutateAsync(d)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : 'השמירה נכשלה')
    }
  }

  return (
    <Modal open onClose={onClose} title={task ? 'עריכת משימה בפרויקט' : 'משימה חדשה בפרויקט'} size="lg">
      <div className="space-y-3">
        <Field label="המשימה">
          <textarea className="input min-h-16" dir="auto" autoFocus value={d.description} onChange={(e) => set({ description: e.target.value })} />
        </Field>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="תחום">
            <select
              className="input"
              value={d.area_id ?? ''}
              onChange={(e) => {
                const area = areas.find((a) => a.id === e.target.value)
                // a new task without a contact takes the contact of the area it is moved to
                set({
                  area_id: e.target.value || null,
                  ...(!task && !d.contact_id && !d.external_owner && area ? { contact_id: area.contact_id, external_owner: area.contact_text } : {}),
                })
              }}
            >
              <option value="">ללא תחום</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="סטטוס">
            <select className="input" value={d.status} onChange={(e) => set({ status: e.target.value })}>
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {TASK_STATUS[s].label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="תאריך יעד">
            <input type="date" className="input" value={d.due_date ?? ''} onChange={(e) => set({ due_date: e.target.value || null })} />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="אחראי (צוות)">
            <select className="input" value={d.assignee_id ?? ''} onChange={(e) => set({ assignee_id: e.target.value || null })}>
              <option value="">—</option>
              {team.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.full_name || a.email}
                </option>
              ))}
            </select>
          </Field>
          <Field label="גורם חיצוני אחראי">
            <input className="input" dir="auto" value={d.external_owner} onChange={(e) => set({ external_owner: e.target.value })} placeholder="למשל: הנדסה רפואית בלינסון" />
          </Field>
          <Field label="איש קשר (מבית החולים)">
            <select className="input" value={d.contact_id ?? ''} onChange={(e) => set({ contact_id: e.target.value || null })}>
              <option value="">—</option>
              {hospitalContacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.role ? ` · ${c.role}` : ''}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <CoordinatorField contactId={d.coordinator_contact_id} text={d.coordinator_text} onChange={set} />

        <Field label="ממתין ל… (גורם או אדם שאנחנו תלויים בו)">
          <input className="input" dir="auto" value={d.waiting_for} onChange={(e) => set({ waiting_for: e.target.value })} placeholder="למשל: אישור ועדת רכש — נתעדכן ביום ראשון" />
        </Field>
        <Field label="פרטים קבועים על המשימה (ההערות עם תאריך — למטה)">
          <textarea className="input min-h-14" dir="auto" value={d.notes} onChange={(e) => set({ notes: e.target.value })} />
        </Field>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div className="flex items-center justify-between gap-2 border-t border-slate-200 pt-3">
          <div>
            {task && (
              <ConfirmButton message="למחוק את המשימה?" onConfirm={() => del.mutate(task.id, { onSuccess: onClose })}>
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

        {task && (
          <div className="border-t border-slate-200 pt-3">
            <p className="mb-2 text-sm font-semibold text-slate-700">הערות לפי תאריך וקבצים — מה קרה ומתי</p>
            <ProjectUpdates projectId={project.id} taskId={task.id} />
          </div>
        )}
      </div>
    </Modal>
  )
}
