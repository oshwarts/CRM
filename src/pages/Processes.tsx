import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Copy, Pencil, Plus, Trash2, Workflow } from 'lucide-react'
import { useAuth } from '../context/AuthProvider'
import { classNames, formatDate, todayISO } from '../lib/utils'
import { KIND_LABELS } from '../lib/processLogic'
import { useDeleteTemplate, useProcesses, useSetStepDone, useTemplates, type Template } from '../lib/processes'
import { ProcessCard, ProcessSuggestions } from '../components/ProcessPanels'
import { StartProcessModal, TemplateEditor } from '../components/ProcessModals'
import { ConfirmButton, EmptyState, ErrorState, Spinner, Tab, TabList, TabPanel, Tabs } from '../components/ui'

/** processes: onboarding of an agent, a new hospital, an agent leaving, training... A manager starts them from editable templates; an agent sees his steps */
export default function Processes() {
  const { isAdmin, user } = useAuth()
  const navigate = useNavigate()
  const processes = useProcesses()
  const templates = useTemplates()
  const del = useDeleteTemplate()
  const setDone = useSetStepDone()
  const [tab, setTab] = useState(isAdmin ? 'active' : 'mine')
  const [starting, setStarting] = useState(false)
  const [editing, setEditing] = useState<Omit<Template, 'id'> & { id?: string } | 'new' | null>(null)
  const today = todayISO()

  const all = useMemo(() => processes.data ?? [], [processes.data])
  const open = all.filter((p) => p.status === 'open')
  const closed = all.filter((p) => p.status === 'closed')
  const mySteps = useMemo(() => open.flatMap((p) => p.steps.filter((s) => s.assignee_id === user?.id && !s.is_done).map((s) => ({ ...s, process: p }))).sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999')), [open, user?.id])

  if (processes.isLoading) return <Spinner />
  if (processes.error && !processes.data) return <ErrorState error={processes.error} />

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-brand-800 sm:text-3xl">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#00326d] text-white"><Workflow size={20} aria-hidden /></span>
            תהליכים
          </h1>
          <p className="text-sm text-slate-500">{isAdmin ? 'קליטת סוכן או בית חולים, הכשרה, עזיבה: תבנית אחת, והשלבים הופכים למשימות' : 'השלבים שהוקצו לך בתהליכים'}</p>
        </div>
        {isAdmin && (
          <button className="btn-primary" onClick={() => setStarting(true)}>
            <Plus size={16} aria-hidden /> התחל תהליך
          </button>
        )}
      </div>

      <ProcessSuggestions onStarted={(id) => navigate(`/processes/${id}`)} />

      <Tabs value={tab} onChange={setTab}>
        <TabList>
          {isAdmin && <Tab id="active">{`פעילים (${open.length})`}</Tab>}
          <Tab id="mine">{`השלבים שלי (${mySteps.length})`}</Tab>
          {isAdmin && <Tab id="closed">{`הסתיימו (${closed.length})`}</Tab>}
          {isAdmin && <Tab id="templates">{`תבניות (${templates.data?.length ?? 0})`}</Tab>}
        </TabList>

        <TabPanel id="active">
          {open.length === 0 ? <EmptyState title="אין תהליכים פעילים" hint="התחל תהליך מתבנית: קליטת סוכן, קבלת בית חולים, הכשרה או עזיבה" /> : (
            <ul className="space-y-2">
              {open.map((p) => <ProcessCard key={p.id} p={p} />)}
            </ul>
          )}
        </TabPanel>

        <TabPanel id="mine">
          {mySteps.length === 0 ? <EmptyState title="אין שלבים פתוחים שלך" hint="שלבים בתהליכים שהוקצו לך יופיעו כאן" /> : (
            <ul className="space-y-2">
              {mySteps.map((s) => (
                <li key={s.id} className="flex items-start gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
                  <button type="button" role="checkbox" aria-checked={false} aria-label={`סמן כבוצע: ${s.description}`} onClick={() => setDone.mutate({ id: s.id, done: true })} className="grid h-11 w-11 shrink-0 place-items-center rounded-full">
                    <span className="h-6 w-6 rounded-full border-2 border-slate-300 bg-white" />
                  </button>
                  <div className="min-w-0 flex-1 py-1">
                    <p dir="auto" className="[overflow-wrap:anywhere]">{s.description}</p>
                    {s.notes && <p dir="auto" className="text-xs text-slate-500">{s.notes}</p>}
                    <p className="text-xs text-slate-500">
                      <Link to={`/processes/${s.process.id}`} className="text-brand-700 hover:underline">{s.process.name}</Link>
                      {s.due_date && <span className={classNames(s.due_date < today && 'font-medium text-red-600')}> · עד {formatDate(s.due_date)}</span>}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabPanel>

        <TabPanel id="closed">
          {closed.length === 0 ? <EmptyState title="עדיין לא הסתיימו תהליכים" /> : <ul className="space-y-2">{closed.map((p) => <ProcessCard key={p.id} p={p} />)}</ul>}
        </TabPanel>

        <TabPanel id="templates">
          <div className="mb-2 flex justify-end">
            <button className="btn-secondary" onClick={() => setEditing('new')}><Plus size={16} aria-hidden /> תבנית חדשה</button>
          </div>
          {templates.isLoading ? <Spinner /> : (templates.data ?? []).length === 0 ? <EmptyState title="אין תבניות" /> : (
            <ul className="space-y-2">
              {(templates.data ?? []).map((t) => (
                <li key={t.id} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p dir="auto" className="font-semibold text-slate-800">{t.name}</p>
                      <p className="text-xs text-slate-500">{KIND_LABELS[t.kind]} · {t.steps.length} שלבים{t.description ? ` · ${t.description}` : ''}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <button className="btn-secondary" onClick={() => setEditing(t)}><Pencil size={16} aria-hidden /> עריכה</button>
                      <button className="btn-ghost" onClick={() => setEditing({ ...t, id: undefined, name: `${t.name} (עותק)` })} aria-label={`שכפול ${t.name}`}><Copy size={16} aria-hidden /> שכפול</button>
                      <ConfirmButton className="btn-ghost !text-red-600" message={`למחוק את התבנית "${t.name}"? תהליכים שכבר התחילו לא יימחקו.`} label={`מחיקת ${t.name}`} onConfirm={() => del.mutate(t.id)}>
                        <Trash2 size={16} aria-hidden /> מחיקה
                      </ConfirmButton>
                    </div>
                  </div>
                  <ol className="mt-2 list-decimal space-y-0.5 ps-5 text-sm text-slate-700">
                    {t.steps.map((s) => (
                      <li key={s.id} dir="auto">{s.title} <span className="text-xs text-slate-400">· יום {s.day_offset}</span></li>
                    ))}
                  </ol>
                </li>
              ))}
            </ul>
          )}
        </TabPanel>
      </Tabs>

      {starting && <StartProcessModal templates={templates.data ?? []} onClose={() => setStarting(false)} onStarted={(id) => navigate(`/processes/${id}`)} />}
      {editing && <TemplateEditor template={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
