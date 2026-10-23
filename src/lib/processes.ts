// Processes: editable templates and the processes started from them; the steps of a process are tasks of the system (migration 079).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { actingUserId } from './actingAs'
import type { AgentLike, ProcessKind, ProcessSubject, StepDraft, TemplateStep } from './processLogic'

// the tables are newer than the generated types: they are used through an untyped view of the client
const raw = supabase as unknown as SupabaseClient

const ok = <T,>(r: { data: T | null; error: { message: string } | null }): T => {
  if (r.error) throw new Error(r.error.message)
  return r.data as T
}

export type Template = { id: string; name: string; description: string; kind: ProcessKind; subject: ProcessSubject; sort: number; steps: (TemplateStep & { id: string; sort: number })[] }

export function useTemplates() {
  return useQuery({
    queryKey: ['process-templates'],
    queryFn: async () =>
      ok<Template[]>(await raw.from('process_templates').select('*, steps:process_template_steps(*)').order('sort').order('created_at')).map((t) => ({
        ...t,
        steps: [...(t.steps ?? [])].sort((a, b) => a.sort - b.sort),
      })),
  })
}

export type TemplateDraft = { id?: string; name: string; description: string; kind: ProcessKind; subject: ProcessSubject; steps: TemplateStep[] }

export function useSaveTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (d: TemplateDraft) => {
      const row = { name: d.name.trim(), description: d.description.trim(), kind: d.kind, subject: d.subject }
      let id = d.id
      if (id) ok(await raw.from('process_templates').update(row).eq('id', id))
      else id = ok<{ id: string }>(await raw.from('process_templates').insert(row).select('id').single()).id
      // the steps are written again in the order of the list (a template is small and only managers edit it)
      ok(await raw.from('process_template_steps').delete().eq('template_id', id))
      const steps = d.steps.filter((s) => s.title.trim())
      if (steps.length) ok(await raw.from('process_template_steps').insert(steps.map((s, i) => ({ template_id: id, sort: i, title: s.title.trim(), notes: s.notes.trim(), day_offset: s.day_offset, owner: s.owner }))))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['process-templates'] }),
  })
}

export function useDeleteTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => ok(await raw.from('process_templates').delete().eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['process-templates'] }),
  })
}

export type Step = { id: string; description: string; notes: string; due_date: string | null; is_done: boolean; done_at: string | null; assignee_id: string | null; sort: number }
export type Process = {
  id: string
  template_id: string | null
  name: string
  kind: ProcessKind
  subject_agent_id: string | null
  subject_hospital_id: string | null
  start_date: string
  status: 'open' | 'closed'
  closed_on: string | null
  notes: string
  created_at: string
  steps: Step[]
  agent: { id: string; full_name: string } | null
  hospital: { id: string; name: string } | null
}

const PROCESS_SELECT = '*, steps:meeting_tasks(id, description, notes, due_date, is_done, done_at, assignee_id, sort), agent:profiles!subject_agent_id(id, full_name), hospital:hospitals!subject_hospital_id(id, name)'

/** the processes the person may see: a manager sees all, an agent only those with a step assigned to him (the database decides) */
export function useProcesses() {
  return useQuery({
    queryKey: ['processes'],
    queryFn: async () => ok<Process[]>(await raw.from('processes').select(PROCESS_SELECT).order('start_date', { ascending: false }).limit(1000)).map((p) => ({ ...p, steps: [...(p.steps ?? [])].sort((a, b) => a.sort - b.sort) })),
  })
}

/** every profile, also the ones that were deactivated (to suggest the process of leaving) */
export function useAllProfiles(enabled: boolean) {
  return useQuery({
    queryKey: ['profiles-all'],
    enabled,
    queryFn: async () => ok<AgentLike[]>(await raw.from('profiles').select('id, full_name, active, created_at, is_test, role').order('full_name')),
  })
}

const invalidate = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ['processes'] })
  qc.invalidateQueries({ queryKey: ['tasks'] })
}

export type StartInput = { template: Template | null; name: string; kind: ProcessKind; subject_agent_id: string | null; subject_hospital_id: string | null; start_date: string; steps: StepDraft[] }

export function useStartProcess() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (d: StartInput) => {
      const me = await actingUserId()
      const created = ok<{ id: string }>(
        await raw.from('processes').insert({ template_id: d.template?.id ?? null, name: d.name.trim(), kind: d.kind, subject_agent_id: d.subject_agent_id, subject_hospital_id: d.subject_hospital_id, start_date: d.start_date }).select('id').single(),
      )
      const steps = d.steps.filter((s) => s.title.trim())
      if (steps.length) {
        ok(
          await raw.from('meeting_tasks').insert(
            steps.map((s, i) => ({ description: s.title.trim(), notes: s.notes, due_date: s.due_date || null, assignee_id: s.assignee_id ?? me, created_by: me, process_id: created.id, hospital_id: d.subject_hospital_id, sort: i, status: 'todo' })),
          ),
        )
      }
      return created.id
    },
    onSuccess: () => invalidate(qc),
  })
}

export type StepPatch = Partial<{ description: string; notes: string; due_date: string | null; assignee_id: string | null }>

export function useUpdateStep() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: StepPatch }) => ok(await raw.from('meeting_tasks').update(patch).eq('id', id)),
    onSuccess: () => invalidate(qc),
  })
}

export function useSetStepDone() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => ok(await raw.from('meeting_tasks').update({ is_done: done, status: done ? 'done' : 'todo', done_at: done ? new Date().toISOString() : null }).eq('id', id)),
    onSuccess: () => invalidate(qc),
  })
}

export function useAddStep() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ process, description, assignee_id, due_date }: { process: Process; description: string; assignee_id: string | null; due_date: string | null }) => {
      const me = await actingUserId()
      ok(await raw.from('meeting_tasks').insert({ description: description.trim(), assignee_id: assignee_id ?? me, due_date, created_by: me, process_id: process.id, hospital_id: process.subject_hospital_id, sort: process.steps.length, status: 'todo' }))
    },
    onSuccess: () => invalidate(qc),
  })
}

export function useDeleteStep() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => ok(await raw.from('meeting_tasks').delete().eq('id', id)),
    onSuccess: () => invalidate(qc),
  })
}

export function useUpdateProcess() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<{ name: string; notes: string; start_date: string; status: 'open' | 'closed'; closed_on: string | null; closed_by: string | null }> }) => ok(await raw.from('processes').update(patch).eq('id', id)),
    onSuccess: () => invalidate(qc),
  })
}

export function useDeleteProcess() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => ok(await raw.from('processes').delete().eq('id', id)),
    onSuccess: () => invalidate(qc),
  })
}
