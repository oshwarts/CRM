import { useMemo } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Bot, Building2, CalendarDays, Map as MapIcon, Package, ScanLine, Stethoscope, User } from 'lucide-react'
import { useMapData, useMeetings, usePatientScans } from '../lib/api'
import { usePlannedSurgeries } from '../lib/plannedSurgeries'
import { HospitalActions } from '../components/HospitalActions'
import { HospitalCommercial } from '../components/HospitalCommercial'
import { ContactsSection } from '../components/ContactsSection'
import { LinkedTasks, useLinkedTasks } from '../components/LinkedTasks'
import { CompetitorSection } from '../components/CompetitorSection'
import { CaseVolumesEditor } from '../components/CaseVolumesEditor'
import { EmptyState, ErrorState, Spinner, Tab, TabList, TabPanel, Tabs } from '../components/ui'
import { DOCTOR_STATUS_LABELS, MEETING_STATUS_LABELS, SCAN_PROCEDURE_LABELS, SECTOR_LABELS } from '../lib/types'
import { classNames, daysUntil, formatDate, todayISO } from '../lib/utils'
import { DAY_NAMES, formatDays } from '../lib/clinics'

const TABS = ['overview', 'doctors', 'contacts', 'meetings', 'surgeries', 'volumes', 'tasks', 'competitors']

