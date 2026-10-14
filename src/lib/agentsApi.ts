import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { actingUserId } from './actingAs'
import { useDoctors, useMapData, useMeetings, usePatientScans, useTasks } from './api'
import type { MetricData } from './agentMetrics'
import type { AgentGoal, AgentNote, AgentReview } from './types'

function unwrap<T>(res: { data: unknown; error: unknown }): T {
  if (res.error) throw res.error
  return res.data as T
}

/** every agent's favorites (managers) or just the signed-in user's own (agents) — decided by the database */
export function useAllFavorites() {
  return useQuery({
    queryKey: ['all-favorites'],
    queryFn: async () => unwrap<{ user_id: string; doctor_id: string }[]>(await supabase.from('favorites').select('user_id, doctor_id')),
  })
}

export function useAllCounts() {
  return useQuery({
    queryKey: ['all-counts'],
    queryFn: async () => unwrap<{ counted_by: string | null; counted_on: string }[]>(await supabase.from('consumable_counts').select('counted_by, counted_on')),
  })
}

/** everything the numbers of an agent are measured from */
export function useMetricData(): { data: MetricData | null; loading: boolean } {
  const meetings = useMeetings()
  const scans = usePatientScans()
  const doctors = useDoctors()
  const tasks = useTasks()
  const favorites = useAllFavorites()
  const counts = useAllCounts()
  const hospitals = useMapData()
  const loading = [meetings, scans, doctors, tasks, favorites, counts, hospitals].some((q) => q.isLoading)
  const data = useMemo(() => {
    if (loading) return null
    const hospitalsOf = new Map<string, string[]>()
    for (const h of hospitals.data ?? []) for (const a of h.hospital_agents) if (a.agent) hospitalsOf.set(a.agent.id, [...(hospitalsOf.get(a.agent.id) ?? []), h.id])
    return {
      meetings: meetings.data ?? [],
      scans: scans.data ?? [],
      doctors: doctors.data ?? [],
      tasks: tasks.data ?? [],
      favorites: favorites.data ?? [],
      counts: counts.data ?? [],
      hospitalsOf,
    }
  }, [loading, meetings.data, scans.data, doctors.data, tasks.data, favorites.data, counts.data, hospitals.data])
  return { data, loading }
}

/* ---------------- goals ---------------- */
export function useAgentGoals() {
  return useQuery({
    queryKey: ['agent-goals'],
    queryFn: async () => unwrap<AgentGoal[]>(await supabase.from('agent_goals').select('*').order('period_start', { ascending: false }).order('created_at')),
  })
}

export type GoalInput = {
  id?: string
  agent_id: string
  title: string
  category: string
  metric: string
  target: number | null
  current_value: number
  unit: string
  progress_pct: number
  period_start: string
  period_end: string
  notes: string
}

export function useSaveGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (g: GoalInput) => {
      const { id, ...row } = g
      if (id) unwrap(await supabase.from('agent_goals').update({ ...row, title: row.title.trim(), notes: row.notes.trim() }).eq('id', id))
      else unwrap(await supabase.from('agent_goals').insert({ ...row, title: row.title.trim(), notes: row.notes.trim() }))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent-goals'] }),
  })
}

export function useDeleteGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('agent_goals').delete().eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent-goals'] }),
  })
}

/* ---------------- 1:1 reviews and notes (managers) ---------------- */
export function useAgentReviews(agentId: string | undefined) {
  return useQuery({
    queryKey: ['agent-reviews', agentId],
    enabled: !!agentId,
    queryFn: async () =>
      unwrap<AgentReview[]>(await supabase.from('agent_reviews').select('*').eq('agent_id', agentId!).order('review_date', { ascending: false }).order('created_at', { ascending: false })),
  })
}

export type ReviewInput = {
  id?: string
  agent_id: string
  kind: string
  review_date: string
  summary: string
  agreements: string
  rating: number | null
  /** follow-up tasks that become real tasks of the agent */
  tasks: { description: string; due_date: string | null }[]
}

