// Suggestions for improving the system: written by anybody, read and answered by the developer of the system (the profile marked is_developer).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './supabase'

const db = supabase as unknown as SupabaseClient

export type SuggestionKind = 'idea' | 'problem'
export type SuggestionStatus = 'new' | 'seen' | 'done' | 'declined'

export const SUGGESTION_KIND_LABELS: Record<SuggestionKind, string> = { idea: 'רעיון לשיפור', problem: 'משהו לא עובד' }
export const SUGGESTION_STATUS_LABELS: Record<SuggestionStatus, string> = { new: 'נשלחה', seen: 'נקראה', done: 'טופלה', declined: 'לא תיושם' }

export type Suggestion = {
  id: string
  created_by: string
  kind: SuggestionKind
  body: string
  page: string
  status: SuggestionStatus
  dev_note: string
  handled_at: string | null
  created_at: string
  author: { full_name: string; email: string } | null
}

const KEY = ['suggestions']

/** every suggestion (the developer) or just my own (everybody else) — the database decides */
export function useSuggestions() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await db.from('suggestions').select('*, author:profiles!created_by(full_name, email)').order('created_at', { ascending: false }).limit(300)
      if (error) throw error
      return (data ?? []) as Suggestion[]
    },
    staleTime: 60_000,
  })
}

export function useCreateSuggestion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (s: { kind: SuggestionKind; body: string; page: string }) => {
      const { error } = await db.from('suggestions').insert({ kind: s.kind, body: s.body.trim(), page: s.page.slice(0, 200) })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useAnswerSuggestion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { id: string; status: SuggestionStatus; dev_note?: string }) => {
      const row: Record<string, unknown> = { status: v.status, handled_at: v.status === 'new' ? null : new Date().toISOString() }
      if (v.dev_note !== undefined) row.dev_note = v.dev_note.trim()
      const { error } = await db.from('suggestions').update(row).eq('id', v.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}
