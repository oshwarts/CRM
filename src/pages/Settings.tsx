import { PipelineStagesSettings } from '../components/PipelineStagesSettings'
import { RobotLinks } from '../components/RobotLinks'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { UploadRequests } from '../components/UploadRequests'
import { SystemHealth } from '../components/SystemHealth'
import { useAuth } from '../context/AuthProvider'
import { BookUser, Check, FileUp, Image as ImageIcon, Pencil, Plus, Trash2 } from 'lucide-react'
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
import { EmptyRow, ListSearch, Section } from '../components/SettingsKit'
import { normalizeHe } from '../lib/contactMatch'

/** the areas of the settings, in the order of the tabs (on the phone they are a list to choose from) */
const AREAS: [id: string, label: string][] = [
  ['lists', 'רשימות'],
  ['procedures', 'הליכים'],
  ['equipment', 'ציוד'],
  ['implants', 'מידות שתל'],
  ['consumables', 'מתכלים'],
  ['course', 'מהלך ניתוחי'],
  ['info', 'מידע קליני'],
  ['hospitals', 'בתי חולים'],
  ['contacts', 'אנשי קשר'],
  ['uploads', 'אישורי העלאה'],
  ['health', 'בריאות המערכת'],
]

export default function Settings() {
  const [params] = useSearchParams()
  const [tab, setTab] = useState(params.get('tab') ?? 'lists')

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-brand-800 sm:text-3xl">הגדרות</h1>

      <Tabs value={tab} onChange={setTab}>
        {/* phone: 11 tabs do not fit in a row, so the area is picked from a list; wider screens keep the tabs */}
        <div className="sm:hidden">
          <label className="label" htmlFor="settings-area">
            אזור בהגדרות
          </label>
          <select id="settings-area" className="input font-semibold" value={tab} onChange={(e) => setTab(e.target.value)}>
            {AREAS.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="hidden sm:block">
          <TabList>
            {AREAS.map(([id, label]) => (
              <Tab key={id} id={id}>
                {label}
              </Tab>
            ))}
          </TabList>
        </div>

        <TabPanel id="lists">
          <div className="grid items-start gap-3 lg:grid-cols-2">
            <SimpleListSettings
              title="חברות"
              placeholder="שם חברה חדשה"
              defaultOpen
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
        <TabPanel id="health">
          <SystemHealth />
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
  defaultOpen,
}: {
  title: string
  placeholder: string
  useList: ListHook
  useUpsert: UpsertHook
  useDelete: DeleteHook
  /** shown under each row (for example the robots of a company) */
  extra?: (id: string) => React.ReactNode
  defaultOpen?: boolean
}) {
  const list = useList()
  const upsert = useUpsert()
  const del = useDelete()
  const [name, setName] = useState('')

  return (
    <Section title={title} count={list.data?.length} defaultOpen={defaultOpen}>
      <form
        className="mb-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (!name.trim()) return
          upsert.mutate({ name: name.trim() })
          setName('')
        }}
      >
        <input className="input" aria-label={`${title}: שם חדש`} enterKeyHint="done" placeholder={placeholder} value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn-primary shrink-0" disabled={!name.trim()}>
          <Plus size={16} aria-hidden />
          הוסף
        </button>
      </form>
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
          {(list.data ?? []).length === 0 && <EmptyRow>הרשימה ריקה. הוסף את הפריט הראשון למעלה.</EmptyRow>}
        </ul>
      )}
    </Section>
  )
}

/* ---------------- Procedures ---------------- */

