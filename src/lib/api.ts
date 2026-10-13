import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { supabase } from './supabase'
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
} from './types'
import { SCAN_PROCEDURE_TO_NAME } from './types'
import { currentUserId, mergePatch, registerExecutor, runOrQueue, type ExecResult } from './outbox'
import { queryClient } from './queryClient'
import type { TablesInsert, TablesUpdate } from './database.types'

function unwrap<T>(res: { data: unknown; error: unknown }): T {
  if (res.error) throw res.error
  return res.data as T
}

/* ============================ Reference data ============================ */

export function useAgents() {
  return useQuery({
    queryKey: ['agents'],
    queryFn: async () =>
      unwrap<Profile[]>(
        await supabase.from('profiles').select('*').order('full_name'),
      ).filter((p) => p.active !== false),
  })
}

/** every account, active or not — for the admin user-management page */
export function useAllUsers() {
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
    mutationFn: async ({ id, ...patch }: { id: string; role?: string; active?: boolean; full_name?: string }) =>
      unwrap(await supabase.from('profiles').update(patch).eq('id', id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agents'] })
      qc.invalidateQueries({ queryKey: ['all-users'] })
    },
  })
}

export function useCompanies() {
  return useQuery({
    queryKey: ['companies'],
    queryFn: async () =>
      unwrap<Company[]>(
        await supabase.from('companies').select('*').order('name'),
      ),
  })
}

export function useProcedures() {
  return useQuery({
    queryKey: ['procedures'],
    queryFn: async () =>
      unwrap<Procedure[]>(
        await supabase.from('procedures').select('*').order('name'),
      ),
  })
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
    queryFn: async () =>
      unwrap<DoctorListItem[]>(
        await supabase
          .from('doctors')
          .select(DOCTOR_LIST_SELECT)
          .order('name'),
      ),
  })
}

export function useDoctor(id: string | undefined) {
  return useQuery({
    queryKey: ['doctor', id],
    enabled: !!id,
    queryFn: async () =>
      unwrap<DoctorWithRelations>(
        await supabase
          .from('doctors')
          .select(DOCTOR_FULL_SELECT)
          .eq('id', id!)
          .single(),
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
  next_step_date: string | null
  contact_cadence_days: number | null
  companyIds: string[]
  procedureIds: string[]
  roboticSystemIds: string[]
  hospitals: { hospital_id: string; role_at_hospital: string; sector: string }[]
}

async function saveDoctorRelations(doctorId: string, d: DoctorFormData) {
  await supabase.from('doctor_companies').delete().eq('doctor_id', doctorId)
  if (d.companyIds.length)
    unwrap(
      await supabase
        .from('doctor_companies')
        .insert(d.companyIds.map((company_id) => ({ doctor_id: doctorId, company_id }))),
    )

  await supabase.from('doctor_procedures').delete().eq('doctor_id', doctorId)
  if (d.procedureIds.length)
    unwrap(
      await supabase
        .from('doctor_procedures')
        .insert(
          d.procedureIds.map((procedure_id) => ({ doctor_id: doctorId, procedure_id })),
        ),
    )

  await supabase.from('doctor_robotic_systems').delete().eq('doctor_id', doctorId)
  if (d.roboticSystemIds.length)
    unwrap(
      await supabase
        .from('doctor_robotic_systems')
        .insert(
          d.roboticSystemIds.map((system_id) => ({ doctor_id: doctorId, system_id })),
        ),
    )

  await supabase.from('doctor_hospitals').delete().eq('doctor_id', doctorId)
  if (d.hospitals.length)
    unwrap(
      await supabase.from('doctor_hospitals').insert(
        d.hospitals.map((h) => ({
          doctor_id: doctorId,
          hospital_id: h.hospital_id,
          role_at_hospital: h.role_at_hospital,
          sector: h.sector,
        })),
      ),
    )
}

export function useCreateDoctor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (d: DoctorFormData) => {
      const { data: userRes } = await supabase.auth.getUser()
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
        next_step_date: d.next_step_date,
        contact_cadence_days: d.contact_cadence_days,
        created_by: userRes.user?.id ?? null,
      }
      const created = unwrap<Doctor>(
        await supabase.from('doctors').insert(row).select().single(),
      )
      await saveDoctorRelations(created.id, d)
      return created
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doctors'] })
    },
  })
}

