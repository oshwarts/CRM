import { useEffect, useState } from 'react'
import { MonitorPlay, Printer } from 'lucide-react'
import { BrandLogo } from '../BrandLogo'
import { stuckText, type TeamModel } from '../../lib/teamStats'
import { formatDate, todayISO } from '../../lib/utils'
import { BigNumber, FunnelBars, Meter, TrendBars } from './TeamCharts'
import { Presentation } from './Presentation'
import { FunnelAnalysis } from './FunnelAnalysis'

/** the report is always printed on white, whatever theme the screen is in */
function useLightWhilePrinting() {
  useEffect(() => {
    const root = document.documentElement
    let was = false
    const before = () => {
      was = root.classList.contains('dark')
      root.classList.remove('dark')
    }
    const after = () => {
      if (was) root.classList.add('dark')
    }
    window.addEventListener('beforeprint', before)
    window.addEventListener('afterprint', after)
    return () => {
      window.removeEventListener('beforeprint', before)
      window.removeEventListener('afterprint', after)
    }
  }, [])
}

/** a one-page report for the company's management: the numbers, the trends, the agents against their goals, the pipeline — printable / PDF */
export function ManagementReport({ model }: { model: TeamModel }) {
  useLightWhilePrinting()
  const [showAgents, setShowAgents] = useState(true)
  const [showAttention, setShowAttention] = useState(true)
  const [presenting, setPresenting] = useState(false)
  const { kpis } = model
  const reds = model.attention.filter((a) => a.level === 'red')

  return (
    <div className="space-y-4">
      <div className="card space-y-3 p-3 print:hidden sm:flex sm:flex-wrap sm:items-center sm:gap-3 sm:space-y-0">
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <button className="btn-primary !px-4" onClick={() => window.print()}>
            <Printer size={16} /> הדפס / PDF
          </button>
          <button className="btn-secondary !px-4" onClick={() => setPresenting(true)}>
            <MonitorPlay size={16} /> מצגת לישיבה
          </button>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <label className="flex min-h-9 items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" className="h-4 w-4" checked={showAgents} onChange={(e) => setShowAgents(e.target.checked)} /> פירוט לפי סוכן
          </label>
          <label className="flex min-h-9 items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" className="h-4 w-4" checked={showAttention} onChange={(e) => setShowAttention(e.target.checked)} /> נקודות לתשומת לב
          </label>
        </div>
        <p className="text-xs text-slate-500">הדוח לא כולל הערות מנהל ושיחות אישיות עם הסוכנים.</p>
      </div>

      <article id="management-report" className="card space-y-5 p-4 sm:p-8">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#00326d] pb-4">
          <BrandLogo size="lg" />
          <div className="sm:text-left">
            <h2 className="text-2xl font-semibold text-brand-800">דוח ביצועי צוות</h2>
            <p className="text-sm text-slate-500">
              {model.period.label} · הופק ב-{formatDate(todayISO())}
            </p>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <BigNumber label="ניתוחי MAKO" value={kpis.surgeries.value} delta={kpis.surgeries} />
          <BigNumber label="פגישות שהתקיימו" value={kpis.meetings.value} delta={kpis.meetings} />
          <BigNumber label="עמידה ביעדים" value={kpis.hasGoals ? kpis.goals.value : null} suffix="%" delta={kpis.goals} points />
          <BigNumber label="התקדמות בהכשרות" value={kpis.training.pct} suffix="%" sub={kpis.training.stuck > 0 ? stuckText(kpis.training.stuck) : undefined} />
        </section>

        <section>
          <h3 className="mb-1.5 font-semibold text-brand-800">עיקרי הדברים</h3>
          <ul className="list-disc space-y-1 pr-5 text-sm text-slate-700">
            {model.summary.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="mb-1 font-semibold text-brand-800">ניתוחי MAKO לפי חודש</h3>
            <TrendBars series={model.series} field="surgeries" />
          </div>
          <div>
            <h3 className="mb-1 font-semibold text-brand-800">פגישות שהתקיימו לפי חודש</h3>
            <TrendBars series={model.series} field="meetings" />
          </div>
        </section>

        {showAgents && (
          <section>
            <h3 className="mb-1.5 font-semibold text-brand-800">הסוכנים מול היעדים וההכשרה</h3>
            <ul className="space-y-2 sm:hidden print:hidden">
              {model.agents.map((r) => (
                <li key={r.agent.id} className="rounded-xl border border-slate-200 p-3">
                  <p className="font-semibold text-slate-800">{r.agent.full_name || r.agent.email}</p>
                  <p className="mt-0.5 text-xs text-slate-600">
                    {r.m.meetings_held} פגישות · {r.m.surgeries_covered} ניתוחים בבתי החולים · {r.m.tasks_done} משימות הושלמו
                  </p>
                  <div className="mt-2 space-y-1 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <span className="w-12 shrink-0">יעדים</span>
                      <div className="flex-1">{r.goalsCount > 0 ? <Meter pct={r.goalsAvg} /> : <span className="text-slate-400">לא הוגדרו</span>}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-12 shrink-0">הכשרה</span>
                      <div className="flex-1">
                        <Meter pct={r.training.pct} />
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <table className="hidden w-full text-sm sm:table print:table">
              <thead>
                <tr className="border-b border-slate-300 text-right text-xs text-slate-500">
                  <th className="py-1.5 font-medium">סוכן</th>
                  <th className="py-1.5 text-center font-medium">פגישות</th>
                  <th className="py-1.5 text-center font-medium">ניתוחים בבתי החולים</th>
                  <th className="py-1.5 text-center font-medium">משימות שהושלמו</th>
                  <th className="w-40 py-1.5 font-medium">יעדים</th>
                  <th className="w-40 py-1.5 font-medium">הכשרה</th>
                </tr>
              </thead>
              <tbody>
                {model.agents.map((r) => (
                  <tr key={r.agent.id} className="border-b border-slate-100">
                    <td className="py-1.5 font-medium text-slate-800">{r.agent.full_name || r.agent.email}</td>
                    <td className="py-1.5 text-center">{r.m.meetings_held}</td>
                    <td className="py-1.5 text-center">{r.m.surgeries_covered}</td>
                    <td className="py-1.5 text-center">{r.m.tasks_done}</td>
                    <td className="py-1.5">{r.goalsCount > 0 ? <Meter pct={r.goalsAvg} /> : <span className="text-xs text-slate-300">לא הוגדרו</span>}</td>
                    <td className="py-1.5">
                      <Meter pct={r.training.pct} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section className="grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="mb-1 font-semibold text-brand-800">משפך רופאים פוטנציאליים</h3>
            <p className="mb-2 text-xs text-slate-500">
              {model.potentialTotal} בפיפליין, {model.closing} בשלבי משא ומתן וסגירה (מצב נוכחי)
            </p>
            <FunnelBars funnel={model.funnel} />
          </div>
          {showAttention && (
            <div>
              <h3 className="mb-1 font-semibold text-brand-800">נקודות לתשומת לב</h3>
              {model.attention.length === 0 ? (
                <p className="text-sm text-emerald-700">אין חריגים בצוות.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {model.attention.slice(0, 10).map((a, i) => (
                    <li key={i} className={a.level === 'red' ? 'text-red-600' : 'text-amber-700'}>
                      ● {a.agent.full_name || a.agent.email}: {a.text}
                    </li>
                  ))}
                  {model.attention.length > 10 && <li className="text-slate-400">ועוד {model.attention.length - 10}…</li>}
                </ul>
              )}
              {reds.length === 0 && model.attention.length > 0 && <p className="mt-1 text-xs text-slate-400">אין חריגים דחופים.</p>}
            </div>
          )}
        </section>

        <section>
          <h3 className="mb-1 font-semibold text-brand-800">המשפך במספרים</h3>
          <FunnelAnalysis model={model} />
        </section>

        <footer className="border-t border-slate-200 pt-2 text-[11px] text-slate-400">
          הנתונים נלקחים מהמערכת: פגישות שהתקיימו בפועל, ניתוחי MAKO מהסריקות (עד היום), יעדים והכשרות כפי שהוגדרו. המשפך וההכשרות מציגים את המצב הנוכחי.
        </footer>
      </article>

      {presenting && <Presentation model={model} onClose={() => setPresenting(false)} />}
    </div>
  )
}
