import { lazy, Suspense, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AlertTriangle, Building2, Download, CalendarDays, Navigation, Phone, Scissors, Search, SlidersHorizontal, User } from 'lucide-react'
import { useMapData, useMeetings, usePatientScans } from '../lib/api'
import { usePlannedSurgeries } from '../lib/plannedSurgeries'
import { buildHospitalRows, NO_VISIT_DAYS, STATUS_CHIP, STATUS_LABELS, STATUS_ORDER, STATUS_PIN, useSetHospitalCommercial, type CommercialStatus, type HospitalRow, type Warning } from '../lib/hospitalStats'
import { usePersisted } from '../lib/usePersisted'
import { downloadCsv } from '../lib/csv'
import { useAuth } from '../context/AuthProvider'
import { classNames, formatDate, todayISO } from '../lib/utils'
import { EmptyState, ErrorState, Spinner, Tab, TabList, TabPanel, Tabs } from '../components/ui'
import { hospitalNavLinks } from '../components/HospitalActions'
import { MeetingFormModal } from '../components/MeetingFormModal'
import { PlannedSurgeryModal } from '../components/PlannedSurgeryModal'
// the map (and its library) is loaded only when the map tab is opened
const MapPage = lazy(() => import('./MapPage'))

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
      className={classNames('min-h-8 max-w-full shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium', STATUS_CHIP[row.status])}
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

