import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { nextCopyId, nextDue, stableUuid } from './taskLogic'
import { supabase } from './supabase'
import { syncMeetingIntel } from './meetingIntel'
import { withParentNames } from './procedures'
import { fileHash } from './docDuplicates'
import { useAuth } from '../context/AuthProvider'
import { actingUserId } from './actingAs'
import type {
  CaseVolumeRow,
  InfoCategory,
  InfoDocument,
  SurgicalCourse,
  TemplateStage,
  ConsumableCountRow,
  ConsumableItem,
  ConsumableMinimum,
  Company,
  Contact,
  Doctor,
  DoctorListItem,
  DoctorProcedureEquipmentRow,
  DoctorWithRelations,
  EquipmentItemWithCompany,
  Hospital,
  HospitalListItem,
  ImplantOption,
  ImplantField,
  MeetingTask,
  MeetingWithRelations,
  Organization,
  PatientScan,
  PatientScanRow,
  Procedure,
  Profile,
  RoboticSystem,
  TaskRow,
  AuditEntry,
  CompetitorIntelRow,
  Competitor,
} from './types'
import { SCAN_PROCEDURE_TO_NAME } from './types'
import { infoStorage } from './largeFiles'
import { saveChangedFields } from './safeSave'
import { currentUserId, mergePatch, registerExecutor, runOrQueue, type ExecResult } from './outbox'
import { queryClient } from './queryClient'
import { toast } from './toast'
import type { TablesInsert, TablesUpdate } from './database.types'

function unwrap<T>(res: { data: unknown; error: unknown }): T {
  if (res.error) throw res.error
  return res.data as T
}

/**
 * The API returns at most 1000 rows per request and cuts the rest without saying so. Lists that grow with use (meetings,
 * tasks, scans, doctors, contacts, case volumes) are read page by page; `id` is the last sort key so pages never overlap.
 */
async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const rows = unwrap<T[]>(await page(from, from + 999))
    out.push(...rows)
    if (rows.length < 1000) return out
  }
}

/* ============================ Reference data ============================ */

export function useAgents() {
  const { impersonating } = useAuth()
  return useQuery({
    queryKey: ['agents'],
    queryFn: async () =>
      unwrap<Profile[]>(
        await supabase.from('profiles').select('*').order('full_name'),
      ).filter((p) => p.active !== false),
    select: (rows) => rows.filter((u) => !u.is_test || u.id === impersonating?.id),
  })
}

/** every account, active or not — for the admin user-management page */
/** every user — the fictitious test users of the developer are left out (unless the developer is acting as one) */
export function useAllUsers() {
  const { impersonating } = useAuth()
  return useQuery({
    queryKey: ['all-users'],
    queryFn: async () =>
      unwrap<Profile[]>(await supabase.from('profiles').select('*').order('created_at')),
    select: (rows) => rows.filter((u) => !u.is_test || u.id === impersonating?.id),
  })
}

/** managers: people who signed up and wait for approval (never approved or disabled before) */
export function usePendingSignups() {
  const { isAdmin } = useAuth()
  return useQuery({
    queryKey: ['all-users'],
    enabled: isAdmin,
    queryFn: async () => unwrap<Profile[]>(await supabase.from('profiles').select('*').order('created_at')),
    select: (rows) => rows.filter((u) => !u.active && !u.status_changed_at && !u.is_test),
  })
}

/** developer only: everyone one can switch to, test users included */
export function useSwitchableUsers() {
  return useQuery({
    queryKey: ['all-users'],
    queryFn: async () =>
      unwrap<Profile[]>(await supabase.from('profiles').select('*').order('created_at')),
  })
}

export function useUserActivity() {
  return useQuery({
    queryKey: ['user-activity'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_user_activity')
      if (error) throw error
      return new Map((data ?? []).map((r) => [r.id, r.last_sign_in_at]))
    },
  })
}

export function useUpdateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string; role?: string; active?: boolean; full_name?: string; is_content_editor?: boolean }) =>
      unwrap(await supabase.from('profiles').update(patch).eq('id', id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agents'] })
      qc.invalidateQueries({ queryKey: ['all-users'] })
    },
  })
}

/** the company equipment belongs to by default: A.M.I. Technologies (the company itself) */
export const findDefaultCompany = <T extends { id: string; name: string }>(list: T[] | undefined) => (list ?? []).find((c) => /\bami\b/i.test(c.name))

export function useCompanies() {
  return useQuery({
    queryKey: ['companies'],
    queryFn: async () =>
      unwrap<Company[]>(
        await supabase.from('companies').select('*').order('name'),
      ),
  })
}

const fetchProcedures = async () => unwrap<Procedure[]>(await supabase.from('procedures').select('*').order('name'))

/** the procedures for choosing and showing: a sub-procedure is named "Parent › Child" and follows its parent */
export function useProcedures() {
  return useQuery({ queryKey: ['procedures'], queryFn: fetchProcedures, select: withParentNames })
}

/** the procedures as they are stored (the names without the parent), for the screen that edits them */
export function useProceduresRaw() {
  return useQuery({ queryKey: ['procedures'], queryFn: fetchProcedures })
}

export function useHospitals() {
  return useQuery({
    queryKey: ['hospitals'],
    queryFn: async () =>
      unwrap<HospitalListItem[]>(
        await supabase
          .from('hospitals')
          .select('*, organization:organizations(*), hospital_robotic_systems(system_id)')
          .order('name'),
      ),
  })
}

export function useOrganizations() {
  return useQuery({
    queryKey: ['organizations'],
    queryFn: async () =>
      unwrap<Organization[]>(
        await supabase.from('organizations').select('*').order('name'),
      ),
  })
}

export function useRoboticSystems() {
  return useQuery({
    queryKey: ['robotic-systems'],
    queryFn: async () =>
      unwrap<RoboticSystem[]>(
        await supabase.from('robotic_systems').select('*').order('name'),
      ),
  })
}

/* ============================ Doctors ============================ */

const DOCTOR_LIST_SELECT =
  '*, doctor_companies(company_id), doctor_procedures(procedure_id), doctor_robotic_systems(system_id), doctor_hospitals(hospital_id, hospital:hospitals(*))'

const DOCTOR_FULL_SELECT =
  '*, doctor_companies(company:companies(*)), doctor_procedures(procedure:procedures(*)), doctor_robotic_systems(system:robotic_systems(*)), doctor_hospitals(*, hospital:hospitals(*, organization:organizations(*))), doctor_preop_plans(*, procedure:procedures(*))'

export function useDoctors() {
  return useQuery({
    queryKey: ['doctors'],
    queryFn: () =>
      fetchAll<DoctorListItem>((a, b) => supabase.from('doctors').select(DOCTOR_LIST_SELECT).order('name').order('id').range(a, b)),
  })
}

export function useDoctor(id: string | undefined) {
  return useQuery({
    queryKey: ['doctor', id],
    enabled: !!id,
    queryFn: async () =>
      // maybeSingle: an id that does not exist (a deleted doctor, an old link) is "not found" (null), not an error
      unwrap<DoctorWithRelations | null>(
        await supabase
          .from('doctors')
          .select(DOCTOR_FULL_SELECT)
          .eq('id', id!)
          .maybeSingle(),
      ),
  })
}

export type DoctorFormData = {
  name: string
  title: string
  position: string
  phone: string
  email: string
  notes: string
  status: string
  tracking_notes: string
  pipeline_stage: string
  next_step: string
  next_step_date: string | null
  contact_cadence_days: number | null
  companyIds: string[]
  procedureIds: string[]
  roboticSystemIds: string[]
  hospitals: { hospital_id: string; role_at_hospital: string; sector: string; clinic_days: number[]; clinic_hours: string; clinic_note: string }[]
}

/**
 * Makes the rows of a join table (all rows of one parent) equal to `wanted` WITHOUT emptying it first: new / changed rows
 * are upserted, then only the rows that are no longer wanted are deleted. A save that fails half way (a dropped
 * connection) therefore leaves the old rows in place instead of a doctor / meeting with nothing attached.
 * `base` (optional) = the targets the editor saw when he opened the form: then only what HE added is written and only what HE
 * removed is deleted - a row another user added or removed meanwhile is left alone.
 */
async function syncJoin(
  table: 'doctor_companies' | 'doctor_procedures' | 'doctor_robotic_systems' | 'doctor_hospitals' | 'meeting_doctors' | 'meeting_agents' | 'meeting_contacts' | 'hospital_agents',
  parentCol: 'doctor_id' | 'meeting_id' | 'hospital_id',
  parentId: string,
  otherCol: string,
  wanted: Record<string, unknown>[],
  base: string[] | null = null,
) {
  const byOther = new Map<string, Record<string, unknown>>()
  for (const w of wanted) byOther.set(String(w[otherCol]), w) // one row per target (a duplicate would break the upsert)
  // the table / column names are chosen by the callers above; the typed client cannot follow a union of tables
  const t = () => supabase.from(table as 'meeting_doctors')
  const pc = parentCol as 'meeting_id'
  const existing = unwrap<Record<string, string>[]>(await t().select(otherCol).eq(pc, parentId))
  const drop = existing.map((r) => r[otherCol]).filter((id) => !byOther.has(id) && (base === null || base.includes(id)))
  const write = [...byOther.entries()].filter(([id]) => base === null || !base.includes(id)).map(([, w]) => w)
  if (write.length)
    unwrap(
      await t().upsert(write.map((w) => ({ [parentCol]: parentId, ...w })) as never, { onConflict: `${parentCol},${otherCol}` }),
    )
  if (drop.length) unwrap(await t().delete().eq(pc, parentId).in(otherCol as 'doctor_id', drop))
}

/** with `base` (the values the form was opened with) only the lists that were changed are written */
async function saveDoctorRelations(doctorId: string, d: DoctorFormData, base?: DoctorFormData) {
  const changed = (a: unknown, b: unknown) => !base || JSON.stringify(a) !== JSON.stringify(b)
  if (changed(d.companyIds, base?.companyIds)) await syncJoin('doctor_companies', 'doctor_id', doctorId, 'company_id', d.companyIds.map((company_id) => ({ company_id })))
  if (changed(d.procedureIds, base?.procedureIds)) await syncJoin('doctor_procedures', 'doctor_id', doctorId, 'procedure_id', d.procedureIds.map((procedure_id) => ({ procedure_id })))
  if (changed(d.roboticSystemIds, base?.roboticSystemIds)) await syncJoin('doctor_robotic_systems', 'doctor_id', doctorId, 'system_id', d.roboticSystemIds.map((system_id) => ({ system_id })))
  if (changed(d.hospitals, base?.hospitals))
    await syncJoin(
      'doctor_hospitals',
      'doctor_id',
      doctorId,
      'hospital_id',
      // a row where no hospital was chosen is not a link
      d.hospitals.filter((h) => h.hospital_id).map((h) => ({ hospital_id: h.hospital_id, role_at_hospital: h.role_at_hospital, sector: h.sector, clinic_days: h.clinic_days, clinic_hours: h.clinic_hours, clinic_note: h.clinic_note })),
    )
}

export function useCreateDoctor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (d: DoctorFormData) => {
      const actingId = await actingUserId()
      const row: TablesInsert<'doctors'> = {
        name: d.name,
        title: d.title,
        position: d.position,
        phone: d.phone,
        email: d.email,
        notes: d.notes,
        status: d.status,
        tracking_notes: d.tracking_notes,
        pipeline_stage: d.pipeline_stage,
        next_step: d.next_step,
        next_step_date: d.next_step_date,
        contact_cadence_days: d.contact_cadence_days,
        created_by: actingId,
      }
      const created = unwrap<Doctor>(
        await supabase.from('doctors').insert(row).select().single(),
      )
      try {
        await saveDoctorRelations(created.id, d)
      } catch (err) {
        // the doctor without his hospitals / procedures is half a record, and a second try would add him again: take him back
        await supabase.from('doctors').delete().eq('id', created.id)
        throw err
      }
      return created
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doctors'] })
    },
  })
}

