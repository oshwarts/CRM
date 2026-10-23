import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Users } from 'lucide-react'
import { useAgentGoals, useMetricData } from '../lib/agentsApi'
import { overlaps, monthPeriod, quarterPeriod } from '../lib/agentMetrics'
import { useAuth } from '../context/AuthProvider'
import { EmptyState, Spinner, Tab, TabList, TabPanel, Tabs } from '../components/ui'
import { GoalBars } from '../components/GoalBars'
import { TrainingMatrix } from '../components/TrainingMatrix'
import { ProcessCard, ProcessSuggestions } from '../components/ProcessPanels'
import { useProcesses } from '../lib/processes'
import { ManagementReport } from '../components/team/ManagementReport'
import { TeamOverview } from '../components/team/TeamOverview'
import { PeriodControls } from '../components/team/PeriodControls'
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
              <h3 className="mb-3 flex items-center justify-between gap-2 font-semibold text-brand-800">
                <Link to={`/agents/${r.agent.id}`} className="min-w-0 truncate hover:underline">
                  {r.agent.full_name || r.agent.email}
                </Link>
                {r.goalsAvg != null && <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">ממוצע {r.goalsAvg}%</span>}
              </h3>
              <GoalBars goals={mine} data={data} empty="לא הוגדרו יעדים לתקופה זו." />
              {mine.length === 0 && (
                <Link to={`/agents/${r.agent.id}`} className="mt-2 inline-flex min-h-9 items-center text-sm font-medium text-brand-700 hover:underline">
                  הגדרת יעד בכרטיס הסוכן
                </Link>
              )}
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
      <div className="space-y-3 print:hidden">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-brand-800 sm:text-3xl">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#00326d] text-white">
              <Users size={20} />
            </span>
            ניהול סוכנים
          </h1>
          <p className="mt-1 text-sm text-slate-500">הצוות במבט אחד. לחץ על סוכן לצפייה בלוז, במשימות, ביעדים ובשיחות.</p>
        </div>
        {view !== 'training' && (
          <PeriodControls
            kind={kind}
            label={period.label}
            onKind={(k) => {
              setKind(k)
              setOffset(0)
            }}
            onPrev={() => setOffset((o) => o - 1)}
            onNext={() => setOffset((o) => o + 1)}
            nextDisabled={offset >= 0}
            onToday={offset !== 0 ? () => setOffset(0) : undefined}
          />
        )}
      </div>

      <Tabs value={view} onChange={setView}>
        <TabList>
          <Tab id="overview">סקירה</Tab>
          <Tab id="goals">יעדים</Tab>
          <Tab id="training">הכשרות</Tab>
          <Tab id="processes">תהליכים</Tab>
          <Tab id="report">דוח להנהלה</Tab>
        </TabList>

        <TabPanel id="overview">{loading || !model ? <Spinner /> : model.agents.length === 0 ? <EmptyState title="אין סוכנים" hint="סוכנים נוספים נרשמים במסך הכניסה, והמנהל מאשר אותם בניהול מערכת." /> : <TeamOverview model={model} />}</TabPanel>
        <TabPanel id="goals">{loading || !model ? <Spinner /> : <TeamGoals model={model} period={period} />}</TabPanel>
        <TabPanel id="training">
          <TrainingMatrix />
        </TabPanel>
        <TabPanel id="processes">
          <AgentsProcesses />
        </TabPanel>
        <TabPanel id="report">{loading || !model ? <Spinner /> : <ManagementReport model={model} />}</TabPanel>
      </Tabs>
    </div>
  )
}

/** the processes of the agents (onboarding, training, leaving) with what is late; the app suggests starting one when an agent joins or leaves */
function AgentsProcesses() {
  const processes = useProcesses()
  const open = (processes.data ?? []).filter((p) => p.status === 'open' && p.subject_agent_id)
  return (
    <div className="space-y-3">
      <ProcessSuggestions />
      {open.length === 0 ? (
        <p className="text-sm text-slate-500">אין תהליכים פעילים של סוכנים. <Link to="/processes" className="font-medium text-brand-700 hover:underline">לתהליכים</Link></p>
      ) : (
        <ul className="grid gap-2 lg:grid-cols-2">{open.map((p) => <ProcessCard key={p.id} p={p} />)}</ul>
      )}
      <Link to="/processes" className="btn-secondary inline-flex">כל התהליכים והתבניות</Link>
    </div>
  )
}