export function useUpdateDoctor(id: string) {
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
        next_step_date: d.next_step_date,
        contact_cadence_days: d.contact_cadence_days,
      }
      unwrap(await supabase.from('doctors').update(row).eq('id', id))
      await saveDoctorRelations(id, d)
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
      const { data: userRes } = await supabase.auth.getUser()
      if (!userRes.user) return [] as string[]
      const rows = unwrap<{ doctor_id: string }[]>(
        await supabase
          .from('favorites')
          .select('doctor_id')
          .eq('user_id', userRes.user.id),
      )
      return rows.map((r) => r.doctor_id)
    },
  })
}

export function useToggleFavorite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      doctorId,
      isFavorite,
    }: {
      doctorId: string
      isFavorite: boolean
    }) => {
      const { data: userRes } = await supabase.auth.getUser()
      const userId = userRes.user?.id
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['favorites'] }),
  })
}

/* ============================ Meetings ============================ */

const MEETING_SELECT =
  '*, responsible_agent:profiles!meetings_responsible_agent_id_fkey(id, full_name), meeting_doctors(doctor:doctors(id, name, title)), meeting_contacts(contact:contacts(id, name, role, hospital_id)), meeting_agents(agent:profiles(id, full_name, role)), hospital:hospitals(id, name), meeting_tasks(*)'

export function useMeetings() {
  return useQuery({
    queryKey: ['meetings'],
    queryFn: async () =>
      unwrap<MeetingWithRelations[]>(
        await supabase
          .from('meetings')
          .select(MEETING_SELECT)
          .order('meeting_date', { ascending: false, nullsFirst: false }),
      ),
  })
}

export function useMeeting(id: string | undefined) {
  return useQuery({
    queryKey: ['meeting', id],
    enabled: !!id,
    queryFn: async () =>
      unwrap<MeetingWithRelations>(
        await supabase.from('meetings').select(MEETING_SELECT).eq('id', id!).single(),
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
  tasks: { id?: string; description: string; is_done: boolean; due_date: string | null }[]
}

async function saveMeetingChildren(meetingId: string, d: MeetingFormData, baseTaskIds: string[] | null = null) {
  await supabase.from('meeting_doctors').delete().eq('meeting_id', meetingId)
  if (d.doctorIds.length)
    unwrap(
      await supabase
        .from('meeting_doctors')
        .insert(d.doctorIds.map((doctor_id) => ({ meeting_id: meetingId, doctor_id }))),
    )

  await supabase.from('meeting_agents').delete().eq('meeting_id', meetingId)
  if (d.agentIds.length)
    unwrap(
      await supabase
        .from('meeting_agents')
        .insert(d.agentIds.map((agent_id) => ({ meeting_id: meetingId, agent_id }))),
    )

  await supabase.from('meeting_contacts').delete().eq('meeting_id', meetingId)
  if (d.contactIds.length)
    unwrap(
      await supabase
        .from('meeting_contacts')
        .insert(d.contactIds.map((contact_id) => ({ meeting_id: meetingId, contact_id }))),
    )

  const tasks = d.tasks.filter((t) => t.description.trim())
  const keep = tasks.filter((t) => t.id).map((t) => t.id as string)
  const current = unwrap<{ id: string }[]>(await supabase.from('meeting_tasks').select('id').eq('meeting_id', meetingId))
  // only tasks this edit removed are deleted (a task another agent added meanwhile stays)
  const drop = current.map((c) => c.id).filter((id) => !keep.includes(id) && (baseTaskIds === null || baseTaskIds.includes(id)))
  if (drop.length) unwrap(await supabase.from('meeting_tasks').delete().in('id', drop))
  const me = await currentUserId()
  for (const t of tasks) {
    const fields = {
      description: t.description,
      is_done: t.is_done,
      due_date: t.due_date,
      done_at: t.is_done ? new Date().toISOString() : null,
    }
    const id = t.id ?? crypto.randomUUID()
    // existing tasks keep their sub-tasks / assignee / priority — only the fields of the form are touched
    if (current.some((c) => c.id === id)) unwrap(await supabase.from('meeting_tasks').update(fields).eq('id', id))
    else unwrap(await supabase.from('meeting_tasks').insert({ ...fields, id, meeting_id: meetingId, assignee_id: me || null, created_by: me || null }))
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
    }) => {
      const payload = { name: p.name, category: p.category, is_mako: p.is_mako }
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

export function useDeleteHospital() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(await supabase.from('hospitals').delete().eq('id', id)),
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
      await supabase.from('hospital_agents').delete().eq('hospital_id', hospitalId)
      if (agentIds.length)
        unwrap(
          await supabase
            .from('hospital_agents')
            .insert(agentIds.map((agent_id) => ({ hospital_id: hospitalId, agent_id }))),
        )
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
            '*, organization:organizations(*), hospital_agents(agent:profiles(id, full_name)), hospital_robotic_systems(system:robotic_systems(*)), case_volumes(procedure_id, year, count, procedure:procedures(name)), contacts(*), doctor_hospitals(role_at_hospital, sector, doctor:doctors(id, name, title, position, status))',
          )
          .order('name'),
      ),
  })
}

