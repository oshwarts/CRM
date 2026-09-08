import { useEffect, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import {
  useAgents,
  useCompanies,
  useContacts,
  useDeleteCompany,
  useDeleteContact,
  useDeleteEquipmentItem,
  useDeleteHospital,
  useDeleteOrganization,
  useDeleteProcedure,
  useDeleteRoboticSystem,
  useDoctors,
  useEquipmentItems,
  useHospitalAgents,
  useHospitals,
  useOrganizations,
  useProcedures,
  useRoboticSystems,
  useSetHospitalAgents,
  useSetHospitalRoboticSystems,
  useUpdateProfileRole,
  useUpsertCompany,
  useUpsertContact,
  useUpsertEquipmentItem,
  useUpsertHospital,
  useUpsertOrganization,
  useUpsertProcedure,
  useUpsertRoboticSystem,
} from '../lib/api'
import { useAuth } from '../context/AuthProvider'
import { ContactsSection } from '../components/ContactsSection'
import { CaseVolumesEditor } from '../components/CaseVolumesEditor'
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
  useDeleteImplantOption,
  useImplantOptions,
  useUpsertImplantOption,
} from '../lib/api'
import {
  CONTACT_ROLES,
  IMPLANT_FIELDS,
  PROCEDURE_CATEGORY_LABELS,
  SCAN_PROCEDURE_LABELS,
  SECTOR_LABELS,
  type HospitalListItem,
} from '../lib/types'

export default function Settings() {
  const { isAdmin } = useAuth()
  const [tab, setTab] = useState('lists')

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-slate-800">הגדרות</h1>

      <Tabs value={tab} onChange={setTab}>
        <TabList>
          <Tab id="lists">רשימות</Tab>
          <Tab id="procedures">הליכים</Tab>
          <Tab id="equipment">ציוד</Tab>
          <Tab id="implants">מידות שתל</Tab>
          <Tab id="hospitals">בתי חולים</Tab>
          <Tab id="contacts">אנשי קשר</Tab>
          <Tab id="users">משתמשים</Tab>
        </TabList>

        <TabPanel id="lists">
          <div className="grid gap-4 md:grid-cols-2">
            <SimpleListSettings
              title="חברות"
              placeholder="שם חברה חדשה"
              useList={useCompanies}
              useUpsert={useUpsertCompany}
              useDelete={useDeleteCompany}
            />
            <SimpleListSettings
              title="ארגוני בתי חולים"
              placeholder="כללית / ממשלתי / פרטי / מדיקה…"
              useList={useOrganizations}
              useUpsert={useUpsertOrganization}
              useDelete={useDeleteOrganization}
            />
            <SimpleListSettings
              title="מערכות רובוטיקה"
              placeholder="MAKO / VELYS / ROSA…"
              useList={useRoboticSystems}
              useUpsert={useUpsertRoboticSystem}
              useDelete={useDeleteRoboticSystem}
            />
          </div>
        </TabPanel>
        <TabPanel id="procedures">
          <ProceduresSettings />
        </TabPanel>
        <TabPanel id="equipment">
          <EquipmentSettings />
        </TabPanel>
        <TabPanel id="implants">
          <ImplantOptionsSettings />
        </TabPanel>
        <TabPanel id="hospitals">
          <HospitalsSettings />
        </TabPanel>
        <TabPanel id="contacts">
          <ContactsSettings />
        </TabPanel>
        <TabPanel id="users">
          <UsersSettings isAdmin={isAdmin} />
        </TabPanel>
      </Tabs>
    </div>
  )
}

/* ---------------- Simple name-only lists ---------------- */

type NamedRow = { id: string; name: string }
type ListHook = () => { data?: NamedRow[]; isLoading: boolean }
type UpsertHook = () => { mutate: (v: { id?: string; name: string }) => void }
type DeleteHook = () => { mutate: (id: string) => void }

