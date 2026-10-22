import { GraduationCap } from 'lucide-react'
import { useProcedures } from '../lib/api'
import { useTraining, useTrainingStages } from '../lib/agentsApi'
import { useAuth } from '../context/AuthProvider'
import { scopeState, stagesOf } from '../lib/training'
import { classNames, todayISO } from '../lib/utils'

/** the signed-in agent's own training progress (read-only); shown only once something was recorded */
export function MyTraining() {
  const { user } = useAuth()
  const procedures = useProcedures()
  const stages = useTrainingStages()
  const training = useTraining()
  const mine = (training.data ?? []).filter((r) => r.agent_id === user?.id)
  if (mine.length === 0) return null
  const today = todayISO()
  const all = stages.data ?? []
  const scopes = [
    { key: 'general', title: 'כללי', procedureId: null as string | null },
    ...(procedures.data ?? []).map((p) => ({ key: p.id, title: p.name, procedureId: p.id as string | null })),
  ]
  const rows = scopes.flatMap((sc) => {
    const st = scopeState(stagesOf(all, sc.procedureId), mine, today)
    return st.total > 0 && st.started ? [{ sc, st }] : []
  })
  return (
    <div>
      <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-brand-700">
        <GraduationCap size={13} aria-hidden /> ההכשרות שלי
      </h3>
      <ul className="space-y-2.5">
        {rows.map(({ sc, st }) => (
          <li key={sc.key} className="text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-slate-800">{sc.title}</span>
              <span className={classNames('text-xs', st.complete ? 'text-emerald-700' : 'text-slate-600')}>
                {st.complete ? 'הושלם' : `${st.doneCount}/${st.total} שלבים`}
              </span>
            </div>
            <ul className="mt-1 space-y-0.5">
              {st.stages.map((sp) => (
                <li key={sp.stage.id} className="flex items-center gap-2 text-xs text-slate-600">
                  <span className={classNames('w-24 shrink-0 truncate sm:w-28', sp.done && 'text-emerald-700')}>{sp.stage.name}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <span className={classNames('block h-full', sp.done ? 'bg-emerald-500' : 'bg-brand-500')} style={{ width: `${Math.min(100, (sp.count / sp.stage.required_count) * 100)}%` }} />
                  </span>
                  <span className="w-8 text-left text-slate-500">
                    {sp.count}/{sp.stage.required_count}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  )
}
