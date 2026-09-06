import { useEffect, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import {
  useAgents,
  useCompanies,
  useDeleteCompany,
  useDeleteHospital,
  useDeleteProcedure,
  useHospitalAgents,
  useHospitalProcedureStats,
  useHospitals,
  useProcedures,
  useSetHospitalAgents,
  useSetHospitalProcedureStats,
  useUpdateProfileRole,
  useUpsertCompany,
  useUpsertHospital,
  useUpsertProcedure,
} from '../lib/api'
import { useAuth } from '../context/AuthProvider'
import {
  ConfirmButton,
  Field,
  Modal,
  MultiSelectChips,
  Spinner,
  Tab,
  TabList,
  TabPanel,
  Tabs,
} from '../components/ui'
import {
  PROCEDURE_CATEGORY_LABELS,
  SECTOR_LABELS,
  type Hospital,
} from '../lib/types'

export default function Settings() {
  const { isAdmin } = useAuth()
  const [tab, setTab] = useState('companies')

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-slate-800">הגדרות</h1>

      <Tabs value={tab} onChange={setTab}>
        <TabList>
          <Tab id="companies">חברות</Tab>
          <Tab id="procedures">הליכים</Tab>
          <Tab id="hospitals">בתי חולים</Tab>
          <Tab id="users">משתמשים</Tab>
        </TabList>

        <TabPanel id="companies">
          <CompaniesSettings />
        </TabPanel>
        <TabPanel id="procedures">
          <ProceduresSettings />
        </TabPanel>
        <TabPanel id="hospitals">
          <HospitalsSettings />
        </TabPanel>
        <TabPanel id="users">
          <UsersSettings isAdmin={isAdmin} />
        </TabPanel>
      </Tabs>
    </div>
  )
}

/* ---------------- Companies ---------------- */

