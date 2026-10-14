import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { actingUserId } from './actingAs'
import { INFO_BUCKET } from './api'
import { PROJECT_TEMPLATES } from './projects'
import type { ProjectFile, ProjectUpdate, ProjectWithRelations } from './types'

function unwrap<T>(res: { data: unknown; error: unknown }): T {
  if (res.error) throw res.error
  return res.data as T
}

const PROJECT_SELECT =
  '*, hospital:hospitals(id, name), owner:profiles!projects_owner_id_fkey(id, full_name), areas:project_areas(*)'

/** every project the user can open (his own, the ones he is a member of; admins see all) */
export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const rows = unwrap<ProjectWithRelations[]>(await supabase.from('projects').select(PROJECT_SELECT).order('created_at', { ascending: false }))
      return rows.map((p) => ({ ...p, areas: [...p.areas].sort((a, b) => a.sort - b.sort) }))
    },
  })
}

export type ProjectInput = {
  id?: string
  name: string
  description: string
  hospital_id: string | null
  owner_id?: string | null
  status: string
  start_date: string | null
  target_date: string | null
  /** only for a new project */
  templateKey?: string
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['projects'] })
  qc.invalidateQueries({ queryKey: ['tasks'] })
  qc.invalidateQueries({ queryKey: ['project-updates'] })
  qc.invalidateQueries({ queryKey: ['project-files'] })
}

export function useSaveProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: ProjectInput) => {
      const actingId = await actingUserId()
      const me = actingId
      const row = {
        name: p.name.trim(),
        description: p.description.trim(),
        hospital_id: p.hospital_id,
        status: p.status,
        start_date: p.start_date,
        target_date: p.target_date,
        ...(p.owner_id ? { owner_id: p.owner_id } : {}),
      }
      let id = p.id
      if (id) unwrap(await supabase.from('projects').update(row).eq('id', id))
      else {
        id = unwrap<{ id: string }>(
          await supabase.from('projects').insert({ ...row, owner_id: p.owner_id ?? me, template_key: p.templateKey ?? '' }).select('id').single(),
        ).id
      }
      const tpl = !p.id && p.templateKey ? PROJECT_TEMPLATES.find((t) => t.key === p.templateKey) : undefined
      if (tpl) {
        const areas = unwrap<{ id: string; name: string }[]>(
          await supabase.from('project_areas').insert(tpl.areas.map((a, i) => ({ project_id: id, name: a.name, sort: i }))).select('id, name'),
        )
        const rows = tpl.areas.flatMap((a) => {
          const areaId = areas.find((x) => x.name === a.name)?.id
          return a.tasks.map((t, i) => ({
            sort: i,
            description: t,
            project_id: id,
            area_id: areaId,
            hospital_id: p.hospital_id,
            assignee_id: p.owner_id ?? me,
            created_by: me,
          }))
        })
        unwrap(await supabase.from('meeting_tasks').insert(rows))
      }
      return id
    },
    onSuccess: () => invalidate(qc),
  })
}

export function useDeleteProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('projects').delete().eq('id', id)),
    onSuccess: () => invalidate(qc),
  })
}

export function useSaveArea() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (a: { id?: string; project_id: string; name: string; sort?: number }) => {
      if (a.id) unwrap(await supabase.from('project_areas').update({ name: a.name.trim() }).eq('id', a.id))
      else unwrap(await supabase.from('project_areas').insert({ project_id: a.project_id, name: a.name.trim(), sort: a.sort ?? 99 }))
    },
    onSuccess: () => invalidate(qc),
  })
}

export function useDeleteArea() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('project_areas').delete().eq('id', id)),
    onSuccess: () => invalidate(qc),
  })
}

export type ProjectTaskInput = {
  id?: string
  project_id: string
  area_id: string | null
  description: string
  notes: string
  status: string
  assignee_id: string | null
  external_owner: string
  contact_id: string | null
  waiting_for: string
  due_date: string | null
  priority: string
  hospital_id: string | null
}

