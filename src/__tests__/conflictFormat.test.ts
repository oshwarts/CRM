import { describe, expect, it } from 'vitest'
import { conflictFieldLabel, conflictValue } from '../lib/conflictFormat'

describe('conflict display', () => {
  it('names the fields in Hebrew and falls back to the generic labels, then to the raw name', () => {
    expect(conflictFieldLabel('recurrence')).toBe('חזרה')
    expect(conflictFieldLabel('x_field', { x_field: 'כללי' })).toBe('כללי')
    expect(conflictFieldLabel('unknown_field')).toBe('unknown_field')
  })
  it('shows empty values as a dash and booleans in Hebrew', () => {
    expect(conflictValue('notes', null)).toBe('—')
    expect(conflictValue('notes', '')).toBe('—')
    expect(conflictValue('scanned', true)).toBe('כן')
    expect(conflictValue('scanned', false)).toBe('לא')
  })
  it('translates the coded values', () => {
    expect(conflictValue('priority', 'urgent')).toBe('דחוף')
    expect(conflictValue('recurrence', 'weekly')).toBe('כל שבוע')
    expect(conflictValue('status', 'needs_followup')).toBe('דורשת מעקב')
  })
  it('shows a date as dd/mm/yyyy and a time without seconds', () => {
    expect(conflictValue('due_date', '2026-11-01')).toBe('01/11/2026')
    expect(conflictValue('meeting_time', '09:30:00')).toBe('09:30')
    expect(conflictValue('summary', 'text 2026-11-01 stays')).toBe('text 2026-11-01 stays')
  })
  it('looks ids up and never shows a raw id', () => {
    expect(conflictValue('doctor_id', 'abc', (f, id) => (f === 'doctor_id' && id === 'abc' ? 'ד״ר כהן' : undefined))).toBe('ד״ר כהן')
    expect(conflictValue('hospital_id', 'zzz')).toBe('פריט שנבחר')
  })
})

import { FIELD_LABELS } from '../lib/fieldLabels'
import type { Database } from '../lib/database.types'

describe('every column of the editable tables has a Hebrew name', () => {
  // the columns that can reach a conflict sheet (what the offline executors write); a missing name would show a raw column
  const cols = (keys: string[]) => keys.filter((k) => !FIELD_LABELS[k])
  it('meetings, tasks and scans', () => {
    type M = keyof Database['public']['Tables']['meetings']['Row']
    type T = keyof Database['public']['Tables']['meeting_tasks']['Row']
    type S = keyof Database['public']['Tables']['patient_scans']['Row']
    const meetings: M[] = ['created_at', 'created_by', 'decisions', 'extra_participants', 'competitor_notes', 'hospital_id', 'id', 'location', 'meeting_date', 'meeting_time', 'next_followup_date', 'responsible_agent_id', 'status', 'subject', 'summary', 'updated_at']
    const tasks: T[] = ['assignee_id', 'created_at', 'created_by', 'description', 'doctor_id', 'done_at', 'due_date', 'hospital_id', 'id', 'is_done', 'meeting_id', 'notes', 'project_id', 'area_id', 'status', 'waiting_for', 'external_owner', 'contact_id', 'coordinator_contact_id', 'coordinator_text', 'priority', 'recurrence', 'review_id', 'sort', 'updated_at']
    const scans: S[] = ['anaesthesia_note', 'created_at', 'created_by', 'ct_date', 'ct_time', 'disk_collected', 'plan_ready', 'rescan', 'rescan_date', 'rescan_done', 'rescan_reason', 'surgery_date', 'health_fund', 'hospital_id', 'id', 'implant_data', 'insurance', 'notes', 'patient_dob', 'patient_id_number', 'patient_name', 'patient_phone', 'procedure_type', 'scanned', 'side', 'status', 'surgeon_id', 'updated_at', 'uploaded']
    expect(cols([...meetings, ...tasks, ...scans])).toEqual([])
  })
})