/** `base` = the values the form was opened with: only what the person changed is written, and a change of somebody else is not overwritten silently */
export function useUpdateDoctor(id: string, base?: DoctorFormData) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (d: DoctorFormData) => {
      const row: TablesUpdate<'doctors'> = {
        name: d.name,
        title: d.title,
        position: d.position,
        phone: d.phone,
        email: d.email,
        notes: d.notes,
        status: d.status,
        tracking_notes: d.tracking_notes,
        pipeline_stage: d.pipeline_stage,
        next_step: d.next_step,
        next_step_date: d.next_step_date,
        contact_cadence_days: d.contact_cadence_days,
      }
      if (base) {
        await saveChangedFields({
          table: 'doctors',
          id,
          base: { ...(base as unknown as Record<string, unknown>) },
          next: row as Record<string, unknown>,
          labels: { name: 'השם', title: 'התואר', position: 'התפקיד', phone: 'הטלפון', email: 'המייל', notes: 'ההערות', status: 'הסטטוס', tracking_notes: 'הערות המעקב', pipeline_stage: 'השלב במשפך', next_step: 'הצעד הבא', next_step_date: 'תאריך הצעד הבא', contact_cadence_days: 'קצב הקשר' },
        })
      } else unwrap(await supabase.from('doctors').update(row).eq('id', id))
      await saveDoctorRelations(id, d, base)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doctors'] })
      qc.invalidateQueries({ queryKey: ['doctor', id] })
    },
  })
}

export function useDeleteDoctor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      unwrap(await supabase.from('doctors').delete().eq('id', id))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doctors'] })
      qc.invalidateQueries({ queryKey: ['favorites'] })
    },
  })
}

/* ============================ Pre-op plans ============================ */

export type PreopPlanInput = {
  id?: string
  procedure_id: string | null
  surgeon_preferences: string
  surgical_approach: string
  required_equipment: string
  plan_data: Record<string, unknown>
}

export function useSavePreopPlan(doctorId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (plan: PreopPlanInput) => {
      const fields = {
        procedure_id: plan.procedure_id,
        surgeon_preferences: plan.surgeon_preferences,
        surgical_approach: plan.surgical_approach,
        required_equipment: plan.required_equipment,
        plan_data: plan.plan_data as never,
      }
      if (plan.id) {
        unwrap(
          await supabase
            .from('doctor_preop_plans')
            .update(fields)
            .eq('id', plan.id),
        )
      } else {
        unwrap(
          await supabase
            .from('doctor_preop_plans')
            .insert({ doctor_id: doctorId, ...fields }),
        )
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['doctor', doctorId] }),
  })
}

export function useDeletePreopPlan(doctorId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (planId: string) => {
      unwrap(await supabase.from('doctor_preop_plans').delete().eq('id', planId))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['doctor', doctorId] }),
  })
}

/* ============================ Favorites ============================ */

export function useFavorites() {
  return useQuery({
    queryKey: ['favorites'],
    queryFn: async () => {
      const actingId = await actingUserId()
      if (!actingId) return [] as string[]
      const rows = unwrap<{ doctor_id: string }[]>(
        await supabase
          .from('favorites')
          .select('doctor_id')
          .eq('user_id', actingId),
      )
      return rows.map((r) => r.doctor_id)
    },
  })
}

export function useToggleFavorite() {
  const qc = useQueryClient()
  return useMutation({
    meta: { silent: true },
    mutationFn: async ({
      doctorId,
      isFavorite,
    }: {
      doctorId: string
      isFavorite: boolean
    }) => {
      const actingId = await actingUserId()
      const userId = actingId ?? undefined
      if (!userId) throw new Error('לא מחובר')
      if (isFavorite) {
        unwrap(
          await supabase
            .from('favorites')
            .delete()
            .eq('user_id', userId)
            .eq('doctor_id', doctorId),
        )
      } else {
        unwrap(
          await supabase
            .from('favorites')
            .insert({ user_id: userId, doctor_id: doctorId }),
        )
      }
    },
    // the heart changes at once; if the save fails it goes back and the person is told (the mutation is "silent": no "saved" for every tap)
    onMutate: async ({ doctorId, isFavorite }) => {
      await qc.cancelQueries({ queryKey: ['favorites'] })
      const before = qc.getQueryData<string[]>(['favorites'])
      if (before) qc.setQueryData<string[]>(['favorites'], isFavorite ? before.filter((x) => x !== doctorId) : [...before, doctorId])
      return { before }
    },
    onError: (e, _v, ctx) => {
      if (ctx?.before) qc.setQueryData(['favorites'], ctx.before)
      toast(e instanceof Error && e.message ? `המועדף לא נשמר: ${e.message}` : 'המועדף לא נשמר', { kind: 'error' })
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['favorites'] })
      qc.invalidateQueries({ queryKey: ['all-favorites'] }) // the goals ("doctors in cadence") are measured from it
    },
  })
}

/* ============================ Meetings ============================ */

const MEETING_SELECT =
  '*, responsible_agent:profiles!meetings_responsible_agent_id_fkey(id, full_name), meeting_doctors(doctor:doctors(id, name, title)), meeting_contacts(contact:contacts(id, name, role, hospital_id)), meeting_agents(agent:profiles(id, full_name, role)), hospital:hospitals(id, name), meeting_tasks(*)'

