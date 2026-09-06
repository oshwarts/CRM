import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowRight,
  Building2,
  Heart,
  Pencil,
  Phone,
  Plus,
  Trash2,
} from 'lucide-react'
import {
  useDeleteDoctor,
  useDeletePreopPlan,
  useDoctor,
  useDoctorMeetings,
  useFavorites,
  useProcedures,
  useSavePreopPlan,
  useToggleFavorite,
} from '../lib/api'
import { DoctorFormModal } from '../components/DoctorFormModal'
import { MeetingFormModal } from '../components/MeetingFormModal'
import { ContactsSection } from '../components/ContactsSection'
import { CaseVolumesEditor } from '../components/CaseVolumesEditor'
import {
  ConfirmButton,
  EmptyState,
  ErrorState,
  Field,
  Spinner,
  Tab,
  TabList,
  TabPanel,
  Tabs,
} from '../components/ui'
import {
  DOCTOR_STATUS_LABELS,
  MEETING_STATUS_LABELS,
  SECTOR_LABELS,
  type PreopPlanWithProcedure,
} from '../lib/types'
import { classNames, daysUntil, formatDate } from '../lib/utils'

export default function DoctorProfile() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const doctor = useDoctor(id)
  const meetings = useDoctorMeetings(id)
  const favorites = useFavorites()
  const toggleFav = useToggleFavorite()
  const deleteDoctor = useDeleteDoctor()

  const [tab, setTab] = useState('details')
  const [editing, setEditing] = useState(false)
  const [addMeeting, setAddMeeting] = useState(false)

  if (doctor.isLoading) return <Spinner />
  if (doctor.error) return <ErrorState error={doctor.error} />
  if (!doctor.data) return <EmptyState title="הרופא לא נמצא" />

  const d = doctor.data
  const isFav = (favorites.data ?? []).includes(d.id)
  const sortedMeetingDates = (meetings.data ?? [])
    .map((m) => m.meeting_date)
    .filter((x): x is string => !!x)
    .sort()
  const lastMeetingDate =
    sortedMeetingDates[sortedMeetingDates.length - 1] ?? null
  const daysSince =
    lastMeetingDate != null ? -(daysUntil(lastMeetingDate) ?? 0) : null

  return (
    <div className="space-y-5">
      <Link
        to="/doctors"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowRight size={15} />
        חזרה לרשימת הרופאים
      </Link>

      <div className="card flex flex-wrap items-start justify-between gap-4 p-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-800">
              {d.title} {d.name}
            </h1>
            <span
              className={classNames(
                'chip',
                d.status === 'potential'
                  ? 'border-amber-200 bg-amber-50 text-amber-700'
                  : 'border-green-200 bg-green-50 text-green-700',
              )}
            >
              {DOCTOR_STATUS_LABELS[d.status] ?? d.status}
            </span>
          </div>
          <p className="text-slate-500">{d.position || '—'}</p>
          <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-500">
            {d.phone && (
              <span className="inline-flex items-center gap-1" dir="ltr">
                <Phone size={14} /> {d.phone}
              </span>
            )}
            {d.doctor_companies.length > 0 && (
              <span className="inline-flex items-center gap-1">
                {d.doctor_companies.map((c) => c.company?.name).filter(Boolean).join(' · ')}
              </span>
            )}
            <span
              className={classNames(
                'inline-flex items-center gap-1',
                daysSince != null && daysSince > 90 && 'text-amber-600',
              )}
            >
              פעילות אחרונה:{' '}
              {lastMeetingDate
                ? `${formatDate(lastMeetingDate)} (לפני ${daysSince} ימים)`
                : 'אין פגישות'}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            className={classNames(
              'btn-secondary',
              isFav && 'border-red-200 text-red-500',
            )}
            onClick={() => toggleFav.mutate({ doctorId: d.id, isFavorite: isFav })}
          >
            <Heart size={16} fill={isFav ? 'currentColor' : 'none'} />
            {isFav ? 'במועדפים' : 'הוסף למועדפים'}
          </button>
          <button className="btn-secondary" onClick={() => setEditing(true)}>
            <Pencil size={16} />
            עריכה
          </button>
          <ConfirmButton
            className="btn-ghost text-red-500"
            message={`למחוק את ${d.name}? כל הפגישות והתכנונים המשויכים יימחקו.`}
            onConfirm={() =>
              deleteDoctor.mutate(d.id, { onSuccess: () => navigate('/doctors') })
            }
          >
            <Trash2 size={16} />
          </ConfirmButton>
        </div>
      </div>

      <Tabs value={tab} onChange={setTab}>
        <TabList>
          <Tab id="details">פרטים</Tab>
          <Tab id="hospitals">בתי חולים</Tab>
          <Tab id="procedures">הליכים</Tab>
          <Tab id="volumes">כמויות מקרים</Tab>
          <Tab id="preop">תכנון טרום ניתוחי</Tab>
          <Tab id="contacts">אנשי קשר</Tab>
          <Tab id="meetings">פגישות ({meetings.data?.length ?? 0})</Tab>
        </TabList>

        <TabPanel id="details">
          <div className="card space-y-4 p-5">
            <Field label="הערות מעקב (תהליך)">
              <p className="whitespace-pre-wrap text-sm text-slate-600">
                {d.tracking_notes || 'אין הערות מעקב'}
              </p>
            </Field>
            <Field label="הערות כלליות">
              <p className="whitespace-pre-wrap text-sm text-slate-600">
                {d.notes || 'אין הערות'}
              </p>
            </Field>
          </div>
        </TabPanel>

        <TabPanel id="hospitals">
          {d.doctor_hospitals.length === 0 ? (
            <EmptyState title="לא שויכו בתי חולים" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {d.doctor_hospitals.map((h) => (
                <div key={h.id} className="card p-4">
                  <p className="flex items-center gap-2 font-medium text-slate-800">
                    <Building2 size={16} className="text-brand-500" />
                    {h.hospital?.name ?? '—'}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {h.hospital?.city}
                    {h.role_at_hospital ? ` · ${h.role_at_hospital}` : ''}
                    {` · ${SECTOR_LABELS[h.sector] ?? h.sector}`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </TabPanel>

        <TabPanel id="procedures">
          {d.doctor_procedures.length === 0 ? (
            <EmptyState title="לא נבחרו הליכים" />
          ) : (
            <div className="flex flex-wrap gap-2">
              {d.doctor_procedures.map((p) => (
                <span
                  key={p.procedure?.id}
                  className="chip border-brand-200 bg-brand-50 text-brand-700"
                >
                  {p.procedure?.name}
                </span>
              ))}
            </div>
          )}
        </TabPanel>

        <TabPanel id="volumes">
          {d.doctor_hospitals.length === 0 ? (
            <EmptyState
              title="שייך תחילה בתי חולים"
              hint="כמויות המקרים מוזנות לפי בית חולים"
            />
          ) : (
            <CaseVolumesEditor
              doctorId={d.id}
              entityOptions={d.doctor_hospitals.map((h) => ({
                id: h.hospital_id,
                label: h.hospital?.name ?? '—',
              }))}
            />
          )}
        </TabPanel>

        <TabPanel id="preop">
          <PreopSection doctorId={d.id} plans={d.doctor_preop_plans} />
        </TabPanel>

        <TabPanel id="contacts">
          <ContactsSection doctorId={d.id} />
        </TabPanel>

        <TabPanel id="meetings">
          <div className="flex justify-end">
            <button className="btn-secondary" onClick={() => setAddMeeting(true)}>
              פגישה חדשה עם רופא זה
            </button>
          </div>
          {meetings.isLoading && <Spinner />}
          {meetings.data && meetings.data.length === 0 && (
            <EmptyState title="אין פגישות מתועדות" />
          )}
          <div className="space-y-2">
            {(meetings.data ?? []).map((m) => (
              <Link
                key={m.id}
                to="/meetings"
                className="card block p-4 hover:border-brand-200"
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium text-slate-800">
                    {m.subject || 'פגישה'}
                  </p>
                  <span className="text-sm text-slate-400">
                    {formatDate(m.meeting_date)}
                  </span>
                </div>
                <p className="text-sm text-slate-500">
                  {MEETING_STATUS_LABELS[m.status]}
                  {m.next_followup_date
                    ? ` · מעקב: ${formatDate(m.next_followup_date)}`
                    : ''}
                </p>
              </Link>
            ))}
          </div>
        </TabPanel>
      </Tabs>

      {editing && (
        <DoctorFormModal
          open={editing}
          onClose={() => setEditing(false)}
          doctor={d}
        />
      )}
      {addMeeting && (
        <MeetingFormModal
          open={addMeeting}
          onClose={() => setAddMeeting(false)}
          defaultDoctorId={d.id}
        />
      )}
    </div>
  )
}

function PreopSection({
  doctorId,
  plans,
}: {
  doctorId: string
  plans: PreopPlanWithProcedure[]
}) {
  const procedures = useProcedures()
  const savePlan = useSavePreopPlan(doctorId)
  const deletePlan = useDeletePreopPlan(doctorId)
  const [draft, setDraft] = useState<null | {
    id?: string
    procedure_id: string | null
    surgeon_preferences: string
    surgical_approach: string
    required_equipment: string
  }>(null)

  const makoProcedures = (procedures.data ?? []).filter((p) => p.is_mako)
  const procOptions = makoProcedures.length ? makoProcedures : procedures.data ?? []

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          תכנון טרום־ניתוחי לרובוט MAKO – תוכנית נפרדת לכל הליך.
        </p>
        <button
          className="btn-secondary"
          onClick={() =>
            setDraft({
              procedure_id: procOptions[0]?.id ?? null,
              surgeon_preferences: '',
              surgical_approach: '',
              required_equipment: '',
            })
          }
        >
          <Plus size={16} />
          תוכנית חדשה
        </button>
      </div>

      {plans.length === 0 && !draft && (
        <EmptyState title="אין תוכניות טרום־ניתוחיות" />
      )}

      {plans.map((plan) =>
        draft?.id === plan.id ? (
          <PreopForm
            key={plan.id}
            value={draft}
            options={procOptions}
            onChange={setDraft}
            onCancel={() => setDraft(null)}
            onSave={async () => {
              await savePlan.mutateAsync(draft)
              setDraft(null)
            }}
          />
        ) : (
          <div key={plan.id} className="card p-4">
            <div className="flex items-center justify-between">
              <p className="font-medium text-slate-800">
                {plan.procedure?.name ?? 'הליך כללי'}
              </p>
              <div className="flex gap-1">
                <button
                  className="btn-ghost !px-2"
                  onClick={() =>
                    setDraft({
                      id: plan.id,
                      procedure_id: plan.procedure_id,
                      surgeon_preferences: plan.surgeon_preferences,
                      surgical_approach: plan.surgical_approach,
                      required_equipment: plan.required_equipment,
                    })
                  }
                >
                  <Pencil size={15} />
                </button>
                <ConfirmButton
                  className="btn-ghost !px-2 text-red-500"
                  onConfirm={() => deletePlan.mutate(plan.id)}
                >
                  <Trash2 size={15} />
                </ConfirmButton>
              </div>
            </div>
            <dl className="mt-2 space-y-2 text-sm">
              <PreopRow label="העדפות מנתח" value={plan.surgeon_preferences} />
              <PreopRow label="גישה ניתוחית" value={plan.surgical_approach} />
              <PreopRow label="ציוד נדרש לניתוח" value={plan.required_equipment} />
            </dl>
          </div>
        ),
      )}

      {draft && !draft.id && (
        <PreopForm
          value={draft}
          options={procOptions}
          onChange={setDraft}
          onCancel={() => setDraft(null)}
          onSave={async () => {
            await savePlan.mutateAsync(draft)
            setDraft(null)
          }}
        />
      )}
    </div>
  )
}

function PreopRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[130px_1fr] gap-2">
      <dt className="text-slate-400">{label}</dt>
      <dd className="whitespace-pre-wrap text-slate-700">{value || '—'}</dd>
    </div>
  )
}

function PreopForm({
  value,
  options,
  onChange,
  onCancel,
  onSave,
}: {
  value: {
    id?: string
    procedure_id: string | null
    surgeon_preferences: string
    surgical_approach: string
    required_equipment: string
  }
  options: { id: string; name: string }[]
  onChange: (v: typeof value) => void
  onCancel: () => void
  onSave: () => void
}) {
  return (
    <div className="card space-y-3 border-brand-200 p-4">
      <Field label="הליך">
        <select
          className="input"
          value={value.procedure_id ?? ''}
          onChange={(e) =>
            onChange({ ...value, procedure_id: e.target.value || null })
          }
        >
          <option value="">הליך כללי</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="העדפות מנתח">
        <textarea
          className="input min-h-20"
          value={value.surgeon_preferences}
          onChange={(e) =>
            onChange({ ...value, surgeon_preferences: e.target.value })
          }
        />
      </Field>
      <Field label="גישה ניתוחית">
        <textarea
          className="input min-h-20"
          value={value.surgical_approach}
          onChange={(e) =>
            onChange({ ...value, surgical_approach: e.target.value })
          }
        />
      </Field>
      <Field label="ציוד נדרש לניתוח">
        <textarea
          className="input min-h-20"
          value={value.required_equipment}
          onChange={(e) =>
            onChange({ ...value, required_equipment: e.target.value })
          }
          placeholder="מלל חופשי"
        />
      </Field>
      <div className="flex justify-end gap-2">
        <button className="btn-secondary" onClick={onCancel}>
          ביטול
        </button>
        <button className="btn-primary" onClick={onSave}>
          שמירה
        </button>
      </div>
    </div>
  )
}