export function useSaveProjectTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (t: ProjectTaskInput) => {
      const actingId = await actingUserId()
      const row = {
        project_id: t.project_id,
        area_id: t.area_id,
        description: t.description.trim(),
        notes: t.notes.trim(),
        status: t.status,
        assignee_id: t.assignee_id,
        external_owner: t.external_owner.trim(),
        contact_id: t.contact_id,
        waiting_for: t.waiting_for.trim(),
        due_date: t.due_date,
        priority: t.priority,
        hospital_id: t.hospital_id,
      }
      if (t.id) unwrap(await supabase.from('meeting_tasks').update(row).eq('id', t.id))
      else unwrap(await supabase.from('meeting_tasks').insert({ ...row, created_by: actingId }))
    },
    onSuccess: () => invalidate(qc),
  })
}

/** quick status change (board / list) */
export function useSetTaskStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) =>
      unwrap(await supabase.from('meeting_tasks').update({ status }).eq('id', id)),
    onSuccess: () => invalidate(qc),
  })
}

export function useDeleteProjectTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('meeting_tasks').delete().eq('id', id)),
    onSuccess: () => invalidate(qc),
  })
}

/* ---------------- updates log + files ---------------- */

export function useProjectUpdates(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project-updates', projectId],
    enabled: !!projectId,
    queryFn: async () =>
      unwrap<ProjectUpdate[]>(
        await supabase.from('project_updates').select('*').eq('project_id', projectId!).order('event_date', { ascending: false })
          .order('created_at', { ascending: false }),
      ),
  })
}

export function useProjectFiles(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project-files', projectId],
    enabled: !!projectId,
    queryFn: async () =>
      unwrap<ProjectFile[]>(await supabase.from('project_files').select('*').eq('project_id', projectId!).order('created_at', { ascending: false })),
  })
}

const MAX_FILE = 50 * 1024 * 1024

export function useAddProjectUpdate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (u: { projectId: string; taskId: string | null; body: string; files: File[]; authorName: string; eventDate: string }) => {
      const tooBig = u.files.find((f) => f.size > MAX_FILE)
      if (tooBig) throw new Error(`הקובץ ${tooBig.name} גדול מ-50MB`)
      const created = unwrap<{ id: string }>(
        await supabase
          .from('project_updates')
          .insert({ project_id: u.projectId, task_id: u.taskId, body: u.body.trim(), author_name: u.authorName, event_date: u.eventDate })
          .select('id')
          .single(),
      )
      for (const f of u.files) {
        const ext = (f.name.match(/\.[A-Za-z0-9]{1,6}$/)?.[0] ?? '').toLowerCase()
        const path = `projects/${u.projectId}/${crypto.randomUUID()}${ext}`
        const up = await supabase.storage.from(INFO_BUCKET).upload(path, f, { contentType: f.type || 'application/octet-stream' })
        if (up.error) throw up.error
        unwrap(
          await supabase.from('project_files').insert({
            project_id: u.projectId,
            task_id: u.taskId,
            update_id: created.id,
            storage_path: path,
            file_name: f.name,
            file_size: f.size,
            mime: f.type,
          }),
        )
      }
    },
    onSuccess: () => invalidate(qc),
  })
}

export function useDeleteProjectUpdate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('project_updates').delete().eq('id', id)),
    onSuccess: () => invalidate(qc),
  })
}

/** opens a project file through a short-lived link */
export async function openProjectFile(f: ProjectFile): Promise<string | null> {
  const tab = window.open('', '_blank')
  const { data, error } = await supabase.storage.from(INFO_BUCKET).createSignedUrl(f.storage_path, 3600)
  if (error || !data) {
    tab?.close()
    return error?.message ?? 'פתיחת הקובץ נכשלה'
  }
  if (tab) tab.location.href = data.signedUrl
  else window.location.href = data.signedUrl
  return null
}

