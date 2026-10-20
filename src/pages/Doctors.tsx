import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AlertTriangle, BookUser, Download, CalendarDays, CheckSquare, Heart, MessageCircle, Phone, Plus, Search, SlidersHorizontal } from 'lucide-react'
import { useCompanies, useCompetitorIntel, useDoctors, useFavorites, useHospitals, useMeetings, usePatientScans, usePipelineDoctors, useProcedures, useRoboticSystems, useToggleFavorite } from '../lib/api'
import { usePlannedSurgeries } from '../lib/plannedSurgeries'
import { buildDoctorRows, LOYALTY_CHIP, LOYALTY_SHORT, STALE_DAYS, usePatchDoctor, WINDOWS, type DoctorRow, type Need } from '../lib/doctorStats'
import { CADENCE_LABELS } from '../lib/cadence'
import { usePersisted } from '../lib/usePersisted'
import { expandProcedure } from '../lib/procedures'
import { downloadCsv } from '../lib/csv'
import { DoctorFormModal } from '../components/DoctorFormModal'
import { MeetingFormModal } from '../components/MeetingFormModal'
import { TaskFormModal } from '../components/TaskFormModal'
import { whatsappNumber } from '../components/QuickContact'
import { SmartContactImport } from '../components/SmartContactImport'
import { EmptyState, ErrorState, Field, Modal, Spinner } from '../components/ui'
import { CURRENT_YEAR, DOCTOR_STATUS_LABELS } from '../lib/types'
import { usePipelineStages, useStageSince } from '../lib/pipeline'
import { classNames, formatDate, isOverdue, todayISO } from '../lib/utils'

