import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, ChevronDown } from 'lucide-react'
import type { AgentRow, TeamModel } from '../../lib/teamStats'
import { change, stuckText } from '../../lib/teamStats'
import { classNames } from '../../lib/utils'
import { BigNumber, DeltaBadge, FunnelBars, Meter, Spark, TrendBars } from './TeamCharts'

const nameOf = (r: AgentRow) => r.agent.full_name || r.agent.email

function AgentCard({ r }: { r: AgentRow }) {
  const reds = r.attention.filter((a) => a.level === 'red').length
  const tone = reds > 0 ? 'border-red-300' : r.attention.length > 0 ? 'border-amber-300' : 'border-brand-100/70'
  return (
    <Link to={`/agents/${r.agent.id}`} className={classNames('card block space-y-3 p-4 transition hover:shadow-pop', tone)}>
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#00326d] font-semibold text-white">{(nameOf(r).trim()[0] ?? '?').toUpperCase()}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-brand-800">{nameOf(r)}</p>
          <p className="text-xs text-slate-500">
            {r.lastMeetingDays === null ? 'אין פגישות מתועדות' : r.lastMeetingDays === 0 ? 'פגישה אחרונה: היום' : `פגישה אחרונה: לפני ${r.lastMeetingDays} ימים`}
          </p>
        </div>
        {r.attention.length > 0 && (
          <span className={classNames('chip shrink-0', reds > 0 ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-700')}>
            <AlertTriangle size={12} /> {r.attention.length}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-slate-500">פגישות</p>
          <p className="flex items-center gap-2">
            <span className="text-2xl font-semibold text-brand-800">{r.m.meetings_held}</span>
            <Spark values={r.meetingsSeries} />
          </p>
          <DeltaBadge d={change(r.m.meetings_held, r.prev.meetings_held)} />
        </div>
        <div>
          <p className="text-xs text-slate-500">ניתוחים בבתי החולים שלו</p>
          <p className="text-2xl font-semibold text-brand-800">{r.m.surgeries_covered}</p>
          <DeltaBadge d={change(r.m.surgeries_covered, r.prev.surgeries_covered)} />
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="w-12 shrink-0">יעדים</span>
          <div className="flex-1">{r.goalsCount > 0 ? <Meter pct={r.goalsAvg} /> : <span className="text-slate-300">לא הוגדרו</span>}</div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="w-12 shrink-0">הכשרה</span>
          <div className="flex-1">
            <Meter pct={r.training.pct} />
          </div>
        </div>
      </div>

      {r.attention.length > 0 && (
        <ul className="space-y-0.5 border-t border-slate-100 pt-2 text-xs">
          {r.attention.slice(0, 3).map((a, i) => (
            <li key={i} className={a.level === 'red' ? 'text-red-600' : 'text-amber-700'}>
              ● {a.text}
            </li>
          ))}
          {r.attention.length > 3 && <li className="text-slate-400">ועוד {r.attention.length - 3}…</li>}
        </ul>
      )}
    </Link>
  )
}

function AgentsTable({ model }: { model: TeamModel }) {
  const cell = (v: number | string | null, bad = false) => <td className={classNames('p-2.5 text-center', bad && 'font-semibold text-red-600')}>{v ?? '—'}</td>
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[820px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-right text-xs text-slate-500">
            <th className="p-2.5 font-medium">סוכן</th>
            <th className="p-2.5 text-center font-medium">פגישות שהתקיימו</th>
            <th className="p-2.5 text-center font-medium">רופאים באיחור קשר</th>
            <th className="p-2.5 text-center font-medium">משימות פתוחות</th>
            <th className="p-2.5 text-center font-medium">באיחור</th>
            <th className="p-2.5 text-center font-medium">תקועות</th>
            <th className="p-2.5 text-center font-medium">הושלמו</th>
            <th className="p-2.5 text-center font-medium">סריקות</th>
            <th className="p-2.5 text-center font-medium">ספירות</th>
            <th className="p-2.5 text-center font-medium">יעדים</th>
          </tr>
        </thead>
        <tbody>
          {model.agents.map((r) => (
            <tr key={r.agent.id} className="border-b border-slate-100 hover:bg-slate-50">
              <td className="p-2.5">
                <Link to={`/agents/${r.agent.id}`} className="font-medium text-brand-700 hover:underline">
                  {nameOf(r)}
                </Link>
              </td>
              {cell(r.m.meetings_held)}
              {cell(r.m.cadence_due, r.m.cadence_due > 0)}
              {cell(r.m.tasks_open)}
              {cell(r.m.tasks_overdue, r.m.tasks_overdue > 0)}
              {cell(r.m.tasks_blocked, r.m.tasks_blocked > 0)}
              {cell(r.m.tasks_done)}
              {cell(r.m.scans_created)}
              {cell(r.m.consumable_counts)}
              <td className="p-2.5 text-center">{r.goalsCount === 0 ? <span className="text-slate-300">—</span> : <span className="text-xs">{r.goalsAvg}% ({r.goalsCount})</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** the first screen of the team page: the numbers, who needs attention, a card per agent, the trends */
export function TeamOverview({ model }: { model: TeamModel }) {
  const { kpis, series, funnel } = model
  const reds = model.attention.filter((a) => a.level === 'red')
  // the attention list, one block per agent
  const byAgent = new Map<string, { name: string; id: string; items: { level: 'red' | 'amber'; text: string }[] }>()
  for (const a of model.attention) {
    const e = byAgent.get(a.agent.id) ?? { name: a.agent.full_name || a.agent.email, id: a.agent.id, items: [] }
    e.items.push({ level: a.level, text: a.text })
    byAgent.set(a.agent.id, e)
  }

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <BigNumber label="ניתוחי MAKO" value={kpis.surgeries.value} delta={kpis.surgeries} />
        <BigNumber label="פגישות שהתקיימו" value={kpis.meetings.value} delta={kpis.meetings} />
        <BigNumber label="עמידה ביעדים" value={kpis.hasGoals ? kpis.goals.value : null} suffix="%" delta={kpis.goals} points />
        <BigNumber label="התקדמות בהכשרות" value={kpis.training.pct} suffix="%" sub={kpis.training.stuck > 0 ? stuckText(kpis.training.stuck) : 'אין הכשרות תקועות'} />
      </section>

      <section className={classNames('card p-4', reds.length > 0 ? 'border-red-200' : model.attention.length > 0 ? 'border-amber-200' : 'border-emerald-200')}>
        <h2 className="mb-2 flex items-center gap-2 text-base font-semibold">
          {model.attention.length === 0 ? <CheckCircle2 size={18} className="text-emerald-600" /> : <AlertTriangle size={18} className={reds.length > 0 ? 'text-red-600' : 'text-amber-600'} />}
          {model.attention.length === 0 ? 'הכול תקין — אין סוכן שדורש תשומת לב' : `דורש תשומת לב (${byAgent.size} סוכנים)`}
        </h2>
        {byAgent.size > 0 && (
          <ul className="grid gap-x-6 gap-y-2 text-sm md:grid-cols-2">
            {[...byAgent.values()].map((e) => (
              <li key={e.id}>
                <Link to={`/agents/${e.id}`} className="font-medium text-brand-700 hover:underline">
                  {e.name}
                </Link>
                <ul className="mr-3">
                  {e.items.map((it, i) => (
                    <li key={i} className={it.level === 'red' ? 'text-red-600' : 'text-amber-700'}>
                      ● {it.text}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold">הסוכנים — {model.period.label}</h2>
        {model.agents.length === 0 ? (
          <p className="text-sm text-slate-500">אין סוכנים.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {model.agents.map((r) => (
              <AgentCard key={r.agent.id} r={r} />
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        <div className="card p-4">
          <h2 className="mb-1 text-base font-semibold">ניתוחי MAKO לפי חודש</h2>
          <TrendBars series={series} field="surgeries" />
        </div>
        <div className="card p-4">
          <h2 className="mb-1 text-base font-semibold">פגישות שהתקיימו לפי חודש</h2>
          <TrendBars series={series} field="meetings" />
        </div>
        <div className="card p-4">
          <h2 className="mb-1 text-base font-semibold">משפך רופאים פוטנציאליים</h2>
          <p className="mb-2 text-xs text-slate-500">
            {model.potentialTotal} בפיפליין, {model.closing} בשלבי משא ומתן וסגירה (מצב נוכחי)
          </p>
          <FunnelBars funnel={funnel} />
        </div>
      </section>

      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-brand-700">
          <ChevronDown size={16} className="transition group-open:rotate-180" /> הטבלה המלאה של כל המדדים
        </summary>
        <div className="mt-2">
          <AgentsTable model={model} />
          <p className="mt-1 text-xs text-slate-400">משימות פתוחות, באיחור ותקועות הן המצב כרגע; שאר המדדים לפי התקופה שנבחרה.</p>
        </div>
      </details>
    </div>
  )
}
