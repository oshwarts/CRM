import { useState } from 'react'
import { useCanDelete } from '../lib/permissions'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Building2,
  CalendarDays,
  CheckSquare,
  Heart,
  Mail,
  Package,
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
import { TaskFormModal } from '../components/TaskFormModal'
import { DoctorTimeline } from '../components/DoctorTimeline'
import { SurgicalCourseSection } from '../components/SurgicalCourse'
import { LinkedTasks, useLinkedTasks } from '../components/LinkedTasks'
import { cadenceLabel, contactState } from '../lib/cadence'
import { CompetitorSection } from '../components/CompetitorSection'
import { ContactsSection } from '../components/ContactsSection'
import { CaseVolumesEditor } from '../components/CaseVolumesEditor'
import { EquipmentPlanEditor } from '../components/EquipmentPlanEditor'
import { PickingListModal } from '../components/PickingListModal'
import { PreopPlanForm, PreopPlanSummary } from '../components/PreopPlanForm'
import { PREOP_SCHEMAS, schemaFor, type PreopSchema } from '../lib/preopForm'
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
  const canDelete = useCanDelete()
  const linkedTasks = useLinkedTasks({ doctorId: id })

  const [tab, setTab] = useState('timeline')
  const [editing, setEditing] = useState(false)
  const [addMeeting, setAddMeeting] = useState(false)
  const [addTask, setAddTask] = useState(false)
  const [picking, setPicking] = useState(false)

  if (doctor.isLoading) return <Spinner />
  if (doctor.error && !doctor.data) return <ErrorState error={doctor.error} /> // cached data stays visible when only a background refresh failed
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
  const contact = contactState(d, meetings.data ?? [])

  return (
    <div className="space-y-5">
      <div className="card flex flex-wrap items-start justify-between gap-4 p-5">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-brand-50 text-2xl font-semibold text-brand-700">
            {(d.name.trim()[0] ?? '?').toUpperCase()}
          </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-semibold text-brand-800">
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
              <a href={`tel:${d.phone}`} className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 font-medium text-brand-700 hover:bg-brand-100" dir="ltr">
                <Phone size={14} /> {d.phone}
              </a>
            )}
            {d.email && (
              <a href={`mailto:${d.email}`} className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 font-medium text-brand-700 hover:bg-brand-100" dir="ltr">
                <Mail size={14} /> {d.email}
              </a>
            )}
            {d.doctor_companies.length > 0 && (
              <span className="inline-flex items-center gap-1">
                {d.doctor_companies.map((c) => c.company?.name).filter(Boolean).join(' · ')}
              </span>
            )}
            {d.doctor_robotic_systems.length > 0 && (
              <span className="inline-flex items-center gap-1">
                רובוטיקה:{' '}
                {d.doctor_robotic_systems
                  .map((r) => r.system?.name)
                  .filter(Boolean)
                  .join(' · ')}
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
            {d.contact_cadence_days && (
              <span
                className={classNames(
                  'inline-flex items-center gap-1',
                  contact.status === 'due' && 'font-medium text-red-600',
                  contact.status === 'soon' && 'text-amber-600',
                )}
              >
                קצב קשר: {cadenceLabel(d.contact_cadence_days)}
                {contact.nextMeeting
                  ? ` · פגישה הבאה ${formatDate(contact.nextMeeting)}`
                  : contact.dueDate
                    ? ` · יעד ${formatDate(contact.dueDate)}${contact.status === 'due' ? ' (באיחור)' : ''}`
                    : ''}
              </span>
            )}
            {d.status === 'potential' && d.pipeline_stage && (
              <span className="inline-flex items-center gap-1 text-brand-600">
                שלב: {d.pipeline_stage}
                {d.next_step_date
                  ? ` · צעד הבא ${formatDate(d.next_step_date)}`
                  : ''}
              </span>
            )}
          </div>
        </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" onClick={() => setAddMeeting(true)}>
            <CalendarDays size={16} />
            פגישה חדשה
          </button>
          <button className="btn-secondary" onClick={() => setAddTask(true)}>
            <CheckSquare size={16} />
            משימה
          </button>
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
          <button className="btn-secondary" onClick={() => setPicking(true)}>
            <Package size={16} />
            רשימת ליקוט
          </button>
          <button className="btn-secondary" onClick={() => setEditing(true)}>
            <Pencil size={16} />
            עריכה
          </button>
          {canDelete(d.created_by) && (
          <ConfirmButton
            className="btn-ghost text-red-500"
            message={`למחוק את ${d.name}? כל הפגישות והתכנונים המשויכים יימחקו.`}
            onConfirm={() =>
              deleteDoctor.mutate(d.id, { onSuccess: () => navigate('/doctors') })
            }
          >
            <Trash2 size={16} />
          </ConfirmButton>
          )}
        </div>
      </div>

      <Tabs value={tab} onChange={setTab}>
        <TabList>
          <Tab id="timeline">ציר זמן</Tab>
          <Tab id="details">פרטים</Tab>
          <Tab id="hospitals">בתי חולים</Tab>
          <Tab id="procedures">הליכים</Tab>
          <Tab id="volumes">כמויות מקרים</Tab>
          <Tab id="equipment">ציוד לניתוח</Tab>
          <Tab id="preop">תכנון טרום ניתוחי</Tab>
          <Tab id="contacts">אנשי קשר</Tab>
          <Tab id="course">מהלך ניתוחי</Tab>
          <Tab id="competitors">מתחרים</Tab>
          <Tab id="tasks">משימות ({linkedTasks.open.length})</Tab>
          <Tab id="meetings">פגישות ({meetings.data?.length ?? 0})</Tab>
        </TabList>

        <TabPanel id="timeline">
          <DoctorTimeline doctorId={d.id} />
        </TabPanel>

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

        <TabPanel id="equipment">
          <EquipmentPlanEditor
            doctorId={d.id}
            procedures={d.doctor_procedures
              .map((p) => p.procedure)
              .filter((p): p is NonNullable<typeof p> => !!p)
              .map((p) => ({ id: p.id, name: p.name }))}
          />
        </TabPanel>

        <TabPanel id="preop">
          <PreopSection doctorId={d.id} plans={d.doctor_preop_plans} />
        </TabPanel>

        <TabPanel id="contacts">
          <ContactsSection doctorId={d.id} />
        </TabPanel>

        <TabPanel id="competitors">
          <CompetitorSection doctorId={d.id} />
        </TabPanel>

        <TabPanel id="tasks">
          <LinkedTasks doctorId={d.id} />
        </TabPanel>

        <TabPanel id="course">
          <SurgicalCourseSection doctorId={d.id} />
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
                to={`/meetings/${m.id}?doctor=${d.id}`}
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
      {addTask && <TaskFormModal defaults={{ doctor_id: d.id }} onClose={() => setAddTask(false)} />}
      {picking && (
        <PickingListModal
          doctorId={d.id}
          doctorName={`${d.title} ${d.name}`}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  )
}

type PlanDraft = {
  id?: string
  procedure_id: string | null
  surgeon_preferences: string
  surgical_approach: string
  required_equipment: string
  plan_data: Record<string, unknown>
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
  const [draft, setDraft] = useState<PlanDraft | null>(null)

  const procList = procedures.data ?? []

  // the three planning types, each tied to the procedure that carries its template
  const choices = PREOP_SCHEMAS.map((schema) => ({
    schema,
    procedureId: procList.find((p) => p.planning_template === schema.id)?.id ?? null,
  }))

  const schemaOfProc = (procId: string | null) =>
    schemaFor(procList.find((p) => p.id === procId)?.planning_template)

  function startNew() {
    const first = choices.find((c) => c.procedureId)
    setDraft({
      procedure_id: first?.procedureId ?? null,
      surgeon_preferences: '',
      surgical_approach: '',
      required_equipment: '',
      plan_data: {},
    })
  }

  async function persist(d: PlanDraft) {
    await savePlan.mutateAsync(d)
    setDraft(null)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          תכנון טרום־ניתוחי – תוכנית נפרדת לכל ניתוח: ברך מלאה, ירך או יוני.
        </p>
        <button className="btn-secondary" onClick={startNew}>
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
            choices={choices}
            schema={schemaOfProc(draft.procedure_id)}
            onChange={setDraft}
            onCancel={() => setDraft(null)}
            onSave={() => persist(draft)}
          />
        ) : (
          <PlanCard
            key={plan.id}
            plan={plan}
            onEdit={() =>
              setDraft({
                id: plan.id,
                procedure_id: plan.procedure_id,
                surgeon_preferences: plan.surgeon_preferences,
                surgical_approach: plan.surgical_approach,
                required_equipment: plan.required_equipment,
                plan_data: (plan.plan_data ?? {}) as Record<string, unknown>,
              })
            }
            onDelete={() => deletePlan.mutate(plan.id)}
          />
        ),
      )}

      {draft && !draft.id && (
        <PreopForm
          value={draft}
          choices={choices}
          schema={schemaOfProc(draft.procedure_id)}
          onChange={setDraft}
          onCancel={() => setDraft(null)}
          onSave={() => persist(draft)}
        />
      )}
    </div>
  )
}

