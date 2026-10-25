// Information about a hospital: the estimate of cases per procedure, the general information, and where people and departments are (migration 081).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './supabase'

// the tables are newer than the generated types
const raw = supabase as unknown as SupabaseClient

const ok = <T,>(r: { data: T | null; error: { message: string } | null }): T => {
  if (r.error) throw new Error(r.error.message)
  return r.data as T
}

export type CaseEstimate = { id: string; hospital_id: string; procedure_id: string | null; procedure_text: string; cases: number; period: 'year' | 'month'; note: string }
export type HospitalLocation = { id: string; hospital_id: string; title: string; person: string; place: string; note: string; sort: number }

/** the estimate as cases a year (a monthly figure counts twelve times) */
export const perYear = (e: Pick<CaseEstimate, 'cases' | 'period'>) => (e.period === 'month' ? e.cases * 12 : e.cases)
export const totalPerYear = (list: Pick<CaseEstimate, 'cases' | 'period'>[]) => list.reduce((n, e) => n + perYear(e), 0)

/** the usual places and people of a department, offered as quick starts */
export const LOCATION_PRESETS = ['מנהל מחלקה', 'אחות אחראית', 'חדר ניתוח', 'מכון דימות / CT', 'רכש', 'מחסן סטרילי', 'מזכירות המחלקה']

export function useCaseEstimates(hospitalId: string | undefined) {
  return useQuery({
    queryKey: ['hospital-estimates', hospitalId],
    enabled: !!hospitalId,
    queryFn: async () => ok<CaseEstimate[]>(await raw.from('hospital_case_estimates').select('*').eq('hospital_id', hospitalId!).order('updated_at')),
  })
}

export function useSaveEstimate(hospitalId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (e: Partial<CaseEstimate> & { cases: number }) => {
      const row = { hospital_id: hospitalId, procedure_id: e.procedure_id ?? null, procedure_text: (e.procedure_text ?? '').trim(), cases: Math.max(0, Math.round(e.cases)), period: e.period ?? 'year', note: (e.note ?? '').trim(), updated_at: new Date().toISOString() }
      if (e.id) ok(await raw.from('hospital_case_estimates').update(row).eq('id', e.id))
      else ok(await raw.from('hospital_case_estimates').insert(row))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hospital-estimates', hospitalId] }),
  })
}

export function useDeleteEstimate(hospitalId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => ok(await raw.from('hospital_case_estimates').delete().eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hospital-estimates', hospitalId] }),
  })
}

export function useLocations(hospitalId: string | undefined) {
  return useQuery({
    queryKey: ['hospital-locations', hospitalId],
    enabled: !!hospitalId,
    queryFn: async () => ok<HospitalLocation[]>(await raw.from('hospital_locations').select('*').eq('hospital_id', hospitalId!).order('sort').order('updated_at')),
  })
}

export function useSaveLocation(hospitalId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (l: { id?: string; title: string; person: string; place: string; note: string; sort?: number }) => {
      const row = { hospital_id: hospitalId, title: l.title.trim(), person: l.person.trim(), place: l.place.trim(), note: l.note.trim(), sort: l.sort ?? 0, updated_at: new Date().toISOString() }
      if (l.id) ok(await raw.from('hospital_locations').update(row).eq('id', l.id))
      else ok(await raw.from('hospital_locations').insert(row))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hospital-locations', hospitalId] }),
  })
}

export function useDeleteLocation(hospitalId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => ok(await raw.from('hospital_locations').delete().eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hospital-locations', hospitalId] }),
  })
}

export function useGeneralInfo(hospitalId: string | undefined) {
  return useQuery({
    queryKey: ['hospital-general-info', hospitalId],
    enabled: !!hospitalId,
    queryFn: async () => ok<{ general_info: string }>(await raw.from('hospitals').select('general_info').eq('id', hospitalId!).single()).general_info ?? '',
  })
}

export function useSaveGeneralInfo(hospitalId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (text: string) => ok(await raw.from('hospitals').update({ general_info: text.trim() }).eq('id', hospitalId)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hospital-general-info', hospitalId] }),
  })
}
