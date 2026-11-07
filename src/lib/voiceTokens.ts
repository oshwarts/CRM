// Personal access tokens for hands-free task creation (a Siri Shortcut posts dictated text to the voice-add-task
// edge function with one of these as a bearer token). The raw token exists only on the device that generated it —
// the database holds a SHA-256 hash, never the token itself, so even reading the table can't recover it.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { currentUserId } from './outbox'

function unwrap<T>(res: { data: unknown; error: unknown }): T {
  if (res.error) throw res.error
  return res.data as T
}

export type PersonalToken = { id: string; label: string; created_at: string; last_used_at: string | null }

export function useMyTokens() {
  return useQuery({
    queryKey: ['personal-tokens'],
    queryFn: async () => unwrap<PersonalToken[]>(await supabase.from('personal_access_tokens').select('id, label, created_at, last_used_at').order('created_at', { ascending: false })),
  })
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** creates a token and returns the raw value — shown to the user exactly once, never retrievable again */
export function useCreateToken() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (label: string) => {
      const userId = await currentUserId()
      const token = randomToken()
      const token_hash = await sha256Hex(token)
      unwrap(await supabase.from('personal_access_tokens').insert({ user_id: userId, label: label.trim(), token_hash }))
      return token
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['personal-tokens'] }),
  })
}

export function useRevokeToken() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('personal_access_tokens').delete().eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['personal-tokens'] }),
  })
}
