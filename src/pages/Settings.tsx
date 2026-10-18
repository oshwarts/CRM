import { PipelineStagesSettings } from '../components/PipelineStagesSettings'
import { RobotLinks } from '../components/RobotLinks'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { UploadRequests } from '../components/UploadRequests'
import { useAuth } from '../context/AuthProvider'
import { BookUser, FileUp, Image as ImageIcon, Pencil, Plus, Trash2 } from 'lucide-react'
import { SmartContactImport } from '../components/SmartContactImport'
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
  useUpsertCompany,
  useUpsertContact,
  useUpsertHospital,
  useUpsertOrganization,
  useUpsertProcedure,
  useUpsertRoboticSystem,
} from '../lib/api'
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
import { ImplantSettings } from '../components/ImplantSettings'
import {
  CONTACT_ROLES,
  itemImages,
  PROCEDURE_CATEGORY_LABELS,
  SECTOR_LABELS,
  type EquipmentItemWithCompany,
  type HospitalListItem,
} from '../lib/types'

import { ImportContactButton } from '../components/ImportContactButton'
import { ConsumablesSettings } from '../components/ConsumablesSettings'
import { CourseTemplatesSettings } from '../components/CourseTemplatesSettings'
import { InfoCategoriesSettings } from '../components/InfoCategoriesSettings'
import { EquipmentItemModal } from '../components/EquipmentItemModal'
import { EquipmentViewModal } from '../components/EquipmentViewModal'
import { EquipmentPdfImport } from '../components/EquipmentPdfImport'