function PlanCard({
  plan,
  onEdit,
  onDelete,
}: {
  plan: PreopPlanWithProcedure
  onEdit: () => void
  onDelete: () => void
}) {
  const schema = schemaFor(plan.procedure?.planning_template)
  const pd = (plan.plan_data ?? {}) as Record<string, unknown>
  const hasStructured = !!schema

  return (
    <div className="card space-y-3 p-4">
      <div className="flex items-center justify-between">
        <p className="font-medium text-slate-800">
          {plan.procedure?.name ?? 'הליך כללי'}
        </p>
        <div className="flex gap-1">
          <button className="btn-ghost !px-2" onClick={onEdit}>
            <Pencil size={15} />
          </button>
          <ConfirmButton
            className="btn-ghost !px-2 text-red-500"
            onConfirm={onDelete}
          >
            <Trash2 size={15} />
          </ConfirmButton>
        </div>
      </div>

      {schema ? (
        <PreopPlanSummary schema={schema} values={pd} />
      ) : (
        <dl className="space-y-2 text-sm">
          <PreopRow label="העדפות מנתח" value={plan.surgeon_preferences} />
          <PreopRow label="גישה ניתוחית" value={plan.surgical_approach} />
          <PreopRow label="ציוד נדרש לניתוח" value={plan.required_equipment} />
        </dl>
      )}

      {hasStructured && plan.required_equipment && (
        <dl className="space-y-2 text-sm">
          <PreopRow label="ציוד נדרש לניתוח" value={plan.required_equipment} />
        </dl>
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
  choices,
  schema,
  onChange,
  onCancel,
  onSave,
}: {
  value: PlanDraft
  choices: { schema: PreopSchema; procedureId: string | null }[]
  schema: PreopSchema | null
  onChange: (v: PlanDraft) => void
  onCancel: () => void
  onSave: () => void
}) {
  const isNew = !value.id

  function pick(procedureId: string | null) {
    if (!procedureId || procedureId === value.procedure_id) return
    onChange({ ...value, procedure_id: procedureId, plan_data: {} })
  }

  return (
    <div className="card space-y-4 border-brand-200 p-3 sm:p-4">
      {schema || isNew ? (
        <div>
          <p className="label">ניתוח</p>
          <div className="grid grid-cols-3 gap-2">
            {choices.map(({ schema: s, procedureId }) => (
              <button
                key={s.id}
                type="button"
                disabled={!procedureId}
                onClick={() => pick(procedureId)}
                className={
                  'rounded-xl border px-3 py-3 text-sm font-semibold transition disabled:opacity-40 ' +
                  (schema?.id === s.id
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')
                }
              >
                {s.short}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          תוכנית ישנה להליך כללי — אפשר לערוך אותה כטקסט חופשי.
        </p>
      )}

      {schema ? (
        <PreopPlanForm
          schema={schema}
          values={value.plan_data}
          onChange={(pd) => onChange({ ...value, plan_data: pd })}
        />
      ) : (
        <>
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
          <Field label="ציוד נדרש לניתוח (הערה חופשית)">
            <textarea
              className="input min-h-16"
              value={value.required_equipment}
              onChange={(e) =>
                onChange({ ...value, required_equipment: e.target.value })
              }
            />
          </Field>
        </>
      )}

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
