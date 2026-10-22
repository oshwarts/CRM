// Hebrew names of the database columns a person can meet in the app's messages (the list of waiting offline changes when two people
// edited the same thing). Every column of meetings, meeting_tasks (tasks) and patient_scans is here; the generic names used by the
// audit log stay in components/AuditLog.tsx.
export const FIELD_LABELS: Record<string, string> = {
  // shared
  id: 'מזהה', created_at: 'נוצר', updated_at: 'עודכן', created_by: 'נוצר על ידי', notes: 'הערות', status: 'סטטוס', hospital_id: 'בית חולים',
  // meetings
  subject: 'נושא', meeting_date: 'תאריך', meeting_time: 'שעה', location: 'מקום', responsible_agent_id: 'סוכן אחראי', summary: 'סיכום', decisions: 'החלטות',
  next_followup_date: 'מעקב הבא', extra_participants: 'משתתפים נוספים', competitor_notes: 'הערות על מתחרים',
  // tasks
  description: 'תיאור', due_date: 'תאריך יעד', priority: 'עדיפות', recurrence: 'חזרה', doctor_id: 'רופא', assignee_id: 'אחראי', is_done: 'בוצע', done_at: 'בוצע בתאריך',
  meeting_id: 'פגישה', project_id: 'פרויקט', area_id: 'אזור בפרויקט', waiting_for: 'ממתין ל', external_owner: 'גורם חיצוני', contact_id: 'איש קשר',
  coordinator_contact_id: 'מתאם', coordinator_text: 'מתאם (טקסט)', review_id: 'סקירה', sort: 'סדר',
  // patient scans
  patient_name: 'שם מטופל', patient_phone: 'טלפון מטופל', patient_id_number: 'ת״ז', patient_dob: 'תאריך לידה', health_fund: 'קופת חולים', insurance: 'ביטוח',
  procedure_type: 'סוג ניתוח', side: 'צד', surgeon_id: 'מנתח', surgery_date: 'תאריך ניתוח', ct_date: 'תאריך CT', ct_time: 'שעת CT', scanned: 'נסרק',
  uploaded: 'הועלה', disk_collected: 'דיסק הועלה', plan_ready: 'תוכנית מוכנה', rescan: 'סריקה חוזרת', rescan_date: 'תאריך סריקה חוזרת',
  rescan_reason: 'סיבת סריקה חוזרת', rescan_done: 'סריקה חוזרת בוצעה', anaesthesia_note: 'הערת הרדמה', implant_data: 'נתוני שתל',
}
