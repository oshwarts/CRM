import { Link } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { useAgents, useProcedures } from '../lib/api'
import { useTraining, useTrainingStages } from '../lib/agentsApi'
import { scopeState, stagesOf } from '../lib/training'
import { scopeTone } from './TrainingPanel'
import { EmptyState, Spinner } from './ui'
import { classNames, formatDate, todayISO } from '../lib/utils'

/** managers: all agents against the general stages and every procedure — who completed what and where each one stands */
export function TrainingMatrix() {
  const agents = useAgents()
  const procedures = useProcedures()
  const stages = useTrainingStages()
  const training = useTraining()
  if (agents.isLoading || procedures.isLoading || stages.isLoading || training.isLoading) return <Spinner />
  const list = (agents.data ?? []).filter((a) => a.role === 'agent')
  if (list.length === 0) return <EmptyState title="אין סוכנים" />
  const today = todayISO()
  const allStages = stages.data ?? []
  const all = training.data ?? []
  const scopes = [
    { key: 'general', title: 'כללי', procedureId: null as string | null },
    ...(procedures.data ?? []).map((p) => ({ key: p.id, title: p.name, procedureId: p.id as string | null })),
  ].filter((sc) => stagesOf(allStages, sc.procedureId).length > 0)
  if (scopes.length === 0) return <EmptyState title="לא הוגדרו שלבי הכשרה" hint="פתח כרטיס סוכן ← הכשרות ← עריכת שלבים" />

  const cells = list.map((a) => {
    const mine = all.filter((r) => r.agent_id === a.id)
    return { a, states: scopes.map((sc) => ({ sc, st: scopeState(stagesOf(allStages, sc.procedureId), mine, today) })) }
  })
  const stuck = cells.flatMap(({ a, states }) => states.filter((s) => s.st.stuck).map((s) => ({ a, ...s })))

  return (
    <div className="space-y-3">
      {stuck.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <p className="mb-1 flex items-center gap-1.5 font-semibold">
            <AlertTriangle size={15} /> {stuck.length} הכשרות תקועות
          </p>
          <ul className="space-y-0.5 text-xs">
            {stuck.map(({ a, sc, st }) => (
              <li key={`${a.id}-${sc.key}`}>
                <Link to={`/agents/${a.id}`} className="font-medium underline">
                  {a.full_name || a.email}
                </Link>{' '}
                — {sc.title}: {st.current ? `"${st.current.stage.name}" ${st.current.count}/${st.current.stage.required_count}` : ''} (אחרון {formatDate(st.last!)}), {st.daysSince} ימים בלי התקדמות
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-right text-xs text-slate-500">
              <th className="p-2.5 font-medium">סוכן</th>
              {scopes.map((sc) => (
                <th key={sc.key} className="p-2.5 text-center font-medium">
                  {sc.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cells.map(({ a, states }) => (
              <tr key={a.id} className="border-b border-slate-100">
                <td className="p-2.5">
                  <Link to={`/agents/${a.id}`} className="font-medium text-brand-700 hover:underline">
                    {a.full_name || a.email}
                  </Link>
                </td>
                {states.map(({ sc, st }) => (
                  <td key={sc.key} className="p-1.5 text-center">
                    <span
                      className={classNames('inline-block min-w-24 rounded-lg border px-2 py-1 text-xs', scopeTone(st))}
                      title={st.last ? `אחרון: ${formatDate(st.last)}` : 'לא התחיל'}
                    >
                      {st.complete ? 'הושלם' : st.started ? `${st.doneCount}/${st.total}` : '—'}
                      {st.stuck && ' ⚠'}
                      {!st.complete && st.started && st.current && (
                        <span className="block text-[10px] opacity-80">
                          {st.current.stage.name} {st.current.count}/{st.current.stage.required_count}
                        </span>
                      )}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400">הטבלה מראה כמה שלבים הושלמו בכל תחום ואיפה הסוכן עומד כרגע. לחץ על סוכן כדי לעדכן השלמות ולערוך שלבים.</p>
    </div>
  )
}
