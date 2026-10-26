import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Bot, Building2, CalendarDays, ChevronDown, Map as MapIcon, MapPin, Package, Phone, ScanLine, Stethoscope, User } from 'lucide-react'
import { useMapData, useMeetings, usePatientScans } from '../lib/api'
import { usePlannedSurgeries } from '../lib/plannedSurgeries'
import { HospitalActions, NavButtons } from '../components/HospitalActions'
import { HospitalCommercial } from '../components/HospitalCommercial'
import { ContactsSection } from '../components/ContactsSection'
import { LinkedTasks, useLinkedTasks } from '../components/LinkedTasks'
import { CompetitorSection } from '../components/CompetitorSection'
import { CaseVolumesEditor } from '../components/CaseVolumesEditor'
import { HospitalInfo, Locations } from '../components/HospitalInfo'
import { EmptyState, ErrorState, Spinner, Tab, TabList, TabPanel, Tabs } from '../components/ui'
import { DOCTOR_STATUS_LABELS, MEETING_STATUS_LABELS, SCAN_PROCEDURE_LABELS, SECTOR_LABELS } from '../lib/types'
import { classNames, daysUntil, formatDate, todayISO } from '../lib/utils'
import { DAY_NAMES, formatDays } from '../lib/clinics'
import { heldMeetings, lastMetByDoctor, nextMeeting as findNextMeeting, surgeryList, volumeComparison } from '../lib/hospitalView'

const PRIMARY_TABS = ['overview', 'doctors', 'contacts', 'tasks']
const MORE_TABS = ['meetings', 'surgeries', 'info', 'volumes', 'competitors']
const TABS = [...PRIMARY_TABS, ...MORE_TABS]