/* ============================ Contacts ============================ */

export function useContacts() {
  return useQuery({
    queryKey: ['contacts'],
    queryFn: async () =>
      unwrap<Contact[]>(
        await supabase.from('contacts').select('*').order('name'),
      ),
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
    queryFn: async () =>
      unwrap<CaseVolumeRow[]>(
        await supabase
          .from('case_volumes')
          .select(CASE_VOLUME_SELECT)
          .order('year', { ascending: false }),
      ),
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
      unwrap<ImplantOption[]>(
        await supabase
          .from('implant_options')
          .select('*')
          .order('category')
          .order('sort'),
      ),
  })
}

export function useUpsertImplantOption() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (o: { id?: string; category: string; value: string }) => {
      if (o.id)
        unwrap(await supabase.from('implant_options').update({ value: o.value }).eq('id', o.id))
      else unwrap(await supabase.from('implant_options').insert({ category: o.category, value: o.value }))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['implant-options'] }),
  })
}

export function useDeleteImplantOption() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(await supabase.from('implant_options').delete().eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['implant-options'] }),
  })
}

const SCAN_SELECT =
  '*, hospital:hospitals(id, name), surgeon:doctors(id, name, title)'

export function usePatientScans() {
  return useQuery({
    queryKey: ['patient-scans'],
    queryFn: async () =>
      unwrap<PatientScanRow[]>(
        await supabase
          .from('patient_scans')
          .select(SCAN_SELECT)
          .order('ct_date', { ascending: false, nullsFirst: false }),
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
        const { data: userRes } = await supabase.auth.getUser()
        unwrap(
          await supabase
            .from('patient_scans')
            .insert({ ...rest, created_by: userRes.user?.id ?? null } as never),
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
          ? new Date(dateStr).getFullYear()
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
      const { data: userRes } = await supabase.auth.getUser()
      if (!userRes.user) throw new Error('לא מחובר')
      unwrap(
        await supabase
          .from('profiles')
          .update({ full_name: fullName })
          .eq('id', userRes.user.id),
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
  unwrap(await supabase.from('doctor_course_stages').delete().eq('course_id', courseId))
  for (const [i, st] of draft.entries()) {
    const created = unwrap<{ id: string }>(
      await supabase
        .from('doctor_course_stages')
        .insert({ course_id: courseId, title: st.title.trim() || 'שלב', sort: i + 1 })
        .select('id')
        .single(),
    )
    const items = st.items
      .map((t) => t.trim())
      .filter(Boolean)
      .map((text, k) => ({ stage_id: created.id, text, sort: k + 1 }))
    if (items.length) unwrap(await supabase.from('doctor_course_items').insert(items))
  }
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
    mutationFn: async (c: { id?: string; name: string; sort?: number }) => {
      if (c.id) unwrap(await supabase.from('info_categories').update({ name: c.name, sort: c.sort }).eq('id', c.id))
      else unwrap(await supabase.from('info_categories').insert({ name: c.name, sort: c.sort ?? 99 }))
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
    mutationFn: async (d: InfoDocInput) => {
      const { data: userRes } = await supabase.auth.getUser()
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
        const up = await supabase.storage.from(INFO_BUCKET).upload(path, d.file, {
          contentType: d.file.type || 'application/octet-stream',
        })
        if (up.error) throw up.error
        Object.assign(meta, {
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
            .insert({ ...meta, uploaded_by: userRes.user?.id ?? null } as never)
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
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['info-documents'] }),
  })
}

export function useDeleteInfoDoc() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (d: InfoDocument) => {
      if (d.kind === 'file' && d.storage_path) {
        const r = await supabase.storage.from(INFO_BUCKET).remove([d.storage_path])
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
    window.open(d.url, '_blank', 'noopener,noreferrer')
    return null
  }
  const tab = window.open('', '_blank') // opened first so the browser does not block it
  const { data, error } = await supabase.storage.from(INFO_BUCKET).createSignedUrl(d.storage_path, 3600)
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
  '*, subtasks:task_subtasks(*), doctor:doctors(id, name, title), hospital:hospitals(id, name), assignee:profiles!meeting_tasks_assignee_id_fkey(id, full_name), meeting:meetings(id, subject), project:projects(id, name), area:project_areas(id, name), contact:contacts(id, name, role)'

/** every task the signed-in user may see (his own; admins see all) */
export function useTasks() {
  return useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const rows = unwrap<TaskRow[]>(
        await supabase
          .from('meeting_tasks')
          .select(TASK_SELECT)
          .order('due_date', { ascending: true, nullsFirst: false })
          .order('created_at', { ascending: false }),
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
  subtasks: { id?: string; text: string; is_done: boolean }[]
}

function invalidateTasks(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['tasks'] })
  invalidateMeetings(qc)
}

const isoOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** date of the next occurrence of a repeating task (counted from the later of due date and today) */
function nextDue(due: string, recurrence: string): string {
  const base = new Date(`${due}T00:00:00`)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = base > today ? base : today
  if (recurrence === 'weekly') d.setDate(d.getDate() + 7)
  else d.setMonth(d.getMonth() + 1)
  return isoOf(d)
}

/** mark done / not done; completing a repeating task creates the next one */
export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('meeting_tasks').delete().eq('id', id)),
    onSuccess: () => invalidateTasks(qc),
  })
}

/* ============================ Competitor activity ============================ */

const INTEL_SELECT = '*, doctor:doctors(id, name, title), hospital:hospitals(id, name)'

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
  competitor: string
  product: string
  offer: string
  notes: string
  intel_date: string
  doctor_id: string | null
  hospital_id: string | null
}

