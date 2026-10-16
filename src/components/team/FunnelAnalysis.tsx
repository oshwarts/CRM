import type { TeamModel } from '../../lib/teamStats'
import { classNames } from '../../lib/utils'

/** the funnel in numbers: how many reach each stage, the share that moves on, the days in a stage, and who was closed and why */
export function FunnelAnalysis({ model, className }: { model: TeamModel; className?: string }) {
  const { stats, stuck, lost } = model.pipeline
  const known = stats.reduce((n, s) => n + s.reached, 0)
  return (
    <div className={className}>
      {known < 5 ? (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">המעברים בין השלבים נרשמים מעכשיו, ולכן אחוזי ההמרה וזמן השהייה ימלאו עם הזמן.</p>
      ) : null}
      <table className="mt-2 w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-right text-xs text-slate-500">
            <th className="py-1.5 font-medium">שלב</th>
            <th className="py-1.5 text-center font-medium">הגיעו</th>
            <th className="py-1.5 text-center font-medium">עברו הלאה</th>
            <th className="py-1.5 text-center font-medium">ימים בשלב (ממוצע)</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s) => (
            <tr key={s.stage} className="border-b border-slate-100">
              <td className="py-1.5 text-slate-700">{s.stage}</td>
              <td className="py-1.5 text-center font-semibold text-brand-800">{s.reached}</td>
              <td className={classNames('py-1.5 text-center', s.toNextPct !== null && s.toNextPct < 40 && 'font-semibold text-amber-700')}>{s.toNextPct === null ? <span className="text-slate-300">—</span> : `${s.toNextPct}%`}</td>
              <td className="py-1.5 text-center">{s.avgDays === null ? <span className="text-slate-300">—</span> : s.avgDays}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 space-y-0.5 text-xs text-slate-600">
        <p>
          {stuck > 0 ? <span className="font-medium text-amber-700">{stuck} רופאים פוטנציאליים דורשים דחיפה (תקועים, בלי צעד הבא או באיחור).</span> : 'אין רופאים פוטנציאליים תקועים.'}
        </p>
        {lost.count > 0 && (
          <p>
            נסגרו כלא רלוונטיים: <span className="font-medium">{lost.count}</span> · {lost.reasons.map(([r, n]) => `${r} (${n})`).join(', ')}
          </p>
        )}
      </div>
    </div>
  )
}
