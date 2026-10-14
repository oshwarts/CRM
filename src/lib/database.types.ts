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
          contact_cadence_days: number | null
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
          contact_cadence_days?: number | null
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
          contact_cadence_days?: number | null
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
      implant_options: {
        Row: { category: string; created_at: string; id: string; sort: number; value: string }
        Insert: { category: string; created_at?: string; id?: string; sort?: number; value: string }
        Update: { category?: string; created_at?: string; id?: string; sort?: number; value?: string }
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
          plan_ready: boolean
          rescan: boolean
          rescan_date: string | null
          rescan_done: boolean
          rescan_reason: string
          surgery_date: string | null
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
          procedure_type: string
          scanned: boolean
          side: string
          status: string
          surgeon_id: string | null
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
          plan_ready?: boolean
          rescan?: boolean
          rescan_date?: string | null
          rescan_done?: boolean
          rescan_reason?: string
          surgery_date?: string | null
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
          procedure_type?: string
          scanned?: boolean
          side?: string
          status?: string
          surgeon_id?: string | null
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
          plan_ready?: boolean
          rescan?: boolean
          rescan_date?: string | null
          rescan_done?: boolean
          rescan_reason?: string
          surgery_date?: string | null
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
          procedure_type?: string
          scanned?: boolean
          side?: string
          status?: string
          surgeon_id?: string | null
          updated_at?: string
          uploaded?: boolean
        }
        Relationships: []
      }
      consumable_items: {
        Row: { category: string; catalog_number: string; created_at: string; default_min: number; id: string; name: string; sort: number }
        Insert: { category?: string; catalog_number?: string; created_at?: string; default_min?: number; id?: string; name: string; sort?: number }
        Update: { category?: string; catalog_number?: string; created_at?: string; default_min?: number; id?: string; name?: string; sort?: number }
        Relationships: []
      }
      consumable_minimums: {
        Row: { hospital_id: string; item_id: string; min_qty: number }
        Insert: { hospital_id: string; item_id: string; min_qty: number }
        Update: { hospital_id?: string; item_id?: string; min_qty?: number }
        Relationships: []
      }
      consumable_counts: {
        Row: { counted_by: string | null; counted_on: string; created_at: string; hospital_id: string; id: string; notes: string }
        Insert: { counted_by?: string | null; counted_on?: string; created_at?: string; hospital_id: string; id?: string; notes?: string }
        Update: { counted_by?: string | null; counted_on?: string; created_at?: string; hospital_id?: string; id?: string; notes?: string }
        Relationships: []
      }
      consumable_count_lines: {
        Row: { count_id: string; item_id: string; min_qty: number; qty: number }
        Insert: { count_id: string; item_id: string; min_qty?: number; qty?: number }
        Update: { count_id?: string; item_id?: string; min_qty?: number; qty?: number }
        Relationships: []
      }
      app_settings: {
        Row: { key: string; updated_at: string; value: string }
        Insert: { key: string; updated_at?: string; value?: string }
        Update: { key?: string; updated_at?: string; value?: string }
        Relationships: []
      }
      equipment_items: {
        Row: {
          catalog_number: string
          company_id: string | null
          created_at: string
          id: string
          image_path: string
          name: string
        }
        Insert: {
          catalog_number?: string
          company_id?: string | null
          created_at?: string
          id?: string
          image_path?: string
          name: string
        }
        Update: {
          catalog_number?: string
          company_id?: string | null
          created_at?: string
          id?: string
          image_path?: string
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
      procedure_template_stages: {
        Row: { id: string; procedure_id: string; sort: number; title: string }
        Insert: { id?: string; procedure_id: string; sort?: number; title: string }
        Update: { id?: string; procedure_id?: string; sort?: number; title?: string }
        Relationships: []
      }
      doctor_surgical_courses: {
        Row: { created_at: string; doctor_id: string; id: string; procedure_id: string; updated_at: string }
        Insert: { created_at?: string; doctor_id: string; id?: string; procedure_id: string; updated_at?: string }
        Update: { created_at?: string; doctor_id?: string; id?: string; procedure_id?: string; updated_at?: string }
        Relationships: []
      }
      doctor_course_stages: {
        Row: { course_id: string; id: string; sort: number; title: string }
        Insert: { course_id: string; id?: string; sort?: number; title: string }
        Update: { course_id?: string; id?: string; sort?: number; title?: string }
        Relationships: []
      }
      doctor_course_items: {
        Row: { id: string; sort: number; stage_id: string; text: string }
        Insert: { id?: string; sort?: number; stage_id: string; text?: string }
        Update: { id?: string; sort?: number; stage_id?: string; text?: string }
        Relationships: []
      }
      info_categories: {
        Row: { id: string; name: string; sort: number }
        Insert: { id?: string; name: string; sort?: number }
        Update: { id?: string; name?: string; sort?: number }
        Relationships: []
      }
      info_documents: {
        Row: {
          category_id: string | null; created_at: string; description: string; file_name: string; file_size: number
          id: string; kind: string; mime: string; storage_path: string; tags: string[]; title: string
          updated_at: string; uploaded_by: string | null; url: string
        }
        Insert: {
          category_id?: string | null; created_at?: string; description?: string; file_name?: string; file_size?: number
          id?: string; kind?: string; mime?: string; storage_path?: string; tags?: string[]; title: string
          updated_at?: string; uploaded_by?: string | null; url?: string
        }
        Update: {
          category_id?: string | null; created_at?: string; description?: string; file_name?: string; file_size?: number
          id?: string; kind?: string; mime?: string; storage_path?: string; tags?: string[]; title?: string
          updated_at?: string; uploaded_by?: string | null; url?: string
        }
        Relationships: []
      }
      info_document_procedures: {
        Row: { document_id: string; procedure_id: string }
        Insert: { document_id: string; procedure_id: string }
        Update: { document_id?: string; procedure_id?: string }
        Relationships: []
      }
      meeting_agents: {
        Row: { agent_id: string; meeting_id: string }
        Insert: { agent_id: string; meeting_id: string }
        Update: { agent_id?: string; meeting_id?: string }
        Relationships: []
      }
      meeting_contacts: {
        Row: { contact_id: string; meeting_id: string }
        Insert: { contact_id: string; meeting_id: string }
        Update: { contact_id?: string; meeting_id?: string }
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
          assignee_id: string | null
          created_at: string
          created_by: string | null
          description: string
          doctor_id: string | null
          done_at: string | null
          due_date: string | null
          hospital_id: string | null
          id: string
          is_done: boolean
          meeting_id: string | null
          notes: string
          project_id: string | null
          area_id: string | null
          status: string
          waiting_for: string
          external_owner: string
          contact_id: string | null
          priority: string
          recurrence: string
          review_id: string | null
          sort: number
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          doctor_id?: string | null
          done_at?: string | null
          due_date?: string | null
          hospital_id?: string | null
          id?: string
          is_done?: boolean
          meeting_id?: string | null
          notes?: string
          project_id?: string | null
          area_id?: string | null
          status?: string
          waiting_for?: string
          external_owner?: string
          contact_id?: string | null
          priority?: string
          recurrence?: string
          review_id?: string | null
          sort?: number
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          doctor_id?: string | null
          done_at?: string | null
          due_date?: string | null
          hospital_id?: string | null
          id?: string
          is_done?: boolean
          meeting_id?: string | null
          notes?: string
          project_id?: string | null
          area_id?: string | null
          status?: string
          waiting_for?: string
          external_owner?: string
          contact_id?: string | null
          priority?: string
          recurrence?: string
          review_id?: string | null
          sort?: number
          updated_at?: string
        }
        Relationships: []
      }
      task_subtasks: {
        Row: {
          created_at: string
          id: string
          is_done: boolean
          sort: number
          task_id: string
          text: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_done?: boolean
          sort?: number
          task_id: string
          text?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_done?: boolean
          sort?: number
          task_id?: string
          text?: string
        }
        Relationships: []
      }
      competitor_intel: {
        Row: {
          competitor: string
          created_at: string
          created_by: string | null
          doctor_id: string | null
          hospital_id: string | null
          id: string
          intel_date: string
          meeting_id: string | null
          notes: string
          offer: string
          product: string
          updated_at: string
        }
        Insert: {
          competitor?: string
          created_at?: string
          created_by?: string | null
          doctor_id?: string | null
          hospital_id?: string | null
          id?: string
          intel_date?: string
          meeting_id?: string | null
          notes?: string
          offer?: string
          product?: string
          updated_at?: string
        }
        Update: {
          competitor?: string
          created_at?: string
          created_by?: string | null
          doctor_id?: string | null
          hospital_id?: string | null
          id?: string
          intel_date?: string
          meeting_id?: string | null
          notes?: string
          offer?: string
          product?: string
          updated_at?: string
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
        Insert: never
        Update: never
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
      }
      learn_topics: {
        Row: { created_at: string; description: string; id: string; sort: number; title: string }
        Insert: { created_at?: string; description?: string; id?: string; sort?: number; title: string }
        Update: { created_at?: string; description?: string; id?: string; sort?: number; title?: string }
        Relationships: []
      }
      learn_cards: {
        Row: { answer: string; created_at: string; id: string; question: string; sort: number; topic_id: string }
        Insert: { answer: string; created_at?: string; id?: string; question: string; sort?: number; topic_id: string }
        Update: { answer?: string; created_at?: string; id?: string; question?: string; sort?: number; topic_id?: string }
        Relationships: []
      }
      learn_progress: {
        Row: { card_id: string; correct_count: number; id: string; known: boolean; last_seen: string; topic_id: string; user_id: string; wrong_count: number }
        Insert: { card_id: string; correct_count?: number; id?: string; known?: boolean; last_seen?: string; topic_id: string; user_id?: string; wrong_count?: number }
        Update: { card_id?: string; correct_count?: number; id?: string; known?: boolean; last_seen?: string; topic_id?: string; user_id?: string; wrong_count?: number }
        Relationships: []
      }
      learn_attempts: {
        Row: { id: string; score: number; taken_at: string; topic_id: string; total: number; user_id: string }
        Insert: { id?: string; score: number; taken_at?: string; topic_id: string; total: number; user_id?: string }
        Update: { id?: string; score?: number; taken_at?: string; topic_id?: string; total?: number; user_id?: string }
        Relationships: []
      }
      training_stages: {
        Row: { created_at: string; id: string; name: string; procedure_id: string | null; required_count: number; sort: number }
        Insert: { created_at?: string; id?: string; name: string; procedure_id?: string | null; required_count?: number; sort?: number }
        Update: { created_at?: string; id?: string; name?: string; procedure_id?: string | null; required_count?: number; sort?: number }
        Relationships: []
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
        Relationships: []
      }
      meetings: {
        Row: {
          created_at: string
          created_by: string | null
          decisions: string
          extra_participants: string
          competitor_notes: string
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
          created_at?: string
          created_by?: string | null
          decisions?: string
          extra_participants?: string
          competitor_notes?: string
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
          created_at?: string
          created_by?: string | null
          decisions?: string
          extra_participants?: string
          competitor_notes?: string
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
          active: boolean
          created_at: string
          email: string
          full_name: string
          id: string
          impersonating_id: string | null
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
          is_developer?: boolean
          is_test?: boolean
          role?: string
          status_changed_at?: string | null
          status_changed_by?: string | null
        }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean }
      is_active: { Args: Record<string, never>; Returns: boolean }
      merge_records: { Args: { p_table: string; p_keep: string; p_drop: string }; Returns: undefined }
      replace_equipment_parts: { Args: { p_item: string; p_parts: unknown }; Returns: undefined }
      reset_test_user: { Args: { p_target: string }; Returns: undefined }
      set_impersonation: { Args: { target: string | null }; Returns: undefined }
      admin_user_activity: {
        Args: Record<string, never>
        Returns: { id: string; last_sign_in_at: string | null }[]
      }
    }
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
