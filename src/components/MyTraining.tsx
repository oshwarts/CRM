import { GraduationCap } from 'lucide-react'
import { useProcedures } from '../lib/api'
import { useTraining } from '../lib/agentsApi'
import { useAuth } from '../context/AuthProvider'
import { TRAINING_STAGES, trainingOf, trainingState } from '../lib/training'
import { classNames, formatDate, todayISO } from '../lib/utils'

/** the signed-in agent's own training progress (read-only); shown only once something was recorded */
export function MyTraining() {
  const { user } = useAuth()
  const procedures = useProcedures()
  const training = useTraining()
  const mine = (training.data ?? []).filter((r) => r.agent_id === user?.id)
  if (mine.length === 0) return null
  const today = todayISO()
  const rows = (procedures.data ?? []).flatMap((p) => {
    const st = trainingState(trainingOf(mine, user!.id, p.id), today)
    return st.top >= 0 ? [{ p, st }] : []
  })
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
        <GraduationCap size={12} /> ההכשרות שלי
      </p>
      <ul className="space-y-2">
        {rows.map(({ p, st }) => (
          <li key={p.id} className="text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-slate-800">{p.name}</span>
              <span className={classNames('text-xs', st.certified ? 'text-emerald-600' : 'text-slate-500')}>
                {TRAINING_STAGES[st.top].label} · {formatDate(st.last!)}
              </span>
            </div>
            <div className="mt-1 flex gap-1">
              {TRAINING_STAGES.map((s, i) => (
                <span key={s.key} className={classNames('h-1.5 flex-1 rounded-full', i <= st.top ? (st.certified ? 'bg-emerald-500' : 'bg-brand-500') : 'bg-slate-100')} title={s.label} />
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
