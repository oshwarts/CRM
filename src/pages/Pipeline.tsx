import { Link } from 'react-router-dom'
import { Building2, Clock, Target } from 'lucide-react'
import { usePipelineDoctors, type PipelineDoctor } from '../lib/api'
import { EmptyState, ErrorState, Spinner } from '../components/ui'
import { CURRENT_YEAR } from '../lib/types'
import { classNames, formatDate, isOverdue } from '../lib/utils'

export default function Pipeline() {
  const doctors = usePipelineDoctors()

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">רופאים פוטנציאליים</h1>
        <p className="text-sm text-slate-400">
          רופאים שעדיין לא עובדים איתנו – כמה מקרים הם עושים, עם מי, ואיפה עומד התהליך
        </p>
      </div>

      {doctors.isLoading && <Spinner />}
      {doctors.error && <ErrorState error={doctors.error} />}
      {doctors.data && doctors.data.length === 0 && (
        <EmptyState
          title="אין רופאים פוטנציאליים"
          hint="סמן רופא כ'פוטנציאלי' בכרטיס הרופא כדי שיופיע כאן"
        />
      )}

      <div className="space-y-3">
        {(doctors.data ?? []).map((d) => (
          <PipelineCard key={d.id} d={d} />
        ))}
      </div>
    </div>
  )
}

function PipelineCard({ d }: { d: PipelineDoctor }) {
  const hospitals = d.doctor_hospitals
    .map((h) => h.hospital?.name)
    .filter(Boolean)
  const robotics = d.doctor_robotic_systems
    .map((r) => r.system?.name)
    .filter(Boolean)

  // volumes by year
  const byYear = new Map<number, number>()
  const byCompany = new Map<string, number>()
  for (const v of d.case_volumes) {
    byYear.set(v.year, (byYear.get(v.year) ?? 0) + v.count)
    const c = v.company?.name ?? 'לא ידוע'
    byCompany.set(c, (byCompany.get(c) ?? 0) + v.count)
  }
  const currentYearTotal = byYear.get(CURRENT_YEAR) ?? 0
  const totalAll = [...byYear.values()].reduce((s, n) => s + n, 0)

  const overdue = isOverdue(d.next_step_date)

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            to={`/doctors/${d.id}`}
            className="font-semibold text-slate-800 hover:text-brand-600"
          >
            {d.title} {d.name}
          </Link>
          <p className="text-sm text-slate-500">{d.position || '—'}</p>
          {hospitals.length > 0 && (
            <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
              <Building2 size={12} />
              {hospitals.join(', ')}
            </p>
          )}
        </div>
        <div className="text-left">
          {d.pipeline_stage && (
            <span className="chip border-brand-200 bg-brand-50 text-brand-700">
              <Target size={12} />
              {d.pipeline_stage}
            </span>
          )}
          {d.next_step_date && (
            <p
              className={classNames(
                'mt-1 inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs',
                overdue
                  ? 'bg-red-50 text-red-600'
                  : 'bg-amber-50 text-amber-700',
              )}
            >
              <Clock size={11} />
              צעד הבא: {formatDate(d.next_step_date)}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-slate-50 p-2 text-center">
          <p className="text-lg font-bold text-slate-800">{currentYearTotal}</p>
          <p className="text-xs text-slate-400">מקרים {CURRENT_YEAR}</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-2 text-center">
          <p className="text-lg font-bold text-slate-800">{totalAll}</p>
          <p className="text-xs text-slate-400">סה״כ מקרים בתיעוד</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-2 text-center">
          <p className="text-sm font-medium text-slate-700">
            {robotics.length ? robotics.join(', ') : '—'}
          </p>
          <p className="text-xs text-slate-400">רובוטיקה בשימוש</p>
        </div>
      </div>

      {byCompany.size > 0 && (
        <p className="mt-2 text-xs text-slate-500">
          <span className="font-medium">עובד עם: </span>
          {[...byCompany.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([name, n]) => `${name} (${n})`)
            .join(' · ')}
        </p>
      )}

      {d.tracking_notes && (
        <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-2 text-sm text-slate-600">
          {d.tracking_notes}
        </p>
      )}
    </div>
  )
}
