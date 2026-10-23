// Investigations: the problem, its root cause, the solution, the people involved, files and corrective actions (migrations 076, 078).
// An investigation can involve several doctors, contacts and AMI staff; its corrective actions are real tasks of the system.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { infoStorage, FILE_MAX_BYTES } from './largeFiles'
import { actingUserId } from './actingAs'

// the tables are newer than the generated types: they are used through an untyped view of the client
const raw = supabase as unknown as SupabaseClient

export type InvFile = { id: string; file_path: string; file_name: string; file_size: number; mime: string; created_at: string }
export type InvAction = { id: string; description: string; is_done: boolean; due_date: string | null; assignee_id: string | null }

export type Investigation = {
  id: string
  event_date: string
  title: string
  problem: string
  root_cause: string
  solution: string
  status: 'open' | 'closed'
  closed_on: string | null
  closed_by: string | null
  created_by: string | null
  created_at: string
  hospital_id: string | null
  meeting_id: string | null
  product: string
  categories: string[]
  severity: number
  doctors: { id: string; name: string; title: string }[]
  contacts: { id: string; name: string; role: string }[]
  staff: { id: string; full_name: string }[]
  hospital: { id: string; name: string } | null
  meeting: { id: string; subject: string } | null
  files: InvFile[]
  /** the corrective actions the viewer is allowed to see (a task is visible to its owner, its creator and the managers) */
  actions: InvAction[]
}

const SELECT =
  '*, d:investigation_doctors(doctor:doctors(id, name, title)), c:investigation_contacts(contact:contacts(id, name, role)), s:investigation_staff(profile:profiles(id, full_name)), hospital:hospitals(id, name), meeting:meetings(id, subject), files:investigation_files(*), actions:meeting_tasks(id, description, is_done, due_date, assignee_id)'

type Row = Record<string, unknown> & {
  d?: { doctor: Investigation['doctors'][number] | null }[]
  c?: { contact: Investigation['contacts'][number] | null }[]
  s?: { profile: Investigation['staff'][number] | null }[]
  files?: InvFile[]
  actions?: InvAction[]
}

const ok = <T,>(r: { data: T | null; error: { message: string } | null }): T => {
  if (r.error) throw new Error(r.error.message)
  return r.data as T
}

function shape(r: Row): Investigation {
  const { d, c, s, ...rest } = r
  return {
    ...(rest as unknown as Investigation),
    doctors: (d ?? []).flatMap((x) => (x.doctor ? [x.doctor] : [])),
    contacts: (c ?? []).flatMap((x) => (x.contact ? [x.contact] : [])),
    staff: (s ?? []).flatMap((x) => (x.profile ? [x.profile] : [])),
    files: r.files ?? [],
    actions: r.actions ?? [],
    categories: (r.categories as string[] | undefined) ?? [],
  }
}

/** all investigations (or only those that involve one doctor) */
export function useInvestigations(doctorId?: string) {
  return useQuery({
    queryKey: ['investigations'],
    queryFn: async () => ok<Row[]>(await raw.from('doctor_investigations').select(SELECT).order('event_date', { ascending: false }).limit(3000)).map(shape),
    select: (rows) => (doctorId ? rows.filter((i) => i.doctors.some((d) => d.id === doctorId)) : rows),
  })
}

export const openCount = (list: Pick<Investigation, 'status'>[] | undefined) => (list ?? []).filter((i) => i.status === 'open').length

export type ActionDraft = { id?: string; description: string; assignee_id: string | null; due_date: string | null; is_done: boolean }

export type InvestigationDraft = {
  id?: string
  event_date: string
  title: string
  problem: string
  root_cause: string
  solution: string
  status: 'open' | 'closed'
  closedOn?: string | null
  closedBy?: string | null
  hospital_id: string | null
  meeting_id: string | null
  product: string
  categories: string[]
  severity: number
  doctorIds: string[]
  contactIds: string[]
  staffIds: string[]
  /** files already stored (kept ones) and new files to upload */
  files: InvFile[]
  newFiles: File[]
  actions: ActionDraft[]
  /** what the form was opened with: what was removed is deleted */
  baseFiles?: InvFile[]
  baseActionIds?: string[]
}

const today = () => new Date().toLocaleDateString('sv-SE')

/** makes a join table hold exactly `wanted` for one investigation (new rows first, then what was removed) */
async function syncSet(table: string, col: string, id: string, wanted: string[]) {
  const existing = ok<unknown[]>(await raw.from(table).select(col).eq('investigation_id', id)).map((r) => (r as Record<string, string>)[col])
  const add = wanted.filter((w) => !existing.includes(w))
  if (add.length) ok(await raw.from(table).insert(add.map((w) => ({ investigation_id: id, [col]: w }))))
  const drop = existing.filter((e) => !wanted.includes(e))
  if (drop.length) ok(await raw.from(table).delete().eq('investigation_id', id).in(col, drop))
}