function CompaniesSettings() {
  const companies = useCompanies()
  const upsert = useUpsertCompany()
  const del = useDeleteCompany()
  const [name, setName] = useState('')

  return (
    <div className="card p-5">
      <div className="mb-4 flex gap-2">
        <input
          className="input max-w-xs"
          placeholder="שם חברה חדשה"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          className="btn-primary"
          disabled={!name.trim()}
          onClick={() => {
            upsert.mutate({ name: name.trim() })
            setName('')
          }}
        >
          <Plus size={16} />
          הוסף
        </button>
      </div>
      {companies.isLoading ? (
        <Spinner />
      ) : (
        <ul className="divide-y divide-slate-100">
          {(companies.data ?? []).map((c) => (
            <Row
              key={c.id}
              label={c.name}
              onRename={(v) => upsert.mutate({ id: c.id, name: v })}
              onDelete={() => del.mutate(c.id)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

/* ---------------- Procedures ---------------- */

function ProceduresSettings() {
  const procedures = useProcedures()
  const upsert = useUpsertProcedure()
  const del = useDeleteProcedure()
  const [form, setForm] = useState({ name: '', category: 'knee', is_mako: false })

  return (
    <div className="card p-5">
      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
        <input
          className="input"
          placeholder="שם ההליך"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <select
          className="input"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
        >
          {Object.entries(PROCEDURE_CATEGORY_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={form.is_mako}
            onChange={(e) => setForm({ ...form, is_mako: e.target.checked })}
          />
          MAKO
        </label>
        <button
          className="btn-primary"
          disabled={!form.name.trim()}
          onClick={() => {
            upsert.mutate({ ...form, name: form.name.trim() })
            setForm({ name: '', category: 'knee', is_mako: false })
          }}
        >
          <Plus size={16} />
          הוסף
        </button>
      </div>
      {procedures.isLoading ? (
        <Spinner />
      ) : (
        <ul className="divide-y divide-slate-100">
          {(procedures.data ?? []).map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-2 py-2 text-sm"
            >
              <span className="text-slate-700">
                {p.name}
                <span className="mr-2 text-xs text-slate-400">
                  {PROCEDURE_CATEGORY_LABELS[p.category] ?? p.category}
                  {p.is_mako ? ' · MAKO' : ''}
                </span>
              </span>
              <ConfirmButton
                className="btn-ghost !px-2 text-red-500"
                onConfirm={() => del.mutate(p.id)}
              >
                <Trash2 size={15} />
              </ConfirmButton>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ---------------- Hospitals ---------------- */

function HospitalsSettings() {
  const hospitals = useHospitals()
  const agents = useAgents()
  const hospitalAgents = useHospitalAgents()
  const del = useDeleteHospital()
  const [editing, setEditing] = useState<Hospital | 'new' | null>(null)

  return (
    <div className="card p-5">
      <div className="mb-4 flex justify-end">
        <button className="btn-primary" onClick={() => setEditing('new')}>
          <Plus size={16} />
          בית חולים חדש
        </button>
      </div>
      {hospitals.isLoading ? (
        <Spinner />
      ) : (
        <ul className="divide-y divide-slate-100">
          {(hospitals.data ?? []).map((h) => {
            const assigned = (hospitalAgents.data ?? [])
              .filter((ha) => ha.hospital_id === h.id)
              .map(
                (ha) =>
                  (agents.data ?? []).find((a) => a.id === ha.agent_id)
                    ?.full_name,
              )
              .filter(Boolean)
            return (
              <li
                key={h.id}
                className="flex items-center justify-between gap-2 py-2 text-sm"
              >
                <div>
                  <p className="text-slate-700">
                    {h.name}
                    <span className="mr-2 text-xs text-slate-400">
                      {h.city} · {SECTOR_LABELS[h.sector] ?? h.sector}
                      {h.lat == null ? ' · ללא מיקום' : ''}
                    </span>
                  </p>
                  {assigned.length > 0 && (
                    <p className="text-xs text-brand-600">
                      סוכן מטפל: {assigned.join(', ')}
                    </p>
                  )}
                </div>
                <div className="flex gap-1">
                  <button
                    className="btn-ghost !px-2"
                    onClick={() => setEditing(h)}
                  >
                    <Pencil size={15} />
                  </button>
                  <ConfirmButton
                    className="btn-ghost !px-2 text-red-500"
                    onConfirm={() => del.mutate(h.id)}
                  >
                    <Trash2 size={15} />
                  </ConfirmButton>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {editing && (
        <HospitalModal
          hospital={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function HospitalModal({
  hospital,
  onClose,
}: {
  hospital?: Hospital
  onClose: () => void
}) {
  const agents = useAgents()
  const procedures = useProcedures()
  const hospitalAgents = useHospitalAgents()
  const procStatsQuery = useHospitalProcedureStats(hospital?.id)
  const upsert = useUpsertHospital()
  const setAgents = useSetHospitalAgents()
  const setProcStats = useSetHospitalProcedureStats()

  const [form, setForm] = useState({
    name: hospital?.name ?? '',
    city: hospital?.city ?? '',
    sector: hospital?.sector ?? 'public',
    address: hospital?.address ?? '',
    lat: hospital?.lat != null ? String(hospital.lat) : '',
    lng: hospital?.lng != null ? String(hospital.lng) : '',
  })
  const [agentIds, setAgentIds] = useState<string[]>([])
  const [volumes, setVolumes] = useState<Record<string, number>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!hospital) return
    setAgentIds(
      (hospitalAgents.data ?? [])
        .filter((ha) => ha.hospital_id === hospital.id)
        .map((ha) => ha.agent_id),
    )
  }, [hospital, hospitalAgents.data])

  useEffect(() => {
    const map: Record<string, number> = {}
    for (const s of procStatsQuery.data ?? []) map[s.procedure_id] = s.volume
    setVolumes(map)
  }, [procStatsQuery.data])

  async function save() {
    setError(null)
    if (!form.name.trim()) {
      setError('יש להזין שם בית חולים')
      return
    }
    try {
      const saved = await upsert.mutateAsync({
        id: hospital?.id,
        name: form.name.trim(),
        city: form.city.trim(),
        sector: form.sector,
        address: form.address.trim(),
        lat: form.lat ? Number(form.lat) : null,
        lng: form.lng ? Number(form.lng) : null,
      })
      await setAgents.mutateAsync({ hospitalId: saved.id, agentIds })
      await setProcStats.mutateAsync({
        hospitalId: saved.id,
        stats: Object.entries(volumes).map(([procedure_id, volume]) => ({
          procedure_id,
          volume,
        })),
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שמירה נכשלה')
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={hospital ? 'עריכת בית חולים' : 'בית חולים חדש'}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="שם">
          <input
            className="input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <Field label="עיר">
          <input
            className="input"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
          />
        </Field>
        <Field label="סקטור">
          <select
            className="input"
            value={form.sector}
            onChange={(e) => setForm({ ...form, sector: e.target.value })}
          >
            {Object.entries(SECTOR_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="כתובת">
          <input
            className="input"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </Field>
        <Field label="קו רוחב (lat)">
          <input
            dir="ltr"
            className="input text-right"
            value={form.lat}
            onChange={(e) => setForm({ ...form, lat: e.target.value })}
            placeholder="31.7683"
          />
        </Field>
        <Field label="קו אורך (lng)">
          <input
            dir="ltr"
            className="input text-right"
            value={form.lng}
            onChange={(e) => setForm({ ...form, lng: e.target.value })}
            placeholder="35.2137"
          />
        </Field>
      </div>

      <div className="mt-4">
        <Field label="סוכן מטפל">
          <MultiSelectChips
            options={(agents.data ?? []).map((a) => ({
              id: a.id,
              label: a.full_name || a.email,
            }))}
            selected={agentIds}
            onToggle={(id) =>
              setAgentIds((cur) =>
                cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
              )
            }
            labelOf={(o) => o.label}
          />
        </Field>
      </div>

      <div className="mt-4">
        <Field label="כמות ניתוחים לפי הליך (מצטבר)">
          <div className="space-y-1">
            {(procedures.data ?? []).map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="text-slate-600">{p.name}</span>
                <input
                  type="number"
                  min={0}
                  className="input w-24 py-1 text-center"
                  value={volumes[p.id] || ''}
                  onChange={(e) =>
                    setVolumes((cur) => ({
                      ...cur,
                      [p.id]: Math.max(0, Number(e.target.value) || 0),
                    }))
                  }
                />
              </div>
            ))}
          </div>
        </Field>
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="mt-5 flex justify-end gap-2 border-t border-slate-200 pt-4">
        <button className="btn-secondary" onClick={onClose}>
          ביטול
        </button>
        <button
          className="btn-primary"
          onClick={save}
          disabled={upsert.isPending || setAgents.isPending || setProcStats.isPending}
        >
          שמירה
        </button>
      </div>
    </Modal>
  )
}

/* ---------------- Users ---------------- */

function UsersSettings({ isAdmin }: { isAdmin: boolean }) {
  const agents = useAgents()
  const updateRole = useUpdateProfileRole()

  return (
    <div className="card p-5">
      {!isAdmin && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          רק מנהל יכול לשנות הרשאות. משתמשים חדשים נרשמים דרך מסך ההתחברות.
        </p>
      )}
      {agents.isLoading ? (
        <Spinner />
      ) : (
        <ul className="divide-y divide-slate-100">
          {(agents.data ?? []).map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-2 py-2 text-sm"
            >
              <div>
                <p className="text-slate-700">{a.full_name || '—'}</p>
                <p dir="ltr" className="text-right text-xs text-slate-400">
                  {a.email}
                </p>
              </div>
              <select
                className="input max-w-32"
                value={a.role}
                disabled={!isAdmin}
                onChange={(e) =>
                  updateRole.mutate({ id: a.id, role: e.target.value })
                }
              >
                <option value="agent">סוכן</option>
                <option value="admin">מנהל</option>
              </select>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ---------------- shared row ---------------- */

function Row({
  label,
  onRename,
  onDelete,
}: {
  label: string
  onRename: (v: string) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(label)

  return (
    <li className="flex items-center justify-between gap-2 py-2 text-sm">
      {editing ? (
        <input
          className="input max-w-xs"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
        />
      ) : (
        <span className="text-slate-700">{label}</span>
      )}
      <div className="flex gap-1">
        {editing ? (
          <>
            <button
              className="btn-ghost !px-2 text-brand-600"
              onClick={() => {
                if (value.trim()) onRename(value.trim())
                setEditing(false)
              }}
            >
              שמור
            </button>
            <button
              className="btn-ghost !px-2 text-slate-500"
              onClick={() => {
                setValue(label)
                setEditing(false)
              }}
            >
              ביטול
            </button>
          </>
        ) : (
          <>
            <button
              className="btn-ghost !px-2"
              onClick={() => setEditing(true)}
            >
              <Pencil size={15} />
            </button>
            <ConfirmButton
              className="btn-ghost !px-2 text-red-500"
              onConfirm={onDelete}
            >
              <Trash2 size={15} />
            </ConfirmButton>
          </>
        )}
      </div>
    </li>
  )
}