export default function Settings() {
  const [params] = useSearchParams()
  const [tab, setTab] = useState(params.get('tab') ?? 'lists')

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold text-brand-800 sm:text-3xl">הגדרות</h1>

      <Tabs value={tab} onChange={setTab}>
        <TabList>
          <Tab id="lists">רשימות</Tab>
          <Tab id="procedures">הליכים</Tab>
          <Tab id="equipment">ציוד</Tab>
          <Tab id="implants">מידות שתל</Tab>
          <Tab id="consumables">מתכלים</Tab>
          <Tab id="course">מהלך ניתוחי</Tab>
          <Tab id="info">מידע קליני</Tab>
          <Tab id="hospitals">בתי חולים</Tab>
          <Tab id="contacts">אנשי קשר</Tab>
          <Tab id="uploads">אישורי העלאה</Tab>
        </TabList>

        <TabPanel id="lists">
          <div className="grid gap-4 md:grid-cols-2">
            <SimpleListSettings
              title="חברות"
              placeholder="שם חברה חדשה"
              extra={(id) => <RobotLinks kind="company" ownerId={id} editable />}
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
            <PipelineStagesSettings />
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
          <ImplantSettings />
        </TabPanel>
        <TabPanel id="info">
          <InfoCategoriesSettings />
        </TabPanel>
        <TabPanel id="course">
          <CourseTemplatesSettings />
        </TabPanel>
        <TabPanel id="consumables">
          <ConsumablesSettings />
        </TabPanel>
        <TabPanel id="hospitals">
          <HospitalsSettings />
        </TabPanel>
        <TabPanel id="uploads">
          <UploadRequests />
        </TabPanel>
        <TabPanel id="contacts">
          <ContactsSettings />
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
  extra,
}: {
  title: string
  placeholder: string
  useList: ListHook
  useUpsert: UpsertHook
  useDelete: DeleteHook
  /** shown under each row (for example the robots of a company) */
  extra?: (id: string) => React.ReactNode
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
              extra={extra?.(c.id)}
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

/* ---------------- Equipment catalog ---------------- */

function EquipmentSettings() {
  const items = useEquipmentItems()
  const del = useDeleteEquipmentItem()
  const [editing, setEditing] = useState<EquipmentItemWithCompany | 'new' | null>(null)
  const [viewing, setViewing] = useState<EquipmentItemWithCompany | null>(null)
  const [importing, setImporting] = useState(false)

  return (
    <div className="card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">
          ציוד לניתוח — בדרך כלל מגשי מכשירים. לכל פריט אפשר להוסיף תמונה ורשימת מק״טים, ולצפות בהם בלחיצה.
        </p>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => setImporting(true)}>
            <FileUp size={16} />
            ייבוא מ-PDF
          </button>
          <button className="btn-primary" onClick={() => setEditing('new')}>
            <Plus size={16} />
            ציוד חדש
          </button>
        </div>
      </div>
      {items.isLoading ? (
        <Spinner />
      ) : (
        <ul className="divide-y divide-slate-100">
          {(items.data ?? []).map((it) => (
            <li key={it.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <button className="min-w-0 flex-1 text-right" onClick={() => setViewing(it)}>
                <span className="font-medium text-slate-800 hover:underline" dir="auto">
                  {it.name}
                </span>
                <span className="mr-2 text-xs text-slate-400" dir="ltr">
                  {[it.catalog_number, it.company?.name].filter(Boolean).join(' · ')}
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                  {itemImages(it).length > 0 && (
                    <span className="inline-flex items-center gap-0.5">
                      <ImageIcon size={12} /> {itemImages(it).length > 1 ? `${itemImages(it).length} תמונות` : 'תמונה'}
                    </span>
                  )}
                  {it.parts.length > 0 && <span>{it.parts.length} מק״טים</span>}
                </span>
              </button>
              <button className="btn-ghost !px-2" onClick={() => setEditing(it)} aria-label="עריכה">
                <Pencil size={15} />
              </button>
              <ConfirmButton className="btn-ghost !px-2 text-red-500" onConfirm={() => del.mutate(it.id)}>
                <Trash2 size={15} />
              </ConfirmButton>
            </li>
          ))}
          {(items.data ?? []).length === 0 && (
            <li className="py-4 text-center text-sm text-slate-400">
              הקטלוג ריק. הוסף ציוד, או ייבא מגשים מקובץ PDF.
            </li>
          )}
        </ul>
      )}
      {editing && <EquipmentItemModal item={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {viewing && <EquipmentViewModal item={viewing} onClose={() => setViewing(null)} />}
      {importing && <EquipmentPdfImport onClose={() => setImporting(false)} />}
    </div>
  )
}

/* ---------------- Hospitals ---------------- */

function HospitalsSettings() {
  const hospitals = useHospitals()
  const agents = useAgents()
  const hospitalAgents = useHospitalAgents()
  const del = useDeleteHospital()
  const { isAdmin } = useAuth()
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
                  {isAdmin && (
                    <ConfirmButton
                      className="btn-ghost !px-2 text-red-500"
                      onConfirm={() => del.mutate(h.id)}
                    >
                      <Trash2 size={15} />
                    </ConfirmButton>
                  )}
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
        <Field label="סקטור (פרטי / ציבורי)">
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
          <p className="mt-1 text-xs text-slate-400">
            ההגדרה כאן קבועה לבית החולים ומשפיעה על כל הרופאים המקושרים אליו.
          </p>
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
  office_phone: '',
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
  const [importing, setImporting] = useState(false)
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
      office_phone: draft.office_phone,
      email: draft.email,
      notes: draft.notes,
      hospital_id: draft.hospital_id || null,
      doctor_id: draft.doctor_id || null,
    })
    setDraft(null)
  }

  return (
    <div className="card p-5">
      <p className="mb-3 text-sm text-slate-500">
        איש קשר של <b>בית חולים</b> הוא עובד בבית החולים (מזכירת רופא, אחות ראשית, אחים בחדרי ניתוח, מכון דימות,
        רכש…) ואינו חייב להיות משויך לרופא. איש קשר של <b>רופא</b> הוא בדרך כלל המזכירה שלו.
      </p>
      <div className="mb-4 flex justify-end gap-2">
        <button className="btn-secondary" onClick={() => setImporting(true)}>
          <BookUser size={16} />
          ייבוא מהטלפון
        </button>
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
                list="settings-contact-roles" placeholder="בחר מהרשימה או כתוב תפקיד חופשי"
                value={draft.role}
                onChange={(e) => setDraft({ ...draft, role: e.target.value })}
              />
              <datalist id="settings-contact-roles">
                {CONTACT_ROLES.map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            </Field>
            <div className="sm:col-span-2">
              <ImportContactButton
                onPick={(c) =>
                  setDraft({
                    ...draft,
                    name: draft.name || c.name,
                    phone: c.phone || draft.phone,
                    email: c.email || draft.email,
                  })
                }
              />
            </div>
            <Field label="טלפון">
              <input
                dir="ltr"
                className="input text-right"
                value={draft.phone}
                onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
              />
            </Field>
            <Field label="טלפון משרד">
              <input
                dir="ltr"
                className="input text-right"
                value={draft.office_phone}
                onChange={(e) => setDraft({ ...draft, office_phone: e.target.value })}
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
                  {[c.phone, c.office_phone ? `משרד ${c.office_phone}` : '', c.email, hospitalName(c.hospital_id), doctorName(c.doctor_id)]
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
                      office_phone: c.office_phone,
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
      {importing && <SmartContactImport onClose={() => setImporting(false)} />}
    </div>
  )
}

/* ---------------- Users ---------------- */

/* ---------------- shared row ---------------- */

function Row({
  label,
  onRename,
  onDelete,
  extra,
}: {
  label: string
  onRename: (v: string) => void
  onDelete: () => void
  extra?: React.ReactNode
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(label)

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
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
      {extra && <div className="basis-full">{extra}</div>}
    </li>
  )
}