function ProceduresSettings() {
  const procedures = useProcedures()
  const upsert = useUpsertProcedure()
  const del = useDeleteProcedure()
  const [form, setForm] = useState({ name: '', category: 'knee', is_mako: false })

  return (
    <div className="card space-y-4 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-800">הליכים</h2>
        <span className="text-sm text-slate-500">{procedures.data?.length ?? 0} הליכים</span>
      </div>
      <form
        className="grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center"
        onSubmit={(e) => {
          e.preventDefault()
          if (!form.name.trim()) return
          upsert.mutate({ ...form, name: form.name.trim() })
          setForm({ name: '', category: 'knee', is_mako: false })
        }}
      >
        <input className="input" aria-label="שם ההליך" enterKeyHint="done" placeholder="שם ההליך החדש" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <div className="grid grid-cols-[1fr_auto] items-center gap-2 sm:contents">
          <select className="input" aria-label="קטגוריה" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {Object.entries(PROCEDURE_CATEGORY_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <label className="flex min-h-[40px] items-center gap-2 px-1 text-sm text-slate-700">
            <input type="checkbox" className="h-5 w-5" checked={form.is_mako} onChange={(e) => setForm({ ...form, is_mako: e.target.checked })} />
            MAKO
          </label>
        </div>
        <button className="btn-primary" disabled={!form.name.trim()}>
          <Plus size={16} aria-hidden />
          הוסף הליך
        </button>
      </form>
      {procedures.isLoading ? (
        <Spinner />
      ) : (
        <ul className="divide-y divide-slate-100">
          {(procedures.data ?? []).map((p) => (
            <li key={p.id} className="flex items-center gap-2 py-1.5 text-sm">
              <span className="min-w-0 flex-1 text-slate-800">
                <span className="[overflow-wrap:anywhere]">{p.name}</span>
                <span className="block text-xs text-slate-500">
                  {PROCEDURE_CATEGORY_LABELS[p.category] ?? p.category}
                  {p.is_mako ? ' · MAKO' : ''}
                </span>
              </span>
              <ConfirmButton className="btn-ghost !px-2 text-red-600" label={`מחק את ${p.name}`} onConfirm={() => del.mutate(p.id)}>
                <Trash2 size={16} />
              </ConfirmButton>
            </li>
          ))}
          {(procedures.data ?? []).length === 0 && <EmptyRow>עוד לא הוגדרו הליכים.</EmptyRow>}
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
  const [q, setQ] = useState('')

  const shown = useMemo(() => {
    const words = normalizeHe(q).split(' ').filter(Boolean)
    return (items.data ?? []).filter((it) => {
      if (!words.length) return true
      const hay = normalizeHe(`${it.name} ${it.catalog_number} ${it.company?.name ?? ''}`)
      return words.every((w) => hay.includes(w))
    })
  }, [items.data, q])

  return (
    <div className="card space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-800">
          ציוד לניתוח <span className="text-sm font-normal text-slate-500">{items.data?.length ?? 0}</span>
        </h2>
        <div className="grid w-full grid-cols-2 gap-2 sm:w-auto">
          <button className="btn-secondary" onClick={() => setImporting(true)}>
            <FileUp size={16} aria-hidden />
            ייבוא מ-PDF
          </button>
          <button className="btn-primary" onClick={() => setEditing('new')}>
            <Plus size={16} aria-hidden />
            ציוד חדש
          </button>
        </div>
      </div>
      <p className="text-sm text-slate-600">בדרך כלל מגשי מכשירים. לכל פריט אפשר להוסיף תמונה ורשימת מק״טים, ולצפות בהם בלחיצה על השם.</p>
      {(items.data ?? []).length > 5 && <ListSearch value={q} onChange={setQ} label="חיפוש ציוד" placeholder="חיפוש לפי שם, מק״ט או חברה…" />}
      {items.isLoading ? (
        <Spinner />
      ) : (
        <ul className="divide-y divide-slate-100">
          {shown.map((it) => (
            <li key={it.id} className="flex items-center gap-1 py-1.5 text-sm">
              <button className="min-w-0 flex-1 py-1 text-right" onClick={() => setViewing(it)}>
                <span className="block font-medium text-slate-800 [overflow-wrap:anywhere] hover:underline" dir="auto">
                  {it.name}
                </span>
                {(it.catalog_number || it.company?.name) && (
                  <span className="block text-xs text-slate-500" dir="auto">
                    {[it.catalog_number, it.company?.name].filter(Boolean).join(' · ')}
                  </span>
                )}
                <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                  {itemImages(it).length > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <ImageIcon size={12} aria-hidden /> {itemImages(it).length > 1 ? `${itemImages(it).length} תמונות` : 'תמונה'}
                    </span>
                  )}
                  {it.parts.length > 0 && <span>{it.parts.length} מק״טים</span>}
                </span>
              </button>
              <button className="btn-ghost !px-2" onClick={() => setEditing(it)} aria-label={`עריכת ${it.name}`}>
                <Pencil size={16} />
              </button>
              <ConfirmButton className="btn-ghost !px-2 text-red-600" label={`מחק את ${it.name}`} onConfirm={() => del.mutate(it.id)}>
                <Trash2 size={16} />
              </ConfirmButton>
            </li>
          ))}
          {(items.data ?? []).length === 0 && <EmptyRow>הקטלוג ריק. הוסף ציוד, או ייבא מגשים מקובץ PDF.</EmptyRow>}
          {(items.data ?? []).length > 0 && shown.length === 0 && <EmptyRow>לא נמצא ציוד שמתאים לחיפוש.</EmptyRow>}
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
  const [q, setQ] = useState('')

  const shown = useMemo(() => {
    const words = normalizeHe(q).split(' ').filter(Boolean)
    return (hospitals.data ?? []).filter((h) => {
      if (!words.length) return true
      const hay = normalizeHe(`${h.name} ${h.city} ${h.organization?.name ?? ''}`)
      return words.every((w) => hay.includes(w))
    })
  }, [hospitals.data, q])

  return (
    <div className="card space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-800">
          בתי חולים <span className="text-sm font-normal text-slate-500">{hospitals.data?.length ?? 0}</span>
        </h2>
        <button className="btn-primary max-sm:w-full" onClick={() => setEditing('new')}>
          <Plus size={16} aria-hidden />
          בית חולים חדש
        </button>
      </div>
      {(hospitals.data ?? []).length > 5 && <ListSearch value={q} onChange={setQ} label="חיפוש בית חולים" placeholder="חיפוש לפי שם, עיר או ארגון…" />}
      {hospitals.isLoading ? (
        <Spinner />
      ) : (
        <ul className="divide-y divide-slate-100">
          {shown.map((h) => {
            const assigned = (hospitalAgents.data ?? [])
              .filter((ha) => ha.hospital_id === h.id)
              .map((ha) => (agents.data ?? []).find((a) => a.id === ha.agent_id)?.full_name)
              .filter(Boolean)
            return (
              <li key={h.id} className="flex items-center gap-1 py-1.5 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-800 [overflow-wrap:anywhere]">{h.name}</p>
                  <p className="text-xs text-slate-500">
                    {[h.city, h.organization?.name].filter(Boolean).join(' · ')}
                    {h.lat == null && <span className="mr-1 font-medium text-amber-700">{h.city || h.organization ? ' · ' : ''}ללא מיקום במפה</span>}
                  </p>
                  {assigned.length > 0 && <p className="text-xs text-brand-700">סוכן מטפל: {assigned.join(', ')}</p>}
                </div>
                <button className="btn-ghost !px-2" onClick={() => setEditing(h)} aria-label={`עריכת ${h.name}`}>
                  <Pencil size={16} />
                </button>
                {isAdmin && (
                  <ConfirmButton className="btn-ghost !px-2 text-red-600" label={`מחק את ${h.name}`} onConfirm={() => del.mutate(h.id)}>
                    <Trash2 size={16} />
                  </ConfirmButton>
                )}
              </li>
            )
          })}
          {(hospitals.data ?? []).length === 0 && <EmptyRow>עוד לא הוגדרו בתי חולים.</EmptyRow>}
          {(hospitals.data ?? []).length > 0 && shown.length === 0 && <EmptyRow>לא נמצא בית חולים שמתאים לחיפוש.</EmptyRow>}
        </ul>
      )}

      {editing && <HospitalModal hospital={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function HospitalModal({ hospital, onClose }: { hospital?: HospitalListItem; onClose: () => void }) {
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
  const [systemIds, setSystemIds] = useState<string[]>(hospital?.hospital_robotic_systems.map((r) => r.system_id) ?? [])
  const [error, setError] = useState<string | null>(null)
  const [nameError, setNameError] = useState('')

  useEffect(() => {
    if (!hospital) return
    setAgentIds((hospitalAgents.data ?? []).filter((ha) => ha.hospital_id === hospital.id).map((ha) => ha.agent_id))
  }, [hospital, hospitalAgents.data])

  const hospitalDoctors = (doctors.data ?? []).filter((d) => (hospital ? d.doctor_hospitals.some((h) => h.hospital_id === hospital.id) : false))

  async function save() {
    setError(null)
    setNameError('')
    if (!form.name.trim()) {
      setNameError('יש להזין שם בית חולים')
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
    <Modal open onClose={onClose} title={hospital ? 'עריכת בית חולים' : 'בית חולים חדש'}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="שם" error={nameError} className="sm:col-span-2">
          <input className="input" value={form.name} autoComplete="off" onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="עיר">
          <input className="input" value={form.city} autoComplete="off" onChange={(e) => setForm({ ...form, city: e.target.value })} />
        </Field>
        <Field label="ארגון">
          <select className="input" value={form.organization_id} onChange={(e) => setForm({ ...form, organization_id: e.target.value })}>
            <option value="">— ללא —</option>
            {(organizations.data ?? []).map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="סקטור (פרטי / ציבורי)" className="sm:col-span-2">
          <select className="input" value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })}>
            {Object.entries(SECTOR_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">ההגדרה כאן קבועה לבית החולים ומשפיעה על כל הרופאים המקושרים אליו.</p>
        </Field>
        <Field label="כתובת" className="sm:col-span-2">
          <input className="input" value={form.address} autoComplete="off" onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3 sm:col-span-2">
          <Field label="קו רוחב (lat)">
            <input dir="ltr" inputMode="decimal" className="input text-right" value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} placeholder="31.7683" />
          </Field>
          <Field label="קו אורך (lng)">
            <input dir="ltr" inputMode="decimal" className="input text-right" value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} placeholder="35.2137" />
          </Field>
        </div>
      </div>

      <div className="mt-4">
        <Field label="סוכן מטפל">
          <MultiSelectChips
            options={(agents.data ?? []).map((a) => ({ id: a.id, label: a.full_name || a.email }))}
            selected={agentIds}
            onToggle={(id) => setAgentIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))}
            labelOf={(o) => o.label}
          />
        </Field>
      </div>

      <div className="mt-4">
        <Field label="רובוטיקה בבית החולים">
          <MultiSelectChips
            options={roboticSystems.data ?? []}
            selected={systemIds}
            onToggle={(id) => setSystemIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))}
            labelOf={(o) => o.name}
          />
        </Field>
      </div>

      {hospital && (
        <div className="mt-4 border-t border-slate-200 pt-4">
          <p className="mb-2 text-sm font-medium text-slate-600">כמויות מקרים</p>
          {hospitalDoctors.length === 0 ? (
            <p className="text-sm text-slate-500">אין רופאים משויכים לבית חולים זה. שייך רופא (בכרטיס הרופא) כדי להזין כמויות.</p>
          ) : (
            <CaseVolumesEditor hospitalId={hospital.id} entityOptions={hospitalDoctors.map((d) => ({ id: d.id, label: `${d.title} ${d.name}` }))} />
          )}
        </div>
      )}

      {hospital && (
        <div className="mt-4 border-t border-slate-200 pt-4">
          <ContactsSection hospitalId={hospital.id} />
        </div>
      )}

      <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
        {error && (
          <p role="alert" className="basis-full rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
        <button className="btn-secondary" onClick={onClose}>
          ביטול
        </button>
        <button className="btn-primary" onClick={save} disabled={upsert.isPending || setAgents.isPending || setSystems.isPending}>
          {upsert.isPending || setAgents.isPending || setSystems.isPending ? 'שומר…' : 'שמירה'}
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
type ContactDraft = typeof EMPTY_CONTACT & { id?: string }

function ContactsSettings() {
  const contacts = useContacts()
  const hospitals = useHospitals()
  const doctors = useDoctors()
  const upsert = useUpsertContact()
  const del = useDeleteContact()
  const [importing, setImporting] = useState(false)
  const [draft, setDraft] = useState<ContactDraft | null>(null)
  const [q, setQ] = useState('')

  const hospitalName = (id: string | null) => hospitals.data?.find((h) => h.id === id)?.name
  const doctorName = (id: string | null) => {
    const d = doctors.data?.find((x) => x.id === id)
    return d ? `${d.title} ${d.name}` : undefined
  }

  const shown = useMemo(() => {
    const words = normalizeHe(q).split(' ').filter(Boolean)
    return (contacts.data ?? []).filter((c) => {
      if (!words.length) return true
      const hay = normalizeHe(`${c.name} ${c.role} ${c.phone} ${c.office_phone} ${c.email} ${hospitals.data?.find((h) => h.id === c.hospital_id)?.name ?? ''}`)
      return words.every((w) => hay.includes(w))
    })
  }, [contacts.data, hospitals.data, q])

  return (
    <div className="card space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-800">
          אנשי קשר <span className="text-sm font-normal text-slate-500">{contacts.data?.length ?? 0}</span>
        </h2>
        <div className="grid w-full grid-cols-2 gap-2 sm:w-auto">
          <button className="btn-secondary" onClick={() => setImporting(true)}>
            <BookUser size={16} aria-hidden />
            ייבוא מהטלפון
          </button>
          <button className="btn-primary" onClick={() => setDraft({ ...EMPTY_CONTACT })}>
            <Plus size={16} aria-hidden />
            איש קשר חדש
          </button>
        </div>
      </div>
      <p className="text-sm text-slate-600">
        איש קשר של <b>בית חולים</b> הוא עובד בבית החולים (מזכירת רופא, אחות ראשית, אחים בחדרי ניתוח, מכון דימות, רכש…) ואינו חייב להיות משויך לרופא. איש קשר של <b>רופא</b> הוא בדרך כלל המזכירה שלו.
      </p>
      {(contacts.data ?? []).length > 5 && <ListSearch value={q} onChange={setQ} label="חיפוש איש קשר" placeholder="חיפוש לפי שם, תפקיד, טלפון…" />}

      {contacts.isLoading ? (
        <Spinner />
      ) : (
        <ul className="divide-y divide-slate-100">
          {shown.map((c) => {
            const where = [hospitalName(c.hospital_id), doctorName(c.doctor_id)].filter(Boolean).join(' · ')
            return (
              <li key={c.id} className="flex items-center gap-1 py-1.5 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-800 [overflow-wrap:anywhere]">
                    {c.name}
                    {c.role && <span className="mr-2 text-xs font-normal text-slate-500">{c.role}</span>}
                  </p>
                  {where && <p className="text-xs text-slate-500">{where}</p>}
                  <p className="flex flex-wrap gap-x-3 text-xs text-slate-600" dir="ltr">
                    {c.phone && <a href={`tel:${c.phone}`} className="inline-flex min-h-[32px] items-center">{c.phone}</a>}
                    {c.office_phone && <a href={`tel:${c.office_phone}`} className="inline-flex min-h-[32px] items-center">{c.office_phone}</a>}
                    {c.email && (
                      <a href={`mailto:${c.email}`} className="inline-flex min-h-[32px] items-center [overflow-wrap:anywhere]">
                        {c.email}
                      </a>
                    )}
                    {!c.phone && !c.office_phone && !c.email && <span className="text-slate-500">—</span>}
                  </p>
                </div>
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
                  aria-label={`עריכת ${c.name}`}
                >
                  <Pencil size={16} />
                </button>
                <ConfirmButton className="btn-ghost !px-2 text-red-600" label={`מחק את ${c.name}`} onConfirm={() => del.mutate(c.id)}>
                  <Trash2 size={16} />
                </ConfirmButton>
              </li>
            )
          })}
          {(contacts.data ?? []).length === 0 && <EmptyRow>אין אנשי קשר. אפשר להוסיף גם דרך כרטיס רופא או עריכת בית חולים.</EmptyRow>}
          {(contacts.data ?? []).length > 0 && shown.length === 0 && <EmptyRow>לא נמצא איש קשר שמתאים לחיפוש.</EmptyRow>}
        </ul>
      )}
      {draft && (
        <ContactModal
          draft={draft}
          setDraft={setDraft}
          hospitals={hospitals.data ?? []}
          doctors={doctors.data ?? []}
          saving={upsert.isPending}
          onClose={() => setDraft(null)}
          onSave={async () => {
            if (!draft.name.trim()) return
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
          }}
        />
      )}
      {importing && <SmartContactImport onClose={() => setImporting(false)} />}
    </div>
  )
}

/** add / edit one contact: a dialog, so that the form is in front of the user wherever in the list the contact was */
function ContactModal({
  draft,
  setDraft,
  hospitals,
  doctors,
  saving,
  onClose,
  onSave,
}: {
  draft: ContactDraft
  setDraft: (d: ContactDraft) => void
  hospitals: { id: string; name: string }[]
  doctors: { id: string; title: string; name: string }[]
  saving: boolean
  onClose: () => void
  onSave: () => Promise<void>
}) {
  const [error, setError] = useState('')
  const [nameError, setNameError] = useState('')
  return (
    <Modal open onClose={onClose} title={draft.id ? 'עריכת איש קשר' : 'איש קשר חדש'}>
      <div className="grid gap-3 sm:grid-cols-2">
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
        <Field label="שם" error={nameError}>
          <input className="input" autoComplete="off" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </Field>
        <Field label="תפקיד">
          <input className="input" list="settings-contact-roles" placeholder="בחר מהרשימה או כתוב תפקיד חופשי" value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })} />
          <datalist id="settings-contact-roles">
            {CONTACT_ROLES.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </Field>
        <Field label="טלפון">
          <input dir="ltr" type="tel" inputMode="tel" autoComplete="off" className="input text-right" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
        </Field>
        <Field label="טלפון משרד">
          <input dir="ltr" type="tel" inputMode="tel" autoComplete="off" className="input text-right" value={draft.office_phone} onChange={(e) => setDraft({ ...draft, office_phone: e.target.value })} />
        </Field>
        <Field label="אימייל" className="sm:col-span-2">
          <input dir="ltr" type="email" inputMode="email" autoComplete="off" autoCapitalize="none" className="input text-right" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
        </Field>
        <Field label="שיוך לבית חולים">
          <select className="input" value={draft.hospital_id} onChange={(e) => setDraft({ ...draft, hospital_id: e.target.value })}>
            <option value="">— ללא —</option>
            {hospitals.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="שיוך לרופא">
          <select className="input" value={draft.doctor_id} onChange={(e) => setDraft({ ...draft, doctor_id: e.target.value })}>
            <option value="">— ללא —</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title} {d.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="הערות" className="sm:col-span-2">
          <input className="input" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
        </Field>
      </div>
      <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
        {error && (
          <p role="alert" className="basis-full rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
        <button className="btn-secondary" onClick={onClose}>
          ביטול
        </button>
        <button
          className="btn-primary"
          disabled={saving}
          onClick={async () => {
            setError('')
            if (!draft.name.trim()) return setNameError('יש להזין שם')
            setNameError('')
            try {
              await onSave()
            } catch (e) {
              setError(e instanceof Error ? e.message : 'השמירה נכשלה')
            }
          }}
        >
          {saving ? 'שומר…' : 'שמירה'}
        </button>
      </div>
    </Modal>
  )
}

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

  function done() {
    if (value.trim()) onRename(value.trim())
    setEditing(false)
  }
  function cancel() {
    setValue(label)
    setEditing(false)
  }

  return (
    <li className="py-1.5 text-sm">
      {editing ? (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            done()
          }}
        >
          <input
            className="input basis-full sm:max-w-xs sm:basis-auto sm:flex-1"
            aria-label={`שם חדש במקום ${label}`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && cancel()}
            enterKeyHint="done"
            autoFocus
          />
          <button className="btn-primary flex-1 sm:flex-none">
            <Check size={16} aria-hidden />
            שמור
          </button>
          <button type="button" className="btn-secondary flex-1 sm:flex-none" onClick={cancel}>
            ביטול
          </button>
        </form>
      ) : (
        <div className="flex items-center gap-1">
          <span className="min-w-0 flex-1 py-1 font-medium text-slate-800 [overflow-wrap:anywhere]">{label}</span>
          <button className="btn-ghost !px-2" onClick={() => setEditing(true)} aria-label={`שנה שם של ${label}`}>
            <Pencil size={16} />
          </button>
          <ConfirmButton className="btn-ghost !px-2 text-red-600" label={`מחק את ${label}`} onConfirm={onDelete}>
            <Trash2 size={16} />
          </ConfirmButton>
        </div>
      )}
      {extra && !editing && <div className="mt-1">{extra}</div>}
    </li>
  )
}
