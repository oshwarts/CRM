import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MapContainer, Marker, TileLayer, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import { Building2, Stethoscope, User } from 'lucide-react'
import { useMapData, type MapHospital } from '../lib/api'
import { ErrorState, Spinner } from '../components/ui'
import { SECTOR_LABELS } from '../lib/types'

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

export default function MapPage() {
  const map = useMapData()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const withCoords = useMemo(
    () => (map.data ?? []).filter((h) => h.lat != null && h.lng != null),
    [map.data],
  )

  const selected =
    (map.data ?? []).find((h) => h.id === selectedId) ?? null

  if (map.isLoading) return <Spinner />
  if (map.error) return <ErrorState error={map.error} />

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">מפת בתי חולים</h1>
        <p className="text-sm text-slate-400">
          לחיצה על בית חולים מציגה את הרופאים המשויכים והסוכן המטפל
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="card overflow-hidden" style={{ height: 560 }}>
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

        <div className="card max-h-[560px] overflow-y-auto p-4">
          {selected ? (
            <HospitalPanel hospital={selected} />
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-600">
                כל בתי החולים
              </p>
              {(map.data ?? []).map((h) => (
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
  const agents = hospital.hospital_agents
    .map((a) => a.agent?.full_name)
    .filter(Boolean)

  return (
    <div className="space-y-4">
      <div>
        <p className="flex items-center gap-2 text-lg font-semibold text-slate-800">
          <Building2 size={18} className="text-brand-500" />
          {hospital.name}
        </p>
        <p className="text-sm text-slate-500">
          {hospital.city}
          {hospital.sector
            ? ` · ${SECTOR_LABELS[hospital.sector] ?? hospital.sector}`
            : ''}
        </p>
      </div>

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
