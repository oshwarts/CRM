import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Swords } from 'lucide-react'
import { useCompetitorIntel } from '../lib/api'
import { IntelFormModal } from '../components/CompetitorSection'
import { EmptyState, ErrorState, Spinner } from '../components/ui'
import { normalizeHe } from '../lib/contactMatch'
import type { CompetitorIntelRow } from '../lib/types'
import { classNames, formatDate } from '../lib/utils'

/** competitor activity across the whole system: who is active where, and what they offer */
export default function Competitors() {
  const intel = useCompetitorIntel()
  const [q, setQ] = useState('')
  const [competitor, setCompetitor] = useState('')
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<CompetitorIntelRow | null>(null)

  const all = intel.data ?? []
  const words = normalizeHe(q).split(' ').filter(Boolean)

  const list = useMemo(
    () =>
      all.filter((i) => {
        if (competitor && i.competitor !== competitor) return false
        if (!words.length) return true
        const hay = normalizeHe([i.competitor, i.product, i.offer, i.notes, i.doctor?.name, i.hospital?.name].filter(Boolean).join(' '))
        return words.every((w) => hay.includes(w))
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [all, q, competitor],
  )

  // per competitor: how many reports, in how many hospitals / by how many doctors
  const summary = useMemo(() => {
    const m = new Map<string, { n: number; hospitals: Set<string>; doctors: Set<string>; products: Set<string>; last: string }>()
    for (const i of all) {
      const e = m.get(i.competitor) ?? { n: 0, hospitals: new Set(), doctors: new Set(), products: new Set(), last: '' }
      e.n++
      if (i.hospital_id) e.hospitals.add(i.hospital?.name ?? i.hospital_id)
      if (i.doctor_id) e.doctors.add(i.doctor?.name ?? i.doctor_id)
      if (i.product) e.products.add(i.product)
      if (i.intel_date > e.last) e.last = i.intel_date
      m.set(i.competitor, e)
    }
    return [...m.entries()].sort((a, b) => b[1].n - a[1].n)
  }, [all])

  if (intel.isLoading) return <Spinner />
  if (intel.error) return <ErrorState error={intel.error} />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
            <Swords size={24} className="text-brand-500" />
            פעילות מתחרים
          </h1>
          <p className="text-sm text-slate-400">מי פעיל אצל איזה רופא ובית חולים, ומה הוא מציע</p>
        </div>
        <button className="btn-primary" onClick={() => setAdding(true)}>
          <Plus size={16} />
          רישום חדש
        </button>
      </div>

      {summary.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-right text-slate-500">
                <th className="p-2.5 font-medium">מתחרה</th>
                <th className="p-2.5 font-medium">רישומים</th>
                <th className="p-2.5 font-medium">בתי חולים</th>
                <th className="p-2.5 font-medium">רופאים</th>
                <th className="p-2.5 font-medium">מוצרים</th>
                <th className="p-2.5 font-medium">עדכון אחרון</th>
              </tr>
            </thead>
            <tbody>
              {summary.map(([name, e]) => (
                <tr
                  key={name}
                  className={classNames('cursor-pointer border-b border-slate-100 hover:bg-slate-50', competitor === name && 'bg-brand-50')}
                  onClick={() => setCompetitor(competitor === name ? '' : name)}
                >
                  <td className="p-2.5 font-medium text-slate-800">{name}</td>
                  <td className="p-2.5">{e.n}</td>
                  <td className="p-2.5">{e.hospitals.size}</td>
                  <td className="p-2.5">{e.doctors.size}</td>
                  <td className="p-2.5 text-slate-500">{[...e.products].join(', ') || '—'}</td>
                  <td className="p-2.5 text-slate-500">{formatDate(e.last)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <label className="relative block">
        <Search size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="search" className="input !pr-10" placeholder="חיפוש לפי מתחרה, מוצר, רופא, בית חולים…" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>

      {list.length === 0 ? (
        <EmptyState title="אין רישומים" hint="תעד פעילות של מתחרים מכרטיס רופא, מבית חולים או מכאן" />
      ) : (
        <ul className="space-y-2">
          {list.map((i) => (
            <li key={i.id} className="card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800">
                    {i.competitor}
                    {i.product && <span className="font-normal text-slate-500"> · {i.product}</span>}
                  </p>
                  <p className="text-xs text-slate-400">
                    {formatDate(i.intel_date)}
                    {i.doctor && (
                      <>
                        {' · '}
                        <Link to={`/doctors/${i.doctor.id}`} className="hover:underline">
                          {i.doctor.title} {i.doctor.name}
                        </Link>
                      </>
                    )}
                    {i.hospital && ` · ${i.hospital.name}`}
                  </p>
                  {i.offer && <p dir="auto" className="mt-1 whitespace-pre-line text-sm text-slate-600">{i.offer}</p>}
                  {i.notes && <p dir="auto" className="mt-0.5 whitespace-pre-line text-xs text-slate-400">{i.notes}</p>}
                </div>
                <button className="btn-secondary !px-3 !py-1 text-xs" onClick={() => setEditing(i)}>
                  עריכה
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {adding && <IntelFormModal onClose={() => setAdding(false)} />}
      {editing && <IntelFormModal intel={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
