// Clinic days: public (a doctor's days at a hospital, kept on doctor_hospitals) and private (a doctor's own clinics, with an address).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './supabase'

const db = supabase as unknown as SupabaseClient

/** 0 = Sunday … 6 = Saturday */
export const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
export const DAY_SHORT = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']

/** "א׳, ג׳, ה׳" — the days in week order, no duplicates */
export function formatDays(days: number[] | null | undefined): string {
  return [...new Set(days ?? [])]
    .filter((d) => d >= 0 && d <= 6)
    .sort((a, b) => a - b)
    .map((d) => DAY_SHORT[d])
    .join(', ')
}

export function toggleDay(days: number[], day: number): number[] {
  return days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort((a, b) => a - b)
}

export type PrivateClinic = { id: string; doctor_id: string; address: string; clinic_days: number[]; created_at: string }

export function useDoctorPrivateClinics(doctorId: string | undefined) {
  return useQuery({
    queryKey: ['private-clinics', doctorId],
    enabled: !!doctorId,
    queryFn: async () => {
      const { data, error } = await db.from('doctor_private_clinics').select('*').eq('doctor_id', doctorId!).order('created_at')
      if (error) throw error
      return (data ?? []) as PrivateClinic[]
    },
  })
}

export function useSavePrivateClinic(doctorId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (c: { id?: string; address: string; clinic_days: number[] }) => {
      const row = { address: c.address.trim(), clinic_days: c.clinic_days }
      const { error } = c.id ? await db.from('doctor_private_clinics').update(row).eq('id', c.id) : await db.from('doctor_private_clinics').insert({ ...row, doctor_id: doctorId })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['private-clinics', doctorId] }),
  })
}

export function useDeletePrivateClinic(doctorId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('doctor_private_clinics').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['private-clinics', doctorId] }),
  })
}
