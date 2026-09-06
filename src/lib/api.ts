import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { supabase } from './supabase'
import type {
  Company,
  Doctor,
  DoctorListItem,
  DoctorWithRelations,
  Hospital,
  MeetingTask,
  MeetingWithRelations,
  Procedure,
  Profile,
} from './types'
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
      ),
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
      unwrap<Hospital[]>(
        await supabase.from('hospitals').select('*').order('name'),
      ),
  })
}

/* ============================ Doctors ============================ */

const DOCTOR_LIST_SELECT =
  '*, doctor_companies(company_id), doctor_procedures(procedure_id), doctor_procedure_stats(procedure_id, volume, updated_at), doctor_hospitals(hospital_id, hospital:hospitals(*))'

const DOCTOR_FULL_SELECT =
  '*, doctor_companies(company:companies(*)), doctor_procedures(procedure:procedures(*)), doctor_procedure_stats(procedure_id, volume, updated_at), doctor_hospitals(*, hospital:hospitals(*)), doctor_preop_plans(*, procedure:procedures(*))'

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
  companyIds: string[]
  procedureIds: string[]
  procedureStats: { procedure_id: string; volume: number }[]
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

  await supabase.from('doctor_procedure_stats').delete().eq('doctor_id', doctorId)
  const stats = d.procedureStats.filter((s) => s.volume > 0)
  if (stats.length)
    unwrap(
      await supabase.from('doctor_procedure_stats').insert(
        stats.map((s) => ({
          doctor_id: doctorId,
          procedure_id: s.procedure_id,
          volume: s.volume,
        })),
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

export function useSavePreopPlan(doctorId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (plan: {
      id?: string
      procedure_id: string | null
      surgeon_preferences: string
      surgical_approach: string
      required_equipment: string
    }) => {
      if (plan.id) {
        unwrap(
          await supabase
            .from('doctor_preop_plans')
            .update({
              procedure_id: plan.procedure_id,
              surgeon_preferences: plan.surgeon_preferences,
              surgical_approach: plan.surgical_approach,
              required_equipment: plan.required_equipment,
            })
            .eq('id', plan.id),
        )
      } else {
        unwrap(
          await supabase.from('doctor_preop_plans').insert({
            doctor_id: doctorId,
            procedure_id: plan.procedure_id,
            surgeon_preferences: plan.surgeon_preferences,
            surgical_approach: plan.surgical_approach,
            required_equipment: plan.required_equipment,
          }),
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
  '*, responsible_agent:profiles!meetings_responsible_agent_id_fkey(id, full_name), meeting_doctors(doctor:doctors(id, name, title)), meeting_tasks(*)'

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
  tasks: { id?: string; description: string; is_done: boolean; due_date: string | null }[]
}

async function saveMeetingChildren(meetingId: string, d: MeetingFormData) {
  await supabase.from('meeting_doctors').delete().eq('meeting_id', meetingId)
  if (d.doctorIds.length)
    unwrap(
      await supabase
        .from('meeting_doctors')
        .insert(d.doctorIds.map((doctor_id) => ({ meeting_id: meetingId, doctor_id }))),
    )

  await supabase.from('meeting_tasks').delete().eq('meeting_id', meetingId)
  const tasks = d.tasks.filter((t) => t.description.trim())
  if (tasks.length)
    unwrap(
      await supabase.from('meeting_tasks').insert(
        tasks.map((t) => ({
          meeting_id: meetingId,
          description: t.description,
          is_done: t.is_done,
          due_date: t.due_date,
        })),
      ),
    )
}

export function useCreateMeeting() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (d: MeetingFormData) => {
      const { data: userRes } = await supabase.auth.getUser()
      const row: TablesInsert<'meetings'> = {
        subject: d.subject,
        meeting_date: d.meeting_date,
        meeting_time: d.meeting_time,
        location: d.location,
        responsible_agent_id: d.responsible_agent_id,
        status: d.status,
        summary: d.summary,
        decisions: d.decisions,
        next_followup_date: d.next_followup_date,
        created_by: userRes.user?.id ?? null,
      }
      const created = unwrap<{ id: string }>(
        await supabase.from('meetings').insert(row).select('id').single(),
      )
      await saveMeetingChildren(created.id, d)
      return created
    },
    onSuccess: () => invalidateMeetings(qc),
  })
}

export function useUpdateMeeting(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (d: MeetingFormData) => {
      const row: TablesUpdate<'meetings'> = {
        subject: d.subject,
        meeting_date: d.meeting_date,
        meeting_time: d.meeting_time,
        location: d.location,
        responsible_agent_id: d.responsible_agent_id,
        status: d.status,
        summary: d.summary,
        decisions: d.decisions,
        next_followup_date: d.next_followup_date,
      }
      unwrap(await supabase.from('meetings').update(row).eq('id', id))
      await saveMeetingChildren(id, d)
    },
    onSuccess: () => invalidateMeetings(qc),
  })
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

export function useToggleMeetingTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (task: MeetingTask) => {
      unwrap(
        await supabase
          .from('meeting_tasks')
          .update({ is_done: !task.is_done })
          .eq('id', task.id),
      )
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

export function useHospitalProcedureStats(hospitalId: string | undefined) {
  return useQuery({
    queryKey: ['hospital-procedure-stats', hospitalId],
    enabled: !!hospitalId,
    queryFn: async () =>
      unwrap<{ procedure_id: string; volume: number; updated_at: string }[]>(
        await supabase
          .from('hospital_procedure_stats')
          .select('procedure_id, volume, updated_at')
          .eq('hospital_id', hospitalId!),
      ),
  })
}

export function useSetHospitalProcedureStats() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      hospitalId,
      stats,
    }: {
      hospitalId: string
      stats: { procedure_id: string; volume: number }[]
    }) => {
      await supabase
        .from('hospital_procedure_stats')
        .delete()
        .eq('hospital_id', hospitalId)
      const rows = stats.filter((s) => s.volume > 0)
      if (rows.length)
        unwrap(
          await supabase.from('hospital_procedure_stats').insert(
            rows.map((s) => ({
              hospital_id: hospitalId,
              procedure_id: s.procedure_id,
              volume: s.volume,
            })),
          ),
        )
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['hospital-procedure-stats', v.hospitalId] })
      qc.invalidateQueries({ queryKey: ['map-data'] })
    },
  })
}

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
  hospital_agents: { agent: Pick<Profile, 'id' | 'full_name'> | null }[]
  hospital_procedure_stats: { procedure_id: string; volume: number }[]
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
            '*, hospital_agents(agent:profiles(id, full_name)), hospital_procedure_stats(procedure_id, volume), doctor_hospitals(role_at_hospital, sector, doctor:doctors(id, name, title, position, status))',
          )
          .order('name'),
      ),
  })
}
