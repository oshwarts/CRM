// The feed of 'what is going on in the department' assembled from the data the app already loads, and what each person has seen.
// What was seen and which kinds of news a person wants are kept per user in the database (migration 080), so they follow him to every device.
import { useCallback, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { useAgents, useDoctors, useMeetings } from './api'
import { useAuth } from '../context/AuthProvider'
import { useInvestigations } from './investigations'
import { useProcesses } from './processes'
import { useStageHistoryAll } from './pipeline'
import { ALL_KINDS, buildFeed, unreadItems, type ActivityItem, type ActivityKind, type FeedInput } from './activity'

// the table is newer than the generated types
const raw = supabase as unknown as SupabaseClient
type Prefs = { seen_at: string | null; kinds: ActivityKind[] | null }

export function useActivityFeed() {
  const meetings = useMeetings()
  const investigations = useInvestigations()
  const doctors = useDoctors()
  const stages = useStageHistoryAll()
  const processes = useProcesses()
  const agents = useAgents()

  const items = useMemo<ActivityItem[]>(() => {
    const names = Object.fromEntries((agents.data ?? []).map((a) => [a.id, a.full_name || a.email]))
    const input: FeedInput = {
      names,
      meetings: (meetings.data ?? []) as unknown as FeedInput['meetings'],
      investigations: (investigations.data ?? []).map((i) => ({ ...i, doctors: i.doctors.map((d) => ({ id: d.id, name: d.name })) })),
      doctors: (doctors.data ?? []).map((d) => ({ id: d.id, name: d.name, title: d.title, created_at: d.created_at, created_by: d.created_by })),
      stages: stages.data ?? [],
      processes: (processes.data ?? []).map((p) => ({ id: p.id, name: p.name, start_date: p.start_date, created_at: p.created_at })),
    }
    return buildFeed(input)
  }, [meetings.data, investigations.data, doctors.data, stages.data, processes.data, agents.data])

  return { items, loading: meetings.isLoading || doctors.isLoading, error: meetings.error && !meetings.data ? meetings.error : null }
}

/** what is new for this person, the moment he last looked and the kinds he wants to hear about (shared by the menu counter and the page) */
export function useActivityState() {
  const { user } = useAuth()
  const id = user?.id ?? ''
  const qc = useQueryClient()
  const key = ['activity-prefs', id]
  // the first time: what happened in the last week is new
  const [week] = useState(() => new Date(Date.now() - 7 * 86400_000).toISOString())
  const prefs = useQuery({
    queryKey: key,
    enabled: !!id,
    queryFn: async (): Promise<Prefs> => {
      const { data, error } = await raw.from('user_activity_prefs').select('seen_at, kinds').eq('user_id', id).maybeSingle()
      if (error) throw new Error(error.message)
      return (data as Prefs | null) ?? { seen_at: null, kinds: null }
    },
  })
  const save = useMutation({
    meta: { silent: true },
    mutationFn: async (p: Partial<Prefs>) => {
      const { error } = await raw.from('user_activity_prefs').upsert({ user_id: id, ...p, updated_at: new Date().toISOString() })
      if (error) throw new Error(error.message)
    },
    // the counter changes at once; a refused write puts it back
    onMutate: async (p) => {
      await qc.cancelQueries({ queryKey: key })
      const before = qc.getQueryData<Prefs>(key)
      qc.setQueryData<Prefs>(key, { seen_at: before?.seen_at ?? null, kinds: before?.kinds ?? null, ...p })
      return { before }
    },
    onError: (_e, _p, ctx) => qc.setQueryData(key, ctx?.before),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })

  const { items, loading, error } = useActivityFeed()
  const seenAt = prefs.data?.seen_at ?? week
  const kinds = prefs.data?.kinds ?? ALL_KINDS
  const unread = useMemo(() => (prefs.data ? unreadItems(items, seenAt, user?.id, kinds) : []), [prefs.data, items, seenAt, user?.id, kinds])
  const markSeen = useCallback(() => save.mutate({ seen_at: new Date().toISOString() }), [save])
  const setKinds = useCallback((k: ActivityKind[]) => save.mutate({ kinds: k }), [save])
  return { items, loading, error, unread, seenAt, markSeen, kinds, setKinds }
}
