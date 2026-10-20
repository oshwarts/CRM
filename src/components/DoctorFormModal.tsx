import { useRef, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  useCompanies,
  useCreateDoctor,
  useHospitals,
  useProcedures,
  useRoboticSystems,
  useUpdateDoctor,
  type DoctorFormData,
} from '../lib/api'
import {
  DOCTOR_STATUS_LABELS,
  SECTOR_LABELS,
  TITLES,
  type DoctorWithRelations,
} from '../lib/types'
import {
  Field,
  Modal,
  MultiSelectChips,
  Tab,
  TabList,
  TabPanel,
  Tabs,
} from './ui'
import { ImportContactButton } from './ImportContactButton'
import { CADENCE_LABELS } from '../lib/cadence'

type Props = {
  open: boolean
  onClose: () => void
  doctor?: DoctorWithRelations
}

function compact(list: (string | undefined)[]): string[] {
  return list.filter((x): x is string => !!x)
}

function initialData(doctor?: DoctorWithRelations): DoctorFormData {
  return {
    name: doctor?.name ?? '',
    title: doctor?.title ?? 'דוקטור',
    position: doctor?.position ?? '',
    phone: doctor?.phone ?? '',
    email: doctor?.email ?? '',
    notes: doctor?.notes ?? '',
    status: doctor?.status ?? 'client',
    tracking_notes: doctor?.tracking_notes ?? '',
    pipeline_stage: doctor?.pipeline_stage ?? '',
    next_step: doctor?.next_step ?? '',
    next_step_date: doctor?.next_step_date ?? null,
    contact_cadence_days: doctor?.contact_cadence_days ?? null,
    companyIds: compact(doctor?.doctor_companies.map((c) => c.company?.id) ?? []),
    procedureIds: compact(
      doctor?.doctor_procedures.map((p) => p.procedure?.id) ?? [],
    ),
    roboticSystemIds: compact(
      doctor?.doctor_robotic_systems.map((r) => r.system?.id) ?? [],
    ),
    hospitals:
      doctor?.doctor_hospitals.map((h) => ({
        hospital_id: h.hospital_id,
        role_at_hospital: h.role_at_hospital,
        sector: h.sector,
      })) ?? [],
  }
}

import { usePipelineStages } from '../lib/pipeline'

