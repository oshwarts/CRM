import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CircleMarker, MapContainer, Marker, TileLayer, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import {
  Activity,
  ArrowRight,
  Bot,
  Building2,
  CalendarDays,
  Navigation,
  Phone,
  Search,
  Stethoscope,
  User,
  X,
} from 'lucide-react'
import { useMapData, useMeetings, type MapHospital } from '../lib/api'
import { useAuth } from '../context/AuthProvider'
import { classNames, formatDate } from '../lib/utils'
import { HospitalActions } from '../components/HospitalActions'
import { LinkedTasks } from '../components/LinkedTasks'
import { CompetitorSection } from '../components/CompetitorSection'
import { ErrorState, Spinner } from '../components/ui'
import { DOCTOR_STATUS_LABELS, SECTOR_LABELS } from '../lib/types'

function pinIcon(active: boolean, count: number, base?: string) {
  const color = active ? '#00326d' : (base ?? (count > 0 ? '#1863dc' : '#94a3b8'))
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

/** distance in km between two coordinates */
function km(a: [number, number], b: [number, number]) {
  const rad = (x: number) => (x * Math.PI) / 180
  const dLat = rad(b[0] - a[0])
  const dLng = rad(b[1] - a[1])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(h))
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

/** `embedded`: inside the hospitals page (no title of its own); `pinColor`: the colour of a hospital's pin, by its commercial status */
export default function MapPage({ embedded, pinColor }: { embedded?: boolean; pinColor?: (hospitalId: string) => string } = {}) {
  const map = useMapData()
  const { user } = useAuth()
  const [params] = useSearchParams()
  const [selectedId, setSelectedId] = useState<string | null>(params.get('hospital'))
  const [orgFilter, setOrgFilter] = useState('')
  const [robotFilter, setRobotFilter] = useState('')
  // "my hospitals" — the ones the user is the handling agent of; remembered on this device
  const [mine, setMine] = useState(() => {
    try {
      return localStorage.getItem('map.mine') === '1'
    } catch {
      return false
    }
  })
  function toggleMine() {
    setMine((v) => {
      try {
        localStorage.setItem('map.mine', v ? '0' : '1')
      } catch {
        /* storage blocked: the choice lasts for this visit only */
      }
      return !v
    })
  }
  const [query, setQuery] = useState('')
  const panelRef = useRef<HTMLDivElement>(null)
  // where the user is (asked once when the page opens); the map starts on the nearest hospital
  const [pos, setPos] = useState<[number, number] | null>(null)
  const [geo, setGeo] = useState<'asking' | 'ok' | 'denied'>('asking')

  function locate() {
    if (!navigator.geolocation) return setGeo('denied')
    setGeo('asking')
    navigator.geolocation.getCurrentPosition(
      (r) => {
        setPos([r.coords.latitude, r.coords.longitude])
        setGeo('ok')
      },
      () => setGeo('denied'),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 },
    )
  }
  useEffect(locate, [])

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
  const robotNames = useMemo(() => {
    const s = new Set<string>()
    for (const h of map.data ?? []) for (const r of h.hospital_robotic_systems) if (r.system) s.add(r.system.name)
    return [...s].sort()
  }, [map.data])
  const isMine = (h: MapHospital) => !!user && h.hospital_agents.some((a) => a.agent?.id === user.id)
  const hasMine = (map.data ?? []).some(isMine)

  // distance of every hospital from the user, and the nearest one
  const distances = useMemo(() => {
    const m = new Map<string, number>()
    if (pos) for (const h of map.data ?? []) if (h.lat != null && h.lng != null) m.set(h.id, km(pos, [h.lat, h.lng]))
    return m
  }, [pos, map.data])
  const nearest = useMemo(() => {
    let best: MapHospital | null = null
    for (const h of map.data ?? []) if (distances.has(h.id) && (!best || (distances.get(h.id) as number) < (distances.get(best.id) as number))) best = h
    return best
  }, [distances, map.data])

  const filtered = useMemo(() => {
    const q = normalize(query)
    const list = (map.data ?? []).filter(
      (h) =>
        (!orgFilter || h.organization?.name === orgFilter) &&
        (!robotFilter || h.hospital_robotic_systems.some((r) => r.system?.name === robotFilter)) &&
        (!mine || !hasMine || isMine(h)) &&
        (!q || normalize(`${h.name} ${h.city}`).includes(q)),
    )
    return pos ? [...list].sort((a, b) => (distances.get(a.id) ?? 1e9) - (distances.get(b.id) ?? 1e9)) : list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map.data, orgFilter, robotFilter, mine, hasMine, user?.id, query, pos, distances])

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
  const filtering = !!(query || orgFilter || robotFilter || (mine && hasMine))
  const focusBounds: [number, number][] = filtering && withCoords.length > 0
    ? withCoords.map((h) => [h.lat as number, h.lng as number])
    : pos && nearest && nearest.lat != null && nearest.lng != null
      ? [pos, [nearest.lat, nearest.lng]]
      : [
          [29.6, 34.2],
          [33.3, 35.9],
        ]

  if (map.isLoading) return <Spinner />
  if (map.error && !map.data) return <ErrorState error={map.error} /> // cached data stays visible when only a background refresh failed

  return (
    <div className="space-y-4">
      {!embedded && (
        <div>
          <h1 className="text-2xl font-semibold text-brand-800 sm:text-3xl">בתי חולים</h1>
          <p className="text-sm text-slate-500">לחיצה על בית חולים מציגה את הרופאים, הסוכן המטפל והרובוטיקה</p>
        </div>
      )}
      <div className="grid grid-cols-2 items-end gap-2 sm:flex sm:flex-wrap">
        <label className="relative col-span-2 block sm:w-64">
          <Search
            size={16}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            className="input !pr-9"
            placeholder="חיפוש בית חולים לפי שם"
            aria-label="חיפוש בית חולים לפי שם"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedId(null)
            }}
          />
        </label>
        <select
          className="input min-w-0 sm:max-w-48"
          aria-label="ארגון"
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
        {robotNames.length > 0 && (
          <select className="input min-w-0 sm:max-w-48" aria-label="רובוט" value={robotFilter} onChange={(e) => setRobotFilter(e.target.value)}>
            <option value="">כל הרובוטים</option>
            {robotNames.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        {hasMine && (
          <button
            aria-pressed={mine}
            onClick={toggleMine}
            className={classNames(
              'chip',
              mine ? 'border-brand-500 bg-brand-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
            )}
          >
            <User size={13} /> בתי החולים שלי
          </button>
        )}
        {nearest ? (
          <button
            className="chip border-brand-200 bg-brand-50 text-brand-700 hover:underline"
            onClick={() => setSelectedId(nearest.id)}
          >
            <Navigation size={13} /> הקרוב אליך: {nearest.name} · {(distances.get(nearest.id) as number).toFixed(1)} ק״מ
          </button>
        ) : geo === 'asking' ? (
          <span className="text-slate-400">מאתר את המיקום שלך…</span>
        ) : (
          <button className="chip border-slate-200 bg-white text-slate-600 hover:bg-slate-50" onClick={locate}>
            <Navigation size={13} /> מצא בית חולים קרוב אליי
          </button>
        )}
        {geo === 'denied' && !nearest && <span className="text-xs text-slate-400">אפשר מיקום בדפדפן כדי להתחיל מהקרוב אליך</span>}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="card h-[45vh] min-h-[280px] overflow-hidden lg:h-[560px]">
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
            {pos && (
              <CircleMarker center={pos} radius={8} pathOptions={{ color: '#fff', weight: 3, fillColor: '#1863dc', fillOpacity: 1 }}>
                <Tooltip direction="top">המיקום שלך</Tooltip>
              </CircleMarker>
            )}
            {withCoords.map((h) => (
              <Marker
                key={h.id}
                position={[h.lat as number, h.lng as number]}
                icon={pinIcon(h.id === selectedId || (!selectedId && !query && h.id === nearest?.id), h.doctor_hospitals.length, pinColor?.(h.id))}
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
                  {query ? `לא נמצא בית חולים בשם "${query}"` : 'אין בתי חולים שמתאימים לסינון'}
                  <button
                    className="mr-2 inline-flex items-center gap-1 text-brand-600 underline"
                    onClick={() => {
                      setQuery('')
                      setOrgFilter('')
                      setRobotFilter('')
                      if (mine) toggleMine()
                    }}
                  >
                    <X size={12} /> נקה
                  </button>
                </p>
              )}
              {filtered.map((h) => (
                <button
                  key={h.id}
                  onClick={() => setSelectedId(h.id)}
                  className="flex min-h-12 w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-right text-sm hover:bg-slate-50"
                >
                  <span className="min-w-0">
                    <span className="block break-words text-slate-700">{h.name}</span>
                    <span className="block truncate text-xs text-slate-400">
                      {[
                        h.hospital_agents.map((a) => a.agent?.full_name).filter(Boolean).join(', '),
                        h.hospital_robotic_systems.map((r) => r.system?.name).filter(Boolean).join(', '),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-slate-400">
                    {distances.has(h.id) ? `${(distances.get(h.id) as number).toFixed(1)} ק״מ · ` : ''}
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
        <Link to={`/hospitals/${hospital.id}`} className="mt-1 inline-block text-sm font-medium text-brand-600 hover:underline">
          לכרטיס בית החולים המלא →
        </Link>
      </div>

      <HospitalActions hospital={hospital} compact />

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
        <p className="mb-1 flex items-center gap-1 text-xs font-medium uppercase text-slate-400">
          <Phone size={12} /> אנשי קשר
        </p>
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
                {c.office_phone ? (
                  <a href={`tel:${c.office_phone}`} dir="ltr" className="block text-xs text-slate-400">
                    {c.office_phone} (משרד)
                  </a>
                ) : null}
                {c.email ? (
                  <a href={`mailto:${c.email}`} dir="ltr" className="block break-all text-xs text-slate-400">
                    {c.email}
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
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

      <LinkedTasks hospitalId={hospital.id} />

      <CompetitorSection hospitalId={hospital.id} />

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