function SimpleListSettings({
  title,
  placeholder,
  useList,
  useUpsert,
  useDelete,
}: {
  title: string
  placeholder: string
  useList: ListHook
  useUpsert: UpsertHook
  useDelete: DeleteHook
}) {
  const list = useList()
  const upsert = useUpsert()
  const del = useDelete()
  const [name, setName] = useState('')

  return (
    <div className="card p-5">
      <h3 className="mb-3 font-semibold text-slate-800">{title}</h3>
      <div className="mb-3 flex gap-2">
        <input
          className="input"
          placeholder={placeholder}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          className="btn-primary shrink-0"
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
      {list.isLoading ? (
        <Spinner />
      ) : (
        <ul className="divide-y divide-slate-100">
          {(list.data ?? []).map((c) => (
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

/* ---------------- Implant size options ---------------- */

function ImplantOptionsSettings() {
  const options = useImplantOptions()
  const upsert = useUpsertImplantOption()
  const del = useDeleteImplantOption()
  const [adding, setAdding] = useState<Record<string, string>>({})

  // one column of categories per procedure type
  const groups = Object.entries(IMPLANT_FIELDS) as [
    string,
    { key: string; label: string; category: string }[],
  ][]

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        מידות השתל שמופיעות ברשימת הבחירה בסריקות MAKO, לפי סוג ניתוח.
      </p>
      {options.isLoading ? (
        <Spinner />
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {groups.map(([proc, fields]) => (
            <div key={proc} className="card p-4">
              <h3 className="mb-2 font-semibold text-slate-800">
                {SCAN_PROCEDURE_LABELS[proc]}
              </h3>
              {fields.map((f) => {
                const vals = (options.data ?? []).filter(
                  (o) => o.category === f.category,
                )
                return (
                  <div key={f.category} className="mb-3">
                    <p className="mb-1 text-xs font-medium text-slate-500">
                      {f.label}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {vals.map((o) => (
                        <span
                          key={o.id}
                          className="chip border-slate-200 bg-slate-50 text-slate-600"
                        >
                          {o.value}
                          <button
                            className="text-red-400"
                            onClick={() => del.mutate(o.id)}
                            aria-label="מחק"
                          >
                            <Trash2 size={11} />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="mt-1 flex gap-1">
                      <input
                        className="input py-1 text-sm"
                        placeholder="הוסף מידה"
                        value={adding[f.category] ?? ''}
                        onChange={(e) =>
                          setAdding({ ...adding, [f.category]: e.target.value })
                        }
                      />
                      <button
                        className="btn-secondary shrink-0 !py-1"
                        disabled={!adding[f.category]?.trim()}
                        onClick={() => {
                          upsert.mutate({
                            category: f.category,
                            value: adding[f.category].trim(),
                          })
                          setAdding({ ...adding, [f.category]: '' })
                        }}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------------- Equipment catalog ---------------- */

function EquipmentSettings() {
  const items = useEquipmentItems()
  const companies = useCompanies()
  const upsert = useUpsertEquipmentItem()
  const del = useDeleteEquipmentItem()
  const [form, setForm] = useState({ name: '', catalog_number: '', company_id: '' })

  function submit() {
    if (!form.name.trim()) return
    upsert.mutate({
      name: form.name.trim(),
      catalog_number: form.catalog_number.trim(),
      company_id: form.company_id || null,
    })
    setForm({ name: '', catalog_number: '', company_id: '' })
  }

  return (
    <div className="card p-5">
      <div className="mb-4 grid gap-2 sm:grid-cols-[1.5fr_1fr_1fr_auto]">
        <input
          className="input"
          placeholder="שם הפריט"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          className="input text-right"
          dir="ltr"
          placeholder="מק״ט"
          value={form.catalog_number}
          onChange={(e) => setForm({ ...form, catalog_number: e.target.value })}
        />
        <select
          className="input"
          value={form.company_id}
          onChange={(e) => setForm({ ...form, company_id: e.target.value })}
        >
          <option value="">חברה…</option>
          {(companies.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button className="btn-primary" disabled={!form.name.trim()} onClick={submit}>
          <Plus size={16} />
          הוסף
        </button>
      </div>
      {items.isLoading ? (
        <Spinner />
      ) : (
        <ul className="divide-y divide-slate-100">
          {(items.data ?? []).map((it) => (
            <li
              key={it.id}
              className="flex items-center justify-between gap-2 py-2 text-sm"
            >
              <span className="text-slate-700">
                {it.name}
                <span className="mr-2 text-xs text-slate-400" dir="ltr">
                  {[it.catalog_number, it.company?.name].filter(Boolean).join(' · ')}
                </span>
              </span>
              <ConfirmButton
                className="btn-ghost !px-2 text-red-500"
                onConfirm={() => del.mutate(it.id)}
              >
                <Trash2 size={15} />
              </ConfirmButton>
            </li>
          ))}
          {(items.data ?? []).length === 0 && (
            <li className="py-4 text-center text-sm text-slate-400">
              הקטלוג ריק. הוסף פריטים כדי לשייך אותם להליכים בכרטיסי הרופאים.
            </li>
          )}
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
  const [editing, setEditing] = useState<HospitalListItem | 'new' | null>(null)

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
                      {h.city}
                      {h.organization ? ` · ${h.organization.name}` : ''}
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
  hospital?: HospitalListItem
  onClose: () => void
}) {
  const agents = useAgents()
  const doctors = useDoctors()
  const organizations = useOrganizations()
  const roboticSystems = useRoboticSystems()
  const hospitalAgents = useHospitalAgents()
  const upsert = useUpsertHospital()
  const setAgents = useSetHospitalAgents()
  const setSystems = useSetHospitalRoboticSystems()

  const [form, setForm] = useState({
    name: hospital?.name ?? '',
    city: hospital?.city ?? '',
    sector: hospital?.sector ?? 'public',
    organization_id: hospital?.organization_id ?? '',
    address: hospital?.address ?? '',
    lat: hospital?.lat != null ? String(hospital.lat) : '',
    lng: hospital?.lng != null ? String(hospital.lng) : '',
  })
  const [agentIds, setAgentIds] = useState<string[]>([])
  const [systemIds, setSystemIds] = useState<string[]>(
    hospital?.hospital_robotic_systems.map((r) => r.system_id) ?? [],
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!hospital) return
    setAgentIds(
      (hospitalAgents.data ?? [])
        .filter((ha) => ha.hospital_id === hospital.id)
        .map((ha) => ha.agent_id),
    )
  }, [hospital, hospitalAgents.data])

  const hospitalDoctors = (doctors.data ?? []).filter((d) =>
    hospital
      ? d.doctor_hospitals.some((h) => h.hospital_id === hospital.id)
      : false,
  )

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
        organization_id: form.organization_id || null,
        address: form.address.trim(),
        lat: form.lat ? Number(form.lat) : null,
        lng: form.lng ? Number(form.lng) : null,
      })
      await setAgents.mutateAsync({ hospitalId: saved.id, agentIds })
      await setSystems.mutateAsync({ hospitalId: saved.id, systemIds })
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
        <Field label="ארגון">
          <select
            className="input"
            value={form.organization_id}
            onChange={(e) =>
              setForm({ ...form, organization_id: e.target.value })
            }
          >
            <option value="">— ללא —</option>
            {(organizations.data ?? []).map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
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
        <Field label="כתובת" className="sm:col-span-2">
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
        <Field label="רובוטיקה בבית החולים">
          <MultiSelectChips
            options={roboticSystems.data ?? []}
            selected={systemIds}
            onToggle={(id) =>
              setSystemIds((cur) =>
                cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
              )
            }
            labelOf={(o) => o.name}
          />
        </Field>
      </div>

      {hospital && (
        <div className="mt-4 border-t border-slate-200 pt-4">
          <p className="mb-2 text-sm font-medium text-slate-600">כמויות מקרים</p>
          {hospitalDoctors.length === 0 ? (
            <p className="text-sm text-slate-400">
              אין רופאים משויכים לבית חולים זה. שייך רופא (בכרטיס הרופא) כדי
              להזין כמויות.
            </p>
          ) : (
            <CaseVolumesEditor
              hospitalId={hospital.id}
              entityOptions={hospitalDoctors.map((d) => ({
                id: d.id,
                label: `${d.title} ${d.name}`,
              }))}
            />
          )}
        </div>
      )}

      {hospital && (
        <div className="mt-4 border-t border-slate-200 pt-4">
          <ContactsSection hospitalId={hospital.id} />
        </div>
      )}

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
          disabled={
            upsert.isPending || setAgents.isPending || setSystems.isPending
          }
        >
          שמירה
        </button>
      </div>
    </Modal>
  )
}

/* ---------------- Contacts ---------------- */

const EMPTY_CONTACT = {
  name: '',
  role: '',
  phone: '',
  email: '',
  notes: '',
  hospital_id: '',
  doctor_id: '',
}

function ContactsSettings() {
  const contacts = useContacts()
  const hospitals = useHospitals()
  const doctors = useDoctors()
  const upsert = useUpsertContact()
  const del = useDeleteContact()
  const [draft, setDraft] = useState<
    (typeof EMPTY_CONTACT & { id?: string }) | null
  >(null)

  const hospitalName = (id: string | null) =>
    hospitals.data?.find((h) => h.id === id)?.name
  const doctorName = (id: string | null) => {
    const d = doctors.data?.find((x) => x.id === id)
    return d ? `${d.title} ${d.name}` : undefined
  }

  async function save() {
    if (!draft || !draft.name.trim()) return
    await upsert.mutateAsync({
      id: draft.id,
      name: draft.name.trim(),
      role: draft.role,
      phone: draft.phone,
      email: draft.email,
      notes: draft.notes,
      hospital_id: draft.hospital_id || null,
      doctor_id: draft.doctor_id || null,
    })
    setDraft(null)
  }

  return (
    <div className="card p-5">
      <div className="mb-4 flex justify-end">
        <button
          className="btn-primary"
          onClick={() => setDraft({ ...EMPTY_CONTACT })}
        >
          <Plus size={16} />
          איש קשר חדש
        </button>
      </div>

      {draft && (
        <div className="mb-4 space-y-3 rounded-xl border border-brand-200 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="שם">
              <input
                className="input"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </Field>
            <Field label="תפקיד">
              <input
                className="input"
                list="settings-contact-roles"
                value={draft.role}
                onChange={(e) => setDraft({ ...draft, role: e.target.value })}
              />
              <datalist id="settings-contact-roles">
                {CONTACT_ROLES.map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            </Field>
            <Field label="טלפון">
              <input
                dir="ltr"
                className="input text-right"
                value={draft.phone}
                onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
              />
            </Field>
            <Field label="אימייל">
              <input
                dir="ltr"
                className="input text-right"
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              />
            </Field>
            <Field label="שיוך לבית חולים">
              <select
                className="input"
                value={draft.hospital_id}
                onChange={(e) =>
                  setDraft({ ...draft, hospital_id: e.target.value })
                }
              >
                <option value="">— ללא —</option>
                {(hospitals.data ?? []).map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="שיוך לרופא">
              <select
                className="input"
                value={draft.doctor_id}
                onChange={(e) =>
                  setDraft({ ...draft, doctor_id: e.target.value })
                }
              >
                <option value="">— ללא —</option>
                {(doctors.data ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title} {d.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="הערות" className="sm:col-span-2">
              <input
                className="input"
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setDraft(null)}>
              ביטול
            </button>
            <button
              className="btn-primary"
              onClick={save}
              disabled={!draft.name.trim()}
            >
              שמירה
            </button>
          </div>
        </div>
      )}

      {contacts.isLoading ? (
        <Spinner />
      ) : (
        <ul className="divide-y divide-slate-100">
          {(contacts.data ?? []).map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-2 py-2 text-sm"
            >
              <div>
                <p className="text-slate-700">
                  {c.name}
                  {c.role && (
                    <span className="mr-2 text-xs text-slate-400">{c.role}</span>
                  )}
                </p>
                <p className="text-xs text-slate-400">
                  {[c.phone, hospitalName(c.hospital_id), doctorName(c.doctor_id)]
                    .filter(Boolean)
                    .join(' · ') || '—'}
                </p>
              </div>
              <div className="flex gap-1">
                <button
                  className="btn-ghost !px-2"
                  onClick={() =>
                    setDraft({
                      id: c.id,
                      name: c.name,
                      role: c.role,
                      phone: c.phone,
                      email: c.email,
                      notes: c.notes,
                      hospital_id: c.hospital_id ?? '',
                      doctor_id: c.doctor_id ?? '',
                    })
                  }
                >
                  <Pencil size={15} />
                </button>
                <ConfirmButton
                  className="btn-ghost !px-2 text-red-500"
                  onConfirm={() => del.mutate(c.id)}
                >
                  <Trash2 size={15} />
                </ConfirmButton>
              </div>
            </li>
          ))}
          {(contacts.data ?? []).length === 0 && (
            <li className="py-4 text-center text-sm text-slate-400">
              אין אנשי קשר. אפשר להוסיף גם דרך כרטיס רופא או עריכת בית חולים.
            </li>
          )}
        </ul>
      )}
    </div>
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