const norm = (s: string) => s.toLowerCase().replace(/["'`.׳״‘’“”]/g, '').replace(/[-־]/g, ' ').replace(/\s+/g, ' ').trim()

const NEED_RANK: Record<Need, number> = { due: 0, stale: 1, soon: 2, '': 3 }
const SORTS: Record<string, { label: string; cmp: (a: DoctorRow, b: DoctorRow) => number }> = {
  name: { label: 'שם', cmp: (a, b) => a.d.name.localeCompare(b.d.name, 'he') },
  need: { label: 'צריכים קשר קודם', cmp: (a, b) => NEED_RANK[a.need] - NEED_RANK[b.need] || (b.daysSince ?? 9999) - (a.daysSince ?? 9999) },
  last: { label: 'פגישה אחרונה — הישן קודם', cmp: (a, b) => (b.daysSince ?? 9999) - (a.daysSince ?? 9999) },
  surgeries: { label: 'ניתוחים — הרבה קודם', cmp: (a, b) => b.surgeries - a.surgeries || a.d.name.localeCompare(b.d.name, 'he') },
}

type Only = '' | 'need' | 'missing' | 'fav'
type StatusFilter = '' | 'client' | 'potential' | 'lost'

/** a long list is drawn in pages: the phone does not carry hundreds of cards at once */
const PAGE = 40

const daysFrom = (iso: string) => Math.round((Date.now() - new Date(`${iso}T12:00:00`).getTime()) / 86_400_000)

function NeedChip({ row }: { row: DoctorRow }) {
  const { need, contact, daysSince } = row
  if (need === 'due')
    return <span className="chip border-red-200 bg-red-50 !px-2 !py-0 text-[12px] text-red-700">באיחור קשר{contact.daysToDue != null ? ` ${Math.abs(contact.daysToDue)} ימים` : ''}</span>
  if (need === 'stale')
    return <span className="chip border-amber-200 bg-amber-50 !px-2 !py-0 text-[12px] text-amber-700">{daysSince === null ? 'עוד לא נפגשנו' : `ללא קשר ${daysSince} ימים`}</span>
  if (need === 'soon')
    return <span className="chip border-amber-200 bg-amber-50 !px-2 !py-0 text-[12px] text-amber-700">קשר בעוד {contact.daysToDue} ימים</span>
  return null
}

function lastMeetingText(row: DoctorRow) {
  return row.daysSince === null ? 'אין פגישות' : row.daysSince === 0 ? 'פגישה אחרונה: היום' : `פגישה אחרונה: לפני ${row.daysSince} ימים`
}

function ContactCell({ row }: { row: DoctorRow }) {
  return (
    <div className="space-y-1 text-xs">
      <p className="text-slate-600" title={row.contact.lastDate ? formatDate(row.contact.lastDate) : undefined}>
        {lastMeetingText(row)}
      </p>
      {row.contact.nextMeeting && <p className="text-brand-700">פגישה הבאה: {formatDate(row.contact.nextMeeting)}</p>}
      <NeedChip row={row} />
      <CadenceSelect row={row} />
    </div>
  )
}

function StatusSelect({ row, onLost }: { row: DoctorRow; onLost: (row: DoctorRow) => void }) {
  const patch = usePatchDoctor()
  const potential = row.d.status === 'potential'
  return (
    <select
      className={classNames('max-w-full rounded-full border !py-0.5 pl-2 pr-3 text-xs font-medium min-h-[34px] md:min-h-[28px]', potential ? 'border-amber-200 bg-amber-50 text-amber-700' : row.d.status === 'lost' ? 'border-slate-300 bg-slate-100 text-slate-600' : 'border-emerald-200 bg-emerald-50 text-emerald-700')}
      value={row.d.status}
      aria-label={`סטטוס של ${row.d.name}`}
      onChange={(e) => {
        const v = e.target.value
        if (v === 'lost') onLost(row)
        else patch.mutate({ id: row.d.id, status: v, ...(row.d.status === 'lost' ? { lost_reason: '', lost_at: null } : {}) })
      }}
    >
      {Object.entries(DOCTOR_STATUS_LABELS).map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  )
}

/** closing a doctor as not relevant asks for the reason — in a dialog (a browser prompt is unusable on the phone) */
function LostDialog({ row, onClose }: { row: DoctorRow; onClose: () => void }) {
  const patch = usePatchDoctor()
  const [reason, setReason] = useState('')
  const save = () => {
    patch.mutate({ id: row.d.id, status: 'lost', lost_reason: reason.trim(), lost_at: todayISO() })
    onClose()
  }
  return (
    <Modal open onClose={onClose} title="העברה ללא רלוונטי" size="md">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <p className="text-sm text-slate-600">
          {row.d.title} {row.d.name} יעבור לרשימת "לא רלוונטי". אפשר להחזיר אותו בכל רגע.
        </p>
        <Field label="למה הרופא לא רלוונטי? (אופציונלי)">
          <input className="input" autoFocus enterKeyHint="done" dir="auto" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="למשל: בחר מתחרה, אין תקציב" />
        </Field>
        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
          <button type="button" className="btn-secondary" onClick={onClose}>
            ביטול
          </button>
          <button type="submit" className="btn-primary max-sm:flex-1">
            העבר
          </button>
        </div>
      </form>
    </Modal>
  )
}

function StatusInfo({ row, cases, since }: { row: DoctorRow; cases?: number; since?: string }) {
  if (row.d.status !== 'potential') return null
  const overdue = !!row.d.next_step_date && isOverdue(row.d.next_step_date)
  return (
    <div className="space-y-0.5 text-xs">
      <p className="text-brand-700">
        {row.d.pipeline_stage ? `שלב: ${row.d.pipeline_stage}` : <span className="text-amber-700">לא נקבע שלב</span>}
        {since && row.d.pipeline_stage ? ` · ${daysFrom(since)} ימים` : ''}
        {cases != null && cases > 0 ? <span className="text-slate-600"> · מקרים {CURRENT_YEAR}: {cases}</span> : ''}
      </p>
      {row.d.next_step && (
        <p className="text-slate-700">
          ← {row.d.next_step}
          {row.d.next_step_date && <span className={classNames('mr-1', overdue ? 'font-semibold text-red-600' : 'text-slate-500')}> · {formatDate(row.d.next_step_date)}</span>}
        </p>
      )}
      {!row.d.next_step && row.d.next_step_date && (
        <p className={overdue ? 'font-semibold text-red-600' : 'text-slate-500'}>צעד הבא: {formatDate(row.d.next_step_date)}</p>
      )}
      {!row.d.next_step && !row.d.next_step_date && <p className="text-amber-700">אין צעד הבא</p>}
    </div>
  )
}

function StatusCell({ row, cases, since, onLost }: { row: DoctorRow; cases?: number; since?: string; onLost: (row: DoctorRow) => void }) {
  return (
    <div className="space-y-1">
      <StatusSelect row={row} onLost={onLost} />
      <StatusInfo row={row} cases={cases} since={since} />
    </div>
  )
}

/** the contact rhythm, as a small select */
function CadenceSelect({ row, className }: { row: DoctorRow; className?: string }) {
  const patch = usePatchDoctor()
  return (
    <select
      className={classNames('min-w-0 max-w-full rounded-lg border border-slate-200 bg-white !py-0.5 pl-1 pr-2 text-[12px] text-slate-600 min-h-[36px] md:min-h-[26px]', className)}
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
  )
}

function Actions({ row, fav, onFav, onMeeting, onTask, compact }: { row: DoctorRow; fav: boolean; onFav: () => void; onMeeting: () => void; onTask: () => void; compact?: boolean }) {
  const btn = 'grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700 transition hover:bg-brand-100'
  const phone = row.d.phone
  return (
    <div className={classNames('flex items-center', compact ? 'gap-1' : 'flex-wrap gap-1.5')}>
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
      <button type="button" className={classNames(btn, fav ? '!text-red-500' : '!text-slate-400')} aria-pressed={fav} aria-label={fav ? `הסר את ${row.d.name} ממועדפים` : `הוסף את ${row.d.name} למועדפים`} onClick={onFav}>
        <Heart size={16} fill={fav ? 'currentColor' : 'none'} />
      </button>
    </div>
  )
}

function Name({ row, inline, hideLink }: { row: DoctorRow; inline?: boolean; hideLink?: boolean }) {
  const hospital = row.hospitals.length > 0 ? `${row.hospitals[0]}${row.hospitals.length > 1 ? ` +${row.hospitals.length - 1}` : ''}` : ''
  return (
    <div className="min-w-0">
      {!hideLink && (
        <Link to={`/doctors/${row.d.id}`} className="break-words text-base font-semibold leading-snug text-brand-700 hover:underline md:text-sm">
          {row.d.title} {row.d.name}
        </Link>
      )}
      {inline ? (
        // phone: position and hospital on one line; the position is the one that is cut with an ellipsis
        (row.d.position || hospital) && (
          <p className="flex min-w-0 gap-1 text-xs text-slate-500">
            {row.d.position && <span className="min-w-0 truncate">{row.d.position}</span>}
            {row.d.position && hospital && <span aria-hidden="true">·</span>}
            {hospital && <span className={classNames('truncate', row.d.position ? 'max-w-[55%] shrink-0' : 'min-w-0')}>{hospital}</span>}
          </p>
        )
      ) : (
        <>
          {row.d.position && <p className="truncate text-xs text-slate-500">{row.d.position}</p>}
          {hospital && <p className="truncate text-xs text-slate-500">{hospital}</p>}
        </>
      )}
      {row.missing.length > 0 && <p className="mt-0.5 text-xs text-amber-700">חסר: {row.missing.join(', ')}</p>}
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
  const [lostRow, setLostRow] = useState<DoctorRow | null>(null)
  const [q, setQ] = usePersisted('doctors.q', '')
  const [status, setStatus] = usePersisted<StatusFilter>('doctors.status', '')
  const [stage, setStage] = usePersisted('doctors.stage', '')
  const [companyId, setCompanyId] = usePersisted('doctors.company', '')
  const [procedureId, setProcedureId] = usePersisted('doctors.procedure', '')
  const [hospitalId, setHospitalId] = usePersisted('doctors.hospital', '')
  const [robotId, setRobotId] = usePersisted('doctors.robot', '')
  const [only, setOnly] = usePersisted<Only>('doctors.only', '')
  const [sort, setSort] = usePersisted('doctors.sort', 'name')
  const [windowDays, setWindowDays] = usePersisted('doctors.window', 90)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [limit, setLimit] = useState(PAGE)

  // "potential doctors" used to be a page of its own: the old link opens this list on that segment
  useEffect(() => {
    const s = params.get('status')
    if (s === 'potential' || s === 'client' || s === 'lost') {
      setStatus(s)
      if (s === 'potential') setSort('stage')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // a new search or filter starts from the top of the list again
  useEffect(() => {
    setLimit(PAGE)
  }, [q, status, stage, companyId, procedureId, hospitalId, robotId, only, sort])

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
      all: rows.filter((r) => r.d.status !== 'lost').length,
      lost: rows.filter((r) => r.d.status === 'lost').length,
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
      if (status ? d.status !== status : d.status === 'lost') return false
      if (stage && d.pipeline_stage !== stage) return false
      if (companyId && !d.doctor_companies.some((c) => c.company_id === companyId)) return false
      if (procedureId) {
        // a parent procedure matches the doctors of all of its sub-procedures
        const ids = expandProcedure(procedureId, procedures.data ?? [])
        if (!d.doctor_procedures.some((p) => ids.has(p.procedure_id))) return false
      }
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
  }, [rows, q, status, stage, companyId, procedureId, procedures.data, hospitalId, robotId, only, sort, favSet, stageNames])

  const windowLabel = WINDOWS.find((w) => w.days === windowDays)?.label ?? `${windowDays} ימים`

  /** the list as shown (filters and sort applied) as a file for Excel */
  const exportCsv = () =>
    downloadCsv(
      `רופאים-${todayISO()}.csv`,
      ['שם', 'תואר', 'תפקיד', 'סטטוס', 'שלב במשפך', 'צעד הבא', 'תאריך צעד הבא', 'בית חולים', 'טלפון', 'מייל', 'רובוט', 'חברה', 'קצב קשר (ימים)', 'פגישה אחרונה', 'ימים מהפגישה האחרונה', `ניתוחים (${windowLabel})`, 'נאמנות'],
      shown.map((r) => [
        r.d.name, r.d.title, r.d.position, DOCTOR_STATUS_LABELS[r.d.status] ?? r.d.status, r.d.pipeline_stage, r.d.next_step, r.d.next_step_date,
        r.hospitals.join(' · '), r.d.phone, r.d.email, r.robots.join(' · '), r.companies.join(' · '), r.d.contact_cadence_days, r.contact.lastDate, r.daysSince, r.surgeries, LOYALTY_SHORT[r.loyalty] ?? '',
      ]),
    )

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
  const extraFilters = [hospitalId, procedureId, companyId, robotId, stage].filter(Boolean).length

  if (doctors.isLoading) return <Spinner />
  if (doctors.error && !doctors.data) return <ErrorState error={doctors.error} />

  const visible = shown.slice(0, limit)

  const segment = (label: string, value: StatusFilter, n: number) => (
    <button
      key={label}
      type="button"
      aria-pressed={status === value}
      onClick={() => {
        setStatus(value)
        if (value !== 'potential') setStage('')
      }}
      className={classNames('min-h-[40px] flex-1 whitespace-nowrap rounded-lg px-2 text-sm font-medium transition sm:px-4', status === value ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-600 hover:text-slate-800')}
    >
      {label} <span className={classNames('mr-0.5 text-xs', status === value ? 'text-brand-600' : 'text-slate-500')}>{n}</span>
    </button>
  )

  const quick = (label: string, n: number | null, active: boolean, onClick: () => void, tone: 'warn' | 'plain' | 'fav') => (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={classNames(
        'chip !px-3 !text-[13px]',
        active
          ? tone === 'warn'
            ? 'border-amber-400 bg-amber-100 text-amber-800 ring-1 ring-amber-300'
            : tone === 'fav'
              ? 'border-red-300 bg-red-50 text-red-600 ring-1 ring-red-200'
              : 'border-brand-400 bg-brand-50 text-brand-700 ring-1 ring-brand-200'
          : tone === 'warn' && n
            ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
      )}
    >
      {tone === 'fav' && <Heart size={13} fill={active ? 'currentColor' : 'none'} />}
      {label}
      {n !== null && <b className="font-semibold">{n}</b>}
    </button>
  )

  const select = 'input !w-full sm:!w-auto'

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div>
          <h1 className="text-2xl font-semibold text-brand-800 sm:text-3xl">רופאים</h1>
          <p className="hidden text-sm text-slate-500 sm:block">מי צריך קשר עכשיו, קצב הקשר, ניתוחים, נאמנות והמשפך של הפוטנציאליים</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary !px-3 sm:!px-4" onClick={() => setShowImport(true)}>
            <BookUser size={16} /> <span className="hidden sm:inline">ייבוא איש קשר</span>
            <span className="sm:hidden">ייבוא</span>
          </button>
          <button className="btn-primary !px-3 sm:!px-4" onClick={() => setShowAdd(true)}>
            <Plus size={16} /> <span className="hidden sm:inline">הוספת רופא</span>
            <span className="sm:hidden">רופא חדש</span>
          </button>
        </div>
      </div>

      {/* who: one segmented row (no scrolling) and, under it, what needs attention */}
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
        {segment('הכל', '', counts.all)}
        {segment('לקוחות', 'client', counts.client)}
        {segment('פוטנציאליים', 'potential', counts.potential)}
        {counts.lost > 0 && segment('לא רלוונטי', 'lost', counts.lost)}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {quick('צריכים קשר', counts.need, only === 'need', () => setOnly(only === 'need' ? '' : 'need'), 'warn')}
        {quick('פרטים חסרים', counts.missing, only === 'missing', () => setOnly(only === 'missing' ? '' : 'missing'), 'plain')}
        {quick('מועדפים', null, only === 'fav', () => setOnly(only === 'fav' ? '' : 'fav'), 'fav')}
      </div>

      <div className="card space-y-2 p-2.5 sm:p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <Search size={16} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input !pr-10" type="search" enterKeyHint="search" aria-label="חיפוש רופא או בית חולים" placeholder="חיפוש רופא או בית חולים" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <button type="button" className={classNames('btn-secondary shrink-0 sm:hidden', extraFilters > 0 && '!border-brand-500 !bg-brand-50')} onClick={() => setFiltersOpen((o) => !o)} aria-expanded={filtersOpen}>
            <SlidersHorizontal size={16} /> סינון{extraFilters > 0 ? ` (${extraFilters})` : ''}
          </button>
          <div className={classNames('w-full gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center', filtersOpen ? 'grid grid-cols-2' : 'hidden')}>
            <select className={select} value={hospitalId} aria-label="בית חולים" onChange={(e) => setHospitalId(e.target.value)}>
              <option value="">כל בתי החולים</option>
              {(hospitals.data ?? []).map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
            <select className={select} value={procedureId} aria-label="הליך" onChange={(e) => setProcedureId(e.target.value)}>
              <option value="">כל ההליכים</option>
              {(procedures.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select className={select} value={companyId} aria-label="חברה" onChange={(e) => setCompanyId(e.target.value)}>
              <option value="">כל החברות</option>
              {(companies.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select className={select} value={robotId} aria-label="רובוט" onChange={(e) => setRobotId(e.target.value)}>
              <option value="">כל הרובוטים</option>
              {(systems.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {status === 'potential' && (
              <select className={select} value={stage} aria-label="שלב במשפך" onChange={(e) => setStage(e.target.value)}>
                <option value="">כל השלבים</option>
                {stageNames.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            )}
            <select className={select} value={windowDays} aria-label="היקף ניתוחים לתקופה" onChange={(e) => setWindowDays(Number(e.target.value))}>
              {WINDOWS.map((w) => (
                <option key={w.days} value={w.days}>
                  ניתוחים: {w.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <p className="shrink-0 text-sm text-slate-600" aria-live="polite">
          {shown.length} רופאים{anyFilter ? ` מתוך ${rows.length}` : ''}
        </p>
        {anyFilter && (
          <button type="button" className="shrink-0 px-1 text-sm font-medium text-brand-600 underline" onClick={clearAll}>
            נקה סינון
          </button>
        )}
        <select className="input !w-auto min-w-0 max-w-full flex-1 !min-h-[36px] !py-1 text-sm sm:!flex-none" value={sort} aria-label="מיון" onChange={(e) => setSort(e.target.value)}>
          {[...Object.entries(SORTS), ['stage', { label: 'שלב במשפך — המתקדם קודם' }] as [string, { label: string }]].map(([k, s]) => (
            <option key={k} value={k}>
              מיון: {s.label}
            </option>
          ))}
        </select>
        <button type="button" className="btn-ghost !px-2.5" onClick={exportCsv} aria-label="ייצוא הרשימה לאקסל" title="ייצוא לאקסל">
          <Download size={16} />
          <span className="hidden text-xs sm:inline">ייצוא לאקסל</span>
        </button>
      </div>

      {shown.length === 0 ? (
        rows.length === 0 ? (
          <EmptyState
            title="עוד אין רופאים"
            hint="הוסף את הרופא הראשון, או ייבא איש קשר מהטלפון"
            action={
              <button className="btn-primary" onClick={() => setShowAdd(true)}>
                <Plus size={16} /> הוספת רופא
              </button>
            }
          />
        ) : (
          <EmptyState
            title="אין רופא שמתאים לסינון"
            hint="נסה חיפוש אחר או הסר חלק מהמסננים"
            action={
              <button className="btn-secondary" onClick={clearAll}>
                נקה סינון
              </button>
            }
          />
        )
      ) : (
        <>
          {/* desktop: a table */}
          <div tabIndex={0} aria-label="טבלת רופאים" className="card hidden overflow-x-auto md:block">
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
                {visible.map((r) => (
                  <tr key={r.d.id} className="border-b border-slate-100 align-top hover:bg-slate-50">
                    <td className="p-2.5">
                      <Name row={r} />
                    </td>
                    <td className="p-2.5">
                      <StatusCell row={r} cases={casesNow.get(r.d.id)} since={stageSince.data?.get(r.d.id)?.since} onLost={setLostRow} />
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
                    <td className="p-2.5">{r.loyalty ? <span className={classNames('chip !px-2 !py-0 text-[12px]', LOYALTY_CHIP[r.loyalty])}>{LOYALTY_SHORT[r.loyalty]}</span> : <span className="text-xs text-slate-300">לא ידוע</span>}</td>
                    <td className="p-2.5">
                      <Actions row={r} fav={favSet.has(r.d.id)} onFav={() => toggleFav.mutate({ doctorId: r.d.id, isFavorite: favSet.has(r.d.id) })} onMeeting={() => setModal({ kind: 'meeting', doctorId: r.d.id })} onTask={() => setModal({ kind: 'task', doctorId: r.d.id })} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* phone: cards — the name and status first, then what to do about the doctor */}
          <ul className="space-y-2 md:hidden">
            {visible.map((r) => {
              const showSurgeries = r.surgeries > 0 || sort === 'surgeries'
              const extras = [...r.robots, ...r.companies].join(' · ')
              return (
                <li key={r.d.id} className="card space-y-1.5 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <Link to={`/doctors/${r.d.id}`} className="min-w-0 break-words text-base font-semibold leading-snug text-brand-700 hover:underline">
                      {r.d.title} {r.d.name}
                    </Link>
                    <div className="shrink-0">
                      <StatusSelect row={r} onLost={setLostRow} />
                    </div>
                  </div>
                  <Name inline hideLink row={r} />
                  <StatusInfo row={r} cases={casesNow.get(r.d.id)} since={stageSince.data?.get(r.d.id)?.since} />
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-600">
                    <NeedChip row={r} />
                    <span>{lastMeetingText(r)}</span>
                    {r.contact.nextMeeting && <span className="text-brand-700">הבאה: {formatDate(r.contact.nextMeeting)}</span>}
                  </div>
                  {(showSurgeries || r.loyalty || extras) && (
                    <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-600">
                      {showSurgeries && (
                        <span>
                          ניתוחים ({windowLabel}): <b className="text-sm text-brand-800">{r.surgeries}</b>
                        </span>
                      )}
                      {r.loyalty && <span className={classNames('chip !px-2 !py-0 text-[12px]', LOYALTY_CHIP[r.loyalty])}>{LOYALTY_SHORT[r.loyalty]}</span>}
                      {extras && <span>{extras}</span>}
                    </p>
                  )}
                  <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
                    <Actions compact row={r} fav={favSet.has(r.d.id)} onFav={() => toggleFav.mutate({ doctorId: r.d.id, isFavorite: favSet.has(r.d.id) })} onMeeting={() => setModal({ kind: 'meeting', doctorId: r.d.id })} onTask={() => setModal({ kind: 'task', doctorId: r.d.id })} />
                    <CadenceSelect row={r} className="min-w-[7.5rem] flex-1 sm:flex-none" />
                  </div>
                </li>
              )
            })}
          </ul>

          {shown.length > visible.length && (
            <div className="flex justify-center">
              <button type="button" className="btn-secondary" onClick={() => setLimit((l) => l + PAGE)}>
                הצג עוד ({shown.length - visible.length})
              </button>
            </div>
          )}
        </>
      )}

      <p className="flex items-start gap-1.5 text-xs text-slate-500">
        <AlertTriangle size={12} className="mt-0.5 shrink-0" /> "צריכים קשר": באיחור לפי קצב הקשר שהוגדר, או — כשאין קצב — לא נפגשנו {STALE_DAYS} יום ויותר. פגישה שכבר נקבעה מסירה את ההתראה.
      </p>

      {showAdd && <DoctorFormModal open={showAdd} onClose={() => setShowAdd(false)} />}
      {showImport && <SmartContactImport onClose={() => setShowImport(false)} />}
      {lostRow && <LostDialog row={lostRow} onClose={() => setLostRow(null)} />}
      {modal?.kind === 'meeting' && <MeetingFormModal open onClose={() => setModal(null)} defaultDoctorId={modal.doctorId} />}
      {modal?.kind === 'task' && <TaskFormModal defaults={{ doctor_id: modal.doctorId }} onClose={() => setModal(null)} />}
    </div>
  )
}
