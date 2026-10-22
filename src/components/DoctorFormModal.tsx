import { useMemo, useRef, useState } from 'react'
import { AlertTriangle, Plus, Trash2 } from 'lucide-react'
import {
  useCompanies,
  useCreateDoctor,
  useDoctors,
  useHospitals,
  useProceduresRaw,
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
import { CADENCE_LABELS, cadenceLabel } from '../lib/cadence'
import { findDuplicateDoctors, stripTitle } from '../lib/contactMatch'
import { titleOptions } from '../lib/doctorStats'
import { DayPicker } from './DayPicker'
import { ProcedureRequestModal } from './ProcedureRequestModal'
import { procedureGroups } from '../lib/procedures'

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
        clinic_days: h.clinic_days ?? [],
        clinic_hours: h.clinic_hours ?? '',
        clinic_note: h.clinic_note ?? '',
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
  const phoneRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  /** a second click on Save while the first is still being written must not write twice */
  const busy = useRef(false)
  /** the person saw "a doctor like this exists" and pressed Save again */
  const [ackDup, setAckDup] = useState(false)

  const { names: stageNames } = usePipelineStages()
  const companies = useCompanies()
  const procedures = useProceduresRaw()
  const [requesting, setRequesting] = useState(false)
  const hospitals = useHospitals()
  const roboticSystems = useRoboticSystems()
  const createDoctor = useCreateDoctor()
  // what the form was opened with: the save writes only what is changed from it
  const [base] = useState(() => initialData(doctor))
  const updateDoctor = useUpdateDoctor(doctor?.id ?? '', doctor ? base : undefined)
  const saving = createDoctor.isPending || updateDoctor.isPending

  function patch(p: Partial<DoctorFormData>) {
    if ('name' in p || 'phone' in p || 'email' in p) {
      setAckDup(false)
      setError(null)
    }
    setData((d) => ({ ...d, ...p }))
  }

  // adding: is there a doctor like this one already? (the same phone / e-mail / name) — asked before a second copy is created
  const allDoctors = useDoctors()
  const dups = useMemo(
    () => (isEdit || data.name.trim().length < 2 ? [] : findDuplicateDoctors(data, allDoctors.data ?? [])),
    [isEdit, data, allDoctors.data],
  )
  const strongDup = dups.some((x) => x.reason !== 'similar')

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
  // a phone / e-mail that is wrong is refused; one that was already saved like that (and not touched now) does not block the save
  const phoneError = data.phone.trim() !== base.phone.trim() && data.phone.trim() && data.phone.replace(/\D/g, '').length < 7 ? 'מספר הטלפון קצר מדי' : undefined
  const emailError = data.email.trim() !== base.email.trim() && data.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim()) ? 'כתובת המייל לא תקינה' : undefined

  async function submit() {
    if (busy.current) return
    setError(null)
    if (!data.name.trim() || phoneError || emailError) {
      setTab('general')
      setTriedSave(true)
      // the fields are on the first tab: bring the cursor back to the first one that is wrong
      setTimeout(() => (!data.name.trim() ? nameRef : phoneError ? phoneRef : emailRef).current?.focus(), 0)
      return
    }
    if (strongDup && !ackDup) {
      setAckDup(true)
      setError('כבר יש רופא כזה במערכת. לחיצה נוספת על "שמירה" תיצור רופא חדש בכל זאת.')
      return
    }
    busy.current = true
    try {
      const clean = { ...data, name: data.name.replace(/\s+/g, ' ').trim(), position: data.position.trim(), phone: data.phone.trim(), email: data.email.trim() }
      if (isEdit) await updateDoctor.mutateAsync(clean)
      else await createDoctor.mutateAsync(clean)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שמירה נכשלה')
    } finally {
      busy.current = false
    }
  }

  const availableHospitals = hospitals.data ?? []
  const usedHospitalIds = data.hospitals.map((h) => h.hospital_id)

  return (
    <>
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
                  {titleOptions(base.title, TITLES).map((t) => (
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
              <Field label="טלפון" className="col-span-2 sm:col-span-1" error={triedSave ? phoneError : undefined}>
                <input
                  ref={phoneRef}
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
              <Field label="אימייל" className="col-span-2 sm:col-span-1" error={triedSave ? emailError : undefined}>
                <input
                  ref={emailRef}
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
              {dups.length > 0 && (
                <div role="status" className={`col-span-2 rounded-lg border px-3 py-2 text-sm ${ackDup ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                  <p className="mb-1 flex items-center gap-1.5 font-semibold">
                    <AlertTriangle size={14} className="shrink-0" />
                    {ackDup ? 'לחיצה נוספת על "שמירה" תיצור רופא חדש בכל זאת' : strongDup ? 'כבר יש רופא כזה במערכת — אולי זה אותו רופא?' : 'יש במערכת רופא עם שם דומה'}
                  </p>
                  <ul className="space-y-0.5 text-xs">
                    {dups.slice(0, 3).map(({ doctor: x, reason }) => (
                      <li key={x.id} dir="auto">
                        {x.title} {x.name}
                        {x.phone && ` · ${x.phone}`}
                        {` — ${reason === 'phone' ? 'אותו טלפון' : reason === 'email' ? 'אותו מייל' : reason === 'name' ? 'אותו שם' : 'שם דומה'}`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="col-span-2">
                <ImportContactButton
                  onPick={(c) =>
                    patch({
                      name: data.name || stripTitle(c.name),
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
                  {data.contact_cadence_days && !(data.contact_cadence_days in CADENCE_LABELS) && <option value={data.contact_cadence_days}>{cadenceLabel(data.contact_cadence_days)}</option>}
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
                    <div className="space-y-1.5 rounded-lg bg-slate-50 p-2">
                      <p className="text-xs font-medium text-slate-600">ימי מרפאה בבית החולים</p>
                      <DayPicker
                        label={`ימי מרפאה בבית חולים ${i + 1}`}
                        value={h.clinic_days}
                        onChange={(days) => {
                          const next = [...data.hospitals]
                          next[i] = { ...h, clinic_days: days }
                          patch({ hospitals: next })
                        }}
                      />
                      {h.clinic_days.length > 0 && (
                        <div className="grid gap-1.5 sm:grid-cols-2">
                          <input
                            className="input"
                            aria-label={`שעות המרפאה בבית חולים ${i + 1}`}
                            placeholder="שעות (לדוגמה 8:00–13:00)"
                            value={h.clinic_hours}
                            onChange={(e) => {
                              const next = [...data.hospitals]
                              next[i] = { ...h, clinic_hours: e.target.value }
                              patch({ hospitals: next })
                            }}
                          />
                          <input
                            className="input"
                            dir="auto"
                            aria-label={`הערה על המרפאה בבית חולים ${i + 1}`}
                            placeholder="הערה (לדוגמה: מרפאת ברך)"
                            value={h.clinic_note}
                            onChange={(e) => {
                              const next = [...data.hospitals]
                              next[i] = { ...h, clinic_note: e.target.value }
                              patch({ hospitals: next })
                            }}
                          />
                        </div>
                      )}
                    </div>
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
                      { hospital_id: '', role_at_hospital: '', sector: 'public', clinic_days: [], clinic_hours: '', clinic_note: '' },
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
            <div className="space-y-2">
              {procedureGroups(procedures.data ?? []).map(({ parent, children }) => {
                const row = (p: { id: string; name: string; is_mako?: boolean }, indent: boolean) => (
                  <label
                    key={p.id}
                    className={`flex min-h-[40px] items-center gap-3 rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50${indent ? ' mr-4' : ''}`}
                  >
                    <input type="checkbox" className="h-5 w-5 shrink-0" checked={data.procedureIds.includes(p.id)} onChange={() => toggleProcedure(p.id)} />
                    {p.name}
                    {p.is_mako && <span className="chip border-brand-200 bg-brand-50 text-brand-600">MAKO</span>}
                  </label>
                )
                // a procedure with sub-procedures is only a heading: the sub-procedure is what the doctor does
                if (children.length === 0) return row(parent, false)
                return (
                  <div key={parent.id} className="rounded-xl border border-slate-200 p-1">
                    <p className="px-2 pt-1 text-sm font-semibold text-slate-800">{parent.name}</p>
                    {children.map((c) => row(c, true))}
                  </div>
                )
              })}
            </div>
            <button type="button" className="btn-ghost mt-2 text-brand-700 max-sm:w-full" onClick={() => setRequesting(true)}>
              <Plus size={16} />
              ההליך לא ברשימה? בקש הליך חדש
            </button>
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
    {/* outside the form: its own submit must not reach the doctor form */}
    {requesting && <ProcedureRequestModal onClose={() => setRequesting(false)} doctorId={doctor?.id} doctorName={doctor ? `${doctor.title} ${doctor.name}` : undefined} />}
    </>
  )
}
