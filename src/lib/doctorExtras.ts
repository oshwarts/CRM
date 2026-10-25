// Two more things on a doctor (migration 082): the health funds and private insurers he has an arrangement with, and further roles (chair of a society...).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './supabase'

// the tables are newer than the generated types
const raw = supabase as unknown as SupabaseClient

const ok = <T,>(r: { data: T | null; error: { message: string } | null }): T => {
  if (r.error) throw new Error(r.error.message)
  return r.data as T
}

export type ArrangementKind = 'fund' | 'insurer' | 'other'
export type Arrangement = { id: string; doctor_id: string; kind: ArrangementKind; provider: string; note: string }
export type DoctorRole = { id: string; doctor_id: string; title: string; organization: string; note: string; sort: number }

/** the usual ones, offered as buttons; anything else can be typed */
export const FUNDS = ['כללית', 'מכבי', 'מאוחדת', 'לאומית']
export const INSURERS = ['הראל', 'הפניקס', 'מגדל', 'כלל', 'מנורה מבטחים', 'איילון', 'הכשרה', 'ביטוח ישיר', 'AIG']
export const KIND_LABELS: Record<ArrangementKind, string> = { fund: 'קופות חולים', insurer: 'ביטוחים פרטיים', other: 'אחר' }

/** the kind of a name: a fund or an insurer of the lists, else "other" */
export const kindOf = (provider: string): ArrangementKind => (FUNDS.includes(provider.trim()) ? 'fund' : INSURERS.includes(provider.trim()) ? 'insurer' : 'other')

/** the arrangements grouped for display: funds, insurers, others, each in the order they were added */
export function groupArrangements(list: Pick<Arrangement, 'kind' | 'provider'>[]) {
  return (['fund', 'insurer', 'other'] as ArrangementKind[]).map((kind) => ({ kind, items: list.filter((a) => a.kind === kind) })).filter((g) => g.items.length > 0)
}

export function useArrangements(doctorId: string | undefined) {
  return useQuery({
    queryKey: ['doctor-arrangements', doctorId],
    enabled: !!doctorId,
    queryFn: async () => ok<Arrangement[]>(await raw.from('doctor_arrangements').select('*').eq('doctor_id', doctorId!).order('created_at')),
  })
}

export function useAddArrangement(doctorId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (provider: string) => {
      const name = provider.trim()
      if (!name) return
      ok(await raw.from('doctor_arrangements').upsert({ doctor_id: doctorId, provider: name, kind: kindOf(name) }, { onConflict: 'doctor_id,provider', ignoreDuplicates: true }))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['doctor-arrangements', doctorId] }),
  })
}

export function useRemoveArrangement(doctorId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => ok(await raw.from('doctor_arrangements').delete().eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['doctor-arrangements', doctorId] }),
  })
}

export function useDoctorRoles(doctorId: string | undefined) {
  return useQuery({
    queryKey: ['doctor-roles', doctorId],
    enabled: !!doctorId,
    queryFn: async () => ok<DoctorRole[]>(await raw.from('doctor_roles').select('*').eq('doctor_id', doctorId!).order('sort').order('created_at')),
  })
}

export function useSaveRole(doctorId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (r: { id?: string; title: string; organization: string; note: string; sort?: number }) => {
      const row = { doctor_id: doctorId, title: r.title.trim(), organization: r.organization.trim(), note: r.note.trim(), sort: r.sort ?? 0 }
      if (r.id) ok(await raw.from('doctor_roles').update(row).eq('id', r.id))
      else ok(await raw.from('doctor_roles').insert(row))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['doctor-roles', doctorId] }),
  })
}

export function useDeleteRole(doctorId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => ok(await raw.from('doctor_roles').delete().eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['doctor-roles', doctorId] }),
  })
}
