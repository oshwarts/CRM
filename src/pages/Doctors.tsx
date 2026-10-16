import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AlertTriangle, BookUser, CalendarDays, CheckSquare, Heart, MessageCircle, Phone, Plus, Search, SlidersHorizontal } from 'lucide-react'
import { useCompanies, useCompetitorIntel, useDoctors, useFavorites, useHospitals, useMeetings, usePatientScans, usePipelineDoctors, useProcedures, useRoboticSystems, useToggleFavorite } from '../lib/api'
import { usePlannedSurgeries } from '../lib/plannedSurgeries'
import { buildDoctorRows, LOYALTY_CHIP, LOYALTY_SHORT, STALE_DAYS, usePatchDoctor, WINDOWS, type DoctorRow, type Need } from '../lib/doctorStats'
import { CADENCE_LABELS } from '../lib/cadence'
import { usePersisted } from '../lib/usePersisted'
import { DoctorFormModal } from '../components/DoctorFormModal'
import { MeetingFormModal } from '../components/MeetingFormModal'
import { TaskFormModal } from '../components/TaskFormModal'
import { whatsappNumber } from '../components/QuickContact'
import { SmartContactImport } from '../components/SmartContactImport'
import { EmptyState, ErrorState, Spinner } from '../components/ui'
import { CURRENT_YEAR, DOCTOR_STATUS_LABELS } from '../lib/types'
import { usePipelineStages, useStageSince } from '../lib/pipeline'
import { classNames, formatDate, isOverdue } from '../lib/utils'

