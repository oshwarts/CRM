import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Users } from 'lucide-react'
import { useAgents } from '../lib/api'
import { useAgentGoals, useMetricData } from '../lib/agentsApi'
import { computeAgentMetrics, goalProgress, monthPeriod, overlaps, quarterPeriod } from '../lib/agentMetrics'
import { useAuth } from '../context/AuthProvider'
import { EmptyState, Spinner, Tab, TabList, TabPanel, Tabs } from '../components/ui'
import { TrainingMatrix } from '../components/TrainingMatrix'
import { classNames } from '../lib/utils'

/** managers: all agents side by side for a month or a quarter */
export default function Agents() {
  const { isAdmin } = useAuth()
  const agents = useAgents()
  const goals = useAgentGoals()
  const { data, loading } = useMetricData()
  const [kind, setKind] = useState<'month' | 'quarter'>('month')
  const [offset, setOffset] = useState(0)
  const [view, setView] = useState('perf')
  const period = kind === 'month' ? monthPeriod(offset) : quarterPeriod(offset)

  const rows = useMemo(
    () =>
      (agents.data ?? [])
        .filter((a) => a.role === 'agent')
        .map((a) => {
          const m = data ? computeAgentMetrics(a.id, period, data) : null
          const mine = (goals.data ?? []).filter((g) => g.agent_id === a.id && overlaps(g, period))
          const pcts = mine.map((g) => goalProgress(g, data).pct)
          return { a, m, goals: mine.length, avg: pcts.length ? Math.round(pcts.reduce((x, y) => x + y, 0) / pcts.length) : null }
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [agents.data, goals.data, data, kind, offset],
  )

  if (!isAdmin) return <EmptyState title="אין הרשאה" hint="העמוד זמין למנהלים בלבד" />
  if (agents.isLoading || loading) return <Spinner />

  const cell = (v: number | string | null, bad = false) => (
    <td className={classNames('p-2.5 text-center', bad && 'font-semibold text-red-600')}>{v ?? '—'}</td>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
            <Users size={24} className="text-brand-500" />
            ניהול סוכנים
          </h1>
          <p className="text-sm text-slate-400">השוואה בין הסוכנים. לחץ על סוכן כדי לראות לוז, משימות, יעדים ושיחות מעקב.</p>
        </div>
        <div className={classNames("flex items-center gap-2", view !== "perf" && "invisible")}>
          <select className="input !w-auto" value={kind} onChange={(e) => { setKind(e.target.value as 'month' | 'quarter'); setOffset(0) }}>
            <option value="month">חודשי</option>
            <option value="quarter">רבעוני</option>
          </select>
          <button className="btn-ghost !px-2" onClick={() => setOffset((o) => o - 1)} aria-label="תקופה קודמת">
            <ChevronRight size={18} />
          </button>
          <span className="min-w-28 text-center text-sm font-semibold text-slate-700">{period.label}</span>
          <button className="btn-ghost !px-2" onClick={() => setOffset((o) => o + 1)} aria-label="תקופה הבאה">
            <ChevronLeft size={18} />
          </button>
        </div>
      </div>

      <Tabs value={view} onChange={setView}>
        <TabList>
          <Tab id="perf">ביצועים</Tab>
          <Tab id="training">הכשרות</Tab>
        </TabList>
        <TabPanel id="training">
          <TrainingMatrix />
        </TabPanel>
        <TabPanel id="perf">
      {rows.length === 0 ? (
        <EmptyState title="אין סוכנים" hint="סוכנים נוספים נרשמים במסך הכניסה, והמנהל מאשר אותם בניהול מערכת" />
      ) : (
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
                <th className="p-2.5 text-center font-medium">משימות שהושלמו</th>
                <th className="p-2.5 text-center font-medium">סריקות</th>
                <th className="p-2.5 text-center font-medium">ספירות</th>
                <th className="p-2.5 text-center font-medium">יעדים</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ a, m, goals: n, avg }) => (
                <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-2.5">
                    <Link to={`/agents/${a.id}`} className="font-medium text-brand-700 hover:underline">
                      {a.full_name || a.email}
                    </Link>
                  </td>
                  {cell(m?.meetings_held ?? null)}
                  {cell(m ? m.cadence_due : null, !!m && m.cadence_due > 0)}
                  {cell(m?.tasks_open ?? null)}
                  {cell(m?.tasks_overdue ?? null, !!m && m.tasks_overdue > 0)}
                  {cell(m?.tasks_blocked ?? null, !!m && m.tasks_blocked > 0)}
                  {cell(m?.tasks_done ?? null)}
                  {cell(m?.scans_created ?? null)}
                  {cell(m?.consumable_counts ?? null)}
                  <td className="p-2.5 text-center">
                    {n === 0 ? (
                      <span className="text-slate-300">—</span>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <span className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-100">
                          <span className={classNames('block h-full', (avg ?? 0) >= 80 ? 'bg-emerald-500' : (avg ?? 0) >= 40 ? 'bg-sky-500' : 'bg-red-400')} style={{ width: `${avg ?? 0}%` }} />
                        </span>
                        <span className="text-xs text-slate-600">
                          {avg}% ({n})
                        </span>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-slate-400">
        משימות פתוחות, באיחור ותקועות הן המצב כרגע; שאר המדדים לפי התקופה שנבחרה. "רופאים באיחור קשר" נספר מהרופאים המועדפים של הסוכן שהוגדר להם קצב קשר.
      </p>
        </TabPanel>
      </Tabs>
    </div>
  )
}
