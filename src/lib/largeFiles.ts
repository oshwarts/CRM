// Large files (over 25 MB) need a manager's approval.
// Every upload of the app goes through infoStorage(): a file up to the limit goes to the normal bucket; a bigger one goes to the
// "large" bucket — straight away for managers, and for everybody else only after a manager approved a request for that file.
// The buckets enforce it too (migration 068): the normal one takes 25 MB at most, the large one takes uploads of non-managers
// only while they have an approved request.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { actingUserId } from './actingAs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './supabase'

// the new functions are not in the generated types: they are called through an untyped view of the client
const raw = supabase as unknown as SupabaseClient

const INFO = 'info-docs'
export const LARGE_BUCKET = 'info-docs-large'
export const LARGE_LIMIT = 25 * 1024 * 1024
/** the most the plan allows for one file */
export const FILE_MAX_BYTES = 50 * 1024 * 1024

export class ApprovalRequiredError extends Error {
  state: 'created' | 'pending' | 'rejected'
  constructor(message: string, state: 'created' | 'pending' | 'rejected') {
    super(message)
    this.name = 'ApprovalRequiredError'
    this.state = state
  }
}

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(n >= 10 * 1024 * 1024 ? 0 : 1)}MB`

let adminCache: { value: boolean; at: number } | null = null
async function isAdminNow(): Promise<boolean> {
  if (adminCache && Date.now() - adminCache.at < 5 * 60_000) return adminCache.value
  const { data } = await supabase.rpc('is_admin')
  adminCache = { value: data === true, at: Date.now() }
  return adminCache.value
}

const PURPOSES: [string, string][] = [
  ['projects/', 'קובץ בפרויקט'],
  ['training/', 'אישור הכשרה'],
  ['learn/', 'לומדה'],
  ['equipment/', 'ציוד'],
]
const purposeOf = (path: string) => PURPOSES.find(([p]) => path.startsWith(p))?.[1] ?? 'מידע קליני'

type Bucket = ReturnType<typeof supabase.storage.from>
type UploadOptions = Parameters<Bucket['upload']>[2]

/** the file storage of the app: same calls as the Supabase bucket, with the large-file rule and the second bucket behind them */
export function infoStorage() {
  const info = () => supabase.storage.from(INFO)
  const large = () => supabase.storage.from(LARGE_BUCKET)
  return {
    async upload(path: string, file: File | Blob, opts?: UploadOptions) {
      if (file.size <= LARGE_LIMIT) return info().upload(path, file, opts)
      let ticket: string | null = null
      if (!(await isAdminNow())) {
        const name = file instanceof File ? file.name : path
        const { data, error } = await raw.rpc('request_large_upload', { p_name: name, p_size: file.size, p_purpose: purposeOf(path) })
        if (error) throw error
        const r = data as { state: string; id: string; note: string }
        if (r.state === 'approved') ticket = r.id
        else if (r.state === 'rejected') throw new ApprovalRequiredError(`הבקשה להעלאת "${name}" נדחתה${r.note ? `: ${r.note}` : ''}. אפשר לפנות למנהל, או להקטין את הקובץ.`, 'rejected')
        else if (r.state === 'pending') throw new ApprovalRequiredError(`הבקשה להעלאת "${name}" (${mb(file.size)}) עדיין ממתינה לאישור מנהל.`, 'pending')
        else throw new ApprovalRequiredError(`הקובץ "${name}" גדול (${mb(file.size)}) ודורש אישור מנהל. נשלחה בקשה — אחרי שתאושר, בחר את הקובץ שוב והעלה אותו.`, 'created')
      }
      const up = await large().upload(path, file, opts)
      if (!up.error && ticket) await raw.rpc('finish_large_upload', { p_id: ticket })
      return up
    },
    /** the file is in the normal bucket, or (when it was big) in the large one */
    async createSignedUrl(path: string, expiresIn: number) {
      const a = await info().createSignedUrl(path, expiresIn)
      if (!a.error && a.data) return a
      const b = await large().createSignedUrl(path, expiresIn)
      return b.error ? a : b
    },
    async download(path: string) {
      const a = await info().download(path)
      if (!a.error && a.data) return a
      const b = await large().download(path)
      return b.error ? a : b
    },
    async remove(paths: string[]) {
      const a = await info().remove(paths)
      // a large file may be among them; removing a file that is not there is not an error
      await large().remove(paths)
      return a
    },
  }
}

/* ---------------- the requests ---------------- */

export type UploadRequest = {
  id: string
  requested_by: string
  file_name: string
  file_size: number
  purpose: string
  status: 'pending' | 'approved' | 'rejected' | 'used'
  decided_at: string | null
  decision_note: string
  created_at: string
  requester: { full_name: string } | null
}

const KEY = ['upload-requests']

/** every request (managers) or just my own (everybody else) — the database decides */
export function useUploadRequests() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('upload_requests' as never)
        .select('*, requester:profiles!requested_by(full_name)')
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return (data ?? []) as unknown as UploadRequest[]
    },
    staleTime: 60_000,
  })
}

export function useDecideUpload() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, approve, note }: { id: string; approve: boolean; note?: string }) => {
      const { error } = await supabase
        .from('upload_requests' as never)
        .update({ status: approve ? 'approved' : 'rejected', decided_by: actingUserId(), decided_at: new Date().toISOString(), decision_note: (note ?? '').trim() } as never)
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}