export function useSaveInvestigation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (d: InvestigationDraft) => {
      const tooBig = d.newFiles.find((f) => f.size > FILE_MAX_BYTES)
      if (tooBig) throw new Error(`הקובץ ${tooBig.name} גדול מ-50MB`)
      const me = await actingUserId()
      const id = d.id ?? crypto.randomUUID()

      const uploaded: InvFile[] = []
      try {
        for (const f of d.newFiles) {
          const ext = (f.name.match(/\.[A-Za-z0-9]{1,6}$/)?.[0] ?? '').toLowerCase()
          const path = `investigations/${id}/${crypto.randomUUID()}${ext}`
          const up = await infoStorage().upload(path, f, { contentType: f.type || 'application/octet-stream' })
          if (up.error) throw up.error
          uploaded.push({ id: crypto.randomUUID(), file_path: path, file_name: f.name, file_size: f.size, mime: f.type, created_at: new Date().toISOString() })
        }

        const closing = d.status === 'closed'
        const row = {
          id,
          event_date: d.event_date,
          title: d.title.trim(),
          problem: d.problem.trim(),
          root_cause: d.root_cause.trim(),
          solution: d.solution.trim(),
          status: d.status,
          closed_on: closing ? (d.closedOn ?? today()) : null,
          closed_by: closing ? (d.closedBy ?? me) : null,
          hospital_id: d.hospital_id,
          meeting_id: d.meeting_id,
          product: d.product.trim(),
          categories: d.categories,
          severity: d.severity,
          // the first doctor stays in the old single column (older screens and exports read it)
          doctor_id: d.doctorIds[0] ?? null,
        }
        if (d.id) ok(await raw.from('doctor_investigations').update(row).eq('id', id))
        else ok(await raw.from('doctor_investigations').insert(row))
      } catch (e) {
        if (uploaded.length) await infoStorage().remove(uploaded.map((u) => u.file_path))
        throw e
      }

      await syncSet('investigation_doctors', 'doctor_id', id, d.doctorIds)
      await syncSet('investigation_contacts', 'contact_id', id, d.contactIds)
      await syncSet('investigation_staff', 'profile_id', id, d.staffIds)

      // files: new ones are recorded; the ones the person removed are deleted (the file after the row)
      if (uploaded.length) ok(await raw.from('investigation_files').insert(uploaded.map((u) => ({ id: u.id, investigation_id: id, file_path: u.file_path, file_name: u.file_name, file_size: u.file_size, mime: u.mime, created_by: me }))))
      const keepIds = d.files.map((f) => f.id)
      const removedFiles = (d.baseFiles ?? []).filter((f) => !keepIds.includes(f.id))
      if (removedFiles.length) {
        ok(await raw.from('investigation_files').delete().in('id', removedFiles.map((f) => f.id)))
        await infoStorage().remove(removedFiles.map((f) => f.file_path))
      }

      // corrective actions are tasks: new ones are created, changed ones updated, removed ones deleted
      const actions = d.actions.filter((a) => a.description.trim())
      const removed = (d.baseActionIds ?? []).filter((x) => !actions.some((a) => a.id === x))
      if (removed.length) ok(await raw.from('meeting_tasks').delete().in('id', removed))
      for (const a of actions) {
        const fields = {
          description: a.description.trim(),
          assignee_id: a.assignee_id ?? me,
          due_date: a.due_date || null,
          is_done: a.is_done,
          status: a.is_done ? 'done' : 'todo',
          done_at: a.is_done ? new Date().toISOString() : null,
          doctor_id: d.doctorIds[0] ?? null,
          hospital_id: d.hospital_id,
          investigation_id: id,
        }
        if (a.id) ok(await raw.from('meeting_tasks').update(fields).eq('id', a.id))
        else ok(await raw.from('meeting_tasks').insert({ ...fields, created_by: me }))
      }
      return id
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['investigations'] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}

export function useDeleteInvestigation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: Investigation) => {
      ok(await raw.from('doctor_investigations').delete().eq('id', i.id))
      if (i.files.length) await infoStorage().remove(i.files.map((f) => f.file_path))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['investigations'] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}

/** opens a file of an investigation through a short-lived link; returns an error text or null */
export async function openInvestigationFile(f: Pick<InvFile, 'file_path'>): Promise<string | null> {
  const tab = window.open('', '_blank')
  const { data, error } = await infoStorage().createSignedUrl(f.file_path, 3600)
  if (error || !data) {
    tab?.close()
    return error?.message ?? 'פתיחת הקובץ נכשלה'
  }
  if (tab) tab.location.href = data.signedUrl
  else window.location.href = data.signedUrl
  return null
}

/** the history of an investigation from the audit log (who changed what and when); the log is readable by managers */
export function useInvestigationHistory(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['investigation-history', id],
    enabled: enabled && !!id,
    queryFn: async () => ok<{ id: number; at: string; user_name: string; action: string; changed_fields: string[] }[]>(await raw.from('audit_log').select('id, at, user_name, action, changed_fields').eq('table_name', 'doctor_investigations').eq('record_id', id!).order('at', { ascending: false }).limit(30)),
  })
}
