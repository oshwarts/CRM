// Investigations of a doctor: the problem, its root cause, the solution and the investigation file (migration 076).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { infoStorage, FILE_MAX_BYTES } from './largeFiles'

// the table is newer than the generated types: it is used through an untyped view of the client
const raw = supabase as unknown as SupabaseClient

export type Investigation = {
  id: string
  doctor_id: string
  event_date: string
  title: string
  problem: string
  root_cause: string
  solution: string
  status: 'open' | 'closed'
  closed_on: string | null
  file_path: string | null
  file_name: string
  file_size: number
  mime: string
  created_by: string | null
  created_at: string
}

export type InvestigationDraft = {
  id?: string
  doctor_id: string
  event_date: string
  title: string
  problem: string
  root_cause: string
  solution: string
  status: 'open' | 'closed'
  closedOn?: string | null
  /** a new file to upload; `removeFile` drops the existing one */
  file?: File | null
  removeFile?: boolean
  existing?: Pick<Investigation, 'file_path' | 'file_name' | 'file_size' | 'mime'> | null
}

const ok = <T,>(r: { data: T | null; error: { message: string } | null }): T => {
  if (r.error) throw new Error(r.error.message)
  return r.data as T
}

export function useInvestigations(doctorId: string | undefined) {
  return useQuery({
    queryKey: ['investigations', doctorId],
    enabled: !!doctorId,
    queryFn: async () =>
      ok<Investigation[]>(await raw.from('doctor_investigations').select('*').eq('doctor_id', doctorId!).order('event_date', { ascending: false }).order('created_at', { ascending: false })),
  })
}

export const openCount = (list: Investigation[] | undefined) => (list ?? []).filter((i) => i.status === 'open').length

const today = () => new Date().toLocaleDateString('sv-SE')

export function useSaveInvestigation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (d: InvestigationDraft) => {
      if (d.file && d.file.size > FILE_MAX_BYTES) throw new Error(`הקובץ ${d.file.name} גדול מ-50MB`)
      let file = d.removeFile ? { file_path: null, file_name: '', file_size: 0, mime: '' } : (d.existing ?? { file_path: null, file_name: '', file_size: 0, mime: '' })
      let uploaded: string | null = null
      if (d.file) {
        const ext = (d.file.name.match(/\.[A-Za-z0-9]{1,6}$/)?.[0] ?? '').toLowerCase()
        const path = `investigations/${d.doctor_id}/${crypto.randomUUID()}${ext}`
        const up = await infoStorage().upload(path, d.file, { contentType: d.file.type || 'application/octet-stream' })
        if (up.error) throw up.error
        uploaded = path
        file = { file_path: path, file_name: d.file.name, file_size: d.file.size, mime: d.file.type }
      }
      const row = {
        doctor_id: d.doctor_id,
        event_date: d.event_date,
        title: d.title.trim(),
        problem: d.problem.trim(),
        root_cause: d.root_cause.trim(),
        solution: d.solution.trim(),
        status: d.status,
        closed_on: d.status === 'closed' ? (d.closedOn ?? today()) : null,
        ...file,
      }
      try {
        if (d.id) ok(await raw.from('doctor_investigations').update(row).eq('id', d.id))
        else ok(await raw.from('doctor_investigations').insert(row))
      } catch (e) {
        // the row was not saved: do not leave the uploaded file without an owner
        if (uploaded) await infoStorage().remove([uploaded])
        throw e
      }
      // the file that was replaced or removed goes away once the row points elsewhere
      const old = d.existing?.file_path
      if (old && old !== file.file_path) await infoStorage().remove([old])
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['investigations'] }),
  })
}

export function useDeleteInvestigation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: Investigation) => {
      ok(await raw.from('doctor_investigations').delete().eq('id', i.id))
      if (i.file_path) await infoStorage().remove([i.file_path])
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['investigations'] }),
  })
}

/** opens the investigation file through a short-lived link; returns an error text or null */
export async function openInvestigationFile(i: Pick<Investigation, 'file_path'>): Promise<string | null> {
  if (!i.file_path) return null
  const tab = window.open('', '_blank')
  const { data, error } = await infoStorage().createSignedUrl(i.file_path, 3600)
  if (error || !data) {
    tab?.close()
    return error?.message ?? 'פתיחת הקובץ נכשלה'
  }
  if (tab) tab.location.href = data.signedUrl
  else window.location.href = data.signedUrl
  return null
}

/** the investigations of all doctors (the summary of all doctors) */
export function useAllInvestigations() {
  return useQuery({
    queryKey: ['investigations', 'all'],
    queryFn: async () => ok<Investigation[]>(await raw.from('doctor_investigations').select('*').order('event_date', { ascending: false }).limit(5000)),
  })
}
