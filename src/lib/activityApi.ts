// The feed of "what is going on in the department" assembled from the data the app already loads, and what each person has seen.
// What was seen and which kinds of news a person wants are kept on his device (per user).
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAgents, useDoctors, useMeetings } from './api'
import { useAuth } from '../context/AuthProvider'
import { useInvestigations } from './investigations'
import { useProcesses } from './processes'
import { useStageHistoryAll } from './pipeline'
import { ALL_KINDS, buildFeed, unreadItems, type ActivityItem, type ActivityKind, type FeedInput } from './activity'

const read = <T,>(key: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(key)
    return v ? (JSON.parse(v) as T) : fallback
  } catch {
    return fallback
  }
}
const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* the choice is kept for this visit only */
  }
}

const subs = new Set<() => void>()
/** a value kept on the device and shared by every place that shows it (the menu counter and the page) */
function useStored<T>(key: string, fallback: T) {
  const [v, setV] = useState<T>(() => read(key, fallback))
  useEffect(() => {
    const f = () => setV(read(key, fallback))
    subs.add(f)
    return () => {
      subs.delete(f)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  const set = useCallback(
    (n: T) => {
      write(key, n)
      subs.forEach((f) => f())
    },
    [key],
  )
  return [v, set] as const
}

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

/** what is new for this person, the moment he last looked and the kinds he wants to hear about */
export function useActivityState() {
  const { user } = useAuth()
  const id = user?.id ?? 'anon'
  // the first time: what happened in the last week is new
  const [week] = useState(() => new Date(Date.now() - 7 * 86400_000).toISOString())
  const [seenAt, setSeenAt] = useStored<string>(`ami.activity.seen.${id}`, week)
  const [kinds, setKinds] = useStored<ActivityKind[]>(`ami.activity.kinds.${id}`, ALL_KINDS)
  const { items, loading, error } = useActivityFeed()
  const unread = useMemo(() => unreadItems(items, seenAt, user?.id, kinds), [items, seenAt, user?.id, kinds])
  const markSeen = useCallback(() => setSeenAt(new Date().toISOString()), [setSeenAt])
  return { items, loading, error, unread, seenAt, markSeen, kinds, setKinds }
}