export default function HospitalView() {
  const { id } = useParams<{ id: string }>()
  const [params, setParams] = useSearchParams()
  const tab = TABS.includes(params.get('tab') ?? '') ? (params.get('tab') as string) : 'overview'
  const setTab = (t: string) => setParams(t === 'overview' ? {} : { tab: t }, { replace: true })

  const map = useMapData()
  const allMeetings = useMeetings()
  const surgeries = usePlannedSurgeries()
  const scans = usePatientScans()
  const linkedTasks = useLinkedTasks({ hospitalId: id })

  const h = (map.data ?? []).find((x) => x.id === id) ?? null
  const today = todayISO()

  const meetings = useMemo(
    () =>
      (allMeetings.data ?? [])
        .filter((m) => m.hospital_id === id)
        .sort((a, b) => (b.meeting_date ?? '').localeCompare(a.meeting_date ?? '')),
    [allMeetings.data, id],
  )

  // last meeting with each doctor (anywhere, not only at this hospital)
  const lastMetDoctor = useMemo(() => {
    const m = new Map<string, string>()
    for (const mt of allMeetings.data ?? []) {
      if (!mt.meeting_date || mt.meeting_date > today || mt.status === 'cancelled') continue
      for (const d of mt.meeting_doctors) if (d.doctor && (m.get(d.doctor.id) ?? '') < mt.meeting_date) m.set(d.doctor.id, mt.meeting_date)
    }
    return m
  }, [allMeetings.data, today])

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
  if (!h) return <EmptyState title="בית החולים לא נמצא" />

  const agents = h.hospital_agents.map((a) => a.agent).filter((a): a is NonNullable<typeof a> => !!a)
  const robotics = h.hospital_robotic_systems.map((r) => r.system?.name).filter((x): x is string => !!x)
  const hasMako = robotics.some((r) => r.toUpperCase().includes('MAKO'))
  const doctors = h.doctor_hospitals.filter((dh) => dh.doctor)

  const pastMeetings = meetings.filter((m) => m.meeting_date && m.meeting_date <= today && m.status !== 'cancelled')
  const lastMeeting = pastMeetings[0]?.meeting_date ?? null
  const daysSince = lastMeeting ? -(daysUntil(lastMeeting) ?? 0) : null
  const nextMeeting = [...meetings].reverse().find((m) => m.meeting_date && m.meeting_date > today && m.status === 'scheduled') ?? null
  const upcoming = surgeryRows.filter((s) => s.date >= today && s.status === 'planned')
  const in30 = upcoming.filter((s) => (daysUntil(s.date) ?? 99) <= 30).reduce((n, s) => n + s.cases, 0)

  // case volumes: the latest year next to the year before
  const years = [...new Set(h.case_volumes.map((v) => v.year))].sort((a, b) => b - a)
  const [year, prevYear] = years
  const volumes = new Map<string, { now: number; prev: number }>()
  for (const v of h.case_volumes) {
    if (v.year !== year && v.year !== prevYear) continue
    const name = v.procedure?.name ?? '—'
    const cur = volumes.get(name) ?? { now: 0, prev: 0 }
    if (v.year === year) cur.now += v.count
    else cur.prev += v.count
    volumes.set(name, cur)
  }
  const volumeRows = [...volumes.entries()].filter(([, v]) => v.now > 0 || v.prev > 0).sort((a, b) => b[1].now - a[1].now)

  return (
    <div className="space-y-3 sm:space-y-5">
      <div className="card overflow-hidden">
        <div aria-hidden className="h-1.5 bg-gradient-to-l from-[#00326d] via-[#1863dc] to-[#cc3366]" />
        <div className="space-y-3 p-4 sm:space-y-4 sm:p-5">
          <div className="flex min-w-0 items-start gap-3 sm:gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#00326d] text-white sm:h-16 sm:w-16">
              <Building2 size={22} />
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
                  <Link key={a.id} to={`/agents/${a.id}`} className="chip border-slate-200 bg-white text-slate-600 hover:bg-slate-50">
                    <User size={12} /> {a.full_name}
                  </Link>
                ))}
                {agents.length === 0 && <span className="chip border-amber-200 bg-amber-50 text-amber-700">לא הוגדר סוכן מטפל</span>}
              </div>
            </div>
          </div>

          <HospitalActions hospital={h} />

          <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 pt-2 text-sm sm:pt-4">
            <Link to={`/map?hospital=${h.id}`} className="inline-flex items-center gap-1 font-medium text-brand-600 hover:underline">
              <MapIcon size={14} /> הצג במפה
            </Link>
            {hasMako && (
              <>
                <Link to={`/scans?hospital=${h.id}`} className="inline-flex items-center gap-1 font-medium text-brand-600 hover:underline">
                  <ScanLine size={14} /> סריקות MAKO
                </Link>
                <Link to={`/consumables?hospital=${h.id}`} className="inline-flex items-center gap-1 font-medium text-brand-600 hover:underline">
                  <Package size={14} /> ספירת מתכלים
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      <HospitalCommercial hospital={h} />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
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

      <Tabs value={tab} onChange={setTab}>
        <TabList>
          <Tab id="overview">סקירה</Tab>
          <Tab id="doctors">רופאים ({doctors.length})</Tab>
          <Tab id="contacts">אנשי קשר ({h.contacts.length})</Tab>
          <Tab id="meetings">פגישות ({meetings.length})</Tab>
          <Tab id="surgeries">ניתוחים ({upcoming.length})</Tab>
          <Tab id="volumes">כמויות מקרים</Tab>
          <Tab id="tasks">משימות ({linkedTasks.open.length})</Tab>
          <Tab id="competitors">מתחרים</Tab>
        </TabList>

        <TabPanel id="overview">
          <div className="grid gap-4 lg:grid-cols-2">
            <Section title="מה הלאה" icon={CalendarDays}>
              <ul className="space-y-1.5 text-sm text-slate-600">
                <li>
                  פגישה הבאה:{' '}
                  {nextMeeting ? (
                    <Link to={`/meetings/${nextMeeting.id}`} className="font-medium text-brand-600 hover:underline">
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
                  {volumeRows.map(([name, v]) => {
                    const diff = prevYear ? v.now - v.prev : 0
                    return (
                      <li key={name} className="flex items-center justify-between gap-2 text-slate-600">
                        <span className="min-w-0 truncate">{name}</span>
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
                    <p className="text-sm text-slate-500">{dh.role_at_hospital || d.position || '—'}</p>
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
              {[...upcoming, ...surgeryRows.filter((s) => !upcoming.includes(s)).reverse().slice(0, 20)].map((s) => (
                <div key={s.key} className={classNames('flex items-start justify-between gap-3 p-3 text-sm', s.status === 'cancelled' && 'opacity-50')}>
                  <div className="min-w-0">
                    <p className="font-medium text-slate-700">
                      {s.what}
                      {s.cases > 1 ? ` × ${s.cases}` : ''}
                    </p>
                    <p className="text-xs text-slate-400">{s.surgeon}</p>
                  </div>
                  <span className={classNames('shrink-0 text-xs', s.date >= today ? 'font-medium text-brand-600' : 'text-slate-400')}>
                    {formatDate(s.date)}
                  </span>
                </div>
              ))}
            </div>
          )}
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
    <button type="button" onClick={onClick} className="card px-3 py-2.5 text-right transition hover:border-brand-200 sm:p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={classNames('text-lg font-semibold leading-tight sm:mt-1 sm:text-xl', warn ? 'text-amber-700' : 'text-brand-800')}>{value}</p>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
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
              <p className="min-w-0 break-words font-medium text-slate-800">{m.subject || 'פגישה'}</p>
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
            <dd className="min-w-0 text-slate-600">
              {list.map((dh, i) => (
                <span key={dh.doctor!.id}>
                  {i > 0 && ', '}
                  <Link to={`/doctors/${dh.doctor!.id}`} className="hover:underline">
                    {dh.doctor!.title} {dh.doctor!.name}
                  </Link>
                  {dh.clinic_hours ? <span className="text-xs text-slate-500" dir="ltr"> {dh.clinic_hours}</span> : null}
                </span>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
