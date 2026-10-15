// Planned surgeries that are not MAKO surgeries (no CT scan, no patient file) — a quick entry for the weekly schedule.
// Table: planned_surgeries (migration 060). No patient data is kept here.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './supabase'

// the table is newer than the generated types, so this module talks to it through an untyped view of the client
const db = supabase as unknown as SupabaseClient

export type PlannedSurgery = {
  id: string
  surgery_date: string
  surgery_time: string | null
  doctor_id: string | null
  hospital_id: string | null
  procedure: string
  company: string
  notes: string
  agent_id: string | null
  status: 'planned' | 'done' | 'cancelled'
  created_by: string | null
  doctor: { id: string; title: string; name: string } | null
  hospital: { id: string; name: string } | null
  agent: { id: string; full_name: string } | null
}

export type PlannedSurgeryInput = {
  id?: string
  surgery_date: string
  surgery_time: string | null
  doctor_id: string | null
  hospital_id: string | null
  procedure: string
  company: string
  notes: string
  /** only set when a manager enters it for somebody else; otherwise the database fills in the acting user */
  agent_id?: string | null
}

const KEY = ['planned-surgeries']

export function usePlannedSurgeries() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await db
        .from('planned_surgeries')
        .select('*, doctor:doctors(id, title, name), hospital:hospitals(id, name), agent:profiles!agent_id(id, full_name)')
        .order('surgery_date')
        .limit(1000)
      if (error) throw error
      return (data ?? []) as PlannedSurgery[]
    },
  })
}

export function useSavePlannedSurgery() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (d: PlannedSurgeryInput) => {
      const { id, ...fields } = d
      const payload = { ...fields, procedure: fields.procedure.trim(), company: fields.company.trim(), notes: fields.notes.trim() }
      if (payload.agent_id === undefined) delete payload.agent_id
      const res = id ? await db.from('planned_surgeries').update(payload).eq('id', id) : await db.from('planned_surgeries').insert(payload)
      if (res.error) throw res.error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useSetSurgeryStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: PlannedSurgery['status'] }) => {
      const { error } = await db.from('planned_surgeries').update({ status }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeletePlannedSurgery() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('planned_surgeries').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}
