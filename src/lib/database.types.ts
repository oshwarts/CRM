export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      companies: {
        Row: { created_at: string; id: string; name: string }
        Insert: { created_at?: string; id?: string; name: string }
        Update: { created_at?: string; id?: string; name?: string }
        Relationships: []
      }
      contacts: {
        Row: {
          created_at: string
          doctor_id: string | null
          email: string
          hospital_id: string | null
          id: string
          name: string
          notes: string
          phone: string
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          doctor_id?: string | null
          email?: string
          hospital_id?: string | null
          id?: string
          name: string
          notes?: string
          phone?: string
          role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          doctor_id?: string | null
          email?: string
          hospital_id?: string | null
          id?: string
          name?: string
          notes?: string
          phone?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      doctor_companies: {
        Row: { company_id: string; doctor_id: string }
        Insert: { company_id: string; doctor_id: string }
        Update: { company_id?: string; doctor_id?: string }
        Relationships: []
      }
      doctor_hospitals: {
        Row: {
          doctor_id: string
          hospital_id: string
          id: string
          role_at_hospital: string
          sector: string
        }
        Insert: {
          doctor_id: string
          hospital_id: string
          id?: string
          role_at_hospital?: string
          sector?: string
        }
        Update: {
          doctor_id?: string
          hospital_id?: string
          id?: string
          role_at_hospital?: string
          sector?: string
        }
        Relationships: []
      }
      doctor_preop_plans: {
        Row: {
          created_at: string
          doctor_id: string
          id: string
          plan_data: Json
          procedure_id: string | null
          required_equipment: string
          surgeon_preferences: string
          surgical_approach: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          doctor_id: string
          id?: string
          plan_data?: Json
          procedure_id?: string | null
          required_equipment?: string
          surgeon_preferences?: string
          surgical_approach?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          doctor_id?: string
          id?: string
          plan_data?: Json
          procedure_id?: string | null
          required_equipment?: string
          surgeon_preferences?: string
          surgical_approach?: string
          updated_at?: string
        }
        Relationships: []
      }
      doctor_procedures: {
        Row: { doctor_id: string; procedure_id: string }
        Insert: { doctor_id: string; procedure_id: string }
        Update: { doctor_id?: string; procedure_id?: string }
        Relationships: []
      }
      doctors: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          id: string
          name: string
          next_step_date: string | null
          notes: string
          phone: string
          pipeline_stage: string
          position: string
          status: string
          title: string
          tracking_notes: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          name: string
          next_step_date?: string | null
          notes?: string
          phone?: string
          pipeline_stage?: string
          position?: string
          status?: string
          title?: string
          tracking_notes?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          name?: string
          next_step_date?: string | null
          notes?: string
          phone?: string
          pipeline_stage?: string
          position?: string
          status?: string
          title?: string
          tracking_notes?: string
          updated_at?: string
        }
        Relationships: []
      }
      organizations: {
        Row: { created_at: string; id: string; name: string }
        Insert: { created_at?: string; id?: string; name: string }
        Update: { created_at?: string; id?: string; name?: string }
        Relationships: []
      }
      equipment_items: {
        Row: {
          catalog_number: string
          company_id: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          catalog_number?: string
          company_id?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          catalog_number?: string
          company_id?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      doctor_procedure_equipment: {
        Row: {
          created_at: string
          doctor_id: string
          id: string
          item_id: string
          procedure_id: string
          qty_per_case: number
          scales_with_cases: boolean
        }
        Insert: {
          created_at?: string
          doctor_id: string
          id?: string
          item_id: string
          procedure_id: string
          qty_per_case?: number
          scales_with_cases?: boolean
        }
        Update: {
          created_at?: string
          doctor_id?: string
          id?: string
          item_id?: string
          procedure_id?: string
          qty_per_case?: number
          scales_with_cases?: boolean
        }
        Relationships: []
      }
      robotic_systems: {
        Row: { created_at: string; id: string; name: string }
        Insert: { created_at?: string; id?: string; name: string }
        Update: { created_at?: string; id?: string; name?: string }
        Relationships: []
      }
      hospital_robotic_systems: {
        Row: { hospital_id: string; system_id: string }
        Insert: { hospital_id: string; system_id: string }
        Update: { hospital_id?: string; system_id?: string }
        Relationships: []
      }
      doctor_robotic_systems: {
        Row: { doctor_id: string; system_id: string }
        Insert: { doctor_id: string; system_id: string }
        Update: { doctor_id?: string; system_id?: string }
        Relationships: []
      }
      case_volumes: {
        Row: {
          company_id: string | null
          count: number
          doctor_id: string
          hospital_id: string
          id: string
          procedure_id: string
          updated_at: string
          year: number
        }
        Insert: {
          company_id?: string | null
          count?: number
          doctor_id: string
          hospital_id: string
          id?: string
          procedure_id: string
          updated_at?: string
          year: number
        }
        Update: {
          company_id?: string | null
          count?: number
          doctor_id?: string
          hospital_id?: string
          id?: string
          procedure_id?: string
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      favorites: {
        Row: { created_at: string; doctor_id: string; user_id: string }
        Insert: { created_at?: string; doctor_id: string; user_id: string }
        Update: { created_at?: string; doctor_id?: string; user_id?: string }
        Relationships: []
      }
      hospital_agents: {
        Row: { agent_id: string; hospital_id: string }
        Insert: { agent_id: string; hospital_id: string }
        Update: { agent_id?: string; hospital_id?: string }
        Relationships: []
      }
      hospitals: {
        Row: {
          address: string
          city: string
          created_at: string
          id: string
          lat: number | null
          lng: number | null
          name: string
          organization_id: string | null
          sector: string
        }
        Insert: {
          address?: string
          city?: string
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          organization_id?: string | null
          sector?: string
        }
        Update: {
          address?: string
          city?: string
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          organization_id?: string | null
          sector?: string
        }
        Relationships: []
      }
      meeting_doctors: {
        Row: { doctor_id: string; meeting_id: string }
        Insert: { doctor_id: string; meeting_id: string }
        Update: { doctor_id?: string; meeting_id?: string }
        Relationships: []
      }
      meeting_tasks: {
        Row: {
          created_at: string
          description: string
          due_date: string | null
          id: string
          is_done: boolean
          meeting_id: string
        }
        Insert: {
          created_at?: string
          description?: string
          due_date?: string | null
          id?: string
          is_done?: boolean
          meeting_id: string
        }
        Update: {
          created_at?: string
          description?: string
          due_date?: string | null
          id?: string
          is_done?: boolean
          meeting_id?: string
        }
        Relationships: []
      }
      meetings: {
        Row: {
          created_at: string
          created_by: string | null
          decisions: string
          id: string
          location: string
          meeting_date: string | null
          meeting_time: string | null
          next_followup_date: string | null
          responsible_agent_id: string | null
          status: string
          subject: string
          summary: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          decisions?: string
          id?: string
          location?: string
          meeting_date?: string | null
          meeting_time?: string | null
          next_followup_date?: string | null
          responsible_agent_id?: string | null
          status?: string
          subject?: string
          summary?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          decisions?: string
          id?: string
          location?: string
          meeting_date?: string | null
          meeting_time?: string | null
          next_followup_date?: string | null
          responsible_agent_id?: string | null
          status?: string
          subject?: string
          summary?: string
          updated_at?: string
        }
        Relationships: []
      }
      procedures: {
        Row: {
          category: string
          created_at: string
          id: string
          is_mako: boolean
          name: string
          planning_template: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          is_mako?: boolean
          name: string
          planning_template?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_mako?: boolean
          name?: string
          planning_template?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          role: string
        }
        Insert: {
          created_at?: string
          email?: string
          full_name?: string
          id: string
          role?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          role?: string
        }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: { is_admin: { Args: Record<string, never>; Returns: boolean } }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

type PublicSchema = Database["public"]

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"]
