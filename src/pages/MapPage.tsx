import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import {
  Activity,
  ArrowRight,
  Bot,
  Building2,
  CalendarDays,
  Phone,
  Plus,
  Search,
  Stethoscope,
  User,
  X,
} from 'lucide-react'
import { useMapData, useMeetings, type MapHospital } from '../lib/api'
import { formatDate } from '../lib/utils'
import { HospitalContactModal } from '../components/HospitalContactModal'
import { ErrorState, Spinner } from '../components/ui'
import { DOCTOR_STATUS_LABELS, SECTOR_LABELS } from '../lib/types'

function pinIcon(active: boolean, count: number) {
  const color = active ? '#2f4bb8' : count > 0 ? '#4f7cf7' : '#94a3b8'
  return L.divIcon({
    className: '',
    html: `<div style="
      background:${color};color:#fff;width:26px;height:26px;border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);display:grid;place-items:center;
      box-shadow:0 1px 4px rgba(0,0,0,.4);border:2px solid #fff;">
      <span style="transform:rotate(45deg);font-size:12px;font-weight:700;">${count || ''}</span>
    </div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
  })
}

// ignore case, quotes / geresh marks, dots and dashes so "הדסה עין-כרם" matches "הדסה עין כרם"
const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/["'`.׳״‘’“”]/g, '')
    .replace(/[-־]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

// flies to the selected hospital, or fits the search results, or shows all of Israel
function MapFocus({
  target,
  bounds,
}: {
  target: [number, number] | null
  bounds: [number, number][]
}) {
  const map = useMap()
  const key = target ? target.join(',') : bounds.map((b) => b.join(',')).join('|')
  useEffect(() => {
    if (target) map.flyTo(target, 14, { duration: 0.8 })
    else if (bounds.length > 0) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map])
  return null
}

export default function MapPage() {
  const map = useMapData()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [orgFilter, setOrgFilter] = useState('')
  const [query, setQuery] = useState('')
  const panelRef = useRef<HTMLDivElement>(null)

  // on a phone the panel sits below the map — bring it into view when a pin is tapped
  useEffect(() => {
    if (selectedId && window.innerWidth < 1024)
      panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [selectedId])

  const orgNames = useMemo(() => {
    const s = new Set<string>()
    for (const h of map.data ?? []) if (h.organization) s.add(h.organization.name)
    return [...s].sort()
  }, [map.data])

  const filtered = useMemo(() => {
    const q = normalize(query)
    return (map.data ?? []).filter(
      (h) =>
        (!orgFilter || h.organization?.name === orgFilter) &&
        (!q || normalize(`${h.name} ${h.city}`).includes(q)),
    )
  }, [map.data, orgFilter, query])

  const withCoords = useMemo(
    () => filtered.filter((h) => h.lat != null && h.lng != null),
    [filtered],
  )

  const selected =
    (map.data ?? []).find((h) => h.id === selectedId) ?? null
  const focusTarget: [number, number] | null =
    selected && selected.lat != null && selected.lng != null
      ? [selected.lat, selected.lng]
      : null
  const focusBounds: [number, number][] = query
    ? withCoords.map((h) => [h.lat as number, h.lng as number])
    : [
        [29.6, 34.2],
        [33.3, 35.9],
      ]

  if (map.isLoading) return <Spinner />
  if (map.error) return <ErrorState error={map.error} />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">מפת בתי חולים</h1>
          <p className="text-sm text-slate-400">
            לחיצה על בית חולים מציגה את הרופאים, הסוכן המטפל והרובוטיקה
          </p>
        </div>
        <label className="relative block w-full sm:w-64">
          <Search
            size={16}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            className="input !pr-9"
            placeholder="חיפוש בית חולים לפי שם"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedId(null)
            }}
          />
        </label>
        <select
          className="input max-w-48"
          value={orgFilter}
          onChange={(e) => setOrgFilter(e.target.value)}
        >
          <option value="">כל הארגונים</option>
          {orgNames.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="card h-[50vh] min-h-[300px] overflow-hidden lg:h-[560px]">
          <MapContainer
            center={[31.6, 34.95]}
            zoom={8}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom
          >
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapFocus target={focusTarget} bounds={focusBounds} />
            {withCoords.map((h) => (
              <Marker
                key={h.id}
                position={[h.lat as number, h.lng as number]}
                icon={pinIcon(h.id === selectedId, h.doctor_hospitals.length)}
                eventHandlers={{ click: () => setSelectedId(h.id) }}
              >
                <Tooltip direction="top">{h.name}</Tooltip>
              </Marker>
            ))}
          </MapContainer>
        </div>

        <div ref={panelRef} className="card scroll-mt-16 p-4 lg:max-h-[560px] lg:overflow-y-auto">
          {selected ? (
            <>
              <button
                className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
                onClick={() => setSelectedId(null)}
              >
                <ArrowRight size={14} />
                חזרה לרשימה
              </button>
              <HospitalPanel hospital={selected} />
            </>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-600">
                בתי חולים ({filtered.length})
              </p>
              {filtered.length === 0 && (
                <p className="py-4 text-center text-sm text-slate-400">
                  לא נמצא בית חולים בשם "{query}"
                  <button
                    className="mr-2 inline-flex items-center gap-1 text-brand-600 underline"
                    onClick={() => setQuery('')}
                  >
                    <X size={12} /> נקה
                  </button>
                </p>
              )}
              {filtered.map((h) => (
                <button
                  key={h.id}
                  onClick={() => setSelectedId(h.id)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-right text-sm hover:bg-slate-50"
                >
                  <span className="text-slate-700">{h.name}</span>
                  <span className="text-xs text-slate-400">
                    {h.doctor_hospitals.length} רופאים
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function HospitalPanel({ hospital }: { hospital: MapHospital }) {
  const [addingContact, setAddingContact] = useState(false)
  const allMeetings = useMeetings()
  const hospitalMeetings = (allMeetings.data ?? [])
    .filter((m) => m.hospital_id === hospital.id)
    .sort((a, b) => (b.meeting_date ?? '').localeCompare(a.meeting_date ?? ''))
  const agents = hospital.hospital_agents
    .map((a) => a.agent?.full_name)
    .filter(Boolean)
  const robotics = hospital.hospital_robotic_systems
    .map((r) => r.system?.name)
    .filter(Boolean)

  const latestYear = hospital.case_volumes.reduce(
    (max, v) => Math.max(max, v.year),
    0,
  )
  const statsMap: Record<string, number> = {}
  for (const v of hospital.case_volumes) {
    if (v.year !== latestYear) continue
    const name = v.procedure?.name ?? '—'
    statsMap[name] = (statsMap[name] ?? 0) + v.count
  }
  const stats = Object.entries(statsMap)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])

  return (
    <div className="space-y-4">
      <div>
        <p className="flex items-center gap-2 text-lg font-semibold text-slate-800">
          <Building2 size={18} className="text-brand-500" />
          {hospital.name}
        </p>
        <p className="text-sm text-slate-500">
          {hospital.city}
          {hospital.organization ? ` · ${hospital.organization.name}` : ''}
          {hospital.sector
            ? ` · ${SECTOR_LABELS[hospital.sector] ?? hospital.sector}`
            : ''}
        </p>
      </div>

      {robotics.length > 0 && (
        <div>
          <p className="mb-1 flex items-center gap-1 text-xs font-medium uppercase text-slate-400">
            <Bot size={12} /> רובוטיקה
          </p>
          <div className="flex flex-wrap gap-1">
            {robotics.map((r) => (
              <span
                key={r}
                className="chip border-brand-200 bg-brand-50 text-brand-700"
              >
                {r}
              </span>
            ))}
          </div>
          {robotics.some((r) => r?.toUpperCase().includes('MAKO')) && (
            <div className="mt-2 flex flex-col gap-1">
              <Link
                to={`/scans?hospital=${hospital.id}`}
                className="inline-block text-sm font-medium text-brand-600 hover:underline"
              >
                סריקות MAKO בבית חולים זה →
              </Link>
              <Link
                to={`/consumables?hospital=${hospital.id}`}
                className="inline-block text-sm font-medium text-brand-600 hover:underline"
              >
                ספירת מתכלים בבית חולים זה →
              </Link>
            </div>
          )}
        </div>
      )}

      <div>
        <p className="mb-1 flex items-center gap-1 text-xs font-medium uppercase text-slate-400">
          <User size={12} /> סוכן מטפל
        </p>
        {agents.length ? (
          <div className="flex flex-wrap gap-1">
            {agents.map((a) => (
              <span
                key={a}
                className="chip border-brand-200 bg-brand-50 text-brand-700"
              >
                {a}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">לא הוגדר (ניתן להגדיר בהגדרות)</p>
        )}
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <p className="flex items-center gap-1 text-xs font-medium uppercase text-slate-400">
            <Phone size={12} /> אנשי קשר
          </p>
          <button
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
            onClick={() => setAddingContact(true)}
          >
            <Plus size={14} />
            הוסף איש קשר
          </button>
        </div>
        {hospital.contacts.length === 0 ? (
          <p className="text-sm text-slate-400">אין אנשי קשר לבית החולים (רכש, מכון דימות, מזכירות…)</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {hospital.contacts.map((c) => (
              <li key={c.id} className="text-slate-600">
                <span className="font-medium">{c.name}</span>
                {c.role ? ` · ${c.role}` : ''}
                {c.phone ? (
                  <a href={`tel:${c.phone}`} dir="ltr" className="block text-xs text-slate-400">
                    {c.phone}
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {addingContact && (
          <HospitalContactModal
            hospitalId={hospital.id}
            hospitalName={hospital.name}
            onClose={() => setAddingContact(false)}
          />
        )}
      </div>

      {stats.length > 0 && (
        <div>
          <p className="mb-1 flex items-center gap-1 text-xs font-medium uppercase text-slate-400">
            <Activity size={12} /> כמות מקרים {latestYear}
          </p>
          <ul className="space-y-1 text-sm">
            {stats.map(([name, n]) => (
              <li key={name} className="flex justify-between text-slate-600">
                <span>{name}</span>
                <span className="font-medium">{n}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <p className="mb-1 flex items-center gap-1 text-xs font-medium uppercase text-slate-400">
          <CalendarDays size={12} /> פגישות בבית החולים ({hospitalMeetings.length})
        </p>
        {hospitalMeetings.length === 0 ? (
          <p className="text-sm text-slate-400">עדיין לא תועדו פגישות בבית חולים זה</p>
        ) : (
          <>
            <ul className="space-y-1">
              {hospitalMeetings.slice(0, 5).map((m) => (
                <li key={m.id}>
                  <Link to={`/meetings/${m.id}`} className="block rounded-lg px-3 py-2 text-sm hover:bg-slate-50">
                    <span className="font-medium text-slate-700">{m.subject || 'פגישה'}</span>
                    <span className="block text-xs text-slate-400">
                      {formatDate(m.meeting_date)}
                      {m.meeting_doctors.some((d) => d.doctor)
                        ? ` · ${m.meeting_doctors.flatMap((d) => (d.doctor ? [d.doctor.name] : [])).join(', ')}`
                        : ''}
                      {m.meeting_contacts.some((c) => c.contact)
                        ? ` · ${m.meeting_contacts.flatMap((c) => (c.contact ? [c.contact.name] : [])).join(', ')}`
                        : ''}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              to={`/meetings?hospital=${hospital.id}`}
              className="mt-1 inline-block text-sm font-medium text-brand-600 hover:underline"
            >
              לכל הפגישות בבית חולים זה →
            </Link>
          </>
        )}
      </div>

      <div>
        <p className="mb-1 flex items-center gap-1 text-xs font-medium uppercase text-slate-400">
          <Stethoscope size={12} /> רופאים ({hospital.doctor_hospitals.length})
        </p>
        {hospital.doctor_hospitals.length === 0 ? (
          <p className="text-sm text-slate-400">אין רופאים משויכים</p>
        ) : (
          <ul className="space-y-1">
            {hospital.doctor_hospitals.map(
              (dh) =>
                dh.doctor && (
                  <li key={dh.doctor.id}>
                    <Link
                      to={`/doctors/${dh.doctor.id}`}
                      className="block rounded-lg px-3 py-2 text-sm hover:bg-slate-50"
                    >
                      <span className="font-medium text-slate-700">
                        {dh.doctor.title} {dh.doctor.name}
                        {dh.doctor.status === 'potential' && (
                          <span className="chip mr-1 border-amber-200 bg-amber-50 text-amber-700">
                            {DOCTOR_STATUS_LABELS.potential}
                          </span>
                        )}
                      </span>
                      <span className="block text-xs text-slate-400">
                        {dh.role_at_hospital || dh.doctor.position || '—'}
                      </span>
                    </Link>
                  </li>
                ),
            )}
          </ul>
        )}
      </div>
    </div>
  )
}