export function useSaveIntel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (d: IntelFormData) => {
      const row = {
        competitor: d.competitor.trim(),
        product: d.product.trim(),
        offer: d.offer.trim(),
        notes: d.notes.trim(),
        intel_date: d.intel_date,
        doctor_id: d.doctor_id || null,
        hospital_id: d.hospital_id || null,
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
] as const

export async function exportBackup(onProgress?: (table: string) => void) {
  const out: Record<string, unknown[]> = {}
  for (const t of BACKUP_TABLES) {
    onProgress?.(t)
    const rows: unknown[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from(t).select('*').range(from, from + 999)
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
> & { subtasks?: { text: string }[] }
type TaskDonePayload = { task: DoneTask; done: boolean; nextId: string; at: string }

async function execTaskDone({ task, done, nextId, at }: TaskDonePayload): Promise<ExecResult> {
  unwrap(await supabase.from('meeting_tasks').update({ is_done: done, done_at: done ? at : null }).eq('id', task.id))
  if (done && !task.is_done && task.recurrence !== 'none' && task.due_date) {
    // a repeating task creates the next one (fixed id: sending twice never makes two)
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
      }),
    )
    await supabase.from('task_subtasks').delete().eq('task_id', nextId)
    if (task.subtasks?.length)
      unwrap(await supabase.from('task_subtasks').insert(task.subtasks.map((s, i) => ({ task_id: nextId, text: s.text, sort: i }))))
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
      subtasks: task.subtasks?.map((s) => ({ text: s.text })),
    },
    done,
    nextId: newId(),
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
    mutationFn: ({ task, done }: { task: TaskRow; done: boolean }) => setTaskDoneOffline(task, done),
    onSuccess: () => invalidateTasks(qc),
  })
}

