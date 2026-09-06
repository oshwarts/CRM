import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Heart, Plus, Search } from 'lucide-react'
import {
  useCompanies,
  useDoctorActivity,
  useDoctors,
  useFavorites,
  useHospitals,
  useProcedures,
  useToggleFavorite,
} from '../lib/api'
import { DoctorFormModal } from '../components/DoctorFormModal'
import { EmptyState, ErrorState, Spinner } from '../components/ui'
import { DOCTOR_STATUS_LABELS } from '../lib/types'
import { classNames, formatDate } from '../lib/utils'

export default function Doctors() {
  const doctors = useDoctors()
  const companies = useCompanies()
  const procedures = useProcedures()
  const hospitals = useHospitals()
  const favorites = useFavorites()
  const activity = useDoctorActivity()
  const toggleFav = useToggleFavorite()

  const [showAdd, setShowAdd] = useState(false)
  const [q, setQ] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [procedureId, setProcedureId] = useState('')
  const [hospitalId, setHospitalId] = useState('')
  const [status, setStatus] = useState('')

  const favSet = new Set(favorites.data ?? [])

  const filtered = useMemo(() => {
    const list = doctors.data ?? []
    return list.filter((d) => {
      if (q && !`${d.title} ${d.name} ${d.position}`.toLowerCase().includes(q.toLowerCase()))
        return false
      if (status && d.status !== status) return false
      if (companyId && !d.doctor_companies.some((c) => c.company_id === companyId))
        return false
      if (procedureId && !d.doctor_procedures.some((p) => p.procedure_id === procedureId))
        return false
      if (hospitalId && !d.doctor_hospitals.some((h) => h.hospital_id === hospitalId))
        return false
      return true
    })
  }, [doctors.data, q, status, companyId, procedureId, hospitalId])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">רופאים</h1>
          <p className="text-sm text-slate-400">
            {doctors.data ? `${doctors.data.length} רופאים במערכת` : ' '}
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowAdd(true)}>
          <Plus size={16} />
          הוספת רופא
        </button>
      </div>

      <div className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            className="input pr-9"
            placeholder="חיפוש לפי שם / תפקיד"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">כל הסטטוסים</option>
          {Object.entries(DOCTOR_STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select className="input" value={hospitalId} onChange={(e) => setHospitalId(e.target.value)}>
          <option value="">כל בתי החולים</option>
          {(hospitals.data ?? []).map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
        <select className="input" value={procedureId} onChange={(e) => setProcedureId(e.target.value)}>
          <option value="">כל ההליכים</option>
          {(procedures.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select className="input" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
          <option value="">כל החברות</option>
          {(companies.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {doctors.isLoading && <Spinner />}
      {doctors.error && <ErrorState error={doctors.error} />}
      {doctors.data && filtered.length === 0 && (
        <EmptyState
          title="לא נמצאו רופאים"
          hint="נסה לשנות את הסינון או הוסף רופא חדש"
        />
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((d) => {
          const isFav = favSet.has(d.id)
          const lastMeeting = activity.data?.[d.id]?.lastMeeting ?? null
          return (
            <div key={d.id} className="card flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between">
                <Link to={`/doctors/${d.id}`} className="min-w-0">
                  <p className="truncate font-semibold text-slate-800">
                    {d.title} {d.name}
                  </p>
                  <p className="truncate text-sm text-slate-500">
                    {d.position || '—'}
                  </p>
                  {d.status === 'potential' && (
                    <span className="chip mt-1 border-amber-200 bg-amber-50 text-amber-700">
                      {DOCTOR_STATUS_LABELS.potential}
                    </span>
                  )}
                </Link>
                <button
                  className={classNames(
                    'btn-ghost !px-2',
                    isFav ? 'text-red-500' : 'text-slate-300',
                  )}
                  onClick={() =>
                    toggleFav.mutate({ doctorId: d.id, isFavorite: isFav })
                  }
                  aria-label="מועדף"
                >
                  <Heart size={18} fill={isFav ? 'currentColor' : 'none'} />
                </button>
              </div>

              <div className="flex flex-wrap gap-1">
                {d.doctor_hospitals.slice(0, 3).map((h) => (
                  <span
                    key={h.hospital_id}
                    className="chip border-slate-200 bg-slate-50 text-slate-500"
                  >
                    {h.hospital?.name ?? '—'}
                  </span>
                ))}
                {d.doctor_hospitals.length > 3 && (
                  <span className="chip border-slate-200 bg-slate-50 text-slate-400">
                    +{d.doctor_hospitals.length - 3}
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-400">
                פעילות אחרונה:{' '}
                {lastMeeting ? formatDate(lastMeeting) : 'אין פגישות'}
              </p>

              <Link
                to={`/doctors/${d.id}`}
                className="mt-auto text-sm font-medium text-brand-600 hover:underline"
              >
                לכרטיס הרופא →
              </Link>
            </div>
          )
        })}
      </div>

      {showAdd && (
        <DoctorFormModal open={showAdd} onClose={() => setShowAdd(false)} />
      )}
    </div>
  )
}