/** the lists that grow with use are read from this date on (24 months back by default): older records stay in the database and in the backup */
function historyStart(months = 24): string {
  const d = new Date()
  d.setMonth(d.getMonth() - months)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` // the local day (toISOString is UTC)
}

export function useMeetings() {
  return useQuery({
    queryKey: ['meetings'],
    queryFn: () =>
      fetchAll<MeetingWithRelations>((a, b) =>
        supabase.from('meetings').select(MEETING_SELECT).or(`meeting_date.gte.${historyStart()},meeting_date.is.null`).order('meeting_date', { ascending: false, nullsFirst: false }).order('id').range(a, b),
      ),
  })
}

export function useMeeting(id: string | undefined) {
  return useQuery({
    queryKey: ['meeting', id],
    enabled: !!id,
    queryFn: async () =>
      // an unknown / deleted id is "not found" (null), not a database error about row counts
      unwrap<MeetingWithRelations | null>(
        await supabase.from('meetings').select(MEETING_SELECT).eq('id', id!).maybeSingle(),
      ),
  })
}

export function useDoctorMeetings(doctorId: string | undefined) {
  return useQuery({
    queryKey: ['doctor-meetings', doctorId],
    enabled: !!doctorId,
    queryFn: async () => {
      const links = unwrap<{ meeting_id: string }[]>(
        await supabase
          .from('meeting_doctors')
          .select('meeting_id')
          .eq('doctor_id', doctorId!),
      )
      if (!links.length) return [] as MeetingWithRelations[]
      return unwrap<MeetingWithRelations[]>(
        await supabase
          .from('meetings')
          .select(MEETING_SELECT)
          .in(
            'id',
            links.map((l) => l.meeting_id),
          )
          .order('meeting_date', { ascending: false, nullsFirst: false }),
      )
    },
  })
}

export type MeetingFormData = {
  subject: string
  meeting_date: string | null
  meeting_time: string | null
  location: string
  responsible_agent_id: string | null
  status: string
  summary: string
  decisions: string
  next_followup_date: string | null
  doctorIds: string[]
  hospitalId: string | null
  contactIds: string[]
  agentIds: string[]
  extraParticipants: string
  competitor_notes: string
  /** the competitor the meeting text is about (undefined = not touched: the record keeps its competitor) */
  competitorId?: string | null
  tasks: { id?: string; description: string; is_done: boolean; due_date: string | null }[]
}

/** what the editor saw when he opened the form - the base of the merge (null = a new meeting: write everything) */
type MeetingJoinsBase = {
  doctorIds: string[]
  agentIds: string[]
  contactIds: string[]
  tasks: { id: string; description: string; is_done: boolean; due_date: string | null }[]
}

async function saveMeetingChildren(meetingId: string, d: MeetingFormData, baseTaskIds: string[] | null = null, base: MeetingJoinsBase | null = null) {
  await syncJoin('meeting_doctors', 'meeting_id', meetingId, 'doctor_id', d.doctorIds.map((doctor_id) => ({ doctor_id })), base?.doctorIds ?? null)
  await syncJoin('meeting_agents', 'meeting_id', meetingId, 'agent_id', d.agentIds.map((agent_id) => ({ agent_id })), base?.agentIds ?? null)
  await syncJoin('meeting_contacts', 'meeting_id', meetingId, 'contact_id', d.contactIds.map((contact_id) => ({ contact_id })), base?.contactIds ?? null)

  const tasks = d.tasks.filter((t) => t.description.trim())
  const keep = tasks.filter((t) => t.id).map((t) => t.id as string)
  const current = unwrap<{ id: string; done_at: string | null }[]>(await supabase.from('meeting_tasks').select('id, done_at').eq('meeting_id', meetingId))
  // only tasks this edit removed are deleted (a task another agent added meanwhile stays)
  const drop = current.map((c) => c.id).filter((id) => !keep.includes(id) && (baseTaskIds === null || baseTaskIds.includes(id)))
  if (drop.length) unwrap(await supabase.from('meeting_tasks').delete().in('id', drop))
  const me = await currentUserId()
  for (const t of tasks) {
    const id = t.id ?? crypto.randomUUID()
    const cur = current.find((c) => c.id === id)
    if (cur) {
      // existing tasks keep their sub-tasks / assignee / priority / completion time - only what this edit changed is written
      const was = base?.tasks.find((x) => x.id === id)
      const fields: { description?: string; due_date?: string | null; is_done?: boolean; done_at?: string | null } = {}
      if (!was || was.description !== t.description) fields.description = t.description
      if (!was || was.due_date !== t.due_date) fields.due_date = t.due_date
      if (!was || was.is_done !== t.is_done) {
        fields.is_done = t.is_done
        fields.done_at = t.is_done ? (cur.done_at ?? new Date().toISOString()) : null
      }
      if (Object.keys(fields).length) unwrap(await supabase.from('meeting_tasks').update(fields).eq('id', id))
    } else {
      unwrap(
        await supabase.from('meeting_tasks').insert({
          description: t.description,
          is_done: t.is_done,
          due_date: t.due_date,
          done_at: t.is_done ? new Date().toISOString() : null,
          id,
          meeting_id: meetingId,
          assignee_id: me || null,
          created_by: me || null,
        }),
      )
    }
  }
}

export function useDeleteMeeting() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      unwrap(await supabase.from('meetings').delete().eq('id', id))
    },
    onSuccess: () => invalidateMeetings(qc),
  })
}

function invalidateMeetings(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['meetings'] })
  qc.invalidateQueries({ queryKey: ['meeting'] })
  qc.invalidateQueries({ queryKey: ['doctor-meetings'] })
}

/* ============================ Settings CRUD ============================ */

export function useUpsertCompany() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (c: { id?: string; name: string }) => {
      if (c.id) unwrap(await supabase.from('companies').update({ name: c.name }).eq('id', c.id))
      else unwrap(await supabase.from('companies').insert({ name: c.name }))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['companies'] }),
  })
}

export function useDeleteCompany() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(await supabase.from('companies').delete().eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['companies'] }),
  })
}

export function useUpsertProcedure() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: {
      id?: string
      name: string
      category: string
      is_mako: boolean
      parent_id?: string | null
    }) => {
      const payload = { name: p.name, category: p.category, is_mako: p.is_mako, parent_id: p.parent_id ?? null }
      if (p.id) unwrap(await supabase.from('procedures').update(payload).eq('id', p.id))
      else unwrap(await supabase.from('procedures').insert(payload))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['procedures'] }),
  })
}

export function useDeleteProcedure() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(await supabase.from('procedures').delete().eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['procedures'] }),
  })
}

export function useUpsertHospital() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (h: Partial<Hospital> & { name: string }) => {
      const payload = {
        name: h.name,
        city: h.city ?? '',
        sector: h.sector ?? 'public',
        organization_id: h.organization_id ?? null,
        address: h.address ?? '',
        lat: h.lat ?? null,
        lng: h.lng ?? null,
      }
      if (h.id) {
        return unwrap<Hospital>(
          await supabase
            .from('hospitals')
            .update(payload)
            .eq('id', h.id)
            .select()
            .single(),
        )
      }
      return unwrap<Hospital>(
        await supabase.from('hospitals').insert(payload).select().single(),
      )
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hospitals'] })
      qc.invalidateQueries({ queryKey: ['map-data'] })
    },
  })
}

/** the contact at a hospital who coordinates the CT appointments */
export function useSetHospitalScanContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ hospitalId, contactId }: { hospitalId: string; contactId: string | null }) =>
      unwrap(await supabase.from('hospitals').update({ scan_contact_id: contactId }).eq('id', hospitalId)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hospitals'] })
      qc.invalidateQueries({ queryKey: ['hospital'] })
    },
  })
}

export function useDeleteHospital() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from('hospitals').delete().eq('id', id).select('id')
      // MAKO scans keep their hospital (on delete restrict) — say so in plain words
      if ((error as { code?: string } | null)?.code === '23503') throw new Error('אי אפשר למחוק בית חולים שיש לו סריקות MAKO')
      if (error) throw error
      // a delete the policy does not allow is not an error for the database: it simply deletes nothing
      if (!data?.length) throw new Error('אין הרשאה למחוק בית חולים (למנהלים בלבד)')
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hospitals'] })
      qc.invalidateQueries({ queryKey: ['map-data'] })
    },
  })
}

export function useSetHospitalAgents() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      hospitalId,
      agentIds,
    }: {
      hospitalId: string
      agentIds: string[]
    }) => {
      await syncJoin('hospital_agents', 'hospital_id', hospitalId, 'agent_id', agentIds.map((agent_id) => ({ agent_id })))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['map-data'] })
      qc.invalidateQueries({ queryKey: ['hospital-agents'] })
    },
  })
}

export function useHospitalAgents() {
  return useQuery({
    queryKey: ['hospital-agents'],
    queryFn: async () =>
      unwrap<{ hospital_id: string; agent_id: string }[]>(
        await supabase.from('hospital_agents').select('hospital_id, agent_id'),
      ),
  })
}

export function useSetHospitalRoboticSystems() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      hospitalId,
      systemIds,
    }: {
      hospitalId: string
      systemIds: string[]
    }) => {
      await supabase
        .from('hospital_robotic_systems')
        .delete()
        .eq('hospital_id', hospitalId)
      if (systemIds.length)
        unwrap(
          await supabase
            .from('hospital_robotic_systems')
            .insert(
              systemIds.map((system_id) => ({ hospital_id: hospitalId, system_id })),
            ),
        )
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hospitals'] })
      qc.invalidateQueries({ queryKey: ['map-data'] })
    },
  })
}

function refListHooks(table: 'organizations' | 'robotic_systems', key: string) {
  return {
    useUpsert() {
      const qc = useQueryClient()
      return useMutation({
        mutationFn: async (c: { id?: string; name: string }) => {
          if (c.id)
            unwrap(await supabase.from(table).update({ name: c.name }).eq('id', c.id))
          else unwrap(await supabase.from(table).insert({ name: c.name }))
        },
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: [key] })
          qc.invalidateQueries({ queryKey: ['hospitals'] })
          qc.invalidateQueries({ queryKey: ['map-data'] })
        },
      })
    },
    useDelete() {
      const qc = useQueryClient()
      return useMutation({
        mutationFn: async (id: string) =>
          unwrap(await supabase.from(table).delete().eq('id', id)),
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: [key] })
          qc.invalidateQueries({ queryKey: ['hospitals'] })
          qc.invalidateQueries({ queryKey: ['map-data'] })
        },
      })
    },
  }
}

const orgHooks = refListHooks('organizations', 'organizations')
export const useUpsertOrganization = orgHooks.useUpsert
export const useDeleteOrganization = orgHooks.useDelete

const roboticHooks = refListHooks('robotic_systems', 'robotic-systems')
export const useUpsertRoboticSystem = roboticHooks.useUpsert
export const useDeleteRoboticSystem = roboticHooks.useDelete

export function useUpdateProfileRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) =>
      unwrap(await supabase.from('profiles').update({ role }).eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agents'] }),
  })
}

/* ============================ Map data ============================ */

export type MapHospital = Hospital & {
  organization: Organization | null
  hospital_agents: { agent: Pick<Profile, 'id' | 'full_name'> | null }[]
  hospital_robotic_systems: { system: RoboticSystem | null }[]
  case_volumes: {
    procedure_id: string
    year: number
    count: number
    procedure: { name: string } | null
  }[]
  contacts: Contact[]
  doctor_hospitals: {
    role_at_hospital: string
    sector: string
    clinic_days: number[]
    clinic_hours: string
    clinic_note: string
    doctor: Pick<Doctor, 'id' | 'name' | 'title' | 'position' | 'status'> | null
  }[]
}

export function useMapData() {
  return useQuery({
    queryKey: ['map-data'],
    queryFn: async () =>
      unwrap<MapHospital[]>(
        await supabase
          .from('hospitals')
          .select(
            '*, organization:organizations(*), hospital_agents(agent:profiles(id, full_name)), hospital_robotic_systems(system:robotic_systems(*)), case_volumes(procedure_id, year, count, procedure:procedures(name)), contacts:contacts!contacts_hospital_id_fkey(*), doctor_hospitals(role_at_hospital, sector, clinic_days, clinic_hours, clinic_note, doctor:doctors(id, name, title, position, status))',
          )
          .order('name'),
      ),
  })
}

/* ============================ Contacts ============================ */

export function useContacts() {
  return useQuery({
    queryKey: ['contacts'],
    queryFn: () => fetchAll<Contact>((a, b) => supabase.from('contacts').select('*').order('name').order('id').range(a, b)),
  })
}

export function useUpsertContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (c: Partial<Contact> & { name: string }) => {
      const payload = {
        name: c.name,
        role: c.role ?? '',
        phone: c.phone ?? '',
        office_phone: c.office_phone ?? '',
        email: c.email ?? '',
        notes: c.notes ?? '',
        hospital_id: c.hospital_id ?? null,
        doctor_id: c.doctor_id ?? null,
      }
      if (c.id) unwrap(await supabase.from('contacts').update(payload).eq('id', c.id))
      else unwrap(await supabase.from('contacts').insert(payload))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] })
      qc.invalidateQueries({ queryKey: ['map-data'] })
    },
  })
}

export function useDeleteContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(await supabase.from('contacts').delete().eq('id', id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] })
      qc.invalidateQueries({ queryKey: ['map-data'] })
    },
  })
}

/* ============================ Doctor activity ============================ */

export type DoctorActivity = { lastMeeting: string | null; count: number }

export function useDoctorActivity() {
  return useQuery({
    queryKey: ['doctor-activity'],
    queryFn: async () => {
      const rows = unwrap<
        { doctor_id: string; meeting: { meeting_date: string | null } | null }[]
      >(
        await supabase
          .from('meeting_doctors')
          .select('doctor_id, meeting:meetings(meeting_date)'),
      )
      const map: Record<string, DoctorActivity> = {}
      for (const r of rows) {
        const cur = map[r.doctor_id] ?? { lastMeeting: null, count: 0 }
        cur.count += 1
        const d = r.meeting?.meeting_date ?? null
        if (d && (!cur.lastMeeting || d > cur.lastMeeting)) cur.lastMeeting = d
        map[r.doctor_id] = cur
      }
      return map
    },
  })
}

/* ============================ Case volumes ============================ */

const CASE_VOLUME_SELECT =
  '*, doctor:doctors(id, name, title), hospital:hospitals(id, name, city), procedure:procedures(id, name, category), company:companies(id, name)'

export function useCaseVolumes(filter: {
  doctorId?: string
  hospitalId?: string
}) {
  const { doctorId, hospitalId } = filter
  return useQuery({
    queryKey: ['case-volumes', doctorId ?? null, hospitalId ?? null],
    enabled: !!doctorId || !!hospitalId,
    queryFn: async () => {
      let q = supabase.from('case_volumes').select(CASE_VOLUME_SELECT)
      if (doctorId) q = q.eq('doctor_id', doctorId)
      if (hospitalId) q = q.eq('hospital_id', hospitalId)
      return unwrap<CaseVolumeRow[]>(
        await q.order('year', { ascending: false }),
      )
    },
  })
}

export function useAllCaseVolumes() {
  return useQuery({
    queryKey: ['case-volumes-all'],
    queryFn: () =>
      fetchAll<CaseVolumeRow>((a, b) => supabase.from('case_volumes').select(CASE_VOLUME_SELECT).order('year', { ascending: false }).order('id').range(a, b)),
  })
}

export type CaseVolumeInput = {
  id?: string
  doctor_id: string
  hospital_id: string
  procedure_id: string
  company_id: string | null
  year: number
  count: number
}

function invalidateCaseVolumes(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['case-volumes'] })
  qc.invalidateQueries({ queryKey: ['case-volumes-all'] })
  qc.invalidateQueries({ queryKey: ['map-data'] })
}

export function useUpsertCaseVolume() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: CaseVolumeInput) => {
      const payload = {
        doctor_id: v.doctor_id,
        hospital_id: v.hospital_id,
        procedure_id: v.procedure_id,
        company_id: v.company_id,
        year: v.year,
        count: v.count,
      }
      if (v.id) {
        unwrap(await supabase.from('case_volumes').update(payload).eq('id', v.id))
      } else {
        const res = await supabase.from('case_volumes').insert(payload)
        if (res.error) {
          const code = (res.error as { code?: string }).code
          if (code === '23505')
            throw new Error('כבר קיימת רשומה עם אותו רופא / בי״ח / הליך / חברה / שנה')
          throw res.error
        }
      }
    },
    onSuccess: () => invalidateCaseVolumes(qc),
  })
}

export function useDeleteCaseVolume() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(await supabase.from('case_volumes').delete().eq('id', id)),
    onSuccess: () => invalidateCaseVolumes(qc),
  })
}

/* ============================ Pipeline (potential doctors) ============================ */

export type PipelineDoctor = Doctor & {
  doctor_hospitals: { hospital: { id: string; name: string } | null }[]
  doctor_companies: { company: { id: string; name: string } | null }[]
  doctor_robotic_systems: { system: { id: string; name: string } | null }[]
  case_volumes: {
    year: number
    count: number
    company: { name: string } | null
    procedure: { name: string } | null
    hospital: { name: string } | null
  }[]
}

export function usePipelineDoctors() {
  return useQuery({
    queryKey: ['pipeline-doctors'],
    queryFn: async () =>
      unwrap<PipelineDoctor[]>(
        await supabase
          .from('doctors')
          .select(
            '*, doctor_hospitals(hospital:hospitals(id, name)), doctor_companies(company:companies(id, name)), doctor_robotic_systems(system:robotic_systems(id, name)), case_volumes(year, count, company:companies(name), procedure:procedures(name), hospital:hospitals(name))',
          )
          .eq('status', 'potential')
          .order('name'),
      ),
  })
}

/* ============================ Equipment ============================ */

export function useEquipmentItems() {
  return useQuery({
    queryKey: ['equipment-items'],
    queryFn: async () =>
      unwrap<EquipmentItemWithCompany[]>(
        await supabase
          .from('equipment_items')
          .select('*, company:companies(id, name), parts:equipment_item_parts(*)')
          .order('name'),
      ),
  })
}

export function useUpsertEquipmentItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (e: {
      id?: string
      name: string
      catalog_number: string
      company_id: string | null
    }) => {
      const payload = {
        name: e.name,
        catalog_number: e.catalog_number,
        company_id: e.company_id,
      }
      if (e.id)
        unwrap(await supabase.from('equipment_items').update(payload).eq('id', e.id))
      else unwrap(await supabase.from('equipment_items').insert(payload))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['equipment-items'] })
      qc.invalidateQueries({ queryKey: ['doctor-equipment'] })
    },
  })
}

export function useDeleteEquipmentItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(await supabase.from('equipment_items').delete().eq('id', id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['equipment-items'] })
      qc.invalidateQueries({ queryKey: ['doctor-equipment'] })
    },
  })
}

export function useDoctorEquipment(doctorId: string | undefined) {
  return useQuery({
    queryKey: ['doctor-equipment', doctorId],
    enabled: !!doctorId,
    queryFn: async () =>
      unwrap<DoctorProcedureEquipmentRow[]>(
        await supabase
          .from('doctor_procedure_equipment')
          .select(
            '*, procedure:procedures(id, name), item:equipment_items(*, company:companies(id, name), parts:equipment_item_parts(*))',
          )
          .eq('doctor_id', doctorId!),
      ),
  })
}

export function useUpsertDoctorEquipment(doctorId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (r: {
      id?: string
      procedure_id: string
      item_id: string
      qty_per_case: number
      scales_with_cases: boolean
    }) => {
      const payload = {
        doctor_id: doctorId,
        procedure_id: r.procedure_id,
        item_id: r.item_id,
        qty_per_case: r.qty_per_case,
        scales_with_cases: r.scales_with_cases,
      }
      if (r.id) {
        unwrap(
          await supabase
            .from('doctor_procedure_equipment')
            .update(payload)
            .eq('id', r.id),
        )
      } else {
        const res = await supabase
          .from('doctor_procedure_equipment')
          .insert(payload)
        if (res.error) {
          if ((res.error as { code?: string }).code === '23505')
            throw new Error('הפריט כבר קיים בתוכנית של הליך זה')
          throw res.error
        }
      }
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['doctor-equipment', doctorId] }),
  })
}

export function useDeleteDoctorEquipment(doctorId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(
        await supabase.from('doctor_procedure_equipment').delete().eq('id', id),
      ),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['doctor-equipment', doctorId] }),
  })
}

/* ============================ Patient scans (MAKO) ============================ */

export function useMakoHospitals() {
  return useQuery({
    queryKey: ['mako-hospitals'],
    queryFn: async () => {
      const rows = unwrap<
        {
          hospital: { id: string; name: string } | null
          system: { name: string } | null
        }[]
      >(
        await supabase
          .from('hospital_robotic_systems')
          .select('hospital:hospitals(id, name), system:robotic_systems(name)'),
      )
      const seen = new Set<string>()
      const out: { id: string; name: string }[] = []
      for (const r of rows)
        if (
          r.hospital &&
          r.system?.name?.toUpperCase().includes('MAKO') &&
          !seen.has(r.hospital.id)
        ) {
          seen.add(r.hospital.id)
          out.push(r.hospital)
        }
      return out.sort((a, b) => a.name.localeCompare(b.name, 'he'))
    },
  })
}

export function useImplantOptions() {
  return useQuery({
    queryKey: ['implant-options'],
    queryFn: async () =>
      fetchAll<ImplantOption>((a, b) => supabase.from('implant_options').select('*').order('category').order('sort').order('value').order('id').range(a, b)),
  })
}

/** the fields of the implant form of every procedure type (editable in Settings) */
export function useImplantFields() {
  return useQuery({
    queryKey: ['implant-fields'],
    queryFn: async () => {
      const rows = unwrap<ImplantField[]>(await supabase.from('implant_fields').select('*').order('procedure_type').order('sort').order('created_at'))
      // before the table was filled (or offline with an old cache) the built-in list is used
      return rows.length ? rows : null
    },
  })
}

const invalidateImplants = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ['implant-options'] })
  qc.invalidateQueries({ queryKey: ['implant-fields'] })
}

export function useUpsertImplantOption() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (o: { id?: string; category: string; value: string; parent_id?: string | null; sort?: number }) => {
      const value = o.value.trim()
      if (!value) throw new Error('כתוב ערך')
      if (o.id) unwrap(await supabase.from('implant_options').update({ value }).eq('id', o.id))
      else unwrap(await supabase.from('implant_options').insert({ category: o.category, value, parent_id: o.parent_id ?? null, sort: o.sort ?? 0 }))
    },
    onSuccess: () => invalidateImplants(qc),
  })
}

/** the options of one list in the order given (the position becomes the sort number) */
export function useReorderImplantOptions() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: string[]) => {
      for (const [i, id] of ids.entries()) unwrap(await supabase.from('implant_options').update({ sort: i + 1 }).eq('id', id))
    },
    onSuccess: () => invalidateImplants(qc),
  })
}

export function useDeleteImplantOption() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(await supabase.from('implant_options').delete().eq('id', id)),
    onSuccess: () => invalidateImplants(qc),
  })
}

export function useSaveImplantField() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (f: { id?: string; procedure_type: string; key?: string; label: string; category?: string; depends_on?: string | null; sort?: number }) => {
      const label = f.label.trim()
      if (!label) throw new Error('כתוב שם לשדה')
      if (f.id) {
        unwrap(await supabase.from('implant_fields').update({ label, depends_on: f.depends_on ?? null }).eq('id', f.id))
      } else {
        const id = crypto.randomUUID().slice(0, 8)
        unwrap(await supabase.from('implant_fields').insert({ procedure_type: f.procedure_type, key: `f_${id}`, label, category: `c_${id}`, depends_on: f.depends_on ?? null, sort: f.sort ?? 99 }))
      }
    },
    onSuccess: () => invalidateImplants(qc),
  })
}

export function useReorderImplantFields() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: string[]) => {
      for (const [i, id] of ids.entries()) unwrap(await supabase.from('implant_fields').update({ sort: i + 1 }).eq('id', id))
    },
    onSuccess: () => invalidateImplants(qc),
  })
}

export function useDeleteImplantField() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (f: { id: string; category: string }) => {
      // the sizes of a removed field go with it (sizes already written in scans stay as they were typed)
      unwrap(await supabase.from('implant_options').delete().eq('category', f.category))
      unwrap(await supabase.from('implant_fields').update({ depends_on: null }).eq('depends_on', f.category))
      unwrap(await supabase.from('implant_fields').delete().eq('id', f.id))
    },
    onSuccess: () => invalidateImplants(qc),
  })
}

const SCAN_SELECT =
  '*, hospital:hospitals(id, name), surgeon:doctors(id, name, title)'

export function usePatientScans() {
  return useQuery({
    queryKey: ['patient-scans'],
    queryFn: () =>
      fetchAll<PatientScanRow>((a, b) =>
        supabase.from('patient_scans').select(SCAN_SELECT).or(`surgery_date.gte.${historyStart()},ct_date.gte.${historyStart()},and(surgery_date.is.null,ct_date.is.null)`).order('ct_date', { ascending: false, nullsFirst: false }).order('id').range(a, b),
      ),
  })
}

export type PatientScanInput = Record<string, unknown> & {
  id?: string
  hospital_id: string
}

export function useUpsertPatientScan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (s: PatientScanInput) => {
      const { id, hospital, surgeon, ...rest } = s
      void hospital
      void surgeon
      if (id) {
        unwrap(
          await supabase
            .from('patient_scans')
            .update(rest as never)
            .eq('id', id),
        )
      } else {
        const actingId = await actingUserId()
        unwrap(
          await supabase
            .from('patient_scans')
            .insert({ ...rest, created_by: actingId } as never),
        )
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patient-scans'] }),
  })
}

export function useDeletePatientScan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(await supabase.from('patient_scans').delete().eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patient-scans'] }),
  })
}

export type DoneScanCount = {
  surgeon_id: string
  hospital_id: string
  procedure_name: string
  year: number
  count: number
}

/** completed MAKO surgeries counted from patient_scans (status = done) */
export function useDoneScanCounts() {
  return useQuery({
    queryKey: ['done-scan-counts'],
    queryFn: async () => {
      const rows = unwrap<
        {
          surgeon_id: string | null
          hospital_id: string
          procedure_type: string
          surgery_date: string | null
          ct_date: string | null
        }[]
      >(
        await supabase
          .from('patient_scans')
          .select('surgeon_id, hospital_id, procedure_type, surgery_date, ct_date')
          .eq('status', 'done'),
      )
      const map = new Map<string, DoneScanCount>()
      for (const r of rows) {
        if (!r.surgeon_id) continue
        const procedure_name = SCAN_PROCEDURE_TO_NAME[r.procedure_type]
        if (!procedure_name) continue
        const dateStr = r.surgery_date ?? r.ct_date
        const year = dateStr
          ? Number(dateStr.slice(0, 4))
          : new Date().getFullYear()
        const key = `${r.surgeon_id}|${r.hospital_id}|${procedure_name}|${year}`
        const cur =
          map.get(key) ?? {
            surgeon_id: r.surgeon_id,
            hospital_id: r.hospital_id,
            procedure_name,
            year,
            count: 0,
          }
        cur.count += 1
        map.set(key, cur)
      }
      return [...map.values()]
    },
  })
}

/* ============================ My profile ============================ */

export function useUpdateMyProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (fullName: string) => {
      const actingId = await actingUserId()
      if (!actingId) throw new Error('לא מחובר')
      unwrap(
        await supabase
          .from('profiles')
          .update({ full_name: fullName })
          .eq('id', actingId),
      )
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agents'] }),
  })
}

/* ============================ Consumables (MAKO stock counts) ============================ */

export function useConsumableItems() {
  return useQuery({
    queryKey: ['consumable-items'],
    queryFn: async () =>
      unwrap<ConsumableItem[]>(
        await supabase.from('consumable_items').select('*').order('sort').order('name'),
      ),
  })
}

export function useUpsertConsumableItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (
      i: Partial<ConsumableItem> & { name: string },
    ) => {
      const { id, created_at, ...rest } = i
      void created_at
      if (id) unwrap(await supabase.from('consumable_items').update(rest).eq('id', id))
      else unwrap(await supabase.from('consumable_items').insert(rest))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['consumable-items'] }),
  })
}

export function useDeleteConsumableItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(await supabase.from('consumable_items').delete().eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['consumable-items'] }),
  })
}

export function useConsumableMinimums(hospitalId: string) {
  return useQuery({
    queryKey: ['consumable-minimums', hospitalId],
    enabled: !!hospitalId,
    queryFn: async () =>
      unwrap<ConsumableMinimum[]>(
        await supabase.from('consumable_minimums').select('*').eq('hospital_id', hospitalId),
      ),
  })
}

export function useConsumableCounts(hospitalId: string) {
  return useQuery({
    queryKey: ['consumable-counts', hospitalId],
    enabled: !!hospitalId,
    queryFn: async () =>
      unwrap<ConsumableCountRow[]>(
        await supabase
          .from('consumable_counts')
          .select('*, counter:profiles(full_name, email), lines:consumable_count_lines(*)')
          .eq('hospital_id', hospitalId)
          .order('counted_on', { ascending: false })
          .order('created_at', { ascending: false }),
      ),
  })
}

export type SaveCountInput = {
  hospitalId: string
  countedOn: string
  notes: string
  lines: { item_id: string; qty: number; min_qty: number }[]
  // per-hospital overrides to persist (item_id → min), and items to reset to default
  overrides: { item_id: string; min_qty: number }[]
  clearOverrides: string[]
}

export function useDeleteConsumableCount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(await supabase.from('consumable_counts').delete().eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['consumable-counts'] }),
  })
}

export function useAppSetting(key: string) {
  return useQuery({
    queryKey: ['app-setting', key],
    queryFn: async () => {
      const rows = unwrap<{ value: string }[]>(
        await supabase.from('app_settings').select('value').eq('key', key),
      )
      return rows[0]?.value ?? ''
    },
  })
}

export function useSaveAppSetting() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) =>
      unwrap(
        await supabase
          .from('app_settings')
          .upsert({ key, value, updated_at: new Date().toISOString() }),
      ),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['app-setting', v.key] }),
  })
}

/** update only phone / e-mail of an existing doctor (used when importing a phone contact) */
export function usePatchDoctorContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, phone, email }: { id: string; phone?: string; email?: string }) => {
      const patch: TablesUpdate<'doctors'> = {}
      if (phone !== undefined) patch.phone = phone
      if (email !== undefined) patch.email = email
      unwrap(await supabase.from('doctors').update(patch).eq('id', id))
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['doctors'] })
      qc.invalidateQueries({ queryKey: ['doctor', v.id] })
    },
  })
}

/* ============================ Surgical course (מהלך ניתוחי) ============================ */

export function useTemplateStages() {
  return useQuery({
    queryKey: ['template-stages'],
    queryFn: async () =>
      unwrap<TemplateStage[]>(
        await supabase.from('procedure_template_stages').select('*').order('sort'),
      ),
  })
}

export function useSaveTemplateStages() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ procedureId, titles }: { procedureId: string; titles: string[] }) => {
      unwrap(await supabase.from('procedure_template_stages').delete().eq('procedure_id', procedureId))
      const rows = titles
        .map((t) => t.trim())
        .filter(Boolean)
        .map((title, i) => ({ procedure_id: procedureId, title, sort: i + 1 }))
      if (rows.length) unwrap(await supabase.from('procedure_template_stages').insert(rows))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['template-stages'] }),
  })
}

export function useDoctorCourses(doctorId: string | undefined) {
  return useQuery({
    queryKey: ['doctor-courses', doctorId],
    enabled: !!doctorId,
    queryFn: async () => {
      const rows = unwrap<SurgicalCourse[]>(
        await supabase
          .from('doctor_surgical_courses')
          .select('*, procedure:procedures(id, name), stages:doctor_course_stages(*, items:doctor_course_items(*))')
          .eq('doctor_id', doctorId!)
          .order('created_at'),
      )
      return rows.map((c) => ({
        ...c,
        stages: [...c.stages]
          .sort((a, b) => a.sort - b.sort)
          .map((st) => ({ ...st, items: [...st.items].sort((a, b) => a.sort - b.sort) })),
      }))
    },
  })
}

export type CourseDraft = { title: string; items: string[] }[]

async function writeCourseStages(courseId: string, draft: CourseDraft) {
  // the new stages are written first and the old ones removed only after that succeeded: a dropped connection half way
  // never leaves the course empty (the stages typed by the agent are the valuable part)
  const old = unwrap<{ id: string }[]>(await supabase.from('doctor_course_stages').select('id').eq('course_id', courseId)).map((x) => x.id)
  const created: string[] = []
  try {
    for (const [i, st] of draft.entries()) {
      const stage = unwrap<{ id: string }>(
        await supabase
          .from('doctor_course_stages')
          .insert({ course_id: courseId, title: st.title.trim() || 'שלב', sort: i + 1 })
          .select('id')
          .single(),
      )
      created.push(stage.id)
      const items = st.items
        .map((t) => t.trim())
        .filter(Boolean)
        .map((text, k) => ({ stage_id: stage.id, text, sort: k + 1 }))
      if (items.length) unwrap(await supabase.from('doctor_course_items').insert(items))
    }
  } catch (e) {
    if (created.length) await supabase.from('doctor_course_stages').delete().in('id', created) // best effort: drop the half-written copy
    throw e
  }
  if (old.length) unwrap(await supabase.from('doctor_course_stages').delete().in('id', old))
}

/** a new course starts as a copy of the procedure's template stages (empty lines) */
export function useCreateCourse(doctorId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (procedureId: string) => {
      const course = unwrap<{ id: string }>(
        await supabase
          .from('doctor_surgical_courses')
          .insert({ doctor_id: doctorId, procedure_id: procedureId })
          .select('id')
          .single(),
      )
      const tpl = unwrap<TemplateStage[]>(
        await supabase.from('procedure_template_stages').select('*').eq('procedure_id', procedureId).order('sort'),
      )
      await writeCourseStages(course.id, tpl.map((t) => ({ title: t.title, items: [] })))
      return course.id
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['doctor-courses', doctorId] }),
  })
}

export function useSaveCourse(doctorId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ courseId, draft }: { courseId: string; draft: CourseDraft }) => {
      await writeCourseStages(courseId, draft)
      unwrap(
        await supabase
          .from('doctor_surgical_courses')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', courseId),
      )
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['doctor-courses', doctorId] }),
  })
}

export function useDeleteCourse(doctorId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (courseId: string) =>
      unwrap(await supabase.from('doctor_surgical_courses').delete().eq('id', courseId)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['doctor-courses', doctorId] }),
  })
}

/* ============================ Info library (מידע) ============================ */

export const INFO_BUCKET = 'info-docs'
export const INFO_MAX_BYTES = 50 * 1024 * 1024

export function useInfoCategories() {
  return useQuery({
    queryKey: ['info-categories'],
    queryFn: async () =>
      unwrap<InfoCategory[]>(await supabase.from('info_categories').select('*').order('sort')),
  })
}

export function useSaveInfoCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (c: { id?: string; name: string; sort?: number }): Promise<string> => {
      if (c.id) {
        unwrap(await supabase.from('info_categories').update({ name: c.name, sort: c.sort }).eq('id', c.id))
        return c.id
      }
      return unwrap<{ id: string }>(await supabase.from('info_categories').insert({ name: c.name, sort: c.sort ?? 99 }).select('id').single()).id
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['info-categories'] })
      qc.invalidateQueries({ queryKey: ['info-documents'] })
    },
  })
}

export function useDeleteInfoCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('info_categories').delete().eq('id', id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['info-categories'] })
      qc.invalidateQueries({ queryKey: ['info-documents'] })
    },
  })
}

export function useInfoDocuments() {
  return useQuery({
    queryKey: ['info-documents'],
    queryFn: async () =>
      unwrap<InfoDocument[]>(
        await supabase
          .from('info_documents')
          .select('*, category:info_categories(id, name), procedures:info_document_procedures(procedure_id), uploader:profiles(full_name)')
          .order('created_at', { ascending: false }),
      ),
  })
}

export type InfoDocInput = {
  id?: string
  title: string
  description: string
  categoryId: string | null
  procedureIds: string[]
  tags: string[]
  kind: 'file' | 'link'
  url: string
  file?: File | null
}

export function useSaveInfoDoc() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (d: InfoDocInput): Promise<string> => {
      const actingId = await actingUserId()
      const meta: Record<string, unknown> = {
        title: d.title.trim(),
        description: d.description.trim(),
        category_id: d.categoryId,
        tags: d.tags,
      }
      if (d.kind === 'link') {
        meta.kind = 'link'
        meta.url = d.url.trim()
      } else if (d.file) {
        // storage keys stay ASCII; the original file name is kept in the row
        const ext = (d.file.name.split('.').pop() ?? 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin'
        const path = `${crypto.randomUUID()}.${ext}`
        const up = await infoStorage().upload(path, d.file, {
          contentType: d.file.type || 'application/octet-stream',
        })
        if (up.error) throw up.error
        Object.assign(meta, {
          content_hash: await fileHash(d.file),
          kind: 'file', storage_path: path, file_name: d.file.name, file_size: d.file.size, mime: d.file.type, url: '',
        })
      }

      let id = d.id
      if (id) {
        unwrap(await supabase.from('info_documents').update(meta as never).eq('id', id))
      } else {
        const created = unwrap<{ id: string }>(
          await supabase
            .from('info_documents')
            .insert({ ...meta, uploaded_by: actingId } as never)
            .select('id')
            .single(),
        )
        id = created.id
      }
      unwrap(await supabase.from('info_document_procedures').delete().eq('document_id', id))
      if (d.procedureIds.length)
        unwrap(
          await supabase
            .from('info_document_procedures')
            .insert(d.procedureIds.map((procedure_id) => ({ document_id: id!, procedure_id }))),
        )
      return id
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['info-documents'] }),
  })
}

export function useDeleteInfoDoc() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (d: InfoDocument) => {
      if (d.kind === 'file' && d.storage_path) {
        const r = await infoStorage().remove([d.storage_path])
        if (r.error) throw r.error
      }
      unwrap(await supabase.from('info_documents').delete().eq('id', d.id))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['info-documents'] }),
  })
}

/** opens a document in a new tab (files through a short-lived signed link) */
export async function openInfoDocument(d: InfoDocument): Promise<string | null> {
  if (d.kind === 'link') {
    // the form only accepts http(s), but a row can also be written straight to the API: never open javascript: / data: links
    if (!/^https?:\/\//i.test(d.url.trim())) return 'הקישור אינו תקין'
    window.open(d.url, '_blank', 'noopener,noreferrer')
    return null
  }
  const tab = window.open('', '_blank') // opened first so the browser does not block it
  const { data, error } = await infoStorage().createSignedUrl(d.storage_path, 3600)
  if (error || !data) {
    tab?.close()
    return 'לא ניתן לפתוח את הקובץ'
  }
  if (tab) tab.location.href = data.signedUrl
  else window.location.href = data.signedUrl
  return null
}

/* ============================ Tasks ============================ */
// meeting_tasks is the single tasks table: tasks from meeting summaries and stand-alone tasks

const TASK_SELECT =
  '*, subtasks:task_subtasks(*), doctor:doctors(id, name, title), hospital:hospitals(id, name), assignee:profiles!meeting_tasks_assignee_id_fkey(id, full_name), meeting:meetings(id, subject), project:projects(id, name), area:project_areas(id, name), contact:contacts!meeting_tasks_contact_id_fkey(id, name, role, phone, office_phone, email), coordinator:contacts!meeting_tasks_coordinator_contact_id_fkey(id, name, role, phone, office_phone, email)'

/** every task the signed-in user may see (his own; admins see all) */
export function useTasks() {
  return useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const rows = await fetchAll<TaskRow>((a, b) =>
        supabase
          .from('meeting_tasks')
          .select(TASK_SELECT)
          // open tasks always; finished ones for the last year
          .or(`is_done.eq.false,done_at.gte.${historyStart(12)}`)
          .order('due_date', { ascending: true, nullsFirst: false })
          .order('created_at', { ascending: false })
          .order('id')
          .range(a, b),
      )
      return rows.map((t) => ({ ...t, subtasks: [...t.subtasks].sort((a, b) => a.sort - b.sort) }))
    },
  })
}

export type TaskFormData = {
  id?: string
  description: string
  notes: string
  due_date: string | null
  priority: 'normal' | 'urgent'
  doctor_id: string | null
  hospital_id: string | null
  recurrence: 'none' | 'weekly' | 'monthly'
  assignee_id: string | null
  /** the AMI coordinator: a contact and/or free text */
  coordinator_contact_id?: string | null
  coordinator_text?: string
  subtasks: { id?: string; text: string; is_done: boolean }[]
}

function invalidateTasks(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['tasks'] })
  invalidateMeetings(qc)
}

export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('meeting_tasks').delete().eq('id', id)),
    onSuccess: () => invalidateTasks(qc),
  })
}

/* ============================ Competitor activity ============================ */

const INTEL_SELECT = '*, doctor:doctors(id, name, title), hospital:hospitals(id, name), meeting:meetings(id, subject)'

export function useCompetitorIntel() {
  return useQuery({
    queryKey: ['competitor-intel'],
    queryFn: async () =>
      unwrap<CompetitorIntelRow[]>(
        await supabase.from('competitor_intel').select(INTEL_SELECT).order('intel_date', { ascending: false }),
      ),
  })
}

export type IntelFormData = {
  id?: string
  /** a competitor of the managed list (null = a name typed by hand, for a manager to add to the list later) */
  competitor_id: string | null
  competitor: string
  product: string
  offer: string
  notes: string
  intel_date: string
  doctor_id: string | null
  hospital_id: string | null
  outcome: 'open' | 'won' | 'lost'
  loss_reason: string
  contract_end: string | null
  tender_name: string
  tender_due: string | null
  loyalty: '' | 'loyal' | 'open' | 'leaning'
  price_per_case: number | null
  implant_price: number | null
  payment_terms: string
  /** pictures already stored (paths) */
  image_paths: string[]
  /** new pictures to upload (already shrunk) */
  newImages?: Blob[]
}

export function useSaveIntel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (d: IntelFormData) => {
      const uploaded: string[] = []
      for (const b of d.newImages ?? []) uploaded.push(await uploadImageTo('competitor/', b))
      const row = {
        competitor_id: d.competitor_id,
        competitor: d.competitor.trim(),
        product: d.product.trim(),
        offer: d.offer.trim(),
        notes: d.notes.trim(),
        intel_date: d.intel_date,
        doctor_id: d.doctor_id || null,
        hospital_id: d.hospital_id || null,
        outcome: d.outcome,
        loss_reason: d.outcome === 'lost' ? d.loss_reason : '',
        contract_end: d.contract_end || null,
        tender_name: d.tender_name.trim(),
        tender_due: d.tender_due || null,
        loyalty: d.doctor_id ? d.loyalty : '',
        price_per_case: d.price_per_case,
        implant_price: d.implant_price,
        payment_terms: d.payment_terms.trim(),
        image_paths: [...d.image_paths, ...uploaded],
      }
      if (d.id) unwrap(await supabase.from('competitor_intel').update(row).eq('id', d.id))
      else unwrap(await supabase.from('competitor_intel').insert(row))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['competitor-intel'] }),
  })
}

export function useDeleteIntel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('competitor_intel').delete().eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['competitor-intel'] }),
  })
}

/* ---------- the managed list of competitors (with the battlecard) ---------- */

export function useCompetitors() {
  return useQuery({
    queryKey: ['competitors'],
    queryFn: async () => unwrap<Competitor[]>(await supabase.from('competitors').select('*').order('sort').order('name')),
  })
}

export type CompetitorInput = Omit<Competitor, 'id' | 'created_at' | 'updated_at'> & { id?: string }

export function useSaveCompetitor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (c: CompetitorInput) => {
      const { id, ...rest } = c
      const row = { ...rest, name: rest.name.trim() }
      const saved = id
        ? unwrap<Competitor>(await supabase.from('competitors').update(row).eq('id', id).select().single())
        : unwrap<Competitor>(await supabase.from('competitors').insert(row).select().single())
      // records written with this name by hand are tied to the competitor now
      await supabase.from('competitor_intel').update({ competitor_id: saved.id, competitor: saved.name }).is('competitor_id', null).ilike('competitor', saved.name)
      return saved
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['competitors'] })
      qc.invalidateQueries({ queryKey: ['competitor-intel'] })
    },
  })
}

export function useDeleteCompetitor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('competitors').delete().eq('id', id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['competitors'] })
      qc.invalidateQueries({ queryKey: ['competitor-intel'] })
    },
  })
}

/** the hospitals the signed-in user is responsible for (null while loading) */
export function useMyHospitalIds(): string[] | null {
  const { user } = useAuth()
  const rows = useHospitalAgents()
  if (!rows.data) return null
  return rows.data.filter((r) => r.agent_id === user?.id).map((r) => r.hospital_id)
}

/* ============================ Audit log (admin) ============================ */

export type AuditFilters = { userId: string; table: string; action: string; from: string; to: string; limit: number }

export function useAuditLog(f: AuditFilters) {
  return useQuery({
    queryKey: ['audit-log', f],
    queryFn: async () => {
      let q = supabase.from('audit_log').select('*').order('at', { ascending: false }).limit(f.limit)
      if (f.userId) q = q.eq('user_id', f.userId)
      if (f.table) q = q.eq('table_name', f.table)
      if (f.action) q = q.eq('action', f.action)
      if (f.from) q = q.gte('at', `${f.from}T00:00:00`)
      if (f.to) q = q.lte('at', `${f.to}T23:59:59`)
      return unwrap<AuditEntry[]>(await q)
    },
  })
}

/** every table of the system as one JSON file — a manual backup an admin can keep */
export const BACKUP_TABLES = [
  'profiles', 'companies', 'organizations', 'robotic_systems', 'procedures', 'hospitals', 'hospital_agents',
  'hospital_robotic_systems', 'doctors', 'doctor_companies', 'doctor_hospitals', 'doctor_procedures',
  'doctor_robotic_systems', 'doctor_preop_plans', 'doctor_procedure_equipment', 'equipment_items', 'implant_options',
  'favorites', 'contacts', 'meetings', 'meeting_doctors', 'meeting_agents', 'meeting_contacts', 'meeting_tasks',
  'task_subtasks', 'case_volumes', 'patient_scans', 'consumable_items', 'consumable_minimums', 'consumable_counts',
  'consumable_count_lines', 'app_settings', 'procedure_template_stages', 'doctor_surgical_courses',
  'doctor_course_stages', 'doctor_course_items', 'info_categories', 'info_documents', 'info_document_procedures',
  'competitor_intel', 'audit_log',
  // added later than the first version of the backup: projects, agent management, equipment parts
  'projects', 'project_areas', 'project_updates', 'project_files', 'agent_goals', 'agent_reviews', 'agent_notes',
  'company_robotic_systems', 'competitor_robotic_systems', 'competitors', 'doctor_stage_history', 'implant_fields', 'learn_attempts', 'learn_progress', 'pipeline_stages', 'planned_surgeries', 'upload_requests',
  'equipment_item_parts', 'training_stages', 'agent_training', 'learn_topics', 'learn_cards', 'learn_lessons', 'learn_cases', 'learn_sequences', 'learn_daily', 'learn_tracks', 'learn_track_items', 'consumable_usage',
] as const

export async function exportBackup(onProgress?: (table: string) => void) {
  const out: Record<string, unknown[]> = {}
  // the list comes from the database, so a table added later is never forgotten; the fixed list is the fallback
  const listed = await (supabase as unknown as { rpc: (n: string) => Promise<{ data: unknown }> }).rpc('backup_tables')
  const tables: string[] = Array.isArray(listed.data) && listed.data.length > 0 ? (listed.data as string[]) : [...BACKUP_TABLES]
  for (const t of tables) {
    onProgress?.(t)
    const rows: unknown[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await (supabase as unknown as { from: (n: string) => { select: (c: string) => { range: (a: number, b: number) => Promise<{ data: unknown[] | null; error: { message: string } | null }> } } }).from(t).select('*').range(from, from + 999)
      if (error) throw new Error(`${t}: ${error.message}`)
      rows.push(...(data ?? []))
      if (!data || data.length < 1000) break
    }
    out[t] = rows
  }
  return { exported_at: new Date().toISOString(), tables: out }
}

/* ============================ Writes that also work offline ============================
   Each of these runs against the server when there is a connection and is queued in the outbox (outbox.ts) when
   there is not: the screen is updated at once and the change is sent, merged field by field, when the network returns. */

const newId = () => crypto.randomUUID()
const short = (s: string) => (s.length > 40 ? `${s.slice(0, 40)}…` : s)
const pickKeys = (row: unknown, keys: string[]): Record<string, unknown> | null => {
  if (!row || typeof row !== 'object') return null
  const r = row as Record<string, unknown>
  return Object.fromEntries(keys.map((k) => [k, r[k]]))
}

/** the screen shows the new state immediately; the server's version replaces it after the sync */
function mapMeetingCaches(fn: (m: MeetingWithRelations) => MeetingWithRelations) {
  queryClient.setQueriesData(
    { predicate: (q) => ['meetings', 'meeting', 'doctor-meetings'].includes(String(q.queryKey[0])) },
    (old: unknown) => {
      if (Array.isArray(old)) return old.map((m) => (m && typeof m === 'object' && 'meeting_tasks' in m ? fn(m as MeetingWithRelations) : m))
      if (old && typeof old === 'object' && 'meeting_tasks' in old) return fn(old as MeetingWithRelations)
      return old
    },
  )
}

/* ---------- tasks: done / not done ---------- */

type DoneTask = Pick<
  MeetingTask,
  'id' | 'is_done' | 'description' | 'notes' | 'priority' | 'doctor_id' | 'hospital_id' | 'recurrence' | 'assignee_id' | 'created_by' | 'due_date'
> & Partial<Pick<MeetingTask, 'project_id' | 'area_id' | 'coordinator_contact_id' | 'coordinator_text'>> & { subtasks?: { text: string }[] }
type TaskDonePayload = { task: DoneTask; done: boolean; nextId: string; at: string }

async function execTaskDone({ task, done, nextId, at }: TaskDonePayload): Promise<ExecResult> {
  unwrap(await supabase.from('meeting_tasks').update({ is_done: done, done_at: done ? at : null }).eq('id', task.id))
  if (done && !task.is_done && task.recurrence !== 'none' && task.due_date) {
    // a repeating task creates the next one. The id comes from the source task (nextCopyId): completing it again after a reopen,
    // a retry or an offline replay finds the copy that is already there and makes no second one
    const exists = unwrap<{ id: string }[]>(await supabase.from('meeting_tasks').select('id').eq('id', nextId).retry(false)).length > 0
    if (!exists) {
      unwrap(
        await supabase.from('meeting_tasks').upsert({
          id: nextId,
          description: task.description,
          notes: task.notes,
          priority: task.priority,
          doctor_id: task.doctor_id,
          hospital_id: task.hospital_id,
          recurrence: task.recurrence,
          assignee_id: task.assignee_id,
          created_by: (await currentUserId()) || task.created_by,
          due_date: nextDue(task.due_date, task.recurrence),
          // the next one stays in the same project / area and with the same AMI coordinator
          project_id: task.project_id ?? null,
          area_id: task.area_id ?? null,
          coordinator_contact_id: task.coordinator_contact_id ?? null,
          coordinator_text: task.coordinator_text ?? '',
        }),
      )
    }
    // the steps (not ticked) — only when the copy has none yet, with ids that depend on the copy, so a replay after a cut connection completes them
    const steps = unwrap<{ id: string }[]>(await supabase.from('task_subtasks').select('id').eq('task_id', nextId).retry(false))
    if (steps.length === 0 && task.subtasks?.length)
      unwrap(await supabase.from('task_subtasks').upsert(task.subtasks.map((s, i) => ({ id: stableUuid(`${nextId}:${i}`), task_id: nextId, text: s.text, sort: i }))))
  }
}
registerExecutor<TaskDonePayload>('task.done', execTaskDone)

async function setTaskDoneOffline(task: DoneTask & { subtasks?: { text: string }[] }, done: boolean) {
  const payload: TaskDonePayload = {
    task: {
      id: task.id,
      is_done: task.is_done,
      description: task.description,
      notes: task.notes,
      priority: task.priority,
      doctor_id: task.doctor_id,
      hospital_id: task.hospital_id,
      recurrence: task.recurrence,
      assignee_id: task.assignee_id,
      created_by: task.created_by,
      due_date: task.due_date,
      project_id: task.project_id,
      area_id: task.area_id,
      coordinator_contact_id: task.coordinator_contact_id,
      coordinator_text: task.coordinator_text,
      subtasks: task.subtasks?.map((s) => ({ text: s.text })),
    },
    done,
    nextId: nextCopyId(task.id),
    at: new Date().toISOString(),
  }
  await runOrQueue(
    { kind: 'task.done', label: `${done ? 'סימון כבוצע' : 'ביטול סימון'}: ${short(task.description)}`, recordIds: [task.id], payload },
    () => execTaskDone(payload),
    () => {
      queryClient.setQueryData<TaskRow[]>(['tasks'], (old) =>
        old?.map((t) => (t.id === task.id ? { ...t, is_done: done, done_at: done ? payload.at : null } : t)),
      )
      mapMeetingCaches((m) => ({
        ...m,
        meeting_tasks: m.meeting_tasks.map((t) => (t.id === task.id ? { ...t, is_done: done, done_at: done ? payload.at : null } : t)),
      }))
    },
  )
}

export function useSetTaskDone() {
  const qc = useQueryClient()
  return useMutation({
    meta: { silent: true },
    mutationFn: ({ task, done }: { task: TaskRow; done: boolean }) => setTaskDoneOffline(task, done),
    // the row changes at once (online too, not only when queued); a refused write puts it back
    onMutate: ({ task, done }) => {
      const prev = queryClient.getQueryData<TaskRow[]>(['tasks'])?.find((t) => t.id === task.id)
      queryClient.setQueryData<TaskRow[]>(['tasks'], (old) =>
        old?.map((t) => (t.id === task.id ? { ...t, is_done: done, status: done ? 'done' : 'todo', done_at: done ? new Date().toISOString() : null } : t)),
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      const prev = ctx?.prev
      if (prev) queryClient.setQueryData<TaskRow[]>(['tasks'], (old) => old?.map((t) => (t.id === prev.id ? prev : t)))
    },
    onSuccess: () => invalidateTasks(qc),
  })
}

function setMeetingTaskDone(taskId: string, done: boolean) {
  mapMeetingCaches((m) => ({
    ...m,
    meeting_tasks: m.meeting_tasks.map((t) => (t.id === taskId ? { ...t, is_done: done, done_at: done ? new Date().toISOString() : null } : t)),
  }))
}

export function useToggleMeetingTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (task: MeetingTask) => setTaskDoneOffline(task, !task.is_done),
    // the tick changes at once (online too, not only when queued); a refused write puts it back
    onMutate: (task) => setMeetingTaskDone(task.id, !task.is_done),
    onError: (_e, task) => setMeetingTaskDone(task.id, task.is_done),
    onSuccess: () => invalidateTasks(qc),
  })
}

/* ---------- tasks: create / edit with sub-tasks ---------- */

type TaskSaveData = Omit<TaskFormData, 'id' | 'subtasks'> & { id: string; subtasks: { id: string; text: string; is_done: boolean }[] }
type TaskSavePayload = {
  data: TaskSaveData
  isNew: boolean
  /** what the task looked like when the user started editing (to merge with changes made by others) */
  base: Record<string, unknown> | null
  baseSubIds: string[] | null
  userId: string
}
const TASK_FIELDS = ['description', 'notes', 'due_date', 'priority', 'doctor_id', 'hospital_id', 'recurrence', 'coordinator_contact_id', 'coordinator_text']

const taskFields = (d: TaskSaveData) => ({
  description: d.description.trim(),
  notes: d.notes.trim(),
  due_date: d.due_date || null,
  priority: d.priority,
  doctor_id: d.doctor_id || null,
  hospital_id: d.hospital_id || null,
  recurrence: d.recurrence,
  coordinator_contact_id: d.coordinator_contact_id ?? null,
  coordinator_text: (d.coordinator_text ?? '').trim(),
})

async function execTaskSave(p: TaskSavePayload): Promise<ExecResult> {
  const d = p.data
  let result: ExecResult = undefined
  if (p.isNew) {
    unwrap(
      await supabase
        .from('meeting_tasks')
        .upsert({ id: d.id, ...taskFields(d), assignee_id: d.assignee_id || p.userId, created_by: p.userId }),
    )
  } else {
    // the assignee is written only when this edit changed it (otherwise a manager's reassignment made meanwhile would be undone)
    if (d.assignee_id && (p.base === null || d.assignee_id !== p.base.assignee_id)) {
      unwrap(await supabase.from('meeting_tasks').update({ assignee_id: d.assignee_id }).eq('id', d.id))
    }
    result = await mergePatch('meeting_tasks', d.id, taskFields(d), p.base)
  }
  // sub-tasks: only the ones this edit removed are deleted (a step another agent added meanwhile stays)
  const keep = d.subtasks.filter((s) => s.text.trim()).map((s) => s.id)
  const existing = unwrap<{ id: string }[]>(await supabase.from('task_subtasks').select('id').eq('task_id', d.id).retry(false))
  const drop = existing.map((e) => e.id).filter((id) => !keep.includes(id) && (p.baseSubIds === null || p.baseSubIds.includes(id)))
  if (drop.length) unwrap(await supabase.from('task_subtasks').delete().in('id', drop))
  const rows = d.subtasks
    .filter((s) => s.text.trim())
    .map((s, i) => ({ id: s.id, task_id: d.id, text: s.text.trim(), is_done: s.is_done, sort: i }))
  if (rows.length) unwrap(await supabase.from('task_subtasks').upsert(rows))
  return result
}
registerExecutor<TaskSavePayload>('task.save', execTaskSave)

export function useSaveTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (d: TaskFormData) => {
      const userId = await currentUserId()
      const isNew = !d.id
      const data: TaskSaveData = {
        ...d,
        id: d.id ?? newId(),
        subtasks: d.subtasks.map((s) => ({ id: s.id ?? newId(), text: s.text, is_done: s.is_done })),
      }
      const cached = queryClient.getQueryData<TaskRow[]>(['tasks'])?.find((t) => t.id === data.id)
      const payload: TaskSavePayload = {
        data,
        isNew,
        base: isNew ? null : pickKeys(cached, [...TASK_FIELDS, 'assignee_id']),
        baseSubIds: isNew ? null : (cached?.subtasks.map((s) => s.id) ?? null),
        userId,
      }
      const showSaved = () => {
          const doctors = queryClient.getQueryData<DoctorListItem[]>(['doctors']) ?? []
          const hospitals = queryClient.getQueryData<HospitalListItem[]>(['hospitals']) ?? []
          const agents = queryClient.getQueryData<Profile[]>(['agents']) ?? []
          const contacts = queryClient.getQueryData<NonNullable<TaskRow['coordinator']>[]>(['contacts']) ?? []
          const now = new Date().toISOString()
          queryClient.setQueryData<TaskRow[]>(['tasks'], (old) => {
            const prev = old?.find((t) => t.id === data.id)
            const doctor = doctors.find((x) => x.id === data.doctor_id)
            const hospital = hospitals.find((x) => x.id === data.hospital_id)
            const assigneeId = data.assignee_id || prev?.assignee_id || userId
            const assignee = agents.find((a) => a.id === assigneeId)
            const row = {
              meeting_id: null,
              is_done: false,
              done_at: null,
              created_at: now,
              created_by: userId,
              ...prev,
              ...taskFields(data),
              id: data.id,
              updated_at: now,
              assignee_id: assigneeId,
              doctor: doctor ? { id: doctor.id, name: doctor.name, title: doctor.title } : null,
              hospital: hospital ? { id: hospital.id, name: hospital.name } : null,
              assignee: assignee ? { id: assignee.id, full_name: assignee.full_name } : (prev?.assignee ?? null),
              meeting: prev?.meeting ?? null,
              coordinator: contacts.find((c) => c.id === data.coordinator_contact_id) ?? null,
              subtasks: data.subtasks
                .filter((s) => s.text.trim())
                .map((s, i) => ({ id: s.id, task_id: data.id, text: s.text.trim(), is_done: s.is_done, sort: i, created_at: now })),
            } as TaskRow
            return prev ? old?.map((t) => (t.id === data.id ? row : t)) : [row, ...(old ?? [])]
          })
      }
      await runOrQueue(
        { kind: 'task.save', label: `${isNew ? 'משימה חדשה' : 'עדכון משימה'}: ${short(data.description)}`, recordIds: [data.id], payload },
        () => execTaskSave(payload),
        showSaved,
      )
      showSaved() // sent directly: the list shows it now, the server's copy replaces it after the refresh
    },
    onSuccess: () => invalidateTasks(qc),
  })
}

/* ---------- sub-tasks: tick / add a step ---------- */

registerExecutor<{ id: string; is_done: boolean }>('subtask.toggle', async (p) => {
  unwrap(await supabase.from('task_subtasks').update({ is_done: p.is_done }).eq('id', p.id))
})
registerExecutor<{ id: string; taskId: string; text: string; sort: number }>('subtask.add', async (p) => {
  unwrap(await supabase.from('task_subtasks').upsert({ id: p.id, task_id: p.taskId, text: p.text, sort: p.sort }))
})

export function useToggleSubtask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: { id: string; is_done: boolean }) => {
      const show = () =>
        queryClient.setQueryData<TaskRow[]>(['tasks'], (old) =>
          old?.map((t) => ({ ...t, subtasks: t.subtasks.map((s) => (s.id === p.id ? { ...s, is_done: p.is_done } : s)) })),
        )
      await runOrQueue(
        { kind: 'subtask.toggle', label: 'סימון שלב במשימה', recordIds: [p.id], payload: p },
        async () => {
          unwrap(await supabase.from('task_subtasks').update({ is_done: p.is_done }).eq('id', p.id))
        },
        show,
      )
      show() // sent directly: the tick shows now, the refresh confirms it
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })
}

export function useAddSubtask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: { taskId: string; text: string; sort: number }) => {
      const payload = { id: newId(), taskId: p.taskId, text: p.text.trim(), sort: p.sort }
      const show = () =>
        queryClient.setQueryData<TaskRow[]>(['tasks'], (old) =>
          old?.map((t) =>
            t.id === p.taskId && !t.subtasks.some((x) => x.id === payload.id)
              ? {
                  ...t,
                  subtasks: [...t.subtasks, { id: payload.id, task_id: p.taskId, text: payload.text, is_done: false, sort: payload.sort, created_at: new Date().toISOString() }],
                }
              : t,
          ),
        )
      await runOrQueue(
        { kind: 'subtask.add', label: `שלב חדש: ${short(payload.text)}`, recordIds: [p.taskId, payload.id], payload },
        async () => {
          unwrap(await supabase.from('task_subtasks').upsert({ id: payload.id, task_id: payload.taskId, text: payload.text, sort: payload.sort }))
        },
        show,
      )
      show() // sent directly: the step shows now, the refresh confirms it
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })
}

/* ---------- scans: scanned / disk collected / plan ready ---------- */

type ScanPatchPayload = { id: string; patch: Record<string, unknown>; base: Record<string, unknown> | null }
registerExecutor<ScanPatchPayload>('scan.patch', (p) => mergePatch('patient_scans', p.id, p.patch, p.base))

export function usePatchPatientScan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch: given }: { id: string; patch: Partial<PatientScan> }) => {
      // "disk uploaded" is the one disk flag now; the old "uploaded" column simply follows it
      const patch: Partial<PatientScan> = 'disk_collected' in given ? { ...given, uploaded: given.disk_collected } : given
      const cached = queryClient.getQueryData<PatientScanRow[]>(['patient-scans'])?.find((s) => s.id === id)
      const payload: ScanPatchPayload = {
        id,
        patch: patch as Record<string, unknown>,
        base: pickKeys(cached, Object.keys(patch)),
      }
      await runOrQueue(
        { kind: 'scan.patch', label: `עדכון סריקה: ${cached ? 'מטופל ב' + (cached.hospital?.name ?? 'בית חולים') : ''}`.trim(), recordIds: [id], payload },
        () => mergePatch('patient_scans', id, payload.patch, payload.base),
        () =>
          queryClient.setQueryData<PatientScanRow[]>(['patient-scans'], (old) =>
            old?.map((s) => (s.id === id ? { ...s, ...patch } : s)),
          ),
      )
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patient-scans'] }),
  })
}

/* ---------- consumables: stock count in a hospital ---------- */

type CountPayload = { id: string; s: SaveCountInput; userId: string }
async function execCountSave({ id, s, userId }: CountPayload): Promise<ExecResult> {
  unwrap(
    await supabase
      .from('consumable_counts')
      .upsert({ id, hospital_id: s.hospitalId, counted_on: s.countedOn, notes: s.notes, counted_by: userId || null }),
  )
  await supabase.from('consumable_count_lines').delete().eq('count_id', id)
  if (s.lines.length) unwrap(await supabase.from('consumable_count_lines').insert(s.lines.map((l) => ({ ...l, count_id: id }))))
  if (s.overrides.length)
    unwrap(await supabase.from('consumable_minimums').upsert(s.overrides.map((o) => ({ ...o, hospital_id: s.hospitalId }))))
  if (s.clearOverrides.length)
    unwrap(await supabase.from('consumable_minimums').delete().eq('hospital_id', s.hospitalId).in('item_id', s.clearOverrides))
}
registerExecutor<CountPayload>('count.save', execCountSave)

export function useSaveConsumableCount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (s: SaveCountInput) => {
      const payload: CountPayload = { id: newId(), s, userId: await currentUserId() }
      const hospital = queryClient.getQueryData<HospitalListItem[]>(['hospitals'])?.find((h) => h.id === s.hospitalId)
      await runOrQueue(
        { kind: 'count.save', label: `ספירת מתכלים${hospital ? ' — ' + hospital.name : ''}`, recordIds: [payload.id], payload },
        () => execCountSave(payload),
        () =>
          queryClient.setQueryData<ConsumableCountRow[]>(['consumable-counts', s.hospitalId], (old) => [
            {
              id: payload.id,
              hospital_id: s.hospitalId,
              counted_on: s.countedOn,
              notes: s.notes,
              counted_by: payload.userId,
              created_at: new Date().toISOString(),
              counter: null,
              lines: s.lines.map((l, i) => ({ id: `${payload.id}-${i}`, count_id: payload.id, ...l })),
            } as unknown as ConsumableCountRow,
            ...(old ?? []),
          ]),
      )
      return payload.id
    },
    onSuccess: (_id, v) => {
      qc.invalidateQueries({ queryKey: ['consumable-counts', v.hospitalId] })
      qc.invalidateQueries({ queryKey: ['consumable-minimums', v.hospitalId] })
    },
  })
}

/* ---------- meetings: new meeting / edit a summary ---------- */

type MeetingSavePayload = {
  mode: 'create' | 'update'
  id: string
  data: MeetingFormData & { tasks: { id: string; description: string; is_done: boolean; due_date: string | null }[] }
  base: Record<string, unknown> | null
  baseTaskIds: string[] | null
  /** doctors / agents / contacts / tasks as the editor saw them (absent in ops queued by an older version) */
  baseJoins?: MeetingJoinsBase | null
  userId: string
}
const MEETING_FIELDS = [
  'subject', 'meeting_date', 'meeting_time', 'location', 'responsible_agent_id', 'status', 'summary', 'decisions',
  'next_followup_date', 'hospital_id', 'extra_participants', 'competitor_notes',
]

const meetingRow = (d: MeetingFormData) => ({
  subject: d.subject,
  meeting_date: d.meeting_date,
  meeting_time: d.meeting_time && d.meeting_time.length === 5 ? `${d.meeting_time}:00` : d.meeting_time, // the database returns HH:MM:SS
  location: d.location,
  responsible_agent_id: d.responsible_agent_id,
  status: d.status,
  summary: d.summary,
  decisions: d.decisions,
  next_followup_date: d.next_followup_date,
  hospital_id: d.hospitalId,
  extra_participants: d.extraParticipants.trim(),
  competitor_notes: d.competitor_notes.trim(),
})

async function execMeetingSave(p: MeetingSavePayload): Promise<ExecResult> {
  let result: ExecResult = undefined
  if (p.mode === 'create') {
    unwrap(await supabase.from('meetings').upsert({ id: p.id, ...meetingRow(p.data), created_by: p.userId || null }))
  } else {
    // only the fields this edit changed are sent: an untouched field must not overwrite (or "conflict" with) what someone else saved meanwhile
    const row: Record<string, unknown> = meetingRow(p.data)
    const same = (a: unknown, b: unknown) => (a ?? '') === (b ?? '')
    const patch = p.base ? Object.fromEntries(Object.entries(row).filter(([k, v]) => !same(v, p.base![k]))) : row
    if (Object.keys(patch).length) result = await mergePatch('meetings', p.id, patch, p.base)
  }
  await saveMeetingChildren(p.id, p.data, p.baseTaskIds, p.baseJoins ?? null)
  await syncMeetingIntel(p.id, p.data)
  return result
}
registerExecutor<MeetingSavePayload>('meeting.save', execMeetingSave)

async function saveMeetingOffline(mode: 'create' | 'update', id: string, d: MeetingFormData, opened?: MeetingWithRelations) {
  const userId = await currentUserId()
  const cached =
    queryClient.getQueryData<MeetingWithRelations>(['meeting', id]) ??
    queryClient.getQueryData<MeetingWithRelations[]>(['meetings'])?.find((m) => m.id === id)
  // the base of the merge is what the editor saw when he opened the form (the cache may have been refreshed since)
  const seen = opened ?? cached
  const payload: MeetingSavePayload = {
    mode,
    id,
    data: { ...d, tasks: d.tasks.filter((t) => t.description.trim()).map((t) => ({ ...t, id: t.id ?? newId() })) },
    base: mode === 'update' ? pickKeys(seen, MEETING_FIELDS) : null,
    baseTaskIds: mode === 'update' ? (seen?.meeting_tasks.map((t) => t.id) ?? null) : null,
    baseJoins:
      mode === 'update' && seen
        ? {
            doctorIds: seen.meeting_doctors.flatMap((x) => (x.doctor ? [x.doctor.id] : [])),
            agentIds: seen.meeting_agents.flatMap((x) => (x.agent ? [x.agent.id] : [])),
            contactIds: seen.meeting_contacts.flatMap((x) => (x.contact ? [x.contact.id] : [])),
            tasks: seen.meeting_tasks.map((t) => ({ id: t.id, description: t.description, is_done: t.is_done, due_date: t.due_date })),
          }
        : null,
    userId,
  }
  await runOrQueue(
    { kind: 'meeting.save', label: `${mode === 'create' ? 'פגישה חדשה' : 'עדכון פגישה'}: ${short(d.subject || 'ללא נושא')}`, recordIds: [id], payload },
    () => execMeetingSave(payload),
    () => {
      const doctors = queryClient.getQueryData<DoctorListItem[]>(['doctors']) ?? []
      const agents = queryClient.getQueryData<Profile[]>(['agents']) ?? []
      const hospitals = queryClient.getQueryData<HospitalListItem[]>(['hospitals']) ?? []
      const contacts = queryClient.getQueryData<Contact[]>(['contacts']) ?? []
      const now = new Date().toISOString()
      const m = {
        created_at: now,
        created_by: userId,
        ...cached,
        ...meetingRow(d),
        id,
        updated_at: now,
        responsible_agent: agents.find((a) => a.id === d.responsible_agent_id) ?? null,
        hospital: hospitals.find((h) => h.id === d.hospitalId) ?? null,
        meeting_doctors: d.doctorIds.map((x) => {
          const doc = doctors.find((y) => y.id === x)
          return { doctor: doc ? { id: doc.id, name: doc.name, title: doc.title } : null }
        }),
        meeting_agents: d.agentIds.map((x) => {
          const a = agents.find((y) => y.id === x)
          return { agent: a ? { id: a.id, full_name: a.full_name, role: a.role } : null }
        }),
        meeting_contacts: d.contactIds.map((x) => {
          const c = contacts.find((y) => y.id === x)
          return { contact: c ? { id: c.id, name: c.name, role: c.role, hospital_id: c.hospital_id } : null }
        }),
        meeting_tasks: payload.data.tasks.map((t) => ({
          created_at: now,
          updated_at: now,
          notes: '',
          priority: 'normal',
          recurrence: 'none',
          doctor_id: null,
          hospital_id: d.hospitalId,
          done_at: t.is_done ? now : null,
          assignee_id: userId,
          created_by: userId,
          ...cached?.meeting_tasks.find((x) => x.id === t.id),
          id: t.id,
          meeting_id: id,
          description: t.description,
          is_done: t.is_done,
          due_date: t.due_date,
        })),
      } as unknown as MeetingWithRelations
      queryClient.setQueryData<MeetingWithRelations[]>(['meetings'], (old) =>
        old ? (old.some((x) => x.id === id) ? old.map((x) => (x.id === id ? m : x)) : [m, ...old]) : old,
      )
      queryClient.setQueryData(['meeting', id], m)
    },
  )
}

export function useCreateMeeting() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (d: MeetingFormData) => {
      const id = newId()
      await saveMeetingOffline('create', id, d)
      return { id }
    },
    onSuccess: () => invalidateMeetings(qc),
  })
}

/** `opened` = the meeting as the form showed it: changes are merged against it, not against whatever the cache holds later */
export function useUpdateMeeting(id: string, opened?: MeetingWithRelations) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (d: MeetingFormData) => saveMeetingOffline('update', id, d, opened),
    onSuccess: () => invalidateMeetings(qc),
  })
}

/* ============================ Equipment trays: picture + parts inside ============================ */

const EQUIP_PREFIX = 'equipment/'

/** phone photos are large: shrink to a sensible size before uploading (keeps the picture readable) */
export async function shrinkImage(file: File, maxSide = 1800): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') return file
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * scale)
  canvas.height = Math.round(bmp.height * scale)
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  bmp.close()
  return await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b ?? file), 'image/jpeg', 0.85))
}

async function uploadEquipmentImage(blob: Blob): Promise<string> {
  return uploadImageTo(EQUIP_PREFIX, blob)
}

/** stores a (shrunk) picture in the private bucket and returns its path */
export async function uploadImageTo(prefix: string, blob: Blob): Promise<string> {
  const path = `${prefix}${crypto.randomUUID()}.jpg`
  const up = await infoStorage().upload(path, blob, { contentType: 'image/jpeg' })
  if (up.error) throw up.error
  return path
}

/** short-lived link to a tray picture (the bucket is private) */
export function useEquipmentImageUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ['equipment-image', path],
    enabled: !!path,
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await infoStorage().createSignedUrl(path!, 3600)
      if (error) throw error
      return data.signedUrl
    },
  })
}

export type EquipmentPartInput = { position: number | null; catalog_no: string; description: string; qty: number }
export type EquipmentItemInput = {
  id?: string
  name: string
  catalog_number: string
  company_id: string | null
  /** all the pictures in their order: a stored one (path) or a new one to upload (blob), each with a label */
  images: { path?: string; blob?: Blob; label: string }[]
  parts: EquipmentPartInput[]
}

export function useSaveEquipmentItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (e: EquipmentItemInput) => {
      const images: { path: string; label: string }[] = []
      for (const im of e.images) {
        const path = im.path ?? (im.blob ? await uploadEquipmentImage(im.blob) : '')
        if (path) images.push({ path, label: im.label.trim() })
      }
      // image_path keeps the first picture for older versions of the app
      const row = { name: e.name.trim(), catalog_number: e.catalog_number.trim(), company_id: e.company_id, image_path: images[0]?.path ?? '', images }
      let id = e.id
      if (id) unwrap(await supabase.from('equipment_items').update(row).eq('id', id))
      else id = unwrap<{ id: string }>(await supabase.from('equipment_items').insert(row).select('id').single()).id

      // the list of parts is replaced as a whole (order = sort), in one database transaction: a failure keeps the old list
      const parts = e.parts
        .filter((p) => p.catalog_no.trim() || p.description.trim())
        .map((p, i) => ({ position: p.position, catalog_no: p.catalog_no.trim(), description: p.description.trim(), qty: Math.max(1, p.qty || 1), sort: i }))
      const { error } = await supabase.rpc('replace_equipment_parts', { p_item: id, p_parts: parts })
      if (error) throw error
      return id
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['equipment-items'] })
      qc.invalidateQueries({ queryKey: ['doctor-equipment'] })
    },
  })
}