export default function HospitalView() {
  const { id } = useParams<{ id: string }>()
  const [params, setParams] = useSearchParams()
  const tab = TABS.includes(params.get('tab') ?? '') ? (params.get('tab') as string) : 'overview'

  const map = useMapData()
  const allMeetings = useMeetings()
  const surgeries = usePlannedSurgeries()
  const scans = usePatientScans()
  const linkedTasks = useLinkedTasks({ hospitalId: id })

  // the header, the next step and the numbers fill the first phone screen: opening a tab brings its content to the top
  const tabsTop = useRef<HTMLDivElement>(null)
  const [moreOpen, setMoreOpen] = useState(false) // phone: the rarely used tabs behind "עוד"
  const setTab = (t: string) => {
    setMoreOpen(false)
    setParams(t === 'overview' ? {} : { tab: t }, { replace: true })
    requestAnimationFrame(() => tabsTop.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }))
  }
  // a link with ?tab=… (e.g. from the home screen) lands on the tab, not above it
  const firstTab = useRef(tab)
  const loaded = !!(map.data ?? []).find((x) => x.id === id)
  useEffect(() => {
    if (loaded && firstTab.current !== 'overview') requestAnimationFrame(() => tabsTop.current?.scrollIntoView({ block: 'start' }))
  }, [loaded])

  const h = (map.data ?? []).find((x) => x.id === id) ?? null
  const today = todayISO()

  const meetings = useMemo(
    () =>
      (allMeetings.data ?? [])
        .filter((m) => m.hospital_id === id)
        .sort((a, b) => (b.meeting_date ?? '').localeCompare(a.meeting_date ?? '')),
    [allMeetings.data, id],
  )

  // last held meeting with each doctor (anywhere, not only at this hospital)
  const lastMetDoctor = useMemo(() => lastMetByDoctor(allMeetings.data ?? [], today), [allMeetings.data, today])

  // planned (non-MAKO) surgeries and MAKO surgeries from the scans, one list by date — no patient details
  const surgeryRows = useMemo(() => {
    const rows: { key: string; date: string; surgeon: string; what: string; cases: number; status: string }[] = []
    for (const s of surgeries.data ?? [])
      if (s.hospital_id === id)
        rows.push({
          key: `p-${s.id}`,
          date: s.surgery_date,
          surgeon: s.doctor ? `${s.doctor.title} ${s.doctor.name}` : '—',
          what: [s.procedure || 'ניתוח', s.company].filter(Boolean).join(' · '),
          cases: s.cases,
          status: s.status,
        })
    for (const s of scans.data ?? [])
      if (s.hospital_id === id && s.surgery_date)
        rows.push({
          key: `s-${s.id}`,
          date: s.surgery_date,
          surgeon: s.surgeon ? `${s.surgeon.title} ${s.surgeon.name}` : '—',
          what: `MAKO ${SCAN_PROCEDURE_LABELS[s.procedure_type] ?? s.procedure_type}${s.side ? ` · ${s.side}` : ''}`,
          cases: 1,
          status: s.status,
        })
    return rows.sort((a, b) => a.date.localeCompare(b.date))
  }, [surgeries.data, scans.data, id])

  if (map.isLoading) return <Spinner />
  if (map.error && !map.data) return <ErrorState error={map.error} />
  if (!h)
    return (
      <EmptyState
        title="בית החולים לא נמצא"
        hint="ייתכן שנמחק, או שהקישור שגוי"
        action={
          <Link to="/map" className="btn-secondary">
            לרשימת בתי החולים
          </Link>
        }
      />
    )

  const agents = h.hospital_agents.map((a) => a.agent).filter((a): a is NonNullable<typeof a> => !!a)
  const robotics = h.hospital_robotic_systems.map((r) => r.system?.name).filter((x): x is string => !!x)
  const hasMako = robotics.some((r) => r.toUpperCase().includes('MAKO'))
  const doctors = h.doctor_hospitals.filter((dh) => dh.doctor)
  // who to call: the contact that coordinates the CT appointments, else the first contact with a phone
  const callContact = h.contacts.find((c) => c.id === h.scan_contact_id && c.phone) ?? h.contacts.find((c) => c.phone) ?? null

  const pastMeetings = heldMeetings(meetings, today)
  const lastMeeting = pastMeetings[0]?.meeting_date ?? null
  const daysSince = lastMeeting ? -(daysUntil(lastMeeting) ?? 0) : null
  const nextMeeting = findNextMeeting(meetings, today)
  const { upcoming, shown: shownSurgeries } = surgeryList(surgeryRows, today)
  const in30 = upcoming.filter((s) => (daysUntil(s.date) ?? 99) <= 30).reduce((n, s) => n + s.cases, 0)

  // case volumes: the latest year next to the year before
  const { year, prevYear, rows: volumeRows } = volumeComparison(h.case_volumes)

  const tabLabel: Record<string, string> = {
    overview: 'סקירה',
    doctors: `רופאים (${doctors.length})`,
    contacts: `אנשי קשר (${h.contacts.length})`,
    tasks: `משימות (${linkedTasks.open.length})`,
    meetings: `פגישות (${meetings.length})`,
    surgeries: `ניתוחים (${upcoming.length})`,
    info: 'מידע ומיקומים',
    volumes: 'כמויות מקרים',
    competitors: 'מתחרים',
  }
  const moreInTab = MORE_TABS.includes(tab)

  return (
    <div className="space-y-3 sm:space-y-5">
      <div className="card overflow-hidden">
        <div aria-hidden className="h-1.5 bg-gradient-to-l from-[#00326d] via-[#1863dc] to-[#cc3366]" />
        <div className="space-y-3 p-3.5 sm:space-y-4 sm:p-5">
          <div className="flex min-w-0 items-start gap-3 sm:gap-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#00326d] text-white sm:h-16 sm:w-16">
              <Building2 size={20} />
            </span>
            <div className="min-w-0">
              <h1 className="no-accent break-words text-xl font-semibold leading-snug text-brand-800 sm:text-3xl">{h.name}</h1>
              <p className="text-sm text-slate-500 sm:text-base">
                {[h.address, h.city].filter(Boolean).join(', ') || '—'}
                {h.organization ? ` · ${h.organization.name}` : ''}
                {h.sector ? ` · ${SECTOR_LABELS[h.sector] ?? h.sector}` : ''}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {robotics.map((r) => (
                  <span key={r} className="chip border-brand-200 bg-brand-50 text-brand-700">
                    <Bot size={12} /> {r}
                  </span>
                ))}
                {agents.map((a) => (
                  <Link key={a.id} to={`/agents/${a.id}`} className="chip border-slate-200 bg-white text-slate-600 hover:bg-slate-50 max-sm:!min-h-[40px]">
                    <User size={12} /> {a.full_name}
                  </Link>
                ))}
                {agents.length === 0 && <span className="chip border-amber-200 bg-amber-50 text-amber-700">לא הוגדר סוכן מטפל</span>}
              </div>
            </div>
          </div>

          {/* get there / call: the two things done on the way to a hospital */}
          <div className="flex flex-wrap items-center gap-2">
            <NavButtons hospital={h} />
            {callContact && (
              <a
                href={`tel:${callContact.phone}`}
                className="inline-flex min-h-[40px] items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
                aria-label={`התקשר ל${callContact.name}`}
              >
                <Phone size={15} aria-hidden />
                <span className="max-w-[10rem] truncate">{callContact.name}</span>
              </a>
            )}
          </div>

          <HospitalActions hospital={h} header />

          <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 pt-1 text-sm">
            <Link to={`/map?hospital=${h.id}`} className="inline-flex min-h-[40px] items-center gap-1 font-medium text-brand-600 hover:underline">
              <MapIcon size={14} /> הצג במפה
            </Link>
            {hasMako && (
              <>
                <Link to={`/scans?hospital=${h.id}`} className="inline-flex min-h-[40px] items-center gap-1 font-medium text-brand-600 hover:underline">
                  <ScanLine size={14} /> סריקות MAKO
                </Link>
                <Link to={`/consumables?hospital=${h.id}`} className="inline-flex min-h-[40px] items-center gap-1 font-medium text-brand-600 hover:underline">
                  <Package size={14} /> ספירת מתכלים
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      <HospitalCommercial hospital={h} />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3" role="group" aria-label="מדדים מהירים">
        <Kpi label="רופאים" value={doctors.length} onClick={() => setTab('doctors')} />
        <Kpi
          label="פגישה אחרונה"
          value={daysSince != null ? `לפני ${daysSince} ימים` : 'אין'}
          hint={lastMeeting ? formatDate(lastMeeting) : undefined}
          warn={daysSince == null || daysSince > 60}
          onClick={() => setTab('meetings')}
        />
        <Kpi label="ניתוחים ב-30 יום" value={in30} onClick={() => setTab('surgeries')} />
        <Kpi label="משימות פתוחות" value={linkedTasks.open.length} warn={linkedTasks.open.length > 0} onClick={() => setTab('tasks')} />
      </div>

      <div ref={tabsTop} className="scroll-mt-16" />
      <Tabs value={tab} onChange={setTab}>
        {/* a phone: the four everyday tabs and "עוד" (a grid of the rest) instead of nine tabs that scroll sideways; a wide screen: all of them */}
        <div className="sm:hidden [&_[role=tab]]:!px-1.5 [&_[role=tab]]:!text-[13px]">
          <TabList>
            {PRIMARY_TABS.map((t) => (
              <Tab key={t} id={t}>
                {t === 'doctors' ? 'רופאים' : t === 'contacts' ? 'אנשי קשר' : tabLabel[t]}
              </Tab>
            ))}
            <button
              type="button"
              aria-haspopup="true"
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen((v) => !v)}
              className={classNames(
                'inline-flex min-h-[40px] flex-1 shrink-0 items-center justify-center gap-0.5 whitespace-nowrap rounded-lg px-1.5 py-2 text-[13px] font-medium transition',
                moreInTab ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700',
              )}
            >
              {moreInTab ? tabLabel[tab] : 'עוד'}
              <ChevronDown size={14} aria-hidden className={classNames('transition', moreOpen && 'rotate-180')} />
            </button>
          </TabList>
          {moreOpen && (
            <div role="group" aria-label="עוד לשוניות" className="-mt-2 mb-4 grid grid-cols-2 gap-2" onKeyDown={(e) => e.key === 'Escape' && setMoreOpen(false)}>
              {MORE_TABS.map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-current={tab === t ? 'true' : undefined}
                  onClick={() => setTab(t)}
                  className={classNames(
                    'min-h-[44px] rounded-xl border px-3 py-2 text-sm font-medium',
                    tab === t ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-700',
                  )}
                >
                  {tabLabel[t]}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="hidden sm:block">
          <TabList>
            {TABS.map((t) => (
              <Tab key={t} id={t}>
                {tabLabel[t]}
              </Tab>
            ))}
          </TabList>
        </div>

        <TabPanel id="overview">
          <div className="grid gap-4 lg:grid-cols-2">
            <Section title="מה הלאה" icon={CalendarDays}>
              <ul className="space-y-1.5 text-sm text-slate-600">
                <li>
                  פגישה הבאה:{' '}
                  {nextMeeting ? (
                    <Link to={`/meetings/${nextMeeting.id}`} className="inline-flex min-h-[40px] items-center font-medium text-brand-600 hover:underline">
                      {formatDate(nextMeeting.meeting_date)} · {nextMeeting.subject || 'פגישה'}
                    </Link>
                  ) : (
                    <span className="text-slate-400">לא נקבעה</span>
                  )}
                </li>
                <li>
                  ניתוח הבא:{' '}
                  {upcoming[0] ? (
                    <span className="font-medium">
                      {formatDate(upcoming[0].date)} · {upcoming[0].surgeon} · {upcoming[0].what}
                    </span>
                  ) : (
                    <span className="text-slate-400">אין ניתוחים מתוכננים</span>
                  )}
                </li>
              </ul>
            </Section>

            <Section title={year ? `כמות מקרים ${year}${prevYear ? ` מול ${prevYear}` : ''}` : 'כמות מקרים'} icon={Stethoscope}>
              {volumeRows.length === 0 ? (
                <p className="text-sm text-slate-400">לא הוזנו כמויות מקרים</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {volumeRows.map((v) => {
                    const diff = prevYear ? v.now - v.prev : 0
                    return (
                      <li key={v.name} className="flex items-center justify-between gap-2 text-slate-600">
                        <span className="min-w-0 break-words">{v.name}</span>
                        <span className="shrink-0">
                          <span className="font-medium">{v.now}</span>
                          {prevYear != null && diff !== 0 && (
                            <span className={classNames('mr-2 text-xs', diff > 0 ? 'text-green-600' : 'text-red-500')}>
                              {diff > 0 ? '▲' : '▼'} {Math.abs(diff)}
                            </span>
                          )}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Section>

            <Section title="איפה נמצאים" icon={MapPin} className="lg:col-span-2">
              <Locations hospitalId={h.id} compact />
              <button type="button" className="mt-1 inline-flex min-h-[40px] items-center text-sm font-medium text-brand-600 hover:underline" onClick={() => setTab('info')}>
                מידע, הערכת מקרים ומיקומים ←
              </button>
            </Section>

            <Section title="פגישות אחרונות" icon={CalendarDays} className="lg:col-span-2">
              <MeetingList meetings={pastMeetings.slice(0, 3)} />
            </Section>
          </div>
        </TabPanel>

        <TabPanel id="doctors">
          {doctors.length === 0 ? (
            <EmptyState title="אין רופאים משויכים" hint="משייכים רופא לבית חולים בכרטיס הרופא" />
          ) : (
            <>
            <ClinicSchedule doctors={doctors} />
            <div className="grid gap-2 sm:grid-cols-2">
              {doctors.map((dh) => {
                const d = dh.doctor!
                const last = lastMetDoctor.get(d.id)
                const ago = last ? -(daysUntil(last) ?? 0) : null
                return (
                  <Link key={d.id} to={`/doctors/${d.id}`} className="card block p-4 hover:border-brand-200">
                    <p className="flex flex-wrap items-center gap-1 font-medium text-slate-800">
                      {d.title} {d.name}
                      {d.status === 'potential' && (
                        <span className="chip border-amber-200 bg-amber-50 text-amber-700">{DOCTOR_STATUS_LABELS.potential}</span>
                      )}
                    </p>
                    {(dh.role_at_hospital || d.position) && <p className="text-sm text-slate-500">{dh.role_at_hospital || d.position}</p>}
                    {dh.clinic_days?.length > 0 && (
                      <p className="mt-0.5 text-xs text-brand-700">
                        מרפאה: {formatDays(dh.clinic_days)}
                        {dh.clinic_hours ? ` · ${dh.clinic_hours}` : ''}
                      </p>
                    )}
                    <p className={classNames('mt-1 text-xs', ago == null || ago > 90 ? 'text-amber-600' : 'text-slate-400')}>
                      {last ? `פגישה אחרונה ${formatDate(last)} (לפני ${ago} ימים)` : 'עוד לא נפגשנו'}
                    </p>
                  </Link>
                )
              })}
            </div>
            </>
          )}
        </TabPanel>

        <TabPanel id="contacts">
          <ContactsSection hospitalId={h.id} />
        </TabPanel>

        <TabPanel id="meetings">
          <MeetingList meetings={meetings} />
        </TabPanel>

        <TabPanel id="surgeries">
          {surgeryRows.length === 0 ? (
            <EmptyState title="אין ניתוחים בבית חולים זה" hint="ניתוח חדש — בכפתור 'ניתוח' למעלה" />
          ) : (
            <div className="card divide-y divide-slate-100">
              {shownSurgeries.map((s) => (
                <div key={s.key} className="flex items-start justify-between gap-3 p-3 text-sm">
                  <div className="min-w-0">
                    <p className={classNames('break-words font-medium', s.status === 'cancelled' ? 'text-slate-500 line-through' : 'text-slate-700')}>
                      {s.what}
                      {s.cases > 1 ? ` × ${s.cases}` : ''}
                    </p>
                    <p className="break-words text-xs text-slate-500">
                      {s.surgeon}
                      {s.status === 'cancelled' ? ' · בוטל' : s.status === 'done' ? ' · בוצע' : s.date < today ? ' · טרם עודכן' : ''}
                    </p>
                  </div>
                  <span className={classNames('shrink-0 text-xs', s.date >= today && s.status === 'planned' ? 'font-medium text-brand-600' : 'text-slate-500')}>
                    {formatDate(s.date)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </TabPanel>

        <TabPanel id="info">
          <HospitalInfo hospitalId={h.id} />
        </TabPanel>

        <TabPanel id="volumes">
          {doctors.length === 0 ? (
            <EmptyState title="שייך תחילה רופאים" hint="כמויות המקרים מוזנות לפי רופא" />
          ) : (
            <CaseVolumesEditor
              hospitalId={h.id}
              entityOptions={doctors.map((dh) => ({ id: dh.doctor!.id, label: `${dh.doctor!.title} ${dh.doctor!.name}` }))}
            />
          )}
        </TabPanel>

        <TabPanel id="tasks">
          <LinkedTasks hospitalId={h.id} />
        </TabPanel>

        <TabPanel id="competitors">
          <CompetitorSection hospitalId={h.id} />
        </TabPanel>
      </Tabs>
    </div>
  )
}

function Kpi({ label, value, hint, warn, onClick }: { label: string; value: string | number; hint?: string; warn?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="card flex min-h-[52px] flex-col justify-center px-3 py-1.5 text-right transition hover:border-brand-200 sm:p-4">
      <span className="text-xs leading-tight text-slate-500">{label}</span>
      <span className="flex flex-wrap items-baseline gap-x-2">
        <span className={classNames('text-base font-semibold leading-tight sm:mt-1 sm:text-xl', warn ? 'text-amber-700' : 'text-brand-800')}>{value}</span>
        {hint && <span className="text-xs text-slate-500">{hint}</span>}
      </span>
    </button>
  )
}

function Section({ title, icon: Icon, className, children }: { title: string; icon: typeof Bot; className?: string; children: React.ReactNode }) {
  return (
    <div className={classNames('card p-4', className)}>
      <p className="mb-2 flex items-center gap-1 text-sm font-semibold text-slate-600">
        <Icon size={12} /> {title}
      </p>
      {children}
    </div>
  )
}

function MeetingList({ meetings }: { meetings: NonNullable<ReturnType<typeof useMeetings>['data']> }) {
  if (meetings.length === 0) return <p className="text-sm text-slate-400">עדיין לא תועדו פגישות בבית חולים זה</p>
  return (
    <div className="space-y-2">
      {meetings.map((m) => {
        const who = [
          ...m.meeting_doctors.flatMap((d) => (d.doctor ? [d.doctor.name] : [])),
          ...m.meeting_contacts.flatMap((c) => (c.contact ? [c.contact.name] : [])),
        ].join(', ')
        return (
          <Link key={m.id} to={`/meetings/${m.id}`} className="card block p-3 hover:border-brand-200">
            <div className="flex items-start justify-between gap-3">
              <p className="line-clamp-2 min-w-0 break-words font-medium text-slate-800">{m.subject || 'פגישה'}</p>
              <span className="shrink-0 text-sm text-slate-400">{formatDate(m.meeting_date)}</span>
            </div>
            <p className="text-sm text-slate-500">
              {MEETING_STATUS_LABELS[m.status]}
              {who ? ` · ${who}` : ''}
            </p>
          </Link>
        )
      })}
    </div>
  )
}

/** which doctors receive on which day of the week at this hospital */
function ClinicSchedule({ doctors }: { doctors: { clinic_days: number[]; clinic_hours: string; clinic_note: string; doctor: { id: string; name: string; title: string } | null }[] }) {
  const byDay = DAY_NAMES.map((name, day) => ({
    name,
    list: doctors.filter((dh) => dh.doctor && (dh.clinic_days ?? []).includes(day)),
  })).filter((d) => d.list.length > 0)
  if (byDay.length === 0) return null
  return (
    <section className="card mb-3 p-4" aria-label="מרפאות לפי יום">
      <h2 className="mb-2 text-base font-semibold text-slate-800">מרפאות לפי יום</h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
        {byDay.map(({ name, list }) => (
          <div key={name} className="contents">
            <dt className="font-medium text-slate-700">{name}</dt>
            <dd className="min-w-0 space-y-0.5 text-slate-600">
              {list.map((dh) => (
                <div key={dh.doctor!.id} className="flex flex-wrap items-baseline gap-x-2">
                  <Link to={`/doctors/${dh.doctor!.id}`} className="inline-flex min-h-[40px] items-center hover:underline sm:min-h-[24px]">
                    {dh.doctor!.title} {dh.doctor!.name}
                  </Link>
                  {dh.clinic_hours ? (
                    <span className="text-xs text-slate-500" dir="ltr">
                      {dh.clinic_hours}
                    </span>
                  ) : null}
                </div>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
