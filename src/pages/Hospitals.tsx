import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AlertTriangle, Building2, CalendarDays, Navigation, Phone, Scissors, Search, User } from 'lucide-react'
import { useMapData, useMeetings, usePatientScans } from '../lib/api'
import { usePlannedSurgeries } from '../lib/plannedSurgeries'
import { buildHospitalRows, NO_VISIT_DAYS, STATUS_CHIP, STATUS_LABELS, STATUS_ORDER, STATUS_PIN, useSetHospitalCommercial, type CommercialStatus, type HospitalRow, type Warning } from '../lib/hospitalStats'
import { usePersisted } from '../lib/usePersisted'
import { useAuth } from '../context/AuthProvider'
import { classNames, formatDate } from '../lib/utils'
import { EmptyState, ErrorState, Spinner, Tab, TabList, TabPanel, Tabs } from '../components/ui'
import { hospitalNavLinks } from '../components/HospitalActions'
import { MeetingFormModal } from '../components/MeetingFormModal'
import { PlannedSurgeryModal } from '../components/PlannedSurgeryModal'
import MapPage from './MapPage'

type Filters = { q: string; status: '' | CommercialStatus; org: string; robot: string; agent: string; warn: '' | 'any' | Warning['key']; mine: boolean; sort: string }
const NO_FILTERS: Filters = { q: '', status: '', org: '', robot: '', agent: '', warn: '', mine: false, sort: 'name' }

