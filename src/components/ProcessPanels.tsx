import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, UserPlus } from 'lucide-react'
import { useAuth } from '../context/AuthProvider'
import { classNames, formatDate, todayISO } from '../lib/utils'
import { KIND_LABELS, progress, suggestions } from '../lib/processLogic'
import { useAllProfiles, useProcesses, useTemplates, type Process } from '../lib/processes'
import { StartProcessModal } from './ProcessModals'

export function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="התקדמות">
      <div className="h-full bg-emerald-500 transition-all" style={{ width: `${percent}%` }} />
    </div>
  )
}

/** one process as a card: what it is about, the progress, and what is late */
export function ProcessCard({ p }: { p: Process }) {
  const pr = progress(p.steps, todayISO())
  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <Link to={`/processes/${p.id}`} className="inline-flex min-h-[32px] items-center font-semibold text-brand-700 hover:underline">
          <span dir="auto">{p.name}</span>
        </Link>
        <span className="text-xs text-slate-500">{KIND_LABELS[p.kind] ?? ''} · התחיל ב-{formatDate(p.start_date)}</span>
      </div>
      <div className="mt-1.5 flex items-center gap-3">
        <div className="flex-1"><ProgressBar percent={pr.percent} /></div>
        <span className="shrink-0 text-sm text-slate-700">{pr.done}/{pr.total}</span>
      </div>
      {p.status === 'open' && pr.overdue > 0 && (
        <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-red-700">
          <AlertTriangle size={12} aria-hidden /> {pr.overdue === 1 ? 'שלב אחד באיחור' : `${pr.overdue} שלבים באיחור`}
        </p>
      )}
      {p.status === 'closed' && <p className="mt-1 text-xs text-green-700">נסגר ב-{formatDate(p.closed_on)}</p>}
    </li>
  )
}

const dismissedKey = 'ami.process.dismissed'
const readDismissed = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(dismissedKey) ?? '[]')
  } catch {
    return []
  }
}

/** the manager is asked (nothing starts by itself): an agent joined lately, an agent left */
export function ProcessSuggestions({ onStarted }: { onStarted?: (id: string) => void }) {
  const { isAdmin } = useAuth()
  const profiles = useAllProfiles(isAdmin)
  const processes = useProcesses()
  const templates = useTemplates()
  const [dismissed, setDismissed] = useState<string[]>(readDismissed)
  const [starting, setStarting] = useState<{ agentId: string; kind: 'agent_in' | 'agent_out' } | null>(null)
  if (!isAdmin) return null
  const list = suggestions(profiles.data ?? [], processes.data ?? [], todayISO()).filter((s) => !dismissed.includes(`${s.agent.id}:${s.kind}`))
  if (list.length === 0) return null
  const dismiss = (key: string) => {
    const next = [...dismissed, key]
    setDismissed(next)
    try {
      localStorage.setItem(dismissedKey, JSON.stringify(next))
    } catch {
      /* the choice is kept for this visit only */
    }
  }
  const tpl = starting ? (templates.data ?? []).find((t) => t.kind === starting.kind) ?? null : null
  return (
    <section aria-label="הצעות" className="space-y-1.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
      <p className="font-medium text-amber-900">להתחיל תהליך?</p>
      <ul className="space-y-1.5">
        {list.map((s) => {
          const key = `${s.agent.id}:${s.kind}`
          return (
            <li key={key} className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 flex-1 basis-48 text-slate-800">
                {s.kind === 'agent_in' ? `${s.agent.full_name} הצטרף לאחרונה. באיזה שלב הוא? להתחיל תהליך קליטה?` : `${s.agent.full_name} עזב או הושבת. להתחיל תהליך עזיבה?`}
              </span>
              <button type="button" className="btn-secondary !py-1 text-xs" onClick={() => setStarting({ agentId: s.agent.id, kind: s.kind })}>
                <UserPlus size={14} aria-hidden /> התחל
              </button>
              <button type="button" className="btn-ghost !px-2 text-xs" onClick={() => dismiss(key)}>לא עכשיו</button>
            </li>
          )
        })}
      </ul>
      {starting && (
        <StartProcessModal
          templates={templates.data ?? []}
          template={tpl}
          agentId={starting.agentId}
          onClose={() => setStarting(null)}
          onStarted={(id) => (setStarting(null), onStarted?.(id))}
        />
      )}
    </section>
  )
}

/** the processes of one agent (on his card in the agents management) */
export function AgentProcesses({ agentId }: { agentId: string }) {
  const processes = useProcesses()
  const mine = (processes.data ?? []).filter((p) => p.subject_agent_id === agentId)
  if (processes.isLoading) return null
  return (
    <div>
      {mine.length === 0 ? (
        <p className="text-sm text-slate-500">אין תהליכים לסוכן הזה. <Link to="/processes" className="font-medium text-brand-700 hover:underline">להתחלת תהליך</Link></p>
      ) : (
        <ul className={classNames('grid gap-2 sm:grid-cols-2')}>{mine.map((p) => <ProcessCard key={p.id} p={p} />)}</ul>
      )}
    </div>
  )
}
