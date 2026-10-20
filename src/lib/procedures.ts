// Procedures inside procedures (one level: a parent such as GMRS with its options) and the agents' requests for a new procedure.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './supabase'

/** the client for tables and functions newer than the generated types */
const db = supabase as unknown as SupabaseClient

export type ProcRow = { id: string; name: string; parent_id?: string | null }

/** the parents (procedures that have sub-procedures) with their children, in name order; a procedure without children is a group of its own with none */
export function procedureGroups<T extends ProcRow>(list: T[]): { parent: T; children: T[] }[] {
  const byName = (a: T, b: T) => a.name.localeCompare(b.name, 'he')
  const ids = new Set(list.map((p) => p.id))
  const children = new Map<string, T[]>()
  for (const p of list) if (p.parent_id && ids.has(p.parent_id)) children.set(p.parent_id, [...(children.get(p.parent_id) ?? []), p])
  return list
    .filter((p) => !p.parent_id || !ids.has(p.parent_id))
    .sort(byName)
    .map((parent) => ({ parent, children: (children.get(parent.id) ?? []).sort(byName) }))
}

/** the procedures that are only a group: they have sub-procedures, so the sub-procedure is what gets chosen */
export function groupParentIds(list: ProcRow[]): Set<string> {
  return new Set(list.filter((p) => p.parent_id).map((p) => p.parent_id as string))
}

/** the ids a filter on this procedure matches: the procedure itself and, for a parent, all of its sub-procedures */
export function expandProcedure(id: string, list: ProcRow[]): Set<string> {
  const out = new Set([id])
  for (const p of list) if (p.parent_id === id) out.add(p.id)
  return out
}

/** the list as a flat, ordered list in which every sub-procedure comes right after its parent and is named "Parent › Child" */
export function withParentNames<T extends ProcRow>(list: T[]): T[] {
  const byId = new Map(list.map((p) => [p.id, p]))
  return procedureGroups(list).flatMap(({ parent, children }) => [
    parent,
    ...children.map((c) => ({ ...c, name: `${byId.get(c.parent_id as string)?.name ?? parent.name} › ${c.name}` })),
  ])
}

/* ---------- requests for a new procedure ---------- */

export type ProcedureRequest = {
  id: string
  requested_by: string
  name: string
  parent_id: string | null
  doctor_id: string | null
  note: string
  status: 'pending' | 'approved' | 'rejected'
  decided_at: string | null
  decision_note: string
  procedure_id: string | null
  created_at: string
  requester: { full_name: string } | null
  doctor: { id: string; name: string; title: string } | null
  parent: { name: string } | null
}

const KEY = ['procedure-requests']

/** every request (managers) or just my own (everybody else) — the database decides */
export function useProcedureRequests() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await db
        .from('procedure_requests')
        .select('*, requester:profiles!requested_by(full_name), doctor:doctors(id, name, title), parent:procedures!procedure_requests_parent_id_fkey(name)')
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return (data ?? []) as ProcedureRequest[]
    },
    staleTime: 60_000,
  })
}

export function useCreateProcedureRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (r: { name: string; parent_id: string | null; doctor_id: string | null; note: string }) => {
      const { error } = await db.from('procedure_requests').insert({ name: r.name.trim(), parent_id: r.parent_id, doctor_id: r.doctor_id, note: r.note.trim() })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDecideProcedureRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { id: string; approve: boolean; name?: string; parent?: string | null; note?: string }) => {
      const { error } = await db.rpc('decide_procedure_request', { p_id: v.id, p_approve: v.approve, p_name: v.name ?? null, p_parent: v.parent ?? null, p_note: v.note ?? '' })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      qc.invalidateQueries({ queryKey: ['procedures'] })
      qc.invalidateQueries({ queryKey: ['doctors'] })
      qc.invalidateQueries({ queryKey: ['doctor'] })
    },
  })
}