export function useToggleMeetingTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (task: MeetingTask) => setTaskDoneOffline(task, !task.is_done),
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
const TASK_FIELDS = ['description', 'notes', 'due_date', 'priority', 'doctor_id', 'hospital_id', 'recurrence']

const taskFields = (d: TaskSaveData) => ({
  description: d.description.trim(),
  notes: d.notes.trim(),
  due_date: d.due_date || null,
  priority: d.priority,
  doctor_id: d.doctor_id || null,
  hospital_id: d.hospital_id || null,
  recurrence: d.recurrence,
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
    if (d.assignee_id) unwrap(await supabase.from('meeting_tasks').update({ assignee_id: d.assignee_id }).eq('id', d.id))
    result = await mergePatch('meeting_tasks', d.id, taskFields(d), p.base)
  }
  // sub-tasks: only the ones this edit removed are deleted (a step another agent added meanwhile stays)
  const keep = d.subtasks.filter((s) => s.text.trim()).map((s) => s.id)
  const existing = unwrap<{ id: string }[]>(await supabase.from('task_subtasks').select('id').eq('task_id', d.id))
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
        base: isNew ? null : pickKeys(cached, TASK_FIELDS),
        baseSubIds: isNew ? null : (cached?.subtasks.map((s) => s.id) ?? null),
        userId,
      }
      await runOrQueue(
        { kind: 'task.save', label: `${isNew ? 'משימה חדשה' : 'עדכון משימה'}: ${short(data.description)}`, recordIds: [data.id], payload },
        () => execTaskSave(payload),
        () => {
          const doctors = queryClient.getQueryData<DoctorListItem[]>(['doctors']) ?? []
          const hospitals = queryClient.getQueryData<HospitalListItem[]>(['hospitals']) ?? []
          const agents = queryClient.getQueryData<Profile[]>(['agents']) ?? []
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
              subtasks: data.subtasks
                .filter((s) => s.text.trim())
                .map((s, i) => ({ id: s.id, task_id: data.id, text: s.text.trim(), is_done: s.is_done, sort: i, created_at: now })),
            } as TaskRow
            return prev ? old?.map((t) => (t.id === data.id ? row : t)) : [row, ...(old ?? [])]
          })
        },
      )
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
      await runOrQueue(
        { kind: 'subtask.toggle', label: 'סימון שלב במשימה', recordIds: [p.id], payload: p },
        async () => {
          unwrap(await supabase.from('task_subtasks').update({ is_done: p.is_done }).eq('id', p.id))
        },
        () =>
          queryClient.setQueryData<TaskRow[]>(['tasks'], (old) =>
            old?.map((t) => ({ ...t, subtasks: t.subtasks.map((s) => (s.id === p.id ? { ...s, is_done: p.is_done } : s)) })),
          ),
      )
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })
}

