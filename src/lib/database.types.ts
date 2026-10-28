export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      agent_availability: {
        Row: {
          agent_id: string
          date: string
          id: string
          note: string
          reason: string
          shift: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          agent_id: string
          date: string
          id?: string
          note?: string
          reason?: string
          shift: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          agent_id?: string
          date?: string
          id?: string
          note?: string
          reason?: string
          shift?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_availability_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_availability_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_goals: {
        Row: {
          agent_id: string
          category: string
          created_at: string
          created_by: string | null
          current_value: number
          id: string
          metric: string
          notes: string
          period_end: string
          period_start: string
          progress_pct: number
          target: number | null
          title: string
          unit: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          category?: string
          created_at?: string
          created_by?: string | null
          current_value?: number
          id?: string
          metric?: string
          notes?: string
          period_end: string
          period_start: string
          progress_pct?: number
          target?: number | null
          title: string
          unit?: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          category?: string
          created_at?: string
          created_by?: string | null
          current_value?: number
          id?: string
          metric?: string
          notes?: string
          period_end?: string
          period_start?: string
          progress_pct?: number
          target?: number | null
          title?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_goals_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_goals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_notes: {
        Row: {
          agent_id: string
          body: string
          created_at: string
          created_by: string | null
          id: string
          note_date: string
        }
        Insert: {
          agent_id: string
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          note_date?: string
        }
        Update: {
          agent_id?: string
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          note_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_notes_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_reviews: {
        Row: {
          agent_id: string
          agreements: string
          created_at: string
          created_by: string | null
          id: string
          kind: string
          rating: number | null
          review_date: string
          summary: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          agreements?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          rating?: number | null
          review_date?: string
          summary?: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          agreements?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          rating?: number | null
          review_date?: string
          summary?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_reviews_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_reviews_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_training: {
        Row: {
          agent_id: string
          completed_on: string
          created_at: string
          created_by: string | null
          file_name: string
          file_path: string | null
          id: string
          notes: string
          stage_id: string
        }
        Insert: {
          agent_id: string
          completed_on?: string
          created_at?: string
          created_by?: string | null
          file_name?: string
          file_path?: string | null
          id?: string
          notes?: string
          stage_id: string
        }
        Update: {
          agent_id?: string
          completed_on?: string
          created_at?: string
          created_by?: string | null
          file_name?: string
          file_path?: string | null
          id?: string
          notes?: string
          stage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_training_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_training_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_training_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "training_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value?: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          at: string
          changed_fields: string[]
          detail: Json | null
          id: number
          label: string
          record_id: string
          table_name: string
          user_id: string | null
          user_name: string
        }
        Insert: {
          action: string
          at?: string
          changed_fields?: string[]
          detail?: Json | null
          id?: never
          label?: string
          record_id?: string
          table_name: string
          user_id?: string | null
          user_name?: string
        }
        Update: {
          action?: string
          at?: string
          changed_fields?: string[]
          detail?: Json | null
          id?: never
          label?: string
          record_id?: string
          table_name?: string
          user_id?: string | null
          user_name?: string
        }
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
        Relationships: [
          {
            foreignKeyName: "case_volumes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_volumes_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_volumes_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_volumes_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
        ]
      }
      client_errors: {
        Row: {
          app_version: string
          at: string
          id: number
          message: string
          stack: string
          url: string
          user_agent: string
          user_id: string | null
        }
        Insert: {
          app_version?: string
          at?: string
          id?: never
          message?: string
          stack?: string
          url?: string
          user_agent?: string
          user_id?: string | null
        }
        Update: {
          app_version?: string
          at?: string
          id?: never
          message?: string
          stack?: string
          url?: string
          user_agent?: string
          user_id?: string | null
        }
        Relationships: []
      }
      companies: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      company_robotic_systems: {
        Row: {
          company_id: string
          system_id: string
        }
        Insert: {
          company_id: string
          system_id: string
        }
        Update: {
          company_id?: string
          system_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_robotic_systems_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_robotic_systems_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "robotic_systems"
            referencedColumns: ["id"]
          },
        ]
      }
      competitor_intel: {
        Row: {
          competitor: string
          competitor_id: string | null
          contract_end: string | null
          created_at: string
          created_by: string | null
          doctor_id: string | null
          hospital_id: string | null
          id: string
          image_paths: string[]
          implant_price: number | null
          intel_date: string
          loss_reason: string
          loyalty: string
          meeting_id: string | null
          notes: string
          offer: string
          outcome: string
          payment_terms: string
          price_per_case: number | null
          product: string
          tender_due: string | null
          tender_name: string
          updated_at: string
        }
        Insert: {
          competitor?: string
          competitor_id?: string | null
          contract_end?: string | null
          created_at?: string
          created_by?: string | null
          doctor_id?: string | null
          hospital_id?: string | null
          id?: string
          image_paths?: string[]
          implant_price?: number | null
          intel_date?: string
          loss_reason?: string
          loyalty?: string
          meeting_id?: string | null
          notes?: string
          offer?: string
          outcome?: string
          payment_terms?: string
          price_per_case?: number | null
          product?: string
          tender_due?: string | null
          tender_name?: string
          updated_at?: string
        }
        Update: {
          competitor?: string
          competitor_id?: string | null
          contract_end?: string | null
          created_at?: string
          created_by?: string | null
          doctor_id?: string | null
          hospital_id?: string | null
          id?: string
          image_paths?: string[]
          implant_price?: number | null
          intel_date?: string
          loss_reason?: string
          loyalty?: string
          meeting_id?: string | null
          notes?: string
          offer?: string
          outcome?: string
          payment_terms?: string
          price_per_case?: number | null
          product?: string
          tender_due?: string | null
          tender_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitor_intel_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "competitors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitor_intel_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitor_intel_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitor_intel_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitor_intel_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      competitor_robotic_systems: {
        Row: {
          competitor_id: string
          system_id: string
        }
        Insert: {
          competitor_id: string
          system_id: string
        }
        Update: {
          competitor_id?: string
          system_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitor_robotic_systems_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "competitors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitor_robotic_systems_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "robotic_systems"
            referencedColumns: ["id"]
          },
        ]
      }
      competitors: {
        Row: {
          active: boolean
          created_at: string
          description: string
          id: string
          learn_topic_id: string | null
          name: string
          our_answer: string
          products: string
          reps: string
          sort: number
          strengths: string
          updated_at: string
          weaknesses: string
          website: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string
          id?: string
          learn_topic_id?: string | null
          name: string
          our_answer?: string
          products?: string
          reps?: string
          sort?: number
          strengths?: string
          updated_at?: string
          weaknesses?: string
          website?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string
          id?: string
          learn_topic_id?: string | null
          name?: string
          our_answer?: string
          products?: string
          reps?: string
          sort?: number
          strengths?: string
          updated_at?: string
          weaknesses?: string
          website?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitors_learn_topic_id_fkey"
            columns: ["learn_topic_id"]
            isOneToOne: false
            referencedRelation: "learn_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      consumable_count_lines: {
        Row: {
          count_id: string
          item_id: string
          min_qty: number
          qty: number
        }
        Insert: {
          count_id: string
          item_id: string
          min_qty?: number
          qty?: number
        }
        Update: {
          count_id?: string
          item_id?: string
          min_qty?: number
          qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "consumable_count_lines_count_id_fkey"
            columns: ["count_id"]
            isOneToOne: false
            referencedRelation: "consumable_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumable_count_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "consumable_items"
            referencedColumns: ["id"]
          },
        ]
      }
      consumable_counts: {
        Row: {
          counted_by: string | null
          counted_on: string
          created_at: string
          hospital_id: string
          id: string
          notes: string
        }
        Insert: {
          counted_by?: string | null
          counted_on?: string
          created_at?: string
          hospital_id: string
          id?: string
          notes?: string
        }
        Update: {
          counted_by?: string | null
          counted_on?: string
          created_at?: string
          hospital_id?: string
          id?: string
          notes?: string
        }
        Relationships: [
          {
            foreignKeyName: "consumable_counts_counted_by_fkey"
            columns: ["counted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumable_counts_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      consumable_items: {
        Row: {
          catalog_number: string
          category: string
          created_at: string
          default_min: number
          id: string
          name: string
          sort: number
        }
        Insert: {
          catalog_number?: string
          category?: string
          created_at?: string
          default_min?: number
          id?: string
          name: string
          sort?: number
        }
        Update: {
          catalog_number?: string
          category?: string
          created_at?: string
          default_min?: number
          id?: string
          name?: string
          sort?: number
        }
        Relationships: []
      }
      consumable_minimums: {
        Row: {
          hospital_id: string
          item_id: string
          min_qty: number
        }
        Insert: {
          hospital_id: string
          item_id: string
          min_qty: number
        }
        Update: {
          hospital_id?: string
          item_id?: string
          min_qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "consumable_minimums_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumable_minimums_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "consumable_items"
            referencedColumns: ["id"]
          },
        ]
      }
      consumable_usage: {
        Row: {
          item_id: string
          procedure_type: string
          qty_per_case: number
        }
        Insert: {
          item_id: string
          procedure_type: string
          qty_per_case?: number
        }
        Update: {
          item_id?: string
          procedure_type?: string
          qty_per_case?: number
        }
        Relationships: [
          {
            foreignKeyName: "consumable_usage_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "consumable_items"
            referencedColumns: ["id"]
          },
        ]
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
          office_phone: string
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
          office_phone?: string
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
          office_phone?: string
          phone?: string
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_arrangements: {
        Row: {
          created_at: string
          doctor_id: string
          id: string
          kind: string
          note: string
          provider: string
        }
        Insert: {
          created_at?: string
          doctor_id: string
          id?: string
          kind?: string
          note?: string
          provider: string
        }
        Update: {
          created_at?: string
          doctor_id?: string
          id?: string
          kind?: string
          note?: string
          provider?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_arrangements_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_companies: {
        Row: {
          company_id: string
          doctor_id: string
        }
        Insert: {
          company_id: string
          doctor_id: string
        }
        Update: {
          company_id?: string
          doctor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_companies_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_course_items: {
        Row: {
          id: string
          sort: number
          stage_id: string
          text: string
        }
        Insert: {
          id?: string
          sort?: number
          stage_id: string
          text?: string
        }
        Update: {
          id?: string
          sort?: number
          stage_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_course_items_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "doctor_course_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_course_stages: {
        Row: {
          course_id: string
          id: string
          sort: number
          title: string
        }
        Insert: {
          course_id: string
          id?: string
          sort?: number
          title: string
        }
        Update: {
          course_id?: string
          id?: string
          sort?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_course_stages_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "doctor_surgical_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_hospitals: {
        Row: {
          clinic_days: number[]
          clinic_hours: string
          clinic_note: string
          doctor_id: string
          hospital_id: string
          id: string
          role_at_hospital: string
          sector: string
        }
        Insert: {
          clinic_days?: number[]
          clinic_hours?: string
          clinic_note?: string
          doctor_id: string
          hospital_id: string
          id?: string
          role_at_hospital?: string
          sector?: string
        }
        Update: {
          clinic_days?: number[]
          clinic_hours?: string
          clinic_note?: string
          doctor_id?: string
          hospital_id?: string
          id?: string
          role_at_hospital?: string
          sector?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_hospitals_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_hospitals_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_investigations: {
        Row: {
          categories: string[]
          closed_by: string | null
          closed_on: string | null
          created_at: string
          created_by: string | null
          doctor_id: string | null
          event_date: string
          file_name: string
          file_path: string | null
          file_size: number
          hospital_id: string | null
          id: string
          meeting_id: string | null
          mime: string
          problem: string
          product: string
          root_cause: string
          severity: number
          solution: string
          status: string
          title: string
        }
        Insert: {
          categories?: string[]
          closed_by?: string | null
          closed_on?: string | null
          created_at?: string
          created_by?: string | null
          doctor_id?: string | null
          event_date?: string
          file_name?: string
          file_path?: string | null
          file_size?: number
          hospital_id?: string | null
          id?: string
          meeting_id?: string | null
          mime?: string
          problem?: string
          product?: string
          root_cause?: string
          severity?: number
          solution?: string
          status?: string
          title: string
        }
        Update: {
          categories?: string[]
          closed_by?: string | null
          closed_on?: string | null
          created_at?: string
          created_by?: string | null
          doctor_id?: string | null
          event_date?: string
          file_name?: string
          file_path?: string | null
          file_size?: number
          hospital_id?: string | null
          id?: string
          meeting_id?: string | null
          mime?: string
          problem?: string
          product?: string
          root_cause?: string
          severity?: number
          solution?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_investigations_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_investigations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_investigations_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_investigations_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_investigations_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "doctor_preop_plans_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_preop_plans_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_private_clinics: {
        Row: {
          address: string
          clinic_days: number[]
          created_at: string
          doctor_id: string
          id: string
        }
        Insert: {
          address?: string
          clinic_days?: number[]
          created_at?: string
          doctor_id: string
          id?: string
        }
        Update: {
          address?: string
          clinic_days?: number[]
          created_at?: string
          doctor_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_private_clinics_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "doctor_procedure_equipment_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_procedure_equipment_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "equipment_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_procedure_equipment_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_procedures: {
        Row: {
          doctor_id: string
          procedure_id: string
        }
        Insert: {
          doctor_id: string
          procedure_id: string
        }
        Update: {
          doctor_id?: string
          procedure_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_procedures_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_procedures_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_robotic_systems: {
        Row: {
          doctor_id: string
          system_id: string
        }
        Insert: {
          doctor_id: string
          system_id: string
        }
        Update: {
          doctor_id?: string
          system_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_robotic_systems_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_robotic_systems_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "robotic_systems"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_roles: {
        Row: {
          created_at: string
          doctor_id: string
          id: string
          note: string
          organization: string
          sort: number
          title: string
        }
        Insert: {
          created_at?: string
          doctor_id: string
          id?: string
          note?: string
          organization?: string
          sort?: number
          title: string
        }
        Update: {
          created_at?: string
          doctor_id?: string
          id?: string
          note?: string
          organization?: string
          sort?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_roles_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_stage_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          doctor_id: string
          id: string
          previous_stage: string
          stage: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          doctor_id: string
          id?: string
          previous_stage?: string
          stage: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          doctor_id?: string
          id?: string
          previous_stage?: string
          stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_stage_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_stage_history_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_surgical_courses: {
        Row: {
          created_at: string
          doctor_id: string
          id: string
          procedure_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          doctor_id: string
          id?: string
          procedure_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          doctor_id?: string
          id?: string
          procedure_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_surgical_courses_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_surgical_courses_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
        ]
      }
      doctors: {
        Row: {
          contact_cadence_days: number | null
          created_at: string
          created_by: string | null
          email: string
          id: string
          lost_at: string | null
          lost_reason: string
          name: string
          next_step: string
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
          contact_cadence_days?: number | null
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          lost_at?: string | null
          lost_reason?: string
          name: string
          next_step?: string
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
          contact_cadence_days?: number | null
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          lost_at?: string | null
          lost_reason?: string
          name?: string
          next_step?: string
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
        Relationships: [
          {
            foreignKeyName: "doctors_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_item_parts: {
        Row: {
          catalog_no: string
          created_at: string
          description: string
          id: string
          item_id: string
          position: number | null
          qty: number
          sort: number
        }
        Insert: {
          catalog_no?: string
          created_at?: string
          description?: string
          id?: string
          item_id: string
          position?: number | null
          qty?: number
          sort?: number
        }
        Update: {
          catalog_no?: string
          created_at?: string
          description?: string
          id?: string
          item_id?: string
          position?: number | null
          qty?: number
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "equipment_item_parts_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "equipment_items"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_items: {
        Row: {
          catalog_number: string
          company_id: string | null
          created_at: string
          id: string
          image_path: string
          images: Json
          name: string
        }
        Insert: {
          catalog_number?: string
          company_id?: string | null
          created_at?: string
          id?: string
          image_path?: string
          images?: Json
          name: string
        }
        Update: {
          catalog_number?: string
          company_id?: string | null
          created_at?: string
          id?: string
          image_path?: string
          images?: Json
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          doctor_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          doctor_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          doctor_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hospital_agents: {
        Row: {
          agent_id: string
          hospital_id: string
        }
        Insert: {
          agent_id: string
          hospital_id: string
        }
        Update: {
          agent_id?: string
          hospital_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hospital_agents_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hospital_agents_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      hospital_case_estimates: {
        Row: {
          cases: number
          hospital_id: string
          id: string
          note: string
          period: string
          procedure_id: string | null
          procedure_text: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cases?: number
          hospital_id: string
          id?: string
          note?: string
          period?: string
          procedure_id?: string | null
          procedure_text?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cases?: number
          hospital_id?: string
          id?: string
          note?: string
          period?: string
          procedure_id?: string | null
          procedure_text?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hospital_case_estimates_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hospital_case_estimates_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hospital_case_estimates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hospital_locations: {
        Row: {
          hospital_id: string
          id: string
          note: string
          person: string
          place: string
          sort: number
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          hospital_id: string
          id?: string
          note?: string
          person?: string
          place?: string
          sort?: number
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          hospital_id?: string
          id?: string
          note?: string
          person?: string
          place?: string
          sort?: number
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hospital_locations_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hospital_locations_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hospital_robotic_systems: {
        Row: {
          hospital_id: string
          system_id: string
        }
        Insert: {
          hospital_id: string
          system_id: string
        }
        Update: {
          hospital_id?: string
          system_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hospital_robotic_systems_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hospital_robotic_systems_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "robotic_systems"
            referencedColumns: ["id"]
          },
        ]
      }
      hospitals: {
        Row: {
          address: string
          city: string
          commercial_status: string
          created_at: string
          general_info: string
          id: string
          lat: number | null
          lng: number | null
          name: string
          next_step: string
          next_step_date: string | null
          organization_id: string | null
          scan_center_name: string
          scan_contact_id: string | null
          scan_email: string
          scan_hours: string
          scan_notes: string
          scan_phone: string
          scan_whatsapp_name: string
          scan_whatsapp_url: string
          sector: string
          surgery_days: number[]
        }
        Insert: {
          address?: string
          city?: string
          commercial_status?: string
          created_at?: string
          general_info?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          next_step?: string
          next_step_date?: string | null
          organization_id?: string | null
          scan_center_name?: string
          scan_contact_id?: string | null
          scan_email?: string
          scan_hours?: string
          scan_notes?: string
          scan_phone?: string
          scan_whatsapp_name?: string
          scan_whatsapp_url?: string
          sector?: string
          surgery_days?: number[]
        }
        Update: {
          address?: string
          city?: string
          commercial_status?: string
          created_at?: string
          general_info?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          next_step?: string
          next_step_date?: string | null
          organization_id?: string | null
          scan_center_name?: string
          scan_contact_id?: string | null
          scan_email?: string
          scan_hours?: string
          scan_notes?: string
          scan_phone?: string
          scan_whatsapp_name?: string
          scan_whatsapp_url?: string
          sector?: string
          surgery_days?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "hospitals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      implant_fields: {
        Row: {
          category: string
          created_at: string
          depends_on: string | null
          id: string
          key: string
          label: string
          procedure_type: string
          sort: number
        }
        Insert: {
          category: string
          created_at?: string
          depends_on?: string | null
          id?: string
          key: string
          label: string
          procedure_type: string
          sort?: number
        }
        Update: {
          category?: string
          created_at?: string
          depends_on?: string | null
          id?: string
          key?: string
          label?: string
          procedure_type?: string
          sort?: number
        }
        Relationships: []
      }
      implant_options: {
        Row: {
          category: string
          created_at: string
          id: string
          parent_id: string | null
          sort: number
          value: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          parent_id?: string | null
          sort?: number
          value: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          sort?: number
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "implant_options_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "implant_options"
            referencedColumns: ["id"]
          },
        ]
      }
      info_categories: {
        Row: {
          id: string
          name: string
          sort: number
        }
        Insert: {
          id?: string
          name: string
          sort?: number
        }
        Update: {
          id?: string
          name?: string
          sort?: number
        }
        Relationships: []
      }
      info_document_procedures: {
        Row: {
          document_id: string
          procedure_id: string
        }
        Insert: {
          document_id: string
          procedure_id: string
        }
        Update: {
          document_id?: string
          procedure_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "info_document_procedures_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "info_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "info_document_procedures_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
        ]
      }
      info_documents: {
        Row: {
          category_id: string | null
          content_hash: string
          created_at: string
          description: string
          file_name: string
          file_size: number
          id: string
          kind: string
          mime: string
          storage_path: string
          tags: string[]
          title: string
          updated_at: string
          uploaded_by: string | null
          url: string
        }
        Insert: {
          category_id?: string | null
          content_hash?: string
          created_at?: string
          description?: string
          file_name?: string
          file_size?: number
          id?: string
          kind?: string
          mime?: string
          storage_path?: string
          tags?: string[]
          title: string
          updated_at?: string
          uploaded_by?: string | null
          url?: string
        }
        Update: {
          category_id?: string | null
          content_hash?: string
          created_at?: string
          description?: string
          file_name?: string
          file_size?: number
          id?: string
          kind?: string
          mime?: string
          storage_path?: string
          tags?: string[]
          title?: string
          updated_at?: string
          uploaded_by?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "info_documents_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "info_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "info_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      investigation_contacts: {
        Row: {
          contact_id: string
          investigation_id: string
        }
        Insert: {
          contact_id: string
          investigation_id: string
        }
        Update: {
          contact_id?: string
          investigation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investigation_contacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigation_contacts_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "doctor_investigations"
            referencedColumns: ["id"]
          },
        ]
      }
      investigation_doctors: {
        Row: {
          doctor_id: string
          investigation_id: string
        }
        Insert: {
          doctor_id: string
          investigation_id: string
        }
        Update: {
          doctor_id?: string
          investigation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investigation_doctors_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigation_doctors_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "doctor_investigations"
            referencedColumns: ["id"]
          },
        ]
      }
      investigation_files: {
        Row: {
          created_at: string
          created_by: string | null
          file_name: string
          file_path: string
          file_size: number
          id: string
          investigation_id: string
          mime: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          file_name?: string
          file_path: string
          file_size?: number
          id?: string
          investigation_id: string
          mime?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          investigation_id?: string
          mime?: string
        }
        Relationships: [
          {
            foreignKeyName: "investigation_files_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigation_files_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "doctor_investigations"
            referencedColumns: ["id"]
          },
        ]
      }
      investigation_staff: {
        Row: {
          investigation_id: string
          profile_id: string
        }
        Insert: {
          investigation_id: string
          profile_id: string
        }
        Update: {
          investigation_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investigation_staff_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "doctor_investigations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigation_staff_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      learn_attempts: {
        Row: {
          id: string
          score: number
          taken_at: string
          topic_id: string
          total: number
          user_id: string
        }
        Insert: {
          id?: string
          score: number
          taken_at?: string
          topic_id: string
          total: number
          user_id?: string
        }
        Update: {
          id?: string
          score?: number
          taken_at?: string
          topic_id?: string
          total?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learn_attempts_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "learn_topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learn_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      learn_cards: {
        Row: {
          answer: string
          approved: boolean
          created_at: string
          explanation: string
          id: string
          image_path: string | null
          lesson_id: string | null
          question: string
          sort: number
          topic_id: string
          wrong_options: string[]
        }
        Insert: {
          answer: string
          approved?: boolean
          created_at?: string
          explanation?: string
          id?: string
          image_path?: string | null
          lesson_id?: string | null
          question: string
          sort?: number
          topic_id: string
          wrong_options?: string[]
        }
        Update: {
          answer?: string
          approved?: boolean
          created_at?: string
          explanation?: string
          id?: string
          image_path?: string | null
          lesson_id?: string | null
          question?: string
          sort?: number
          topic_id?: string
          wrong_options?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "learn_cards_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "learn_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learn_cards_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "learn_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      learn_cases: {
        Row: {
          approved: boolean
          correct_index: number
          created_at: string
          explanation: string
          id: string
          image_path: string | null
          options: Json
          question: string
          scenario: string
          sort: number
          title: string
          topic_id: string
        }
        Insert: {
          approved?: boolean
          correct_index?: number
          created_at?: string
          explanation?: string
          id?: string
          image_path?: string | null
          options?: Json
          question?: string
          scenario?: string
          sort?: number
          title: string
          topic_id: string
        }
        Update: {
          approved?: boolean
          correct_index?: number
          created_at?: string
          explanation?: string
          id?: string
          image_path?: string | null
          options?: Json
          question?: string
          scenario?: string
          sort?: number
          title?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learn_cases_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "learn_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      learn_daily: {
        Row: {
          answers: number
          correct: number
          day: string
          points: number
          user_id: string
        }
        Insert: {
          answers?: number
          correct?: number
          day?: string
          points?: number
          user_id?: string
        }
        Update: {
          answers?: number
          correct?: number
          day?: string
          points?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learn_daily_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      learn_lessons: {
        Row: {
          approved: boolean
          body: string
          created_at: string
          doc_ids: string[]
          id: string
          image_path: string | null
          sort: number
          title: string
          topic_id: string
          video_url: string
        }
        Insert: {
          approved?: boolean
          body?: string
          created_at?: string
          doc_ids?: string[]
          id?: string
          image_path?: string | null
          sort?: number
          title: string
          topic_id: string
          video_url?: string
        }
        Update: {
          approved?: boolean
          body?: string
          created_at?: string
          doc_ids?: string[]
          id?: string
          image_path?: string | null
          sort?: number
          title?: string
          topic_id?: string
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "learn_lessons_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "learn_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      learn_progress: {
        Row: {
          box: number
          card_id: string
          correct_count: number
          due_on: string
          id: string
          known: boolean
          last_seen: string
          topic_id: string
          user_id: string
          wrong_count: number
        }
        Insert: {
          box?: number
          card_id: string
          correct_count?: number
          due_on?: string
          id?: string
          known?: boolean
          last_seen?: string
          topic_id: string
          user_id?: string
          wrong_count?: number
        }
        Update: {
          box?: number
          card_id?: string
          correct_count?: number
          due_on?: string
          id?: string
          known?: boolean
          last_seen?: string
          topic_id?: string
          user_id?: string
          wrong_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "learn_progress_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "learn_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learn_progress_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "learn_topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learn_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      learn_sequences: {
        Row: {
          approved: boolean
          created_at: string
          id: string
          sort: number
          steps: string[]
          title: string
          topic_id: string
        }
        Insert: {
          approved?: boolean
          created_at?: string
          id?: string
          sort?: number
          steps?: string[]
          title: string
          topic_id: string
        }
        Update: {
          approved?: boolean
          created_at?: string
          id?: string
          sort?: number
          steps?: string[]
          title?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learn_sequences_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "learn_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      learn_topics: {
        Row: {
          created_at: string
          description: string
          id: string
          sort: number
          title: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          sort?: number
          title: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          sort?: number
          title?: string
        }
        Relationships: []
      }
      learn_track_items: {
        Row: {
          id: string
          pass_pct: number
          sort: number
          stage_id: string | null
          topic_id: string
          track_id: string
        }
        Insert: {
          id?: string
          pass_pct?: number
          sort?: number
          stage_id?: string | null
          topic_id: string
          track_id: string
        }
        Update: {
          id?: string
          pass_pct?: number
          sort?: number
          stage_id?: string | null
          topic_id?: string
          track_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learn_track_items_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "training_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learn_track_items_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "learn_topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learn_track_items_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "learn_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      learn_tracks: {
        Row: {
          audience: string
          created_at: string
          description: string
          id: string
          sort: number
          title: string
        }
        Insert: {
          audience?: string
          created_at?: string
          description?: string
          id?: string
          sort?: number
          title: string
        }
        Update: {
          audience?: string
          created_at?: string
          description?: string
          id?: string
          sort?: number
          title?: string
        }
        Relationships: []
      }
      meeting_agents: {
        Row: {
          agent_id: string
          meeting_id: string
        }
        Insert: {
          agent_id: string
          meeting_id: string
        }
        Update: {
          agent_id?: string
          meeting_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_agents_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_agents_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_contacts: {
        Row: {
          contact_id: string
          meeting_id: string
        }
        Insert: {
          contact_id: string
          meeting_id: string
        }
        Update: {
          contact_id?: string
          meeting_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_contacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_contacts_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_doctors: {
        Row: {
          doctor_id: string
          meeting_id: string
        }
        Insert: {
          doctor_id: string
          meeting_id: string
        }
        Update: {
          doctor_id?: string
          meeting_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_doctors_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_doctors_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_tasks: {
        Row: {
          area_id: string | null
          assignee_id: string | null
          contact_id: string | null
          coordinator_contact_id: string | null
          coordinator_text: string
          created_at: string
          created_by: string | null
          description: string
          doctor_id: string | null
          done_at: string | null
          due_date: string | null
          external_owner: string
          hospital_id: string | null
          id: string
          investigation_id: string | null
          is_done: boolean
          meeting_id: string | null
          notes: string
          priority: string
          process_id: string | null
          project_id: string | null
          recurrence: string
          reminder_at: string | null
          reminder_sent_at: string | null
          review_id: string | null
          sort: number
          status: string
          updated_at: string
          waiting_for: string
        }
        Insert: {
          area_id?: string | null
          assignee_id?: string | null
          contact_id?: string | null
          coordinator_contact_id?: string | null
          coordinator_text?: string
          created_at?: string
          created_by?: string | null
          description?: string
          doctor_id?: string | null
          done_at?: string | null
          due_date?: string | null
          external_owner?: string
          hospital_id?: string | null
          id?: string
          investigation_id?: string | null
          is_done?: boolean
          meeting_id?: string | null
          notes?: string
          priority?: string
          process_id?: string | null
          project_id?: string | null
          recurrence?: string
          reminder_at?: string | null
          reminder_sent_at?: string | null
          review_id?: string | null
          sort?: number
          status?: string
          updated_at?: string
          waiting_for?: string
        }
        Update: {
          area_id?: string | null
          assignee_id?: string | null
          contact_id?: string | null
          coordinator_contact_id?: string | null
          coordinator_text?: string
          created_at?: string
          created_by?: string | null
          description?: string
          doctor_id?: string | null
          done_at?: string | null
          due_date?: string | null
          external_owner?: string
          hospital_id?: string | null
          id?: string
          investigation_id?: string | null
          is_done?: boolean
          meeting_id?: string | null
          notes?: string
          priority?: string
          process_id?: string | null
          project_id?: string | null
          recurrence?: string
          reminder_at?: string | null
          reminder_sent_at?: string | null
          review_id?: string | null
          sort?: number
          status?: string
          updated_at?: string
          waiting_for?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_tasks_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "project_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_tasks_coordinator_contact_id_fkey"
            columns: ["coordinator_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_tasks_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_tasks_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_tasks_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "doctor_investigations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_tasks_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_tasks_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_tasks_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "agent_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          competitor_notes: string
          created_at: string
          created_by: string | null
          decisions: string
          extra_participants: string
          hospital_id: string | null
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
          competitor_notes?: string
          created_at?: string
          created_by?: string | null
          decisions?: string
          extra_participants?: string
          hospital_id?: string | null
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
          competitor_notes?: string
          created_at?: string
          created_by?: string | null
          decisions?: string
          extra_participants?: string
          hospital_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "meetings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_responsible_agent_id_fkey"
            columns: ["responsible_agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      patient_scans: {
        Row: {
          anaesthesia_note: string
          created_at: string
          created_by: string | null
          ct_date: string | null
          ct_time: string | null
          disk_collected: boolean
          health_fund: string
          hospital_id: string
          id: string
          implant_data: Json
          insurance: string
          notes: string
          patient_dob: string | null
          patient_id_number: string
          patient_name: string
          patient_phone: string
          plan_ready: boolean
          procedure_type: string
          rescan: boolean
          rescan_date: string | null
          rescan_done: boolean
          rescan_reason: string
          scanned: boolean
          side: string
          status: string
          surgeon_id: string | null
          surgery_date: string | null
          updated_at: string
          uploaded: boolean
        }
        Insert: {
          anaesthesia_note?: string
          created_at?: string
          created_by?: string | null
          ct_date?: string | null
          ct_time?: string | null
          disk_collected?: boolean
          health_fund?: string
          hospital_id: string
          id?: string
          implant_data?: Json
          insurance?: string
          notes?: string
          patient_dob?: string | null
          patient_id_number?: string
          patient_name?: string
          patient_phone?: string
          plan_ready?: boolean
          procedure_type?: string
          rescan?: boolean
          rescan_date?: string | null
          rescan_done?: boolean
          rescan_reason?: string
          scanned?: boolean
          side?: string
          status?: string
          surgeon_id?: string | null
          surgery_date?: string | null
          updated_at?: string
          uploaded?: boolean
        }
        Update: {
          anaesthesia_note?: string
          created_at?: string
          created_by?: string | null
          ct_date?: string | null
          ct_time?: string | null
          disk_collected?: boolean
          health_fund?: string
          hospital_id?: string
          id?: string
          implant_data?: Json
          insurance?: string
          notes?: string
          patient_dob?: string | null
          patient_id_number?: string
          patient_name?: string
          patient_phone?: string
          plan_ready?: boolean
          procedure_type?: string
          rescan?: boolean
          rescan_date?: string | null
          rescan_done?: boolean
          rescan_reason?: string
          scanned?: boolean
          side?: string
          status?: string
          surgeon_id?: string | null
          surgery_date?: string | null
          updated_at?: string
          uploaded?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "patient_scans_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_scans_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_scans_surgeon_id_fkey"
            columns: ["surgeon_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          created_at: string
          id: string
          is_won: boolean
          name: string
          sort: number
          stuck_days: number | null
          suggested_step: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_won?: boolean
          name: string
          sort?: number
          stuck_days?: number | null
          suggested_step?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_won?: boolean
          name?: string
          sort?: number
          stuck_days?: number | null
          suggested_step?: string
        }
        Relationships: []
      }
      planned_surgeries: {
        Row: {
          agent_id: string | null
          cases: number
          company: string
          created_at: string
          created_by: string | null
          doctor_id: string | null
          hospital_id: string | null
          id: string
          notes: string
          procedure: string
          status: string
          surgery_date: string
          surgery_time: string | null
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          cases?: number
          company?: string
          created_at?: string
          created_by?: string | null
          doctor_id?: string | null
          hospital_id?: string | null
          id?: string
          notes?: string
          procedure?: string
          status?: string
          surgery_date: string
          surgery_time?: string | null
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          cases?: number
          company?: string
          created_at?: string
          created_by?: string | null
          doctor_id?: string | null
          hospital_id?: string | null
          id?: string
          notes?: string
          procedure?: string
          status?: string
          surgery_date?: string
          surgery_time?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "planned_surgeries_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planned_surgeries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planned_surgeries_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planned_surgeries_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      procedure_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string
          doctor_id: string | null
          id: string
          name: string
          note: string
          parent_id: string | null
          procedure_id: string | null
          requested_by: string
          status: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string
          doctor_id?: string | null
          id?: string
          name: string
          note?: string
          parent_id?: string | null
          procedure_id?: string | null
          requested_by?: string
          status?: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string
          doctor_id?: string | null
          id?: string
          name?: string
          note?: string
          parent_id?: string | null
          procedure_id?: string | null
          requested_by?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "procedure_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedure_requests_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedure_requests_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedure_requests_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedure_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      procedure_template_stages: {
        Row: {
          id: string
          procedure_id: string
          sort: number
          title: string
        }
        Insert: {
          id?: string
          procedure_id: string
          sort?: number
          title: string
        }
        Update: {
          id?: string
          procedure_id?: string
          sort?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "procedure_template_stages_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
        ]
      }
      procedures: {
        Row: {
          category: string
          created_at: string
          id: string
          is_mako: boolean
          name: string
          parent_id: string | null
          planning_template: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          is_mako?: boolean
          name: string
          parent_id?: string | null
          planning_template?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_mako?: boolean
          name?: string
          parent_id?: string | null
          planning_template?: string
        }
        Relationships: [
          {
            foreignKeyName: "procedures_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
        ]
      }
      process_template_steps: {
        Row: {
          day_offset: number
          id: string
          notes: string
          owner: string
          sort: number
          template_id: string
          title: string
        }
        Insert: {
          day_offset?: number
          id?: string
          notes?: string
          owner?: string
          sort?: number
          template_id: string
          title: string
        }
        Update: {
          day_offset?: number
          id?: string
          notes?: string
          owner?: string
          sort?: number
          template_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_template_steps_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "process_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      process_templates: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          id: string
          kind: string
          name: string
          sort: number
          subject: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          kind?: string
          name: string
          sort?: number
          subject?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          kind?: string
          name?: string
          sort?: number
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      processes: {
        Row: {
          closed_by: string | null
          closed_on: string | null
          created_at: string
          created_by: string | null
          id: string
          kind: string
          name: string
          notes: string
          start_date: string
          status: string
          subject_agent_id: string | null
          subject_hospital_id: string | null
          template_id: string | null
        }
        Insert: {
          closed_by?: string | null
          closed_on?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          name: string
          notes?: string
          start_date?: string
          status?: string
          subject_agent_id?: string | null
          subject_hospital_id?: string | null
          template_id?: string | null
        }
        Update: {
          closed_by?: string | null
          closed_on?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          name?: string
          notes?: string
          start_date?: string
          status?: string
          subject_agent_id?: string | null
          subject_hospital_id?: string | null
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "processes_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processes_subject_agent_id_fkey"
            columns: ["subject_agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processes_subject_hospital_id_fkey"
            columns: ["subject_hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processes_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "process_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          email: string
          full_name: string
          id: string
          impersonating_id: string | null
          is_content_editor: boolean
          is_developer: boolean
          is_test: boolean
          role: string
          status_changed_at: string | null
          status_changed_by: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          email?: string
          full_name?: string
          id: string
          impersonating_id?: string | null
          is_content_editor?: boolean
          is_developer?: boolean
          is_test?: boolean
          role?: string
          status_changed_at?: string | null
          status_changed_by?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          impersonating_id?: string | null
          is_content_editor?: boolean
          is_developer?: boolean
          is_test?: boolean
          role?: string
          status_changed_at?: string | null
          status_changed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_impersonating_id_fkey"
            columns: ["impersonating_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_status_changed_by_fkey"
            columns: ["status_changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_areas: {
        Row: {
          contact_id: string | null
          contact_text: string
          created_at: string
          id: string
          name: string
          project_id: string
          sort: number
        }
        Insert: {
          contact_id?: string | null
          contact_text?: string
          created_at?: string
          id?: string
          name: string
          project_id: string
          sort?: number
        }
        Update: {
          contact_id?: string | null
          contact_text?: string
          created_at?: string
          id?: string
          name?: string
          project_id?: string
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_areas_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_areas_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_files: {
        Row: {
          created_at: string
          file_name: string
          file_size: number
          id: string
          mime: string
          project_id: string
          storage_path: string
          task_id: string | null
          update_id: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name?: string
          file_size?: number
          id?: string
          mime?: string
          project_id: string
          storage_path: string
          task_id?: string | null
          update_id?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number
          id?: string
          mime?: string
          project_id?: string
          storage_path?: string
          task_id?: string | null
          update_id?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_files_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "meeting_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_files_update_id_fkey"
            columns: ["update_id"]
            isOneToOne: false
            referencedRelation: "project_updates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_updates: {
        Row: {
          author_id: string | null
          author_name: string
          body: string
          created_at: string
          edited_at: string | null
          event_date: string
          id: string
          project_id: string
          task_id: string | null
        }
        Insert: {
          author_id?: string | null
          author_name?: string
          body?: string
          created_at?: string
          edited_at?: string | null
          event_date?: string
          id?: string
          project_id: string
          task_id?: string | null
        }
        Update: {
          author_id?: string | null
          author_name?: string
          body?: string
          created_at?: string
          edited_at?: string | null
          event_date?: string
          id?: string
          project_id?: string
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_updates_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_updates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_updates_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "meeting_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          description: string
          hospital_id: string | null
          id: string
          name: string
          owner_id: string | null
          start_date: string | null
          status: string
          target_date: string | null
          template_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          hospital_id?: string | null
          id?: string
          name: string
          owner_id?: string | null
          start_date?: string | null
          status?: string
          target_date?: string | null
          template_key?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          hospital_id?: string | null
          id?: string
          name?: string
          owner_id?: string | null
          start_date?: string | null
          status?: string
          target_date?: string | null
          template_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_agent: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_agent?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_agent?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      robotic_systems: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      roster_notifications: {
        Row: {
          agent_id: string
          created_at: string
          created_by: string | null
          date: string | null
          id: string
          kind: string
          message: string
          read_at: string | null
          shift: string | null
          week_start: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          created_by?: string | null
          date?: string | null
          id?: string
          kind: string
          message?: string
          read_at?: string | null
          shift?: string | null
          week_start: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          created_by?: string | null
          date?: string | null
          id?: string
          kind?: string
          message?: string
          read_at?: string | null
          shift?: string | null
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "roster_notifications_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roster_notifications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      roster_weeks: {
        Row: {
          closed_at: string
          closed_by: string | null
          week_start: string
        }
        Insert: {
          closed_at?: string
          closed_by?: string | null
          week_start: string
        }
        Update: {
          closed_at?: string
          closed_by?: string | null
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "roster_weeks_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_assignments: {
        Row: {
          agent_id: string
          area: string
          date: string
          hospital_id: string | null
          id: string
          meeting_id: string | null
          note: string
          shift: string
          task_id: string | null
          updated_at: string
          updated_by: string | null
          work_type: string
        }
        Insert: {
          agent_id: string
          area?: string
          date: string
          hospital_id?: string | null
          id?: string
          meeting_id?: string | null
          note?: string
          shift: string
          task_id?: string | null
          updated_at?: string
          updated_by?: string | null
          work_type?: string
        }
        Update: {
          agent_id?: string
          area?: string
          date?: string
          hospital_id?: string | null
          id?: string
          meeting_id?: string | null
          note?: string
          shift?: string
          task_id?: string | null
          updated_at?: string
          updated_by?: string | null
          work_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_assignments_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_assignments_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_assignments_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_assignments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "meeting_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_assignments_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      suggestions: {
        Row: {
          body: string
          created_at: string
          created_by: string
          dev_note: string
          handled_at: string | null
          id: string
          kind: string
          page: string
          status: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string
          dev_note?: string
          handled_at?: string | null
          id?: string
          kind?: string
          page?: string
          status?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string
          dev_note?: string
          handled_at?: string | null
          id?: string
          kind?: string
          page?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggestions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_subtasks: {
        Row: {
          created_at: string
          due_date: string | null
          id: string
          is_done: boolean
          sort: number
          task_id: string
          text: string
        }
        Insert: {
          created_at?: string
          due_date?: string | null
          id?: string
          is_done?: boolean
          sort?: number
          task_id: string
          text?: string
        }
        Update: {
          created_at?: string
          due_date?: string | null
          id?: string
          is_done?: boolean
          sort?: number
          task_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_subtasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "meeting_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      training_stages: {
        Row: {
          created_at: string
          id: string
          name: string
          procedure_id: string | null
          required_count: number
          sort: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          procedure_id?: string | null
          required_count?: number
          sort?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          procedure_id?: string | null
          required_count?: number
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "training_stages_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
        ]
      }
      upload_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string
          file_name: string
          file_size: number
          id: string
          purpose: string
          requested_by: string
          status: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string
          file_name: string
          file_size: number
          id?: string
          purpose?: string
          requested_by?: string
          status?: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string
          file_name?: string
          file_size?: number
          id?: string
          purpose?: string
          requested_by?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "upload_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "upload_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_activity_prefs: {
        Row: {
          kinds: string[] | null
          seen_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          kinds?: string[] | null
          seen_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          kinds?: string[] | null
          seen_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_activity_prefs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_user_activity: {
        Args: never
        Returns: {
          id: string
          last_sign_in_at: string
        }[]
      }
      backup_tables: { Args: never; Returns: string[] }
      can_access_project: { Args: { pid: string }; Returns: boolean }
      can_edit_learning: { Args: never; Returns: boolean }
      can_see_process: { Args: { pid: string }; Returns: boolean }
      decide_procedure_request: {
        Args: {
          p_approve: boolean
          p_id: string
          p_name?: string
          p_note?: string
          p_parent?: string
        }
        Returns: string
      }
      delete_pipeline_stage: {
        Args: { p_id: string; p_move_to?: string }
        Returns: undefined
      }
      effective_uid: { Args: never; Returns: string }
      finish_large_upload: { Args: { p_id: string }; Returns: undefined }
      is_active: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_real_developer: { Args: never; Returns: boolean }
      is_week_closed: { Args: { d: string }; Returns: boolean }
      learn_add_points: {
        Args: { p_answers: number; p_correct: number; p_points: number }
        Returns: undefined
      }
      learn_submit_attempt: {
        Args: { p_picks: Json; p_topic: string }
        Returns: {
          o_score: number
          o_total: number
        }[]
      }
      merge_records: {
        Args: { p_drop: string; p_keep: string; p_table: string }
        Returns: undefined
      }
      rename_pipeline_stage: {
        Args: { p_id: string; p_name: string }
        Returns: undefined
      }
      replace_equipment_parts: {
        Args: { p_item: string; p_parts: Json }
        Returns: undefined
      }
      request_large_upload: {
        Args: { p_name: string; p_purpose?: string; p_size: number }
        Returns: Json
      }
      reset_test_user: { Args: { p_target: string }; Returns: undefined }
      set_impersonation: { Args: { target: string }; Returns: undefined }
      sync_learning_stages: { Args: never; Returns: number }
      system_health: { Args: never; Returns: Json }
      trigger_task_reminders: { Args: never; Returns: undefined }
      week_start_of: { Args: { d: string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
