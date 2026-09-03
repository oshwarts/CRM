import type { Tables } from './database.types'

export type Profile = Tables<'profiles'>
export type Company = Tables<'companies'>
export type Hospital = Tables<'hospitals'>
export type Procedure = Tables<'procedures'>
export type Doctor = Tables<'doctors'>
export type PreopPlan = Tables<'doctor_preop_plans'>
export type Meeting = Tables<'meetings'>
export type MeetingTask = Tables<'meeting_tasks'>

export type DoctorHospitalLink = Tables<'doctor_hospitals'> & {
  hospital: Hospital | null
}

export type PreopPlanWithProcedure = PreopPlan & {
  procedure: Procedure | null
}

export type DoctorWithRelations = Doctor & {
  doctor_companies: { company: Company | null }[]
  doctor_hospitals: DoctorHospitalLink[]
  doctor_procedures: { procedure: Procedure | null }[]
  doctor_preop_plans: PreopPlanWithProcedure[]
}

export type DoctorListItem = Doctor & {
  doctor_companies: { company_id: string }[]
  doctor_hospitals: { hospital_id: string; hospital: Hospital | null }[]
  doctor_procedures: { procedure_id: string }[]
}

export type MeetingWithRelations = Meeting & {
  responsible_agent: Pick<Profile, 'id' | 'full_name'> | null
  meeting_doctors: { doctor: Pick<Doctor, 'id' | 'name' | 'title'> | null }[]
  meeting_tasks: MeetingTask[]
}

export const TITLES = ['דוקטור', 'פרופסור', 'מר', 'גברת'] as const

export const MEETING_STATUS_LABELS: Record<string, string> = {
  scheduled: 'מתוכננת',
  done: 'בוצעה',
  cancelled: 'בוטלה',
  needs_followup: 'דורשת מעקב',
}

export const PROCEDURE_CATEGORY_LABELS: Record<string, string> = {
  knee: 'ברך',
  hip: 'ירך',
  shoulder: 'כתף',
  spine: 'עמוד שדרה',
  other: 'אחר',
}

export const SECTOR_LABELS: Record<string, string> = {
  public: 'ציבורי',
  private: 'פרטי',
}
