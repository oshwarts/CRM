// The funnel of potential doctors: the stages (edited by the managers), the stage and next step of a doctor, and the history of the stages.
// Tables pipeline_stages / doctor_stage_history (migration 064) are newer than the generated types, so this module uses an untyped view of the client.
import { useMemo } from 'react'
import { format } from 'date-fns'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { PIPELINE_STAGES } from './types'
import { STUCK_STAGE_DAYS, type HistoryRow, type StuckThresholds } from './pipelineStats'
import { useAppSetting } from './api'

const db = supabase as unknown as SupabaseClient

export type PipelineStage = { id: string; name: string; sort: number; is_won: boolean; suggested_step: string; stuck_days: number | null }

const STAGES_KEY = ['pipeline-stages']

export function usePipelineStages() {
  const q = useQuery({
    queryKey: STAGES_KEY,
    queryFn: async () => {
      const { data, error } = await db.from('pipeline_stages').select('*').order('sort').order('created_at')
      if (error) throw error
      return (data ?? []) as PipelineStage[]
    },
  })
  // until the list is read (or when it is empty) the standard stages are used, so that the screens never show a funnel without stages
  const names = useMemo(() => (q.data && q.data.length > 0 ? q.data.map((s) => s.name) : ([...PIPELINE_STAGES] as string[])), [q.data])
  const won = useMemo(() => (q.data ?? []).find((s) => s.is_won)?.name ?? null, [q.data])
  return { stages: q.data ?? [], names, won, isLoading: q.isLoading }
}

export function useSaveStage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (s: { id?: string; name: string; sort?: number; is_won?: boolean; suggested_step?: string; stuck_days?: number | null }) => {
      const { id, ...rest } = s
      const name = rest.name.trim()
      if (!name) throw new Error('כתוב שם לשלב')
      if (id) {
        // a rename also moves the doctors that are in the stage (done on the server)
        const cur = (qc.getQueryData<PipelineStage[]>(STAGES_KEY) ?? []).find((x) => x.id === id)
        if (cur && cur.name !== name) {
          const { error } = await db.rpc('rename_pipeline_stage', { p_id: id, p_name: name })
          if (error) throw error
        }
        const patch: Record<string, unknown> = {}
        if (rest.sort !== undefined) patch.sort = rest.sort
        if (rest.is_won !== undefined) patch.is_won = rest.is_won
        if (rest.suggested_step !== undefined) patch.suggested_step = rest.suggested_step.trim()
        if (rest.stuck_days !== undefined) patch.stuck_days = rest.stuck_days
        if (Object.keys(patch).length > 0) {
          const { error } = await db.from('pipeline_stages').update(patch).eq('id', id)
          if (error) throw error
        }
      } else {
        const { error } = await db.from('pipeline_stages').insert({ name, sort: rest.sort ?? 0, is_won: rest.is_won ?? false, suggested_step: (rest.suggested_step ?? '').trim() })
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: STAGES_KEY })
      qc.invalidateQueries({ queryKey: ['doctors'] })
      qc.invalidateQueries({ queryKey: ['pipeline-doctors'] })
      qc.invalidateQueries({ queryKey: ['stage-history'] })
    },
  })
}

/** only one stage can be "the doctor became a client": choosing it clears the others */
export function useSetWonStage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string | null) => {
      const clear = await db.from('pipeline_stages').update({ is_won: false }).neq('id', '00000000-0000-0000-0000-000000000000')
      if (clear.error) throw clear.error
      if (id) {
        const { error } = await db.from('pipeline_stages').update({ is_won: true }).eq('id', id)
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: STAGES_KEY }),
  })
}

export function useMoveStage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ a, b }: { a: PipelineStage; b: PipelineStage }) => {
      // swap the places of two neighbours; the order numbers are renumbered so that equal numbers never block it
      const first = await db.from('pipeline_stages').update({ sort: b.sort }).eq('id', a.id)
      if (first.error) throw first.error
      const second = await db.from('pipeline_stages').update({ sort: a.sort }).eq('id', b.id)
      if (second.error) throw second.error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: STAGES_KEY }),
  })
}

export function useDeleteStage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, moveTo }: { id: string; moveTo: string }) => {
      const { error } = await db.rpc('delete_pipeline_stage', { p_id: id, p_move_to: moveTo })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: STAGES_KEY })
      qc.invalidateQueries({ queryKey: ['doctors'] })
      qc.invalidateQueries({ queryKey: ['pipeline-doctors'] })
    },
  })
}

export type StageChange = { id: string; doctor_id: string; stage: string; previous_stage: string; changed_at: string; by: { full_name: string } | null }

/** the changes of stage of one doctor, newest first */
export function useStageHistory(doctorId: string | undefined) {
  return useQuery({
    queryKey: ['stage-history', doctorId],
    enabled: !!doctorId,
    queryFn: async () => {
      const { data, error } = await db.from('doctor_stage_history').select('*, by:profiles!changed_by(full_name)').eq('doctor_id', doctorId).order('changed_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as StageChange[]
    },
  })
}

/** doctor id → when the doctor entered the stage he is in now (the latest change), for "N days in the stage" */
export function useStageSince() {
  return useQuery({
    queryKey: ['stage-since'],
    queryFn: async () => {
      const { data, error } = await db.from('doctor_stage_history').select('doctor_id, stage, changed_at').order('changed_at', { ascending: false }).limit(5000)
      if (error) throw error
      const m = new Map<string, { stage: string; since: string }>()
      for (const r of (data ?? []) as { doctor_id: string; stage: string; changed_at: string }[]) if (!m.has(r.doctor_id)) m.set(r.doctor_id, { stage: r.stage, since: format(new Date(r.changed_at), 'yyyy-MM-dd') }) // the local day, not the UTC one
      return m
    },
  })
}

/** moves a doctor to a stage, and sets the next step; reaching the "won" stage can make him a client */
export function useSetDoctorPipeline() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string; pipeline_stage?: string; next_step?: string; next_step_date?: string | null; status?: string; lost_reason?: string; lost_at?: string | null }) => {
      const { error } = await supabase.from('doctors').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['doctors'] })
      qc.invalidateQueries({ queryKey: ['doctor', v.id] })
      qc.invalidateQueries({ queryKey: ['pipeline-doctors'] })
      qc.invalidateQueries({ queryKey: ['stage-history'] })
      qc.invalidateQueries({ queryKey: ['stage-since'] })
      qc.invalidateQueries({ queryKey: ['stage-history-all'] })
    },
  })
}

/** every recorded change of stage (for the analysis of the funnel and the "stuck" lists) */
export function useStageHistoryAll() {
  return useQuery({
    queryKey: ['stage-history-all'],
    queryFn: async () => {
      const { data, error } = await db.from('doctor_stage_history').select('doctor_id, stage, previous_stage, changed_at').order('changed_at').limit(10000)
      if (error) throw error
      return (data ?? []) as HistoryRow[]
    },
  })
}

export const STUCK_SETTING_KEY = 'pipeline.stuck_days'

/** after how many days in one stage a potential doctor counts as stuck: the managers' default and the value of each stage */
export function useStuckThresholds(): StuckThresholds {
  const { stages } = usePipelineStages()
  const setting = useAppSetting(STUCK_SETTING_KEY)
  return useMemo(() => {
    const n = Number(setting.data)
    const byStage = new Map<string, number>()
    for (const st of stages) if (st.stuck_days) byStage.set(st.name, st.stuck_days)
    return { defaultDays: Number.isFinite(n) && n >= 1 ? n : STUCK_STAGE_DAYS, byStage } satisfies StuckThresholds
  }, [setting.data, stages])
}