const norm = (s: string) => s.toLowerCase().replace(/["'`.׳״‘’“”]/g, '').replace(/[-־]/g, ' ').replace(/\s+/g, ' ').trim()

const SORTS: Record<string, { label: string; cmp: (a: HospitalRow, b: HospitalRow) => number }> = {
  name: { label: 'שם', cmp: (a, b) => a.h.name.localeCompare(b.h.name, 'he') },
  city: { label: 'עיר', cmp: (a, b) => a.h.city.localeCompare(b.h.city, 'he') || a.h.name.localeCompare(b.h.name, 'he') },
  status: { label: 'סטטוס מסחרי', cmp: (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || a.h.name.localeCompare(b.h.name, 'he') },
  stale: { label: 'ביקור — הישן קודם', cmp: (a, b) => (b.daysSince ?? 9999) - (a.daysSince ?? 9999) },
  surgeries: { label: 'ניתוחים ב-30 יום — הרבה קודם', cmp: (a, b) => b.surgeries30 - a.surgeries30 },
  attention: { label: 'דורשים תשומת לב קודם', cmp: (a, b) => b.warnings.length - a.warnings.length || a.h.name.localeCompare(b.h.name, 'he') },
}

/** the status as a small select that looks like a chip; "(מוצע)" while it is only the suggestion from the robots */
function StatusSelect({ row }: { row: HospitalRow }) {
  const set = useSetHospitalCommercial()
  return (
    <select
      className={classNames('rounded-full border px-2.5 py-1 text-xs font-medium', STATUS_CHIP[row.status])}
      value={row.status}
      aria-label={`סטטוס מסחרי של ${row.h.name}`}
      title={row.suggested ? 'הסטטוס מוצע לפי הרובוטים — בחירה שומרת אותו' : undefined}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => set.mutate({ id: row.h.id, commercial_status: e.target.value as CommercialStatus })}
    >
      {STATUS_ORDER.map((s) => (
        <option key={s} value={s}>
          {STATUS_LABELS[s]}
          {s === row.status && row.suggested ? ' (מוצע)' : ''}
        </option>
      ))}
    </select>
  )
}

function RowActions({ row, onMeeting, onSurgery }: { row: HospitalRow; onMeeting: () => void; onSurgery: () => void }) {
  const nav = hospitalNavLinks(row.h)
  const btn = 'grid h-9 w-9 place-items-center rounded-full bg-brand-50 text-brand-700 transition hover:bg-brand-100'
  return (
    <div className="flex items-center gap-1.5">
      {row.contactPhone && (
        <a href={`tel:${row.contactPhone.phone}`} className={btn} aria-label={`התקשר ל${row.contactPhone.name}`} title={`${row.contactPhone.name} · ${row.contactPhone.phone}`}>
          <Phone size={16} />
        </a>
      )}
      <a href={nav.waze} target="_blank" rel="noreferrer" className={btn} aria-label={`נווט אל ${row.h.name}`} title="ניווט ב-Waze">
        <Navigation size={16} />
      </a>
      <button type="button" className={btn} aria-label={`פגישה חדשה ב${row.h.name}`} title="פגישה חדשה" onClick={onMeeting}>
        <CalendarDays size={16} />
      </button>
      <button type="button" className={btn} aria-label={`ניתוח חדש ב${row.h.name}`} title="ניתוח חדש" onClick={onSurgery}>
        <Scissors size={16} />
      </button>
    </div>
  )
}

function Warnings({ warnings }: { warnings: Warning[] }) {
  if (warnings.length === 0) return null
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {warnings.map((w) => (
        <span key={w.key} className="chip border-amber-200 bg-amber-50 !px-2 !py-0 text-[11px] text-amber-700">
          {w.label}
        </span>
      ))}
    </div>
  )
}

function lastText(row: HospitalRow) {
  if (row.daysSince === null) return <span className="text-slate-400">—</span>
  return (
    <span className={classNames(row.daysSince > NO_VISIT_DAYS && 'font-semibold text-amber-700')} title={row.lastMeeting ? formatDate(row.lastMeeting) : undefined}>
      {row.daysSince === 0 ? 'היום' : `לפני ${row.daysSince} ימים`}
    </span>
  )
}

/** the hospitals: a list to work from (status, last visit, surgeries, what needs attention) and the map as a tab */
export default function Hospitals() {
  const map = useMapData()
  const meetings = useMeetings()
  const scans = usePatientScans()
  const planned = usePlannedSurgeries()
  const { user } = useAuth()
  const [params] = useSearchParams()
  const [tab, setTab] = useState(params.get('hospital') ? 'map' : 'list')
  const [f, setF] = usePersisted<Filters>('hospitals.filters', NO_FILTERS)
  const [modal, setModal] = useState<{ kind: 'meeting' | 'surgery'; hospitalId: string } | null>(null)
  const set = (p: Partial<Filters>) => setF((x) => ({ ...x, ...p }))

  const rows = useMemo(
    () => buildHospitalRows({ hospitals: map.data ?? [], meetings: meetings.data ?? [], scans: scans.data ?? [], planned: planned.data ?? [] }),
    [map.data, meetings.data, scans.data, planned.data],
  )
  const statusById = useMemo(() => new Map(rows.map((r) => [r.h.id, r.status])), [rows])

  const orgs = useMemo(() => [...new Set(rows.flatMap((r) => (r.h.organization ? [r.h.organization.name] : [])))].sort(), [rows])
  const robots = useMemo(() => [...new Set(rows.flatMap((r) => r.robots))].sort(), [rows])
  const agents = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of rows) for (const a of r.agents) m.set(a.id, a.name)
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'he'))
  }, [rows])
  const hasMine = !!user && rows.some((r) => r.agents.some((a) => a.id === user.id))

  const counts = useMemo(
    () => ({
      all: rows.length,
      client: rows.filter((r) => r.status === 'client').length,
      potential: rows.filter((r) => r.status === 'potential').length,
      noVisit: rows.filter((r) => r.warnings.some((w) => w.key === 'no-visit')).length,
      noAgent: rows.filter((r) => r.warnings.some((w) => w.key === 'no-agent')).length,
      attention: rows.filter((r) => r.warnings.length > 0).length,
    }),
    [rows],
  )

  const shown = useMemo(() => {
    const words = norm(f.q).split(' ').filter(Boolean)
    const list = rows.filter(
      (r) =>
        (!f.status || r.status === f.status) &&
        (!f.org || r.h.organization?.name === f.org) &&
        (!f.robot || r.robots.includes(f.robot)) &&
        (!f.agent || r.agents.some((a) => a.id === f.agent)) &&
        (!f.mine || r.agents.some((a) => a.id === user?.id)) &&
        (!f.warn || (f.warn === 'any' ? r.warnings.length > 0 : r.warnings.some((w) => w.key === f.warn))) &&
        (!words.length || words.every((w) => norm(`${r.h.name} ${r.h.city} ${r.h.organization?.name ?? ''}`).includes(w))),
    )
    return [...list].sort((SORTS[f.sort] ?? SORTS.name).cmp)
  }, [rows, f, user?.id])

  if (map.isLoading) return <Spinner />
  if (map.error && !map.data) return <ErrorState error={map.error} />

  const filtered = JSON.stringify({ ...f, sort: '' }) !== JSON.stringify({ ...NO_FILTERS, sort: '' })
  const kpi = (label: string, value: number, active: boolean, onClick: () => void, warn?: boolean) => (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={classNames(
        'card flex flex-col items-start p-3 text-right transition hover:shadow-pop',
        active && 'border-brand-500 ring-2 ring-brand-200',
        warn && value > 0 && !active && 'border-amber-300 bg-amber-50',
      )}
    >
      <span className={classNames('text-2xl font-semibold leading-none', warn && value > 0 ? 'text-amber-700' : 'text-brand-800')}>{value}</span>
      <span className="mt-1 text-xs text-slate-600">{label}</span>
    </button>
  )

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-brand-800 sm:text-3xl">בתי חולים</h1>
        <p className="text-sm text-slate-400">הסטטוס המסחרי, הפעילות האחרונה והניתוחים של כל בית חולים — והמפה בלשונית נפרדת</p>
      </div>

      <div className="grid grid-cols-3 gap-2 lg:grid-cols-6">
        {kpi('בתי חולים', counts.all, !filtered, () => setF(NO_FILTERS))}
        {kpi('לקוחות', counts.client, f.status === 'client', () => set({ status: f.status === 'client' ? '' : 'client' }))}
        {kpi('פוטנציאליים', counts.potential, f.status === 'potential', () => set({ status: f.status === 'potential' ? '' : 'potential' }))}
        {kpi(`ללא ביקור ${NO_VISIT_DAYS} יום`, counts.noVisit, f.warn === 'no-visit', () => set({ warn: f.warn === 'no-visit' ? '' : 'no-visit' }), true)}
        {kpi('ללא סוכן מטפל', counts.noAgent, f.warn === 'no-agent', () => set({ warn: f.warn === 'no-agent' ? '' : 'no-agent' }), true)}
        {kpi('דורשים תשומת לב', counts.attention, f.warn === 'any', () => set({ warn: f.warn === 'any' ? '' : 'any' }), true)}
      </div>

      <Tabs value={tab} onChange={setTab}>
        <TabList>
          <Tab id="list">רשימה</Tab>
          <Tab id="map">מפה</Tab>
        </TabList>

        <TabPanel id="list">
          <div className="space-y-3">
            <div className="card flex flex-wrap items-center gap-2 p-3">
              <label className="relative block w-full sm:w-60">
                <Search size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="search" className="input !pr-9" placeholder="חיפוש בית חולים, עיר או ארגון" value={f.q} onChange={(e) => set({ q: e.target.value })} />
              </label>
              <select className="input !w-auto" value={f.status} aria-label="סטטוס מסחרי" onChange={(e) => set({ status: e.target.value as Filters['status'] })}>
                <option value="">כל הסטטוסים</option>
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
              <select className="input !w-auto" value={f.org} aria-label="ארגון" onChange={(e) => set({ org: e.target.value })}>
                <option value="">כל הארגונים</option>
                {orgs.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
              <select className="input !w-auto" value={f.robot} aria-label="רובוט" onChange={(e) => set({ robot: e.target.value })}>
                <option value="">כל הרובוטים</option>
                {robots.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
              <select className="input !w-auto" value={f.agent} aria-label="סוכן" onChange={(e) => set({ agent: e.target.value })}>
                <option value="">כל הסוכנים</option>
                {agents.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
              {hasMine && (
                <button type="button" aria-pressed={f.mine} onClick={() => set({ mine: !f.mine })} className={classNames('chip', f.mine ? 'border-brand-500 bg-brand-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}>
                  <User size={13} /> בתי החולים שלי
                </button>
              )}
              <select className="input !w-auto" value={f.sort} aria-label="מיון" onChange={(e) => set({ sort: e.target.value })}>
                {Object.entries(SORTS).map(([k, s]) => (
                  <option key={k} value={k}>
                    מיון: {s.label}
                  </option>
                ))}
              </select>
              {filtered && (
                <button type="button" className="text-sm font-medium text-brand-600 underline" onClick={() => setF({ ...NO_FILTERS, sort: f.sort })}>
                  נקה סינון
                </button>
              )}
            </div>

            <p className="text-sm text-slate-500">
              {shown.length} בתי חולים{filtered ? ` מתוך ${rows.length}` : ''}
            </p>

            {shown.length === 0 ? (
              <EmptyState title="אין בתי חולים שמתאימים לסינון" hint="נסה לנקות את הסינון" />
            ) : (
              <>
                {/* desktop: a table */}
                <div className="card hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[860px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-right text-xs text-slate-500">
                        <th className="p-2.5 font-medium">בית חולים</th>
                        <th className="p-2.5 font-medium">סטטוס</th>
                        <th className="p-2.5 font-medium">רובוטים</th>
                        <th className="p-2.5 font-medium">סוכן</th>
                        <th className="p-2.5 text-center font-medium">רופאים</th>
                        <th className="p-2.5 font-medium">פגישה אחרונה</th>
                        <th className="p-2.5 text-center font-medium">ניתוחים 30 י׳</th>
                        <th className="p-2.5 text-center font-medium">קרובים</th>
                        <th className="p-2.5 font-medium">פעולות</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shown.map((r) => (
                        <tr key={r.h.id} className="border-b border-slate-100 align-top hover:bg-slate-50">
                          <td className="p-2.5">
                            <Link to={`/hospitals/${r.h.id}`} className="font-semibold text-brand-700 hover:underline">
                              {r.h.name}
                            </Link>
                            <p className="text-xs text-slate-500">{[r.h.city, r.h.organization?.name].filter(Boolean).join(' · ')}</p>
                            <Warnings warnings={r.warnings} />
                            {r.h.next_step && (
                              <p className="mt-1 text-xs text-brand-700">
                                ← {r.h.next_step}
                                {r.h.next_step_date ? ` (${formatDate(r.h.next_step_date)})` : ''}
                              </p>
                            )}
                          </td>
                          <td className="p-2.5">
                            <StatusSelect row={r} />
                          </td>
                          <td className="p-2.5 text-xs text-slate-600">{r.robots.join(' · ') || '—'}</td>
                          <td className="p-2.5 text-xs text-slate-600">{r.agents.map((a) => a.name).join(', ') || <span className="text-amber-700">לא הוגדר</span>}</td>
                          <td className="p-2.5 text-center">{r.doctors}</td>
                          <td className="p-2.5 text-xs">{lastText(r)}</td>
                          <td className="p-2.5 text-center font-medium">{r.surgeries30}</td>
                          <td className="p-2.5 text-center">{r.upcoming30 || <span className="text-slate-300">—</span>}</td>
                          <td className="p-2.5">
                            <RowActions row={r} onMeeting={() => setModal({ kind: 'meeting', hospitalId: r.h.id })} onSurgery={() => setModal({ kind: 'surgery', hospitalId: r.h.id })} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* phone: cards */}
                <ul className="space-y-2.5 md:hidden">
                  {shown.map((r) => (
                    <li key={r.h.id} className="card space-y-2.5 p-3.5">
                      <div className="space-y-2">
                        <div className="min-w-0">
                          <Link to={`/hospitals/${r.h.id}`} className="flex items-center gap-1.5 font-semibold text-brand-800">
                            <Building2 size={15} className="shrink-0" /> <span className="break-words">{r.h.name}</span>
                          </Link>
                          <p className="text-xs text-slate-500">{[r.h.city, r.h.organization?.name].filter(Boolean).join(' · ')}</p>
                        </div>
                        <StatusSelect row={r} />
                      </div>
                      <Warnings warnings={r.warnings} />
                      <dl className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="rounded-xl bg-slate-50 p-2">
                          <dt className="text-slate-500">פגישה אחרונה</dt>
                          <dd className="mt-0.5 font-medium">{lastText(r)}</dd>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-2">
                          <dt className="text-slate-500">ניתוחים 30 י׳</dt>
                          <dd className="mt-0.5 font-semibold text-brand-800">{r.surgeries30}</dd>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-2">
                          <dt className="text-slate-500">קרובים</dt>
                          <dd className="mt-0.5 font-semibold text-brand-800">{r.upcoming30}</dd>
                        </div>
                      </dl>
                      <p className="text-xs text-slate-600">
                        {r.robots.length > 0 && <span>רובוטים: {r.robots.join(' · ')} · </span>}
                        {r.agents.length > 0 ? r.agents.map((a) => a.name).join(', ') : <span className="text-amber-700">אין סוכן מטפל</span>}
                      </p>
                      {r.h.next_step && (
                        <p className="text-xs text-brand-700">
                          ← {r.h.next_step}
                          {r.h.next_step_date ? ` (${formatDate(r.h.next_step_date)})` : ''}
                        </p>
                      )}
                      <RowActions row={r} onMeeting={() => setModal({ kind: 'meeting', hospitalId: r.h.id })} onSurgery={() => setModal({ kind: 'surgery', hospitalId: r.h.id })} />
                    </li>
                  ))}
                </ul>
              </>
            )}
            {counts.attention > 0 && (
              <p className="flex items-center gap-1.5 text-xs text-slate-400">
                <AlertTriangle size={12} /> "דורש תשומת לב": ללא ביקור יותר מ-{NO_VISIT_DAYS} יום, ללא סוכן מטפל או איש קשר, או לקוח בלי ניתוחים ב-30 הימים האחרונים.
              </p>
            )}
          </div>
        </TabPanel>

        <TabPanel id="map">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
            {STATUS_ORDER.map((s) => (
              <span key={s} className="inline-flex items-center gap-1">
                <span className="h-3 w-3 rounded-full" style={{ background: STATUS_PIN[s] }} /> {STATUS_LABELS[s]}
              </span>
            ))}
          </div>
          <MapPage embedded pinColor={(id) => STATUS_PIN[statusById.get(id) ?? 'potential']} />
        </TabPanel>
      </Tabs>

      {modal?.kind === 'meeting' && <MeetingFormModal open onClose={() => setModal(null)} defaultHospitalId={modal.hospitalId} />}
      {modal?.kind === 'surgery' && <PlannedSurgeryModal hospitalId={modal.hospitalId} onClose={() => setModal(null)} />}
    </div>
  )
}
