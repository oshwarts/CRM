import { useState } from 'react'
import { useAgents, useHospitals } from '../lib/api'
import { useSaveProject, type ProjectInput } from '../lib/projectsApi'
import { PROJECT_STATUS, PROJECT_TEMPLATES } from '../lib/projects'
import { useAuth } from '../context/AuthProvider'
import type { ProjectWithRelations } from '../lib/types'
import { Field, Modal, MultiSelectChips } from './ui'

/** create a project (blank or from a template) or edit its details and members */
export function ProjectFormModal({
  project,
  onClose,
  onSaved,
}: {
  project?: ProjectWithRelations | null
  onClose: () => void
  onSaved?: (id: string) => void
}) {
  const { user, isAdmin } = useAuth()
  const agents = useAgents()
  const hospitals = useHospitals()
  const save = useSaveProject()
  const [d, setD] = useState<ProjectInput>(() =>
    project
      ? {
          id: project.id,
          name: project.name,
          description: project.description,
          hospital_id: project.hospital_id,
          owner_id: project.owner_id,
          status: project.status,
          start_date: project.start_date,
          target_date: project.target_date,
          memberIds: project.members.map((m) => m.user_id),
        }
      : { name: '', description: '', hospital_id: null, owner_id: user?.id ?? null, status: 'active', start_date: null, target_date: null, memberIds: [], templateKey: PROJECT_TEMPLATES[0]?.key ?? '' },
  )
  const [error, setError] = useState('')
  const set = (p: Partial<ProjectInput>) => setD((x) => ({ ...x, ...p }))

  async function submit() {
    setError('')
    if (!d.name.trim()) return setError('כתוב שם לפרויקט')
    try {
      const id = await save.mutateAsync(d)
      onSaved?.(id)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : 'השמירה נכשלה')
    }
  }

  return (
    <Modal open onClose={onClose} title={project ? 'עריכת פרויקט' : 'פרויקט חדש'} size="lg">
      <div className="space-y-3">
        <Field label="שם הפרויקט">
          <input className="input" dir="auto" autoFocus value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder="למשל: אינטגרציית MAKO בבלינסון" />
        </Field>
        <Field label="תיאור (אופציונלי)">
          <textarea className="input min-h-16" dir="auto" value={d.description} onChange={(e) => set({ description: e.target.value })} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="בית חולים">
            <select className="input" value={d.hospital_id ?? ''} onChange={(e) => set({ hospital_id: e.target.value || null })}>
              <option value="">—</option>
              {(hospitals.data ?? []).map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </Field>
          {isAdmin ? (
            <Field label="אחראי על הפרויקט">
              <select className="input" value={d.owner_id ?? ''} onChange={(e) => set({ owner_id: e.target.value || null })}>
                {(agents.data ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.full_name || a.email}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <div />
          )}
          <Field label="תאריך התחלה">
            <input type="date" className="input" value={d.start_date ?? ''} onChange={(e) => set({ start_date: e.target.value || null })} />
          </Field>
          <Field label="תאריך יעד לסיום">
            <input type="date" className="input" value={d.target_date ?? ''} onChange={(e) => set({ target_date: e.target.value || null })} />
          </Field>
        </div>

        {project ? (
          <Field label="סטטוס הפרויקט">
            <select className="input" value={d.status} onChange={(e) => set({ status: e.target.value })}>
              {Object.entries(PROJECT_STATUS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <Field label="תבנית">
            <select className="input" value={d.templateKey ?? ''} onChange={(e) => set({ templateKey: e.target.value })}>
              <option value="">פרויקט ריק (בלי תחומים ומשימות)</option>
              {PROJECT_TEMPLATES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.name} — {t.areas.length} תחומים, {t.areas.reduce((n, a) => n + a.tasks.length, 0)} משימות
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label="צוות הפרויקט (רואים ועורכים את הפרויקט)">
          <MultiSelectChips
            options={(agents.data ?? []).filter((a) => a.id !== d.owner_id).map((a) => ({ id: a.id, label: a.full_name || a.email }))}
            selected={d.memberIds}
            onToggle={(id) => set({ memberIds: d.memberIds.includes(id) ? d.memberIds.filter((x) => x !== id) : [...d.memberIds, id] })}
            labelOf={(o) => o.label}
          />
        </Field>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
          <button className="btn-secondary" onClick={onClose}>
            ביטול
          </button>
          <button className="btn-primary" onClick={submit} disabled={save.isPending}>
            {save.isPending ? 'שומר…' : project ? 'שמירה' : 'צור פרויקט'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