function RowActions({ row, onMeeting, onSurgery, labeled }: { row: HospitalRow; onMeeting: () => void; onSurgery: () => void; labeled?: boolean }) {
  const nav = hospitalNavLinks(row.h)
  const btn = labeled
    ? 'flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl bg-brand-50 px-1 py-1 text-xs font-medium text-brand-700 transition hover:bg-brand-100'
    : 'grid h-9 w-9 place-items-center rounded-full bg-brand-50 text-brand-700 transition hover:bg-brand-100'
  const txt = (t: string) => (labeled ? <span>{t}</span> : null)
  return (
    <div className={classNames('flex items-center', labeled ? 'gap-2 border-t border-slate-100 pt-2.5' : 'gap-1.5')}>
      {row.contactPhone && (
        <a href={`tel:${row.contactPhone.phone}`} className={btn} aria-label={`התקשר ל${row.contactPhone.name}`} title={`${row.contactPhone.name} · ${row.contactPhone.phone}`}>
          <Phone size={16} />
          {txt('התקשר')}
        </a>
      )}
      <a href={nav.waze} target="_blank" rel="noreferrer" className={btn} aria-label={`נווט אל ${row.h.name}`} title="ניווט ב-Waze">
        <Navigation size={16} />
        {txt('נווט')}
      </a>
      <button type="button" className={btn} aria-label={`פגישה חדשה ב${row.h.name}`} title="פגישה חדשה" onClick={onMeeting}>
        <CalendarDays size={16} />
        {txt('פגישה')}
      </button>
      <button type="button" className={btn} aria-label={`ניתוח חדש ב${row.h.name}`} title="ניתוח חדש" onClick={onSurgery}>
        <Scissors size={16} />
        {txt('ניתוח')}
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
  // on the phone the four selects hide behind one "filter" button (open from the start when one is active)
  const [panel, setPanel] = useState(() => !!(f.status || f.org || f.robot || f.agent))
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

  /** the list as shown (filters and sort applied) as a file for Excel */
  const exportCsv = () =>
    downloadCsv(
      `בתי-חולים-${todayISO()}.csv`,
      ['בית חולים', 'עיר', 'ארגון', 'סטטוס מסחרי', 'רובוטים', 'סוכנים', 'רופאים', 'פגישה אחרונה', 'ימים מהפגישה', 'ניתוחים ב-30 יום', 'ניתוחים קרובים', 'צעד הבא', 'תאריך צעד הבא', 'דורש תשומת לב'],
      shown.map((r) => [
        r.h.name, r.h.city, r.h.organization?.name, STATUS_LABELS[r.status], r.robots.join(' · '), r.agents.map((a) => a.name).join(' · '), r.doctors,
        r.lastMeeting, r.daysSince, r.surgeries30, r.upcoming30, r.h.next_step, r.h.next_step_date, r.warnings.map((w) => w.label).join(' · '),
      ]),
    )
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

  /** the same filters as a wrapping row of chips: on the phone, instead of six big tiles */
  const kpiChip = (label: string, value: number, active: boolean, onClick: () => void, warn?: boolean) => (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={classNames(
        'chip',
        active
          ? 'border-brand-500 bg-brand-600 text-white'
          : warn && value > 0
            ? 'border-amber-300 bg-amber-50 text-amber-700'
            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
      )}
    >
      {label} <b className="text-sm">{value}</b>
    </button>
  )
  const activeSelects = [f.status, f.org, f.robot, f.agent].filter(Boolean).length

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-brand-800 sm:text-3xl">בתי חולים</h1>
        <p className="text-sm text-slate-500">סטטוס מסחרי, ביקורים וניתוחים — והמפה בלשונית נפרדת</p>
      </div>

      <div className={classNames('flex flex-wrap gap-1.5 lg:hidden', tab !== 'list' && '!hidden')}>
        {kpiChip('הכל', counts.all, !filtered, () => setF(NO_FILTERS))}
        {kpiChip('דורשים תשומת לב', counts.attention, f.warn === 'any', () => set({ warn: f.warn === 'any' ? '' : 'any' }), true)}
        {kpiChip(`ללא ביקור ${NO_VISIT_DAYS} יום`, counts.noVisit, f.warn === 'no-visit', () => set({ warn: f.warn === 'no-visit' ? '' : 'no-visit' }), true)}
        {kpiChip('ללא סוכן', counts.noAgent, f.warn === 'no-agent', () => set({ warn: f.warn === 'no-agent' ? '' : 'no-agent' }), true)}
        {kpiChip('לקוחות', counts.client, f.status === 'client', () => set({ status: f.status === 'client' ? '' : 'client' }))}
        {kpiChip('פוטנציאליים', counts.potential, f.status === 'potential', () => set({ status: f.status === 'potential' ? '' : 'potential' }))}
      </div>
      <div className={classNames('hidden grid-cols-6 gap-2', tab === 'list' && 'lg:grid')}>
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
                <input type="search" className="input !pr-9" placeholder="חיפוש בית חולים, עיר או ארגון" aria-label="חיפוש בית חולים, עיר או ארגון" value={f.q} onChange={(e) => set({ q: e.target.value })} />
              </label>
              <button type="button" className="btn-secondary shrink-0 sm:hidden" aria-expanded={panel} onClick={() => setPanel((v) => !v)}>
                <SlidersHorizontal size={15} /> סינון
                {activeSelects > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand-600 px-1 text-xs text-white">{activeSelects}</span>}
              </button>
              <select className="input min-w-0 flex-1 sm:!w-auto sm:flex-none" value={f.sort} aria-label="מיון" onChange={(e) => set({ sort: e.target.value })}>
                {Object.entries(SORTS).map(([k, s]) => (
                  <option key={k} value={k}>
                    מיון: {s.label}
                  </option>
                ))}
              </select>
              {hasMine && (
                <button type="button" aria-pressed={f.mine} onClick={() => set({ mine: !f.mine })} className={classNames('chip', f.mine ? 'border-brand-500 bg-brand-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}>
                  <User size={13} /> בתי החולים שלי
                </button>
              )}
              <div className={classNames('grid-cols-2 gap-2 sm:flex sm:flex-wrap', panel ? 'grid w-full' : 'hidden')}>
              <select className="input !w-full sm:!w-auto" value={f.status} aria-label="סטטוס מסחרי" onChange={(e) => set({ status: e.target.value as Filters['status'] })}>
                <option value="">כל הסטטוסים</option>
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
              <select className="input !w-full sm:!w-auto" value={f.org} aria-label="ארגון" onChange={(e) => set({ org: e.target.value })}>
                <option value="">כל הארגונים</option>
                {orgs.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
              <select className="input !w-full sm:!w-auto" value={f.robot} aria-label="רובוט" onChange={(e) => set({ robot: e.target.value })}>
                <option value="">כל הרובוטים</option>
                {robots.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
              <select className="input !w-full sm:!w-auto" value={f.agent} aria-label="סוכן" onChange={(e) => set({ agent: e.target.value })}>
                <option value="">כל הסוכנים</option>
                {agents.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-3 text-sm text-slate-500">
                <span>
                  {shown.length} בתי חולים{filtered ? ` מתוך ${rows.length}` : ''}
                </span>
                {filtered && (
                  <button type="button" className="text-sm font-medium text-brand-600 underline" onClick={() => setF({ ...NO_FILTERS, sort: f.sort })}>
                    נקה סינון
                  </button>
                )}
              </p>
              <button type="button" className="btn-ghost !text-xs" onClick={exportCsv}>
                <Download size={14} /> ייצוא לאקסל
              </button>
            </div>

            {shown.length === 0 ? (
              <EmptyState title="אין בתי חולים שמתאימים לסינון" hint="נסה לנקות את הסינון" />
            ) : (
              <>
                {/* desktop: a table */}
                <div tabIndex={0} className="card hidden overflow-x-auto md:block">
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
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Link to={`/hospitals/${r.h.id}`} className="flex min-h-8 items-start gap-1.5 py-1 text-base font-semibold leading-snug text-brand-800">
                            <Building2 size={15} className="mt-1 shrink-0" /> <span className="break-words">{r.h.name}</span>
                          </Link>
                          <p className="text-xs text-slate-500">{[r.h.city, r.h.organization?.name].filter(Boolean).join(' · ')}</p>
                        </div>
                        <StatusSelect row={r} />
                      </div>
                      <Warnings warnings={r.warnings} />
                      <dl className="grid grid-cols-3 divide-x divide-x-reverse divide-slate-200 rounded-xl bg-slate-50 py-2 text-center text-xs">
                        <div className="px-1">
                          <dd className="font-medium">{lastText(r)}</dd>
                          <dt className="text-slate-500">פגישה אחרונה</dt>
                        </div>
                        <div className="px-1">
                          <dd className="text-sm font-semibold text-brand-800">{r.surgeries30}</dd>
                          <dt className="text-slate-500">ניתוחים ב-30 יום</dt>
                        </div>
                        <div className="px-1">
                          <dd className="text-sm font-semibold text-brand-800">{r.upcoming30}</dd>
                          <dt className="text-slate-500">קרובים</dt>
                        </div>
                      </dl>
                      <p className="text-xs text-slate-600">
                        {r.robots.length > 0 && <span>{r.robots.join(' · ')} · </span>}
                        {r.agents.length > 0 ? r.agents.map((a) => a.name).join(', ') : <span className="text-amber-700">אין סוכן מטפל</span>}
                      </p>
                      {r.h.next_step && (
                        <p className="text-xs text-brand-700">
                          ← {r.h.next_step}
                          {r.h.next_step_date ? ` (${formatDate(r.h.next_step_date)})` : ''}
                        </p>
                      )}
                      <RowActions labeled row={r} onMeeting={() => setModal({ kind: 'meeting', hospitalId: r.h.id })} onSurgery={() => setModal({ kind: 'surgery', hospitalId: r.h.id })} />
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
          <Suspense fallback={<Spinner />}>
            <MapPage embedded pinColor={(id) => STATUS_PIN[statusById.get(id) ?? 'potential']} />
          </Suspense>
        </TabPanel>
      </Tabs>

      {modal?.kind === 'meeting' && <MeetingFormModal open onClose={() => setModal(null)} defaultHospitalId={modal.hospitalId} />}
      {modal?.kind === 'surgery' && <PlannedSurgeryModal hospitalId={modal.hospitalId} onClose={() => setModal(null)} />}
    </div>
  )
}
