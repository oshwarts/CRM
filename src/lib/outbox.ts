import { useSyncExternalStore } from 'react'
import { supabase } from './supabase'
import { openDb, OFFLINE_MESSAGE } from './offline'
import { queryClient } from './queryClient'

/* ---------- offline writes: the outbox ----------
   A small set of safe actions can be done without a network. Each one is stored here (IndexedDB) with the screen
   already updated optimistically, and sent when the connection returns:
   - the oldest first, one by one (a task created offline is sent before the sub-steps added to it)
   - creating records uses ids made on the device, so sending the same action twice never duplicates it
   - changing an existing record is merged field by field: a field is overwritten only if nobody else changed it
     meanwhile; a real conflict (both changed the same field to different values) waits for the user's decision. */

export type OpKind = 'task.done' | 'task.save' | 'subtask.toggle' | 'subtask.add' | 'scan.patch' | 'count.save' | 'meeting.save'
export type Conflict = { field: string; server: unknown; mine: unknown }
export type Op = {
  id: string
  kind: OpKind
  userId: string
  createdAt: number
  label: string
  /** records the op touches — shown as "waiting to be sent" next to them */
  recordIds: string[]
  payload: unknown
  state: 'pending' | 'conflict' | 'failed'
  error?: string
  /** set when state is "conflict": where to write the user's choice */
  target?: { table: string; id: string }
  conflicts?: Conflict[]
}
export type NewOp = Pick<Op, 'kind' | 'label' | 'recordIds' | 'payload'>
export type ExecResult = { conflicts?: Conflict[]; target?: { table: string; id: string } } | void
type Executor = (payload: never, op: Op) => Promise<ExecResult>

const KEY = 'ops'
const executors = new Map<OpKind, Executor>()
export function registerExecutor<P>(kind: OpKind, fn: (payload: P, op: Op) => Promise<ExecResult>) {
  executors.set(kind, fn as unknown as Executor)
}

let ops: Op[] = []
let draining = false
let userId = ''
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())
// stable snapshot for useSyncExternalStore
let snapshot = { ops: [] as Op[], draining: false, userId: '' }
const refreshSnapshot = () => {
  snapshot = { ops, draining, userId }
  notify()
}

async function read(): Promise<Op[]> {
  try {
    const db = await openDb()
    return await new Promise((resolve, reject) => {
      const r = db.transaction('outbox').objectStore('outbox').get(KEY)
      r.onsuccess = () => resolve((r.result as Op[] | undefined) ?? [])
      r.onerror = () => reject(r.error)
    })
  } catch {
    return []
  }
}

async function write() {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const r = db.transaction('outbox', 'readwrite').objectStore('outbox').put(ops, KEY)
      r.onsuccess = () => resolve()
      r.onerror = () => reject(r.error)
    })
  } catch {
    // storage full: the change stays in memory until the app is closed
  }
  channel?.postMessage('changed')
}

const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('ami-outbox') : null

async function reload() {
  ops = await read()
  refreshSnapshot()
}

/** true for "no connection" failures (as opposed to the server refusing a request) */
export function isNetworkError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e)
  return msg.includes(OFFLINE_MESSAGE) || /failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(msg)
}

export async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? ''
}

/** all changes of the queue go through one lock (shared by every tab), always starting from what is saved */
async function mutate(change: () => void | Promise<void>): Promise<void> {
  const run = async () => {
    ops = await read()
    await change()
    refreshSnapshot()
    await write()
  }
  if (typeof navigator !== 'undefined' && 'locks' in navigator) await navigator.locks.request('ami-outbox', run)
  else await run()
}

export async function enqueue(op: NewOp, extra: Partial<Op> = {}): Promise<void> {
  const uid = userId || (await currentUserId())
  await mutate(() => {
    ops = [...ops, { ...op, id: crypto.randomUUID(), userId: uid, createdAt: Date.now(), state: 'pending' as const, ...extra }]
  })
}

/** runs the action now when online; queues it (and updates the screen via `optimistic`) when offline or the network fails */
export async function runOrQueue(op: NewOp, direct: () => Promise<ExecResult>, optimistic: () => void): Promise<void> {
  if (navigator.onLine) {
    try {
      const r = await direct()
      // someone else changed the same field meanwhile: keep it for the user to decide
      if (r && r.conflicts && r.conflicts.length) await enqueue(op, { state: 'conflict', conflicts: r.conflicts, target: r.target })
      return
    } catch (e) {
      if (!isNetworkError(e)) throw e
    }
  }
  await enqueue(op)
  optimistic()
  scheduleDrain(8000)
}

let drainTimer: ReturnType<typeof setTimeout> | null = null
function scheduleDrain(ms: number) {
  if (drainTimer) clearTimeout(drainTimer)
  drainTimer = setTimeout(() => void drain(), ms)
}

