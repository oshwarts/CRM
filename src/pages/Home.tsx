import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Building2,
  Clock,
  Heart,
  ScanLine,
  Stethoscope,
  Target,
  X,
} from 'lucide-react'
import {
  useDoctors,
  useFavorites,
  useMeetings,
  usePatientScans,
  useToggleFavorite,
} from '../lib/api'
import { useAuth } from '../context/AuthProvider'
import { EmptyState, Spinner } from '../components/ui'
import { classNames, daysUntil, formatDate, isOverdue, todayISO } from '../lib/utils'

export default function Home() {
  const { user, profile } = useAuth()
  const doctors = useDoctors()
  const favorites = useFavorites()
  const meetings = useMeetings()
  const scans = usePatientScans()
  const toggleFav = useToggleFavorite()
  const [toAdd, setToAdd] = useState('')

  const scanAlerts = useMemo(() => {
    const t = todayISO()
    const list = scans.data ?? []
    const active = list.filter((s) => s.status !== 'cancelled')
    const surgerySoon = (s: (typeof list)[number]) =>
      !!s.surgery_date && s.surgery_date >= t && (daysUntil(s.surgery_date) ?? 99) <= 7
    return {
      upcoming: list.filter(
        (s) => s.ct_date && s.ct_date >= t && (daysUntil(s.ct_date) ?? 99) <= 7 && !s.scanned,
      ),
      overdue: list.filter(
        (s) => s.ct_date && s.ct_date < t && !s.scanned && s.status !== 'cancelled',
      ),
      // ניתוח בשבוע הקרוב, ועדיין אין תאריך CT מתואם
      noCtSoon: active.filter((s) => surgerySoon(s) && !s.ct_date),
      // ניתוח בשבוע הקרוב, יש CT אבל הדיסק טרם נאסף
      noDiskSoon: active.filter(
        (s) => surgerySoon(s) && !!s.ct_date && !s.disk_collected,
      ),
    }
  }, [scans.data])

  const favIds = favorites.data ?? []
  const favSet = new Set(favIds)
  const allDoctors = doctors.data ?? []
  const favDoctors = allDoctors.filter((d) => favSet.has(d.id))
  const potentialDoctors = allDoctors.filter((d) => d.status === 'potential')

  const nextMeetingByDoctor = useMemo(() => {
    const map = new Map<string, string>()
    const today = new Date().toISOString().slice(0, 10)
    for (const m of meetings.data ?? []) {
      if (!m.meeting_date || m.meeting_date < today) continue
      for (const md of m.meeting_doctors) {
        if (!md.doctor) continue
        const cur = map.get(md.doctor.id)
        if (!cur || m.meeting_date < cur) map.set(md.doctor.id, m.meeting_date)
      }
    }
    return map
  }, [meetings.data])

  const followups = useMemo(() => {
    return (meetings.data ?? [])
      .filter(
        (m) =>
          m.next_followup_date &&
          m.status !== 'done' &&
          m.status !== 'cancelled' &&
          (!m.responsible_agent_id || m.responsible_agent_id === user?.id),
      )
      .sort((a, b) =>
        (a.next_followup_date ?? '').localeCompare(b.next_followup_date ?? ''),
      )
  }, [meetings.data, user?.id])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">
          שלום{profile?.full_name ? `, ${profile.full_name}` : ''}
        </h1>
        <p className="text-sm text-slate-400">
          הרופאים המועדפים שלך ומעקב הפגישות במקום אחד
        </p>
      </div>

      {/* follow-ups */}
      <section className="card p-5">
        <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-800">
          <Clock size={18} className="text-brand-500" />
          מעקב פגישות
        </h2>
        {meetings.isLoading ? (
          <Spinner />
        ) : followups.length === 0 ? (
          <p className="text-sm text-slate-400">אין פגישות שממתינות למעקב.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {followups.map((m) => {
              const overdue = isOverdue(m.next_followup_date)
              return (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-700">
                      {m.subject || 'פגישה'}
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      {m.meeting_doctors
                        .map((d) => d.doctor && `${d.doctor.title} ${d.doctor.name}`)
                        .filter(Boolean)
                        .join(', ') || '—'}
                    </p>
                  </div>
                  <span
                    className={classNames(
                      'chip shrink-0',
                      overdue
                        ? 'border-red-200 bg-red-50 text-red-600'
                        : 'border-amber-200 bg-amber-50 text-amber-700',
                    )}
                  >
                    {overdue ? 'באיחור · ' : ''}
                    {formatDate(m.next_followup_date)}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* MAKO scans */}
      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold text-slate-800">
            <ScanLine size={18} className="text-brand-500" />
            סריקות MAKO
          </h2>
          <Link to="/scans" className="text-sm font-medium text-brand-600 hover:underline">
            לכל הסריקות →
          </Link>
        </div>
        {scans.isLoading ? (
          <Spinner />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Link to="/scans" className="rounded-lg bg-slate-50 p-3 text-center hover:bg-slate-100">
                <p className="text-2xl font-bold text-slate-800">{scans.data?.length ?? 0}</p>
                <p className="text-xs text-slate-400">סה״כ מטופלים</p>
              </Link>
              <Link
                to="/scans"
                className={classNames(
                  'rounded-lg p-3 text-center',
                  scanAlerts.upcoming.length ? 'bg-amber-50 hover:bg-amber-100' : 'bg-slate-50',
                )}
              >
                <p className="text-2xl font-bold text-amber-600">{scanAlerts.upcoming.length}</p>
                <p className="text-xs text-slate-400">CT בשבוע הקרוב</p>
              </Link>
              <Link
                to="/scans"
                className={classNames(
                  'rounded-lg p-3 text-center',
                  scanAlerts.overdue.length ? 'bg-red-50 hover:bg-red-100' : 'bg-slate-50',
                )}
              >
                <p className="text-2xl font-bold text-red-600">{scanAlerts.overdue.length}</p>
                <p className="text-xs text-slate-400">CT עבר — טרם נסרק</p>
              </Link>
            </div>

            <p className="mb-2 mt-4 text-xs font-medium uppercase tracking-wide text-slate-400">
              לקראת ניתוח בשבוע הקרוב
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Link
                to="/scans"
                className={classNames(
                  'rounded-lg p-3 text-center',
                  scanAlerts.noCtSoon.length ? 'bg-fuchsia-50 hover:bg-fuchsia-100' : 'bg-slate-50',
                )}
              >
                <p className="text-2xl font-bold text-fuchsia-600">{scanAlerts.noCtSoon.length}</p>
                <p className="text-xs text-slate-400">ניתוח השבוע — אין תאריך CT מתואם</p>
              </Link>
              <Link
                to="/scans"
                className={classNames(
                  'rounded-lg p-3 text-center',
                  scanAlerts.noDiskSoon.length ? 'bg-orange-50 hover:bg-orange-100' : 'bg-slate-50',
                )}
              >
                <p className="text-2xl font-bold text-orange-600">{scanAlerts.noDiskSoon.length}</p>
                <p className="text-xs text-slate-400">ניתוח השבוע — הדיסק לא נאסף</p>
              </Link>
            </div>
          </>
        )}
        {scanAlerts.upcoming.length > 0 && (
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {scanAlerts.upcoming.slice(0, 5).map((s) => (
              <li key={s.id} className="flex items-center justify-between py-1.5">
                <span className="text-slate-700">
                  {s.patient_name}
                  <span className="mr-2 text-xs text-slate-400">
                    {s.hospital?.name}
                  </span>
                </span>
                <span className="chip border-amber-200 bg-amber-50 text-amber-700">
                  CT {formatDate(s.ct_date)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {scanAlerts.noCtSoon.length > 0 && (
          <ul className="mt-2 divide-y divide-slate-100 text-sm">
            {scanAlerts.noCtSoon.slice(0, 5).map((s) => (
              <li key={s.id} className="flex items-center justify-between py-1.5">
                <span className="text-slate-700">
                  {s.patient_name}
                  <span className="mr-2 text-xs text-slate-400">{s.hospital?.name}</span>
                </span>
                <span className="chip border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700">
                  ניתוח {formatDate(s.surgery_date)} · אין CT
                </span>
              </li>
            ))}
          </ul>
        )}
        {scanAlerts.noDiskSoon.length > 0 && (
          <ul className="mt-2 divide-y divide-slate-100 text-sm">
            {scanAlerts.noDiskSoon.slice(0, 5).map((s) => (
              <li key={s.id} className="flex items-center justify-between py-1.5">
                <span className="text-slate-700">
                  {s.patient_name}
                  <span className="mr-2 text-xs text-slate-400">{s.hospital?.name}</span>
                </span>
                <span className="chip border-orange-200 bg-orange-50 text-orange-700">
                  ניתוח {formatDate(s.surgery_date)} · דיסק לא נאסף
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* potential doctors */}
      {potentialDoctors.length > 0 && (
        <section className="card p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-800">
            <Target size={18} className="text-amber-500" />
            רופאים פוטנציאליים במעקב ({potentialDoctors.length})
          </h2>
          <ul className="divide-y divide-slate-100">
            {potentialDoctors.map((d) => (
              <li key={d.id} className="py-2">
                <Link
                  to={`/doctors/${d.id}`}
                  className="block rounded-lg px-2 py-1 hover:bg-slate-50"
                >
                  <p className="text-sm font-medium text-slate-700">
                    {d.title} {d.name}
                    <span className="mr-2 text-xs font-normal text-slate-400">
                      {d.doctor_hospitals
                        .map((h) => h.hospital?.name)
                        .filter(Boolean)
                        .join(', ')}
                    </span>
                  </p>
                  {d.tracking_notes && (
                    <p className="truncate text-xs text-slate-500">
                      {d.tracking_notes}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* favorites picker */}
      <section className="card p-5">
        <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-800">
          <Heart size={18} className="text-red-500" />
          רופאים מועדפים
        </h2>
        <div className="flex flex-wrap gap-2">
          <select
            className="input max-w-xs"
            value={toAdd}
            onChange={(e) => {
              const id = e.target.value
              setToAdd('')
              if (id && !favSet.has(id))
                toggleFav.mutate({ doctorId: id, isFavorite: false })
            }}
          >
            <option value="">בחר רופא להוספה למועדפים…</option>
            {allDoctors
              .filter((d) => !favSet.has(d.id))
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title} {d.name}
                </option>
              ))}
          </select>
        </div>

        {favDoctors.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {favDoctors.map((d) => (
              <span
                key={d.id}
                className="chip border-red-200 bg-red-50 text-red-600"
              >
                {d.title} {d.name}
                <button
                  onClick={() =>
                    toggleFav.mutate({ doctorId: d.id, isFavorite: true })
                  }
                  aria-label="הסר"
                >
                  <X size={13} />
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* favorite doctor cards */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-800">
          <Stethoscope size={18} className="text-brand-500" />
          הרופאים המועדפים שלי
        </h2>

        {favorites.isLoading || doctors.isLoading ? (
          <Spinner />
        ) : favDoctors.length === 0 ? (
          <EmptyState
            title="עדיין לא סימנת רופאים מועדפים"
            hint="בחר רופאים מהרשימה למעלה כדי לראות אותם כאן"
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {favDoctors.map((d) => {
              const next = nextMeetingByDoctor.get(d.id)
              return (
                <Link
                  key={d.id}
                  to={`/doctors/${d.id}`}
                  className="card flex flex-col gap-3 p-4 hover:border-brand-200"
                >
                  <div className="flex items-center gap-3">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-500 text-white">
                      <Stethoscope size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-800">
                        {d.title} {d.name}
                      </p>
                      <p className="truncate text-sm text-slate-500">
                        {d.position || '—'}
                      </p>
                    </div>
                  </div>

                  <div
                    className={classNames(
                      'rounded-lg px-3 py-2 text-sm',
                      next
                        ? 'bg-brand-50 text-brand-700'
                        : 'bg-slate-50 text-slate-400',
                    )}
                  >
                    <Clock size={13} className="ml-1 inline" />
                    {next ? `פגישה קרובה: ${formatDate(next)}` : 'אין פגישות מתועדות'}
                  </div>

                  {d.doctor_hospitals.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
                      <Building2 size={13} />
                      {d.doctor_hospitals.slice(0, 3).map((h) => (
                        <span
                          key={h.hospital_id}
                          className="chip border-slate-200 bg-white text-slate-500"
                        >
                          {h.hospital?.name ?? '—'}
                        </span>
                      ))}
                      {d.doctor_hospitals.length > 3 && (
                        <span className="chip border-slate-200 bg-white text-slate-400">
                          +{d.doctor_hospitals.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