export function useAddSubtask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: { taskId: string; text: string; sort: number }) => {
      const payload = { id: newId(), taskId: p.taskId, text: p.text.trim(), sort: p.sort }
      await runOrQueue(
        { kind: 'subtask.add', label: `שלב חדש: ${short(payload.text)}`, recordIds: [p.taskId, payload.id], payload },
        async () => {
          unwrap(await supabase.from('task_subtasks').upsert({ id: payload.id, task_id: payload.taskId, text: payload.text, sort: payload.sort }))
        },
        () =>
          queryClient.setQueryData<TaskRow[]>(['tasks'], (old) =>
            old?.map((t) =>
              t.id === p.taskId
                ? {
                    ...t,
                    subtasks: [
                      ...t.subtasks,
                      { id: payload.id, task_id: p.taskId, text: payload.text, is_done: false, sort: payload.sort, created_at: new Date().toISOString() },
                    ],
                  }
                : t,
            ),
          ),
      )
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
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<PatientScan> }) => {
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
  userId: string
}
const MEETING_FIELDS = [
  'subject', 'meeting_date', 'meeting_time', 'location', 'responsible_agent_id', 'status', 'summary', 'decisions',
  'next_followup_date', 'hospital_id', 'extra_participants', 'competitor_notes',
]

const meetingRow = (d: MeetingFormData) => ({
  subject: d.subject,
  meeting_date: d.meeting_date,
  meeting_time: d.meeting_time,
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
    result = await mergePatch('meetings', p.id, meetingRow(p.data), p.base)
  }
  await saveMeetingChildren(p.id, p.data, p.baseTaskIds)
  return result
}
registerExecutor<MeetingSavePayload>('meeting.save', execMeetingSave)

async function saveMeetingOffline(mode: 'create' | 'update', id: string, d: MeetingFormData) {
  const userId = await currentUserId()
  const cached =
    queryClient.getQueryData<MeetingWithRelations>(['meeting', id]) ??
    queryClient.getQueryData<MeetingWithRelations[]>(['meetings'])?.find((m) => m.id === id)
  const payload: MeetingSavePayload = {
    mode,
    id,
    data: { ...d, tasks: d.tasks.filter((t) => t.description.trim()).map((t) => ({ ...t, id: t.id ?? newId() })) },
    base: mode === 'update' ? pickKeys(cached, MEETING_FIELDS) : null,
    baseTaskIds: mode === 'update' ? (cached?.meeting_tasks.map((t) => t.id) ?? null) : null,
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

export function useUpdateMeeting(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (d: MeetingFormData) => saveMeetingOffline('update', id, d),
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
  const path = `${EQUIP_PREFIX}${crypto.randomUUID()}.jpg`
  const up = await supabase.storage.from(INFO_BUCKET).upload(path, blob, { contentType: 'image/jpeg' })
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
      const { data, error } = await supabase.storage.from(INFO_BUCKET).createSignedUrl(path!, 3600)
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
  /** a new picture to upload (null = leave as is) */
  image?: Blob | null
  removeImage?: boolean
  parts: EquipmentPartInput[]
}

export function useSaveEquipmentItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (e: EquipmentItemInput) => {
      const existing = e.id
        ? unwrap<{ image_path: string } | null>(await supabase.from('equipment_items').select('image_path').eq('id', e.id).maybeSingle())
        : null
      let image_path = existing?.image_path ?? ''
      if (e.removeImage) image_path = ''
      if (e.image) image_path = await uploadEquipmentImage(e.image)

      const row = { name: e.name.trim(), catalog_number: e.catalog_number.trim(), company_id: e.company_id, image_path }
      let id = e.id
      if (id) unwrap(await supabase.from('equipment_items').update(row).eq('id', id))
      else id = unwrap<{ id: string }>(await supabase.from('equipment_items').insert(row).select('id').single()).id

      // the list of parts is replaced as a whole (order = sort)
      unwrap(await supabase.from('equipment_item_parts').delete().eq('item_id', id))
      const parts = e.parts.filter((p) => p.catalog_no.trim() || p.description.trim())
      if (parts.length)
        unwrap(
          await supabase.from('equipment_item_parts').insert(
            parts.map((p, i) => ({
              item_id: id,
              position: p.position,
              catalog_no: p.catalog_no.trim(),
              description: p.description.trim(),
              qty: Math.max(1, p.qty || 1),
              sort: i,
            })),
          ),
        )
      return id
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['equipment-items'] })
      qc.invalidateQueries({ queryKey: ['doctor-equipment'] })
    },
  })
}
