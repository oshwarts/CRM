import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  useCompanies,
  useCreateDoctor,
  useHospitals,
  useProcedures,
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
    companyIds: compact(doctor?.doctor_companies.map((c) => c.company?.id) ?? []),
    procedureIds: compact(
      doctor?.doctor_procedures.map((p) => p.procedure?.id) ?? [],
    ),
    procedureStats:
      doctor?.doctor_procedure_stats.map((s) => ({
        procedure_id: s.procedure_id,
        volume: s.volume,
      })) ?? [],
    hospitals:
      doctor?.doctor_hospitals.map((h) => ({
        hospital_id: h.hospital_id,
        role_at_hospital: h.role_at_hospital,
        sector: h.sector,
      })) ?? [],
  }
}

export function DoctorFormModal({ open, onClose, doctor }: Props) {
  const isEdit = !!doctor
  const [tab, setTab] = useState('general')
  const [data, setData] = useState<DoctorFormData>(() => initialData(doctor))
  const [error, setError] = useState<string | null>(null)

  const companies = useCompanies()
  const procedures = useProcedures()
  const hospitals = useHospitals()
  const createDoctor = useCreateDoctor()
  const updateDoctor = useUpdateDoctor(doctor?.id ?? '')
  const saving = createDoctor.isPending || updateDoctor.isPending

  function patch(p: Partial<DoctorFormData>) {
    setData((d) => ({ ...d, ...p }))
  }

  function toggleCompany(id: string) {
    setData((d) => ({
      ...d,
      companyIds: d.companyIds.includes(id)
        ? d.companyIds.filter((x) => x !== id)
        : [...d.companyIds, id],
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

  function setVolume(procedureId: string, volume: number) {
    setData((d) => {
      const rest = d.procedureStats.filter((s) => s.procedure_id !== procedureId)
      return {
        ...d,
        procedureStats:
          volume > 0
            ? [...rest, { procedure_id: procedureId, volume }]
            : rest,
      }
    })
  }

  const volumeOf = (procedureId: string) =>
    data.procedureStats.find((s) => s.procedure_id === procedureId)?.volume ?? 0

  async function submit() {
    setError(null)
    if (!data.name.trim()) {
      setTab('general')
      setError('יש להזין שם רופא')
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
      <Tabs value={tab} onChange={setTab}>
        <TabList>
          <Tab id="general">פרטים כלליים</Tab>
          <Tab id="hospitals">בתי חולים</Tab>
          <Tab id="procedures">הליכים וכמויות</Tab>
          <Tab id="preop">תכנון טרום ניתוחי</Tab>
        </TabList>

        <TabPanel id="general">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="שם הרופא">
              <input
                className="input"
                value={data.name}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder="הזן שם הרופא"
              />
            </Field>
            <Field label="תואר">
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
            <Field label="תפקיד">
              <input
                className="input"
                value={data.position}
                onChange={(e) => patch({ position: e.target.value })}
                placeholder="לדוגמה: מנהל מחלקת אורתופדיה"
              />
            </Field>
            <Field label="טלפון">
              <input
                dir="ltr"
                className="input text-right"
                value={data.phone}
                onChange={(e) => patch({ phone: e.target.value })}
                placeholder="הזן מספר טלפון"
              />
            </Field>
            <Field label="אימייל">
              <input
                dir="ltr"
                className="input text-right"
                value={data.email}
                onChange={(e) => patch({ email: e.target.value })}
              />
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
            <Field label="הערות מעקב (תהליך מול רופא פוטנציאלי)" className="sm:col-span-2">
              <textarea
                className="input min-h-20"
                value={data.tracking_notes}
                onChange={(e) => patch({ tracking_notes: e.target.value })}
                placeholder="איפה עומד התהליך, מה הצעד הבא…"
              />
            </Field>
            <Field label="הערות כלליות" className="sm:col-span-2">
              <textarea
                className="input min-h-20"
                value={data.notes}
                onChange={(e) => patch({ notes: e.target.value })}
              />
            </Field>
            <Field label="חברות" className="sm:col-span-2">
              <MultiSelectChips
                options={companies.data ?? []}
                selected={data.companyIds}
                onToggle={toggleCompany}
                labelOf={(c) => c.name}
              />
            </Field>
          </div>
        </TabPanel>

        <TabPanel id="hospitals">
          <p className="text-sm text-slate-500">
            לרופא יכולים להיות מספר בתי חולים (למשל ציבורי ופרטי).
          </p>
          <div className="space-y-3">
            {data.hospitals.map((h, i) => (
              <div
                key={i}
                className="grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-[1fr_1fr_auto]"
              >
                <select
                  className="input"
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
                  placeholder="תפקיד בבית החולים"
                  value={h.role_at_hospital}
                  onChange={(e) => {
                    const next = [...data.hospitals]
                    next[i] = { ...h, role_at_hospital: e.target.value }
                    patch({ hospitals: next })
                  }}
                />
                <div className="flex items-center gap-2">
                  <select
                    className="input"
                    value={h.sector}
                    onChange={(e) => {
                      const next = [...data.hospitals]
                      next[i] = { ...h, sector: e.target.value }
                      patch({ hospitals: next })
                    }}
                  >
                    {Object.entries(SECTOR_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn-ghost !px-2 text-red-500"
                    onClick={() =>
                      patch({
                        hospitals: data.hospitals.filter((_, x) => x !== i),
                      })
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              className="btn-secondary"
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
          <p className="text-sm text-slate-500">
            סמן את ההליכים שהרופא מבצע והזן כמות ניתוחים מצטברת לכל הליך.
          </p>
          <div className="space-y-1">
            {(procedures.data ?? []).map((p) => {
              const on = data.procedureIds.includes(p.id)
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                >
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
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
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    כמות
                    <input
                      type="number"
                      min={0}
                      className="input w-20 py-1 text-center"
                      value={volumeOf(p.id) || ''}
                      onChange={(e) =>
                        setVolume(p.id, Math.max(0, Number(e.target.value) || 0))
                      }
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </TabPanel>

        <TabPanel id="preop">
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
            תכנון טרום־ניתוחי לרובוט MAKO (לפי הליך – ברך / ירך): העדפות מנתח,
            גישה ניתוחית וציוד נדרש – נערך בכרטיס הרופא לאחר השמירה, שם ניתן
            להוסיף תוכנית נפרדת לכל הליך.
          </div>
        </TabPanel>
      </Tabs>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="mt-5 flex justify-end gap-2 border-t border-slate-200 pt-4">
        <button className="btn-secondary" onClick={onClose}>
          ביטול
        </button>
        <button className="btn-primary" onClick={submit} disabled={saving}>
          {saving ? 'שומר…' : 'שמירה'}
        </button>
      </div>
    </Modal>
  )
}