/** puts one contact (or outside party) on the whole area: it becomes the area's default for new tasks, and is applied to its tasks */
export function useSetAreaContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (a: { areaId: string; contactId: string | null; text: string; overwrite: boolean }) => {
      unwrap(await supabase.from('project_areas').update({ contact_id: a.contactId, contact_text: a.text }).eq('id', a.areaId))
      let q = supabase.from('meeting_tasks').update({ contact_id: a.contactId, external_owner: a.text }).eq('area_id', a.areaId)
      // by default only tasks that have nobody yet
      if (!a.overwrite) q = q.is('contact_id', null).eq('external_owner', '')
      unwrap(await q)
    },
    onSuccess: () => invalidate(qc),
  })
}

/** the same contact on several chosen tasks */
export function useSetTasksContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (a: { ids: string[]; contactId: string | null; text: string }) => {
      if (!a.ids.length) return
      unwrap(await supabase.from('meeting_tasks').update({ contact_id: a.contactId, external_owner: a.text }).in('id', a.ids))
    },
    onSuccess: () => invalidate(qc),
  })
}

/** puts a task at a position (index) of an area — the same area to reorder, another area to move it there */
export function useMoveTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (m: { taskId: string; areaId: string | null; orderedIds: string[]; sameArea: boolean }) => {
      // m.orderedIds = the target area's task ids in the wanted order (the moved task included)
      await Promise.all(
        m.orderedIds.map((id, i) =>
          supabase
            .from('meeting_tasks')
            .update(id === m.taskId && !m.sameArea ? { sort: i, area_id: m.areaId } : { sort: i })
            .eq('id', id)
            .then((r) => unwrap(r)),
        ),
      )
    },
    onSuccess: () => invalidate(qc),
  })
}

/** change the date an update refers to (back-dating an event) */
export function useSetUpdateDate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (a: { id: string; eventDate: string }) =>
      unwrap(await supabase.from('project_updates').update({ event_date: a.eventDate }).eq('id', a.id)),
    onSuccess: () => invalidate(qc),
  })
}

/** saves the order of the project's areas (ids in the wanted order) */
export function useReorderAreas() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      await Promise.all(orderedIds.map((id, i) => supabase.from('project_areas').update({ sort: i }).eq('id', id).then((r) => unwrap(r))))
    },
    onSuccess: () => invalidate(qc),
  })
}

/** edit a written update: its text, its date, remove files, add files */
export function useEditProjectUpdate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (e: { id: string; projectId: string; taskId: string | null; body: string; eventDate: string; removeFiles: ProjectFile[]; newFiles: File[] }) => {
      const tooBig = e.newFiles.find((f) => f.size > MAX_FILE)
      if (tooBig) throw new Error(`הקובץ ${tooBig.name} גדול מ-50MB`)
      unwrap(await supabase.from('project_updates').update({ body: e.body.trim(), event_date: e.eventDate, edited_at: new Date().toISOString() }).eq('id', e.id))
      if (e.removeFiles.length) {
        unwrap(await supabase.from('project_files').delete().in('id', e.removeFiles.map((f) => f.id)))
        // the stored copy can only be deleted by a manager; for others the file just disappears from the update
        await supabase.storage.from(INFO_BUCKET).remove(e.removeFiles.map((f) => f.storage_path))
      }
      for (const f of e.newFiles) {
        const ext = (f.name.match(/\.[A-Za-z0-9]{1,6}$/)?.[0] ?? '').toLowerCase()
        const path = `projects/${e.projectId}/${crypto.randomUUID()}${ext}`
        const up = await supabase.storage.from(INFO_BUCKET).upload(path, f, { contentType: f.type || 'application/octet-stream' })
        if (up.error) throw up.error
        unwrap(
          await supabase.from('project_files').insert({
            project_id: e.projectId,
            task_id: e.taskId,
            update_id: e.id,
            storage_path: path,
            file_name: f.name,
            file_size: f.size,
            mime: f.type,
          }),
        )
      }
    },
    onSuccess: () => invalidate(qc),
  })
}