export function DoctorFormModal({ open, onClose, doctor }: Props) {
  const isEdit = !!doctor
  const [tab, setTab] = useState('general')
  const [data, setData] = useState<DoctorFormData>(() => initialData(doctor))
  const [error, setError] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  const { names: stageNames } = usePipelineStages()
  const companies = useCompanies()
  const procedures = useProcedures()
  const hospitals = useHospitals()
  const roboticSystems = useRoboticSystems()
  const createDoctor = useCreateDoctor()
  // what the form was opened with: the save writes only what is changed from it
  const [base] = useState(() => initialData(doctor))
  const updateDoctor = useUpdateDoctor(doctor?.id ?? '', doctor ? base : undefined)
  const saving = createDoctor.isPending || updateDoctor.isPending

  function patch(p: Partial<DoctorFormData>) {
    setData((d) => ({ ...d, ...p }))
  }

  function toggleId(list: 'companyIds' | 'roboticSystemIds', id: string) {
    setData((d) => ({
      ...d,
      [list]: d[list].includes(id)
        ? d[list].filter((x) => x !== id)
        : [...d[list], id],
    }))
  }

  function toggleProcedure(id: string) {
    setData((d) => ({
      ...d,
      procedureIds: d.procedureIds.includes(id)
        ? d.procedureIds.filter((x) => x !== id)
        : [...d.procedureIds, id],
    }))
  }

  const [triedSave, setTriedSave] = useState(false)

  async function submit() {
    setError(null)
    if (!data.name.trim()) {
      setTab('general')
      setTriedSave(true)
      // the name field is on the first tab: bring the cursor back to it
      setTimeout(() => nameRef.current?.focus(), 0)
      return
    }
    try {
      if (isEdit) await updateDoctor.mutateAsync(data)
      else await createDoctor.mutateAsync(data)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שמירה נכשלה')
    }
  }

  const availableHospitals = hospitals.data ?? []
  const usedHospitalIds = data.hospitals.map((h) => h.hospital_id)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'עריכת רופא' : 'הוספת רופא חדש'}
      size="xl"
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <Tabs value={tab} onChange={setTab}>
          <TabList>
            <Tab id="general">פרטים כלליים</Tab>
            <Tab id="hospitals">בתי חולים{data.hospitals.length > 0 ? ` (${data.hospitals.length})` : ''}</Tab>
            <Tab id="procedures">הליכים{data.procedureIds.length > 0 ? ` (${data.procedureIds.length})` : ''}</Tab>
          </TabList>

          <TabPanel id="general">
            <div className="grid grid-cols-2 gap-x-3 gap-y-3.5 sm:gap-4">
              <Field label="שם הרופא" className="col-span-2 sm:col-span-1" error={triedSave && !data.name.trim() ? 'יש להזין שם רופא' : undefined}>
                <input
                  ref={nameRef}
                  className="input"
                  autoComplete="off"
                  enterKeyHint="next"
                  value={data.name}
                  onChange={(e) => patch({ name: e.target.value })}
                  placeholder="הזן שם הרופא"
                />
              </Field>
              <Field label="תואר" className="sm:col-span-1">
                <select
                  className="input"
                  value={data.title}
                  onChange={(e) => patch({ title: e.target.value })}
                >
                  {TITLES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <Field label="סטטוס">
                <select
                  className="input"
                  value={data.status}
                  onChange={(e) => patch({ status: e.target.value })}
                >
                  {Object.entries(DOCTOR_STATUS_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="תפקיד" className="col-span-2">
                <input
                  className="input"
                  autoComplete="off"
                  enterKeyHint="next"
                  value={data.position}
                  onChange={(e) => patch({ position: e.target.value })}
                  placeholder="לדוגמה: מנהל מחלקת אורתופדיה"
                />
              </Field>
              <Field label="טלפון" className="col-span-2 sm:col-span-1">
                <input
                  dir="ltr"
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  className="input text-right"
                  value={data.phone}
                  onChange={(e) => patch({ phone: e.target.value })}
                  placeholder="הזן מספר טלפון"
                />
              </Field>
              <Field label="אימייל" className="col-span-2 sm:col-span-1">
                <input
                  dir="ltr"
                  type="email"
                  inputMode="email"
                  autoComplete="off"
                  autoCapitalize="none"
                  className="input text-right"
                  value={data.email}
                  onChange={(e) => patch({ email: e.target.value })}
                />
              </Field>
              <div className="col-span-2">
                <ImportContactButton
                  onPick={(c) =>
                    patch({
                      name: data.name || c.name,
                      phone: c.phone || data.phone,
                      email: c.email || data.email,
                    })
                  }
                />
              </div>

              {data.status === 'potential' && (
                <div className="col-span-2 grid grid-cols-2 gap-x-3 gap-y-3.5 rounded-xl border border-amber-200 bg-amber-50/50 p-3 sm:gap-4">
                  <Field label="שלב בתהליך" className="col-span-2 sm:col-span-1">
                    <select className="input" value={data.pipeline_stage} onChange={(e) => patch({ pipeline_stage: e.target.value })}>
                      <option value="">לא הוגדר</option>
                      {(stageNames.includes(data.pipeline_stage) || !data.pipeline_stage ? stageNames : [data.pipeline_stage, ...stageNames]).map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="תאריך צעד הבא" className="col-span-2 sm:col-span-1">
                    <input
                      type="date"
                      className="input"
                      value={data.next_step_date ?? ''}
                      onChange={(e) =>
                        patch({ next_step_date: e.target.value || null })
                      }
                    />
                  </Field>
                  <Field label="הצעד הבא" className="col-span-2">
                    <input className="input" dir="auto" enterKeyHint="next" value={data.next_step} onChange={(e) => patch({ next_step: e.target.value })} placeholder="לדוגמה: להציג את המערכת בישיבת המחלקה" />
                  </Field>
                </div>
              )}

              <Field label="קצב קשר רצוי עם הרופא" className="col-span-2 sm:col-span-1">
                <select
                  className="input"
                  value={data.contact_cadence_days ?? ''}
                  onChange={(e) => patch({ contact_cadence_days: e.target.value ? Number(e.target.value) : null })}
                >
                  <option value="">ללא (לא נעקב)</option>
                  {Object.entries(CADENCE_LABELS).map(([days, label]) => (
                    <option key={days} value={days}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                label={
                  data.status === 'potential'
                    ? 'הערות מעקב (התהליך מול הרופא)'
                    : 'הערות מעקב'
                }
                className="col-span-2"
              >
                <textarea
                  className="input min-h-20"
                  value={data.tracking_notes}
                  onChange={(e) => patch({ tracking_notes: e.target.value })}
                  placeholder="איפה עומד התהליך, מה הצעד הבא…"
                />
              </Field>
              <Field label="הערות כלליות" className="col-span-2">
                <textarea
                  className="input min-h-20"
                  value={data.notes}
                  onChange={(e) => patch({ notes: e.target.value })}
                />
              </Field>
              <Field label="חברות" className="col-span-2">
                <MultiSelectChips
                  options={companies.data ?? []}
                  selected={data.companyIds}
                  onToggle={(id) => toggleId('companyIds', id)}
                  labelOf={(c) => c.name}
                />
              </Field>
              <Field label="רובוטיקה בשימוש" className="col-span-2">
                <MultiSelectChips
                  options={roboticSystems.data ?? []}
                  selected={data.roboticSystemIds}
                  onToggle={(id) => toggleId('roboticSystemIds', id)}
                  labelOf={(r) => r.name}
                />
              </Field>
            </div>
          </TabPanel>

          <TabPanel id="hospitals">
            <p className="text-sm text-slate-600">
              לרופא יכולים להיות מספר בתי חולים (למשל ציבורי ופרטי).
            </p>
            <div className="space-y-3">
              {data.hospitals.length === 0 && (
                <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">עוד לא נבחר בית חולים</p>
              )}
              {data.hospitals.map((h, i) => {
                const sector = availableHospitals.find((o) => o.id === h.hospital_id)?.sector
                return (
                  <div key={i} className="grid gap-2.5 rounded-xl border border-slate-200 p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
                    <select
                      className="input"
                      aria-label={`בית חולים ${i + 1}`}
                      value={h.hospital_id}
                      onChange={(e) => {
                        const next = [...data.hospitals]
                        next[i] = { ...h, hospital_id: e.target.value }
                        patch({ hospitals: next })
                      }}
                    >
                      <option value="">בחר בית חולים…</option>
                      {availableHospitals
                        .filter(
                          (opt) =>
                            opt.id === h.hospital_id ||
                            !usedHospitalIds.includes(opt.id),
                        )
                        .map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.name}
                            {opt.city ? ` – ${opt.city}` : ''}
                          </option>
                        ))}
                    </select>
                    <input
                      className="input"
                      aria-label={`תפקיד בבית חולים ${i + 1}`}
                      autoComplete="off"
                      placeholder="תפקיד בבית החולים"
                      value={h.role_at_hospital}
                      onChange={(e) => {
                        const next = [...data.hospitals]
                        next[i] = { ...h, role_at_hospital: e.target.value }
                        patch({ hospitals: next })
                      }}
                    />
                    <div className="flex items-center justify-between gap-2">
                      {/* public / private belongs to the hospital — changed only in Settings */}
                      <span
                        className={
                          'chip shrink-0 ' +
                          (sector === 'private'
                            ? 'border-violet-200 bg-violet-50 text-violet-700'
                            : sector
                              ? 'border-sky-200 bg-sky-50 text-sky-700'
                              : 'border-slate-200 bg-slate-50 text-slate-500')
                        }
                        title="נקבע לפי בית החולים — ניתן לשינוי בהגדרות"
                      >
                        {sector ? (SECTOR_LABELS[sector] ?? sector) : 'ציבורי / פרטי'}
                      </span>
                      <button
                        type="button"
                        className="btn-ghost !px-2 text-red-600"
                        aria-label={`הסר את בית חולים ${i + 1}`}
                        title="הסר"
                        onClick={() =>
                          patch({
                            hospitals: data.hospitals.filter((_, x) => x !== i),
                          })
                        }
                      >
                        <Trash2 size={16} />
                        <span className="text-sm sm:hidden">הסר</span>
                      </button>
                    </div>
                  </div>
                )
              })}
              <button
                type="button"
                className="btn-secondary max-sm:w-full"
                onClick={() =>
                  patch({
                    hospitals: [
                      ...data.hospitals,
                      { hospital_id: '', role_at_hospital: '', sector: 'public' },
                    ],
                  })
                }
              >
                <Plus size={16} />
                הוסף בית חולים
              </button>
            </div>
          </TabPanel>

          <TabPanel id="procedures">
            <p className="text-sm text-slate-600">
              סמן את ההליכים שהרופא מבצע. כמויות מקרים שנתיות ותכנון טרום־ניתוחי (העדפות מנתח, גישה וציוד לכל הליך) נערכים בכרטיס הרופא לאחר השמירה.
            </p>
            <div className="space-y-1">
              {(procedures.data ?? []).map((p) => {
                const on = data.procedureIds.includes(p.id)
                return (
                  <label
                    key={p.id}
                    className="flex min-h-[40px] items-center gap-3 rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      className="h-5 w-5 shrink-0"
                      checked={on}
                      onChange={() => toggleProcedure(p.id)}
                    />
                    {p.name}
                    {p.is_mako && (
                      <span className="chip border-brand-200 bg-brand-50 text-brand-600">
                        MAKO
                      </span>
                    )}
                  </label>
                )
              })}
            </div>
          </TabPanel>
        </Tabs>

        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2 border-t border-slate-200 pt-4">
          <button type="button" className="btn-secondary" onClick={onClose}>
            ביטול
          </button>
          <button type="submit" className="btn-primary max-sm:flex-1" disabled={saving}>
            {saving ? 'שומר…' : 'שמירה'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
