import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Users } from 'lucide-react'
import { useAgentGoals, useMetricData } from '../lib/agentsApi'
import { overlaps, monthPeriod, quarterPeriod } from '../lib/agentMetrics'
import { useAuth } from '../context/AuthProvider'
import { EmptyState, Spinner, Tab, TabList, TabPanel, Tabs } from '../components/ui'
import { GoalBars } from '../components/GoalBars'
import { TrainingMatrix } from '../components/TrainingMatrix'
import { ManagementReport } from '../components/team/ManagementReport'
import { TeamOverview } from '../components/team/TeamOverview'
import { useTeamModel, type PeriodKind } from '../components/team/useTeamModel'

/** goals of every agent for the shown period, one block per agent */
function TeamGoals({ model, period }: { model: NonNullable<ReturnType<typeof useTeamModel>['model']>; period: { start: string; end: string; label: string } }) {
  const goals = useAgentGoals()
  const { data } = useMetricData()
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">יעדים של כל סוכן ל{period.label}. הוספה ועריכה של יעדים נעשות בכרטיס הסוכן.</p>
      <div className="grid gap-3 lg:grid-cols-2">
        {model.agents.map((r) => {
          const mine = (goals.data ?? []).filter((g) => g.agent_id === r.agent.id && overlaps(g, period as never))
          return (
            <section key={r.agent.id} className="card p-4">
              <h3 className="mb-2 flex items-center justify-between font-semibold text-brand-800">
                <Link to={`/agents/${r.agent.id}`} className="hover:underline">
                  {r.agent.full_name || r.agent.email}
                </Link>
                {r.goalsAvg != null && <span className="text-sm font-medium text-slate-500">ממוצע {r.goalsAvg}%</span>}
              </h3>
              <GoalBars goals={mine} data={data} empty="לא הוגדרו יעדים לתקופה זו." />
            </section>
          )
        })}
      </div>
    </div>
  )
}

/** managers: the team at a glance — numbers against the period before, who needs attention, goals and training, and the report for management */
export default function Agents() {
  const { isAdmin } = useAuth()
  const [kind, setKind] = useState<PeriodKind>('month')
  const [offset, setOffset] = useState(0)
  const [view, setView] = useState('overview')
  const { model, loading } = useTeamModel(kind, offset)
  const period = kind === 'month' ? monthPeriod(offset) : quarterPeriod(offset)

  if (!isAdmin) return <EmptyState title="אין הרשאה" hint="העמוד זמין למנהלים בלבד" />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-brand-800 sm:text-3xl">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#00326d] text-white">
              <Users size={20} />
            </span>
            ניהול סוכנים
          </h1>
          <p className="text-sm text-slate-400">הצוות במבט אחד. לחץ על סוכן כדי לראות לוז, משימות, יעדים ושיחות.</p>
        </div>
        {view !== 'training' && (
          <div className="flex items-center gap-2">
            <select
              className="input !w-auto"
              value={kind}
              aria-label="סוג תקופה"
              onChange={(e) => {
                setKind(e.target.value as PeriodKind)
                setOffset(0)
              }}
            >
              <option value="month">חודשי</option>
              <option value="quarter">רבעוני</option>
            </select>
            <button className="btn-ghost !px-2" onClick={() => setOffset((o) => o - 1)} aria-label="תקופה קודמת">
              <ChevronRight size={18} />
            </button>
            <span className="min-w-28 text-center text-sm font-semibold text-slate-700">{period.label}</span>
            <button className="btn-ghost !px-2" onClick={() => setOffset((o) => o + 1)} aria-label="תקופה הבאה" disabled={offset >= 0}>
              <ChevronLeft size={18} />
            </button>
          </div>
        )}
      </div>

      <Tabs value={view} onChange={setView}>
        <TabList>
          <Tab id="overview">סקירה</Tab>
          <Tab id="goals">יעדים</Tab>
          <Tab id="training">הכשרות</Tab>
          <Tab id="report">דוח להנהלה</Tab>
        </TabList>

        <TabPanel id="overview">{loading || !model ? <Spinner /> : model.agents.length === 0 ? <EmptyState title="אין סוכנים" hint="סוכנים נוספים נרשמים במסך הכניסה, והמנהל מאשר אותם בניהול מערכת." /> : <TeamOverview model={model} />}</TabPanel>
        <TabPanel id="goals">{loading || !model ? <Spinner /> : <TeamGoals model={model} period={period} />}</TabPanel>
        <TabPanel id="training">
          <TrainingMatrix />
        </TabPanel>
        <TabPanel id="report">{loading || !model ? <Spinner /> : <ManagementReport model={model} />}</TabPanel>
      </Tabs>
    </div>
  )
}