const norm = (s: string) => s.toLowerCase().replace(/["'`.׳״‘’“”]/g, '').replace(/[-־]/g, ' ').replace(/\s+/g, ' ').trim()

const NEED_RANK: Record<Need, number> = { due: 0, stale: 1, soon: 2, '': 3 }
const SORTS: Record<string, { label: string; cmp: (a: DoctorRow, b: DoctorRow) => number }> = {
  name: { label: 'שם', cmp: (a, b) => a.d.name.localeCompare(b.d.name, 'he') },
  need: { label: 'צריכים קשר קודם', cmp: (a, b) => NEED_RANK[a.need] - NEED_RANK[b.need] || (b.daysSince ?? 9999) - (a.daysSince ?? 9999) },
  last: { label: 'פגישה אחרונה — הישן קודם', cmp: (a, b) => (b.daysSince ?? 9999) - (a.daysSince ?? 9999) },
  surgeries: { label: 'ניתוחים — הרבה קודם', cmp: (a, b) => b.surgeries - a.surgeries || a.d.name.localeCompare(b.d.name, 'he') },
}

type Only = '' | 'need' | 'missing' | 'fav'

const daysFrom = (iso: string) => Math.round((Date.now() - new Date(`${iso}T12:00:00`).getTime()) / 86_400_000)

function NeedChip({ row }: { row: DoctorRow }) {
  const { need, contact, daysSince } = row
  if (need === 'due')
    return <span className="chip border-red-200 bg-red-50 !px-2 !py-0 text-[11px] text-red-700">באיחור קשר{contact.daysToDue != null ? ` ${Math.abs(contact.daysToDue)} ימים` : ''}</span>
  if (need === 'stale')
    return <span className="chip border-amber-200 bg-amber-50 !px-2 !py-0 text-[11px] text-amber-700">{daysSince === null ? 'עוד לא נפגשנו' : `ללא קשר ${daysSince} ימים`}</span>
  if (need === 'soon')
    return <span className="chip border-amber-200 bg-amber-50 !px-2 !py-0 text-[11px] text-amber-700">קשר בעוד {contact.daysToDue} ימים</span>
  return null
}

function ContactCell({ row }: { row: DoctorRow }) {
  const patch = usePatchDoctor()
  return (
    <div className="space-y-1 text-xs">
      <p className="text-slate-600" title={row.contact.lastDate ? formatDate(row.contact.lastDate) : undefined}>
        {row.daysSince === null ? 'אין פגישות' : row.daysSince === 0 ? 'פגישה אחרונה: היום' : `פגישה אחרונה: לפני ${row.daysSince} ימים`}
      </p>
      {row.contact.nextMeeting && <p className="text-brand-700">פגישה הבאה: {formatDate(row.contact.nextMeeting)}</p>}
      <NeedChip row={row} />
      <select
        className="block max-w-full rounded-lg border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] text-slate-600"
        value={row.d.contact_cadence_days ?? ''}
        aria-label={`קצב קשר של ${row.d.name}`}
        onChange={(e) => patch.mutate({ id: row.d.id, contact_cadence_days: e.target.value ? Number(e.target.value) : null })}
      >
        <option value="">ללא קצב קשר</option>
        {Object.entries(CADENCE_LABELS).map(([days, label]) => (
          <option key={days} value={days}>
            {label}
          </option>
        ))}
      </select>
    </div>
  )
}

function StatusCell({ row, cases, since }: { row: DoctorRow; cases?: number; since?: string }) {
  const patch = usePatchDoctor()
  const potential = row.d.status === 'potential'
  return (
    <div className="space-y-1">
      <select
        className={classNames('rounded-full border px-2.5 py-1 text-xs font-medium', potential ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700')}
        value={row.d.status}
        aria-label={`סטטוס של ${row.d.name}`}
        onChange={(e) => patch.mutate({ id: row.d.id, status: e.target.value })}
      >
        {Object.entries(DOCTOR_STATUS_LABELS).map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      {potential && (
        <p className="text-[11px] text-brand-700">
          {row.d.pipeline_stage ? `שלב: ${row.d.pipeline_stage}` : <span className="text-amber-700">לא נקבע שלב</span>}
          {since && row.d.pipeline_stage ? ` · ${daysFrom(since)} ימים` : ''}
        </p>
      )}
      {potential && cases != null && cases > 0 && <p className="text-[11px] text-slate-600">מקרים {CURRENT_YEAR}: {cases}</p>}
      {potential && row.d.next_step && <p className="text-[11px] text-slate-700">← {row.d.next_step}</p>}
      {potential && !row.d.next_step && !row.d.next_step_date && <p className="text-[11px] text-amber-700">אין צעד הבא</p>}
      {potential && row.d.next_step_date && (
        <p className={classNames('text-[11px]', isOverdue(row.d.next_step_date) ? 'font-semibold text-red-600' : 'text-slate-500')}>צעד הבא: {formatDate(row.d.next_step_date)}</p>
      )}
    </div>
  )
}

function Actions({ row, fav, onFav, onMeeting, onTask }: { row: DoctorRow; fav: boolean; onFav: () => void; onMeeting: () => void; onTask: () => void }) {
  const btn = 'grid h-9 w-9 place-items-center rounded-full bg-brand-50 text-brand-700 transition hover:bg-brand-100'
  const phone = row.d.phone
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {phone && (
        <>
          <a href={`tel:${phone}`} className={btn} aria-label={`התקשר ל${row.d.name}`} title={phone}>
            <Phone size={16} />
          </a>
          <a href={`https://wa.me/${whatsappNumber(phone)}`} target="_blank" rel="noreferrer" className={btn} aria-label={`וואטסאפ ל${row.d.name}`} title="וואטסאפ">
            <MessageCircle size={16} />
          </a>
        </>
      )}
      <button type="button" className={btn} aria-label={`פגישה חדשה עם ${row.d.name}`} title="פגישה חדשה" onClick={onMeeting}>
        <CalendarDays size={16} />
      </button>
      <button type="button" className={btn} aria-label={`משימה על ${row.d.name}`} title="משימה" onClick={onTask}>
        <CheckSquare size={16} />
      </button>
      <button type="button" className={classNames(btn, fav ? '!text-red-500' : '!text-slate-400')} aria-pressed={fav} aria-label={fav ? 'הסר ממועדפים' : 'הוסף למועדפים'} onClick={onFav}>
        <Heart size={16} fill={fav ? 'currentColor' : 'none'} />
      </button>
    </div>
  )
}

function Name({ row }: { row: DoctorRow }) {
  return (
    <div className="min-w-0">
      <Link to={`/doctors/${row.d.id}`} className="font-semibold text-brand-700 hover:underline">
        {row.d.title} {row.d.name}
      </Link>
      <p className="truncate text-xs text-slate-500">{row.d.position || '—'}</p>
      {row.hospitals.length > 0 && (
        <p className="truncate text-xs text-slate-500">
          {row.hospitals[0]}
          {row.hospitals.length > 1 ? ` +${row.hospitals.length - 1}` : ''}
        </p>
      )}
      {row.missing.length > 0 && <p className="mt-0.5 text-[11px] text-amber-700">חסר: {row.missing.join(', ')}</p>}
    </div>
  )
}

/** the doctors: a list to work from — who needs contact, the contact rhythm, surgeries, loyalty, the pipeline of potential doctors — and cards on the phone */
export default function Doctors() {
  const doctors = useDoctors()
  const meetings = useMeetings()
  const scans = usePatientScans()
  const planned = usePlannedSurgeries()
  const intel = useCompetitorIntel()
  const pipeline = usePipelineDoctors()
  const { names: stageNames } = usePipelineStages()
  const stageSince = useStageSince()
  const companies = useCompanies()
  const systems = useRoboticSystems()
  const procedures = useProcedures()
  const hospitals = useHospitals()
  const favorites = useFavorites()
  const toggleFav = useToggleFavorite()
  const [params] = useSearchParams()

  const [showAdd, setShowAdd] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [modal, setModal] = useState<{ kind: 'meeting' | 'task'; doctorId: string } | null>(null)
  const [q, setQ] = usePersisted('doctors.q', '')
  const [status, setStatus] = usePersisted<'' | 'client' | 'potential'>('doctors.status', '')
  const [stage, setStage] = usePersisted('doctors.stage', '')
  const [companyId, setCompanyId] = usePersisted('doctors.company', '')
  const [procedureId, setProcedureId] = usePersisted('doctors.procedure', '')
  const [hospitalId, setHospitalId] = usePersisted('doctors.hospital', '')
  const [robotId, setRobotId] = usePersisted('doctors.robot', '')
  const [only, setOnly] = usePersisted<Only>('doctors.only', '')
  const [sort, setSort] = usePersisted('doctors.sort', 'name')
  const [windowDays, setWindowDays] = usePersisted('doctors.window', 90)
  const [filtersOpen, setFiltersOpen] = useState(false)

  // "potential doctors" used to be a page of its own: the old link opens this list on that segment
  useEffect(() => {
    const s = params.get('status')
    if (s === 'potential' || s === 'client') {
      setStatus(s)
      if (s === 'potential') setSort('stage')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // cases per year of the potential doctors, as the old pipeline page showed them
  const casesNow = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of pipeline.data ?? []) m.set(p.id, p.case_volumes.filter((v) => v.year === CURRENT_YEAR).reduce((n, v) => n + v.count, 0))
    return m
  }, [pipeline.data])

  const favSet = useMemo(() => new Set(favorites.data ?? []), [favorites.data])
  const rows = useMemo(
    () =>
      buildDoctorRows({
        doctors: doctors.data ?? [],
        meetings: meetings.data ?? [],
        scans: scans.data ?? [],
        planned: planned.data ?? [],
        intel: intel.data ?? [],
        robotNames: new Map((systems.data ?? []).map((s) => [s.id, s.name])),
        companyNames: new Map((companies.data ?? []).map((c) => [c.id, c.name])),
        windowDays,
      }),
    [doctors.data, meetings.data, scans.data, planned.data, intel.data, systems.data, companies.data, windowDays],
  )

  const counts = useMemo(
    () => ({
      all: rows.length,
      client: rows.filter((r) => r.d.status === 'client').length,
      potential: rows.filter((r) => r.d.status === 'potential').length,
      need: rows.filter((r) => r.need === 'due' || r.need === 'stale').length,
      missing: rows.filter((r) => r.missing.length > 0).length,
    }),
    [rows],
  )

  const shown = useMemo(() => {
    const words = norm(q).split(' ').filter(Boolean)
    const list = rows.filter((r) => {
      const d = r.d
      if (status && d.status !== status) return false
      if (stage && d.pipeline_stage !== stage) return false
      if (companyId && !d.doctor_companies.some((c) => c.company_id === companyId)) return false
      if (procedureId && !d.doctor_procedures.some((p) => p.procedure_id === procedureId)) return false
      if (hospitalId && !d.doctor_hospitals.some((h) => h.hospital_id === hospitalId)) return false
      if (robotId && !d.doctor_robotic_systems.some((s) => s.system_id === robotId)) return false
      if (only === 'need' && !(r.need === 'due' || r.need === 'stale')) return false
      if (only === 'missing' && r.missing.length === 0) return false
      if (only === 'fav' && !favSet.has(d.id)) return false
      if (words.length && !words.every((w) => norm(`${d.title} ${d.name} ${d.position} ${r.hospitals.join(' ')}`).includes(w))) return false
      return true
    })
    // by stage: the managers' order of the stages, the furthest first
    const byStage = (a: DoctorRow, b: DoctorRow) => stageNames.indexOf(b.d.pipeline_stage) - stageNames.indexOf(a.d.pipeline_stage) || a.d.name.localeCompare(b.d.name, 'he')
    return [...list].sort(sort === 'stage' ? byStage : (SORTS[sort] ?? SORTS.name).cmp)
  }, [rows, q, status, stage, companyId, procedureId, hospitalId, robotId, only, sort, favSet, stageNames])

  const anyFilter = !!(q || status || stage || companyId || procedureId || hospitalId || robotId || only)
  const clearAll = () => {
    setQ('')
    setStatus('')
    setStage('')
    setCompanyId('')
    setProcedureId('')
    setHospitalId('')
    setRobotId('')
    setOnly('')
  }
  const extraFilters = [hospitalId, procedureId, companyId, robotId].filter(Boolean).length
  const windowLabel = WINDOWS.find((w) => w.days === windowDays)?.label ?? `${windowDays} ימים`

  if (doctors.isLoading) return <Spinner />
  if (doctors.error && !doctors.data) return <ErrorState error={doctors.error} />

  const kpi = (label: string, value: number, active: boolean, onClick: () => void, warn?: boolean) => (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={classNames('card flex flex-col items-start p-3 text-right transition hover:shadow-pop', active && 'border-brand-500 ring-2 ring-brand-200', warn && value > 0 && !active && 'border-amber-300 bg-amber-50')}
    >
      <span className={classNames('text-2xl font-semibold leading-none', warn && value > 0 ? 'text-amber-700' : 'text-brand-800')}>{value}</span>
      <span className="mt-1 text-xs text-slate-600">{label}</span>
    </button>
  )
  const pill = (label: string, value: '' | 'client' | 'potential', n: number) => (
    <button
      key={label}
      type="button"
      aria-pressed={status === value}
      onClick={() => {
        setStatus(value)
        if (value !== 'potential') setStage('')
      }}
      className={classNames('rounded-full border px-4 py-1.5 text-sm font-medium transition', status === value ? 'border-brand-500 bg-brand-500 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}
    >
      {label} <span className={status === value ? 'text-white/80' : 'text-slate-400'}>{n}</span>
    </button>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-brand-800">רופאים</h1>
          <p className="text-sm text-slate-500">מי צריך קשר עכשיו, קצב הקשר, ניתוחים, נאמנות והמשפך של הפוטנציאליים</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={() => setShowImport(true)}>
            <BookUser size={16} /> ייבוא איש קשר
          </button>
          <button className="btn-primary" onClick={() => setShowAdd(true)}>
            <Plus size={16} /> הוספת רופא
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {kpi('רופאים', counts.all, !anyFilter, clearAll)}
        {kpi('צריכים קשר עכשיו', counts.need, only === 'need', () => setOnly(only === 'need' ? '' : 'need'), true)}
        {kpi('פוטנציאליים', counts.potential, status === 'potential' && !only, () => setStatus(status === 'potential' ? '' : 'potential'))}
        {kpi('פרטים חסרים', counts.missing, only === 'missing', () => setOnly(only === 'missing' ? '' : 'missing'), true)}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {pill('כל הרופאים', '', counts.all)}
        {pill('לקוחות', 'client', counts.client)}
        {pill('פוטנציאליים (משפך)', 'potential', counts.potential)}
        <button type="button" aria-pressed={only === 'fav'} onClick={() => setOnly(only === 'fav' ? '' : 'fav')} className={classNames('chip', only === 'fav' ? 'border-red-300 bg-red-50 text-red-600' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}>
          <Heart size={13} fill={only === 'fav' ? 'currentColor' : 'none'} /> המועדפים שלי
        </button>
      </div>

      <div className="card flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search size={16} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input !pr-10" placeholder="חיפוש: שם, תפקיד או בית חולים" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button type="button" className="btn-secondary shrink-0 sm:hidden" onClick={() => setFiltersOpen((o) => !o)} aria-expanded={filtersOpen}>
          <SlidersHorizontal size={16} /> סינון{extraFilters > 0 ? ` (${extraFilters})` : ''}
        </button>
        <div className={classNames('w-full flex-wrap items-center gap-2 sm:flex sm:w-auto', filtersOpen ? 'flex' : 'hidden')}>
          <select className="input !w-auto" value={hospitalId} aria-label="בית חולים" onChange={(e) => setHospitalId(e.target.value)}>
            <option value="">כל בתי החולים</option>
            {(hospitals.data ?? []).map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
          <select className="input !w-auto" value={procedureId} aria-label="הליך" onChange={(e) => setProcedureId(e.target.value)}>
            <option value="">כל ההליכים</option>
            {(procedures.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select className="input !w-auto" value={companyId} aria-label="חברה" onChange={(e) => setCompanyId(e.target.value)}>
            <option value="">כל החברות</option>
            {(companies.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select className="input !w-auto" value={robotId} aria-label="רובוט" onChange={(e) => setRobotId(e.target.value)}>
            <option value="">כל הרובוטים</option>
            {(systems.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {status === 'potential' && (
            <select className="input !w-auto" value={stage} aria-label="שלב במשפך" onChange={(e) => setStage(e.target.value)}>
              <option value="">כל השלבים</option>
              {stageNames.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          )}
          <select className="input !w-auto" value={windowDays} aria-label="היקף ניתוחים לתקופה" onChange={(e) => setWindowDays(Number(e.target.value))}>
            {WINDOWS.map((w) => (
              <option key={w.days} value={w.days}>
                היקף ניתוחים: {w.label}
              </option>
            ))}
          </select>
          <select className="input !w-auto" value={sort} aria-label="מיון" onChange={(e) => setSort(e.target.value)}>
            {[...Object.entries(SORTS), ['stage', { label: 'שלב במשפך — המתקדם קודם' }] as [string, { label: string }]].map(([k, s]) => (
              <option key={k} value={k}>
                מיון: {s.label}
              </option>
            ))}
          </select>
        </div>
        {anyFilter && (
          <button type="button" className="text-sm font-medium text-brand-600 underline" onClick={clearAll}>
            נקה סינון
          </button>
        )}
      </div>

      <p className="text-sm text-slate-500">
        {shown.length} רופאים{anyFilter ? ` מתוך ${rows.length}` : ''}
      </p>

      {shown.length === 0 ? (
        <EmptyState
          title="לא נמצאו רופאים"
          hint="נסה לשנות את הסינון או הוסף רופא חדש"
          action={
            <button className="btn-primary" onClick={() => setShowAdd(true)}>
              <Plus size={16} /> הוספת רופא
            </button>
          }
        />
      ) : (
        <>
          {/* desktop: a table */}
          <div className="card hidden overflow-x-auto md:block">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-right text-xs text-slate-500">
                  <th className="p-2.5 font-medium">רופא</th>
                  <th className="p-2.5 font-medium">סטטוס</th>
                  <th className="p-2.5 font-medium">רובוט וחברה</th>
                  <th className="p-2.5 font-medium">קשר</th>
                  <th className="p-2.5 text-center font-medium">ניתוחים ({windowLabel})</th>
                  <th className="p-2.5 font-medium">נאמנות</th>
                  <th className="p-2.5 font-medium">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.d.id} className="border-b border-slate-100 align-top hover:bg-slate-50">
                    <td className="p-2.5">
                      <Name row={r} />
                    </td>
                    <td className="p-2.5">
                      <StatusCell row={r} cases={casesNow.get(r.d.id)} since={stageSince.data?.get(r.d.id)?.since} />
                    </td>
                    <td className="p-2.5 text-xs text-slate-600">
                      {r.robots.length > 0 && <p>רובוט: {r.robots.join(' · ')}</p>}
                      {r.companies.length > 0 && <p>{r.companies.join(' · ')}</p>}
                      {r.robots.length === 0 && r.companies.length === 0 && <span className="text-slate-300">—</span>}
                    </td>
                    <td className="p-2.5">
                      <ContactCell row={r} />
                    </td>
                    <td className="p-2.5 text-center text-base font-semibold text-brand-800">{r.surgeries || <span className="text-slate-300">0</span>}</td>
                    <td className="p-2.5">{r.loyalty ? <span className={classNames('chip !px-2 !py-0 text-[11px]', LOYALTY_CHIP[r.loyalty])}>{LOYALTY_SHORT[r.loyalty]}</span> : <span className="text-xs text-slate-300">לא ידוע</span>}</td>
                    <td className="p-2.5">
                      <Actions row={r} fav={favSet.has(r.d.id)} onFav={() => toggleFav.mutate({ doctorId: r.d.id, isFavorite: favSet.has(r.d.id) })} onMeeting={() => setModal({ kind: 'meeting', doctorId: r.d.id })} onTask={() => setModal({ kind: 'task', doctorId: r.d.id })} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* phone: cards */}
          <ul className="space-y-2.5 md:hidden">
            {shown.map((r) => (
              <li key={r.d.id} className="card space-y-2.5 p-3.5">
                <Name row={r} />
                <StatusCell row={r} cases={casesNow.get(r.d.id)} since={stageSince.data?.get(r.d.id)?.since} />
                <ContactCell row={r} />
                <dl className="grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="rounded-xl bg-slate-50 p-2">
                    <dt className="text-slate-500">ניתוחים ({windowLabel})</dt>
                    <dd className="mt-0.5 text-base font-semibold text-brand-800">{r.surgeries}</dd>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-2">
                    <dt className="text-slate-500">נאמנות</dt>
                    <dd className="mt-0.5">{r.loyalty ? <span className={classNames('chip !px-2 !py-0 text-[11px]', LOYALTY_CHIP[r.loyalty])}>{LOYALTY_SHORT[r.loyalty]}</span> : <span className="text-slate-300">לא ידוע</span>}</dd>
                  </div>
                </dl>
                {(r.robots.length > 0 || r.companies.length > 0) && <p className="text-xs text-slate-600">{[...r.robots, ...r.companies].join(' · ')}</p>}
                <Actions row={r} fav={favSet.has(r.d.id)} onFav={() => toggleFav.mutate({ doctorId: r.d.id, isFavorite: favSet.has(r.d.id) })} onMeeting={() => setModal({ kind: 'meeting', doctorId: r.d.id })} onTask={() => setModal({ kind: 'task', doctorId: r.d.id })} />
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="flex items-center gap-1.5 text-xs text-slate-400">
        <AlertTriangle size={12} /> "צריכים קשר": באיחור לפי קצב הקשר שהוגדר, או — כשאין קצב — לא נפגשנו {STALE_DAYS} יום ויותר. פגישה שכבר נקבעה מסירה את ההתראה.
      </p>

      {showAdd && <DoctorFormModal open={showAdd} onClose={() => setShowAdd(false)} />}
      {showImport && <SmartContactImport onClose={() => setShowImport(false)} />}
      {modal?.kind === 'meeting' && <MeetingFormModal open onClose={() => setModal(null)} defaultDoctorId={modal.doctorId} />}
      {modal?.kind === 'task' && <TaskFormModal defaults={{ doctor_id: modal.doctorId }} onClose={() => setModal(null)} />}
    </div>
  )
}
