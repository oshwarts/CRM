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
import { SECTOR_LABELS, TITLES, type DoctorWithRelations } from '../lib/types'
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
    companyIds: compact(
      doctor?.doctor_companies.map((c) => c.company?.id) ?? [],
    ),
    procedureIds: compact(
      doctor?.doctor_procedures.map((p) => p.procedure?.id) ?? [],
    ),
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

  function toggle(list: 'companyIds' | 'procedureIds', id: string) {
    setData((d) => ({
      ...d,
      [list]: d[list].includes(id)
        ? d[list].filter((x) => x !== id)
        : [...d[list], id],
    }))
  }

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
          <Tab id="procedures">הליכים</Tab>
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
            <Field label="אימייל" className="sm:col-span-2">
              <input
                dir="ltr"
                className="input text-right"
                value={data.email}
                onChange={(e) => patch({ email: e.target.value })}
              />
            </Field>
            <Field label="הערות" className="sm:col-span-2">
              <textarea
                className="input min-h-24"
                value={data.notes}
                onChange={(e) => patch({ notes: e.target.value })}
                placeholder="הערות כלליות"
              />
            </Field>
            <Field label="חברות" className="sm:col-span-2">
              <MultiSelectChips
                options={companies.data ?? []}
                selected={data.companyIds}
                onToggle={(id) => toggle('companyIds', id)}
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
                    const hospitals = [...data.hospitals]
                    hospitals[i] = { ...h, hospital_id: e.target.value }
                    patch({ hospitals })
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
                    const hospitals = [...data.hospitals]
                    hospitals[i] = { ...h, role_at_hospital: e.target.value }
                    patch({ hospitals })
                  }}
                />
                <div className="flex items-center gap-2">
                  <select
                    className="input"
                    value={h.sector}
                    onChange={(e) => {
                      const hospitals = [...data.hospitals]
                      hospitals[i] = { ...h, sector: e.target.value }
                      patch({ hospitals })
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
          <Field label="הליכים שהרופא מבצע">
            <MultiSelectChips
              options={procedures.data ?? []}
              selected={data.procedureIds}
              onToggle={(id) => toggle('procedureIds', id)}
              labelOf={(p) => p.name}
            />
          </Field>
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