export function useSaveReview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (r: ReviewInput) => {
      const actingId = await actingUserId()
      const me = actingId
      const row = { agent_id: r.agent_id, kind: r.kind, review_date: r.review_date, summary: r.summary.trim(), agreements: r.agreements.trim(), rating: r.rating }
      let id = r.id
      if (id) unwrap(await supabase.from('agent_reviews').update(row).eq('id', id))
      else id = unwrap<{ id: string }>(await supabase.from('agent_reviews').insert(row).select('id').single()).id
      const tasks = r.tasks.filter((t) => t.description.trim())
      if (tasks.length)
        unwrap(
          await supabase.from('meeting_tasks').insert(
            tasks.map((t) => ({ description: t.description.trim(), due_date: t.due_date, assignee_id: r.agent_id, created_by: me, review_id: id })),
          ),
        )
      return id
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent-reviews'] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}

export function useDeleteReview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('agent_reviews').delete().eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent-reviews'] }),
  })
}

export function useAgentNotes(agentId: string | undefined) {
  return useQuery({
    queryKey: ['agent-notes', agentId],
    enabled: !!agentId,
    queryFn: async () =>
      unwrap<AgentNote[]>(await supabase.from('agent_notes').select('*').eq('agent_id', agentId!).order('note_date', { ascending: false }).order('created_at', { ascending: false })),
  })
}

export function useAddAgentNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (n: { agent_id: string; body: string; note_date: string }) =>
      unwrap(await supabase.from('agent_notes').insert({ agent_id: n.agent_id, body: n.body.trim(), note_date: n.note_date })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent-notes'] }),
  })
}

export function useDeleteAgentNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('agent_notes').delete().eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent-notes'] }),
  })
}

/* ---------------- training ---------------- */
import { INFO_BUCKET } from './api'
import type { AgentTraining } from './types'

/** every agent's training rows (managers) or just the signed-in agent's own — decided by the database */
export function useTraining() {
  return useQuery({
    queryKey: ['agent-training'],
    queryFn: async () => unwrap<AgentTraining[]>(await supabase.from('agent_training').select('*').order('completed_on')),
  })
}

export type TrainingInput = {
  agent_id: string
  procedure_id: string
  stage: string
  completed_on: string
  notes: string
  file: File | null
  /** a file already attached stays unless removeFile is set or a new one is chosen */
  existing: AgentTraining | null
  removeFile: boolean
}

export function useSaveTrainingStage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (t: TrainingInput) => {
      let file_path = t.existing?.file_path ?? null
      let file_name = t.existing?.file_name ?? ''
      const oldPath = file_path
      if (t.removeFile) {
        file_path = null
        file_name = ''
      }
      if (t.file) {
        const ext = (t.file.name.match(/\.[A-Za-z0-9]{1,6}$/)?.[0] ?? '').toLowerCase()
        const path = `training/${t.agent_id}/${crypto.randomUUID()}${ext}`
        const up = await supabase.storage.from(INFO_BUCKET).upload(path, t.file, { contentType: t.file.type || 'application/octet-stream' })
        if (up.error) throw up.error
        file_path = path
        file_name = t.file.name
      }
      unwrap(
        await supabase
          .from('agent_training')
          .upsert(
            { agent_id: t.agent_id, procedure_id: t.procedure_id, stage: t.stage, completed_on: t.completed_on, notes: t.notes.trim(), file_path, file_name },
            { onConflict: 'agent_id,procedure_id,stage' },
          ),
      )
      if (oldPath && oldPath !== file_path) await supabase.storage.from(INFO_BUCKET).remove([oldPath])
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent-training'] }),
  })
}

export function useRemoveTrainingStage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (t: AgentTraining) => {
      unwrap(await supabase.from('agent_training').delete().eq('id', t.id))
      if (t.file_path) await supabase.storage.from(INFO_BUCKET).remove([t.file_path])
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent-training'] }),
  })
}

/** opens the attached certificate through a short-lived link */
export async function openTrainingFile(path: string): Promise<string | null> {
  const tab = window.open('', '_blank')
  const { data, error } = await supabase.storage.from(INFO_BUCKET).createSignedUrl(path, 3600)
  if (error || !data) {
    tab?.close()
    return error?.message ?? 'פתיחת הקובץ נכשלה'
  }
  if (tab) tab.location.href = data.signedUrl
  else window.location.href = data.signedUrl
  return null
}