export async function drain(): Promise<void> {
  if (!navigator.onLine || draining) return
  const run = async () => {
    draining = true
    refreshSnapshot()
    let touched = false
    try {
      await reload()
      userId = await currentUserId()
      if (!userId) return
      for (const op of ops.filter((o) => o.userId === userId && o.state === 'pending')) {
        const exec = executors.get(op.kind)
        try {
          if (!exec) throw new Error('פעולה לא מוכרת')
          const r = await exec(op.payload as never, op)
          touched = true
          if (r && r.conflicts && r.conflicts.length) {
            ops = ops.map((o) => (o.id === op.id ? { ...o, state: 'conflict' as const, conflicts: r.conflicts, target: r.target } : o))
          } else ops = ops.filter((o) => o.id !== op.id)
        } catch (e) {
          if (isNetworkError(e)) break
          const msg = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : 'השליחה נכשלה'
          ops = ops.map((o) => (o.id === op.id ? { ...o, state: 'failed' as const, error: msg } : o))
        }
        await write()
        refreshSnapshot()
      }
    } finally {
      draining = false
      await write()
      refreshSnapshot()
      // only now reload the data, so the screen shows what the server really has
      if (touched) void queryClient.invalidateQueries()
    }
  }
  if (typeof navigator !== 'undefined' && 'locks' in navigator) await navigator.locks.request('ami-outbox', run)
  else await run()
}

export async function retryOp(id: string) {
  await mutate(() => {
    ops = ops.map((o) => (o.id === id ? { ...o, state: 'pending' as const, error: undefined } : o))
  })
  await drain()
}

/** drops a queued change (the screen goes back to what the server has) */
export async function discardOp(id: string) {
  await mutate(() => {
    ops = ops.filter((o) => o.id !== id)
  })
  void queryClient.invalidateQueries()
}

/** the user's decision for each field in conflict: keep the server's value or write his own */
export async function resolveConflict(id: string, choices: Record<string, 'server' | 'mine'>) {
  const op = ops.find((o) => o.id === id)
  if (!op || !op.target || !op.conflicts) return
  const patch: Record<string, unknown> = {}
  for (const c of op.conflicts) if (choices[c.field] === 'mine') patch[c.field] = c.mine
  if (Object.keys(patch).length) {
    const { error } = await supabase.from(op.target.table as 'meetings').update(patch as never).eq('id', op.target.id)
    if (error) {
      await mutate(() => {
        ops = ops.map((o) => (o.id === id ? { ...o, state: 'failed' as const, error: error.message } : o))
      })
      return
    }
  }
  await discardOp(id)
}

/** called on an explicit sign out */
export async function clearOutbox() {
  await mutate(() => {
    ops = []
  })
}

export function useOutbox() {
  const s = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => snapshot,
    () => snapshot,
  )
  const mine = s.ops.filter((o) => !s.userId || o.userId === s.userId)
  return {
    ops: mine,
    pending: mine.filter((o) => o.state === 'pending').length,
    conflicts: mine.filter((o) => o.state === 'conflict').length,
    failed: mine.filter((o) => o.state === 'failed').length,
    draining: s.draining,
  }
}

/** ids of the records that have a change waiting to be sent → state */
export function usePendingRecords(): Map<string, Op['state']> {
  const { ops: list } = useOutbox()
  const m = new Map<string, Op['state']>()
  for (const o of list) for (const id of o.recordIds) if (m.get(id) !== 'conflict') m.set(id, o.state)
  return m
}

/** compares a patch with what the server has now (field by field) and applies what is safe */
export async function mergePatch(
  table: string,
  id: string,
  patch: Record<string, unknown>,
  base: Record<string, unknown> | null,
): Promise<ExecResult> {
  const fields = Object.keys(patch)
  const { data: server, error } = await supabase
    .from(table as 'meetings')
    .select(fields.join(','))
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!server) throw new Error('הרשומה נמחקה על ידי משתמש אחר')
  const row = server as unknown as Record<string, unknown>
  const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
  const toApply: Record<string, unknown> = {}
  const conflicts: Conflict[] = []
  for (const f of fields) {
    if (same(row[f], patch[f])) continue // already what I want
    if (base === null || same(row[f], base[f])) toApply[f] = patch[f] // nobody touched it meanwhile
    else conflicts.push({ field: f, server: row[f], mine: patch[f] })
  }
  if (Object.keys(toApply).length) {
    const { error: e2 } = await supabase.from(table as 'meetings').update(toApply as never).eq('id', id)
    if (e2) throw e2
  }
  return conflicts.length ? { conflicts, target: { table, id } } : undefined
}

/* ---------- start ---------- */
if (typeof window !== 'undefined') {
  void reload().then(async () => {
    userId = await currentUserId()
    refreshSnapshot()
    void drain()
  })
  channel?.addEventListener('message', () => void reload())
  window.addEventListener('online', () => void drain())
  supabase.auth.onAuthStateChange((_e, session) => {
    userId = session?.user.id ?? ''
    refreshSnapshot()
    if (userId) void drain()
  })
  // a safety net: pending changes are retried every half minute while the app is open
  setInterval(() => {
    if (ops.some((o) => o.state === 'pending')) void drain()
  }, 30_000)
}

/** how many changes are waiting right now (read at call time, not from a render) */
export const outboxSize = () => ops.filter((o) => !userId || o.userId === userId).length
