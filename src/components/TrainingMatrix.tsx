import { Link } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { useAgents, useProcedures } from '../lib/api'
import { useTraining } from '../lib/agentsApi'
import { TRAINING_STAGES, trainingOf, trainingState } from '../lib/training'
import { stageTone } from './TrainingPanel'
import { EmptyState, Spinner } from './ui'
import { classNames, formatDate, todayISO } from '../lib/utils'

/** managers: all agents against all procedures — who is certified in what and where each one stands */
export function TrainingMatrix() {
  const agents = useAgents()
  const procedures = useProcedures()
  const training = useTraining()
  if (agents.isLoading || procedures.isLoading || training.isLoading) return <Spinner />
  const list = (agents.data ?? []).filter((a) => a.role === 'agent')
  const procs = procedures.data ?? []
  if (list.length === 0) return <EmptyState title="אין סוכנים" />
  const today = todayISO()
  const all = training.data ?? []

  const stuck = list.flatMap((a) =>
    procs.flatMap((p) => {
      const st = trainingState(trainingOf(all, a.id, p.id), today)
      return st.stuck ? [{ a, p, st }] : []
    }),
  )

  return (
    <div className="space-y-3">
      {stuck.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <p className="mb-1 flex items-center gap-1.5 font-semibold">
            <AlertTriangle size={15} /> {stuck.length} הכשרות תקועות
          </p>
          <ul className="space-y-0.5 text-xs">
            {stuck.map(({ a, p, st }) => (
              <li key={`${a.id}-${p.id}`}>
                <Link to={`/agents/${a.id}`} className="font-medium underline">
                  {a.full_name || a.email}
                </Link>{' '}
                — {p.name}: אחרי "{TRAINING_STAGES[st.top].label}" ({formatDate(st.last!)}), {st.daysSince} ימים בלי התקדמות
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
              {procs.map((p) => (
                <th key={p.id} className="p-2.5 text-center font-medium">
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((a) => (
              <tr key={a.id} className="border-b border-slate-100">
                <td className="p-2.5">
                  <Link to={`/agents/${a.id}`} className="font-medium text-brand-700 hover:underline">
                    {a.full_name || a.email}
                  </Link>
                </td>
                {procs.map((p) => {
                  const st = trainingState(trainingOf(all, a.id, p.id), today)
                  return (
                    <td key={p.id} className="p-1.5 text-center">
                      <span
                        className={classNames('inline-block min-w-24 rounded-lg border px-2 py-1 text-xs', stageTone(st.top, st.certified, st.stuck))}
                        title={st.last ? `אחרון: ${formatDate(st.last)}` : 'לא התחיל'}
                      >
                        {st.top < 0 ? '—' : TRAINING_STAGES[st.top].label}
                        {st.stuck && ' ⚠'}
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400">
        השלבים לפי הסדר: {TRAINING_STAGES.map((s) => s.label).join(' ← ')}. לחץ על סוכן כדי לעדכן שלבים, להוסיף תאריך, הערות וקובץ.
      </p>
    </div>
  )
}
