import type { Tables } from './database.types'

export type Profile = Tables<'profiles'>
export type Company = Tables<'companies'>
export type Hospital = Tables<'hospitals'>
export type Procedure = Tables<'procedures'>
export type Doctor = Tables<'doctors'>
export type PreopPlan = Tables<'doctor_preop_plans'>
export type Meeting = Tables<'meetings'>
export type MeetingTask = Tables<'meeting_tasks'>
export type Contact = Tables<'contacts'>
export type CaseVolume = Tables<'case_volumes'>
export type Organization = Tables<'organizations'>
export type RoboticSystem = Tables<'robotic_systems'>
export type EquipmentItem = Tables<'equipment_items'>

export type EquipmentItemWithCompany = EquipmentItem & {
  company: Pick<Company, 'id' | 'name'> | null
}

export type DoctorProcedureEquipmentRow = Tables<'doctor_procedure_equipment'> & {
  item: EquipmentItemWithCompany | null
  procedure: Pick<Procedure, 'id' | 'name'> | null
}

export const CURRENT_YEAR = new Date().getFullYear()
export const YEAR_OPTIONS = [0, 1, 2, 3, 4].map((n) => CURRENT_YEAR - n)

export const PIPELINE_STAGES = [
  'זיהוי ראשוני',
  'יצירת קשר',
  'פגישת היכרות',
  'הדגמת מוצר',
  'ניתוח ניסיון',
  'משא ומתן',
  'סגירה / הפיכה ללקוח',
] as const

export type CaseVolumeRow = CaseVolume & {
  doctor: Pick<Doctor, 'id' | 'name' | 'title'> | null
  hospital: Pick<Hospital, 'id' | 'name' | 'city'> | null
  procedure: Pick<Procedure, 'id' | 'name' | 'category'> | null
  company: Pick<Company, 'id' | 'name'> | null
}

export const CONTACT_ROLES = [
  'אחות אחראית',
  'אחות חדר ניתוח',
  'טכנאי / מהנדס',
  'מנהל רכש',
  'מזכירה רפואית',
  'מנהל מחלקה',
  'רכזת ניתוחים',
  'אחר',
] as const

export type HospitalWithOrg = Hospital & {
  organization: Organization | null
}

export type HospitalListItem = Hospital & {
  organization: Organization | null
  hospital_robotic_systems: { system_id: string }[]
}

export type DoctorHospitalLink = Tables<'doctor_hospitals'> & {
  hospital: HospitalWithOrg | null
}

export type PreopPlanWithProcedure = PreopPlan & {
  procedure: Procedure | null
}

export type DoctorWithRelations = Doctor & {
  doctor_companies: { company: Company | null }[]
  doctor_hospitals: DoctorHospitalLink[]
  doctor_procedures: { procedure: Procedure | null }[]
  doctor_preop_plans: PreopPlanWithProcedure[]
  doctor_robotic_systems: { system: RoboticSystem | null }[]
}

export type DoctorListItem = Doctor & {
  doctor_companies: { company_id: string }[]
  doctor_hospitals: { hospital_id: string; hospital: Hospital | null }[]
  doctor_procedures: { procedure_id: string }[]
  doctor_robotic_systems: { system_id: string }[]
}

export type MeetingWithRelations = Meeting & {
  responsible_agent: Pick<Profile, 'id' | 'full_name'> | null
  meeting_doctors: { doctor: Pick<Doctor, 'id' | 'name' | 'title'> | null }[]
  meeting_tasks: MeetingTask[]
}

export const TITLES = ['דוקטור', 'פרופסור', 'מר', 'גברת'] as const

export const DOCTOR_STATUS_LABELS: Record<string, string> = {
  client: 'לקוח',
  potential: 'פוטנציאלי',
}

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
