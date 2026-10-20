import { useState } from 'react'
import { useAllUsers, useAuditLog, type AuditFilters } from '../lib/api'
import { EmptyState, ErrorState, Spinner } from './ui'
import { classNames } from '../lib/utils'

const TABLE_LABELS: Record<string, string> = {
  doctors: 'רופא',
  hospitals: 'בית חולים',
  contacts: 'איש קשר',
  meetings: 'פגישה',
  meeting_tasks: 'משימה',
  patient_scans: 'סריקת מטופל',
  info_documents: 'מסמך מידע',
  profiles: 'משתמש',
  competitor_intel: 'פעילות מתחרה',
  consumable_counts: 'ספירת מתכלים',
  doctor_surgical_courses: 'מהלך ניתוחי',
}

const ACTION_LABELS: Record<string, { label: string; cls: string }> = {
  insert: { label: 'נוצר', cls: 'border-green-200 bg-green-50 text-green-700' },
  update: { label: 'עודכן', cls: 'border-sky-200 bg-sky-50 text-sky-700' },
  delete: { label: 'נמחק', cls: 'border-red-200 bg-red-50 text-red-600' },
}

export const FIELD_LABELS: Record<string, string> = {
  name: 'שם', phone: 'טלפון', email: 'אימייל', notes: 'הערות', status: 'סטטוס', role: 'הרשאה', active: 'פעיל',
  surgery_date: 'תאריך ניתוח', ct_date: 'תאריך CT', side: 'צד', hospital_id: 'בית חולים', surgeon_id: 'מנתח',
  patient_name: 'שם מטופל', patient_phone: 'טלפון מטופל', patient_id_number: 'ת״ז', is_done: 'בוצע', due_date: 'תאריך יעד',
  assignee_id: 'אחראי', description: 'תיאור', priority: 'עדיפות', summary: 'סיכום', subject: 'נושא', meeting_date: 'תאריך',
  contact_cadence_days: 'קצב קשר', plan_ready: 'תוכנית מוכנה', scanned: 'נסרק', disk_collected: 'הועלה דיסק',
  impersonating_id: 'התחזות', password_reset_link: 'קישור לאיפוס סיסמה', pipeline_stage: 'שלב', tracking_notes: 'הערות מעקב', title: 'כותרת',
}

const fmt = (iso: string) =>
  new Intl.DateTimeFormat('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))

/** admin-only: who changed what and when */
export function AuditLog() {
  const users = useAllUsers()
  const [f, setF] = useState<AuditFilters>({ userId: '', table: '', action: '', from: '', to: '', limit: 100 })
  const log = useAuditLog(f)
  const set = (p: Partial<AuditFilters>) => setF((x) => ({ ...x, ...p, limit: p.limit ?? 100 }))

  return (
    <div className="space-y-3">
      <div className="card grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 lg:grid-cols-5">
        <select className="input col-span-2 sm:col-span-1" value={f.userId} onChange={(e) => set({ userId: e.target.value })} aria-label="משתמש">
          <option value="">כל המשתמשים</option>
          {(users.data ?? []).map((u) => (
            <option key={u.id} value={u.id}>
              {u.full_name || u.email}
            </option>
          ))}
        </select>
        <select className="input" value={f.table} onChange={(e) => set({ table: e.target.value })} aria-label="סוג רשומה">
          <option value="">כל הסוגים</option>
          {Object.entries(TABLE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select className="input" value={f.action} onChange={(e) => set({ action: e.target.value })} aria-label="פעולה">
          <option value="">כל הפעולות</option>
          <option value="insert">נוצר</option>
          <option value="update">עודכן</option>
          <option value="delete">נמחק</option>
        </select>
        <label className="block text-xs text-slate-600">מתאריך
          <input type="date" className="input mt-0.5" value={f.from} onChange={(e) => set({ from: e.target.value })} />
        </label>
        <label className="block text-xs text-slate-600">עד תאריך
          <input type="date" className="input mt-0.5" value={f.to} onChange={(e) => set({ to: e.target.value })} />
        </label>
      </div>

      {log.isLoading ? (
        <Spinner />
      ) : log.error ? (
        <ErrorState error={log.error} />
      ) : (log.data ?? []).length === 0 ? (
        <EmptyState title="אין פעולות מתועדות" hint="פעולות שיבוצעו מעכשיו יופיעו כאן" />
      ) : (
        <>
          <ul className="card divide-y divide-slate-100">
            {(log.data ?? []).map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2.5 text-sm">
                <span className={classNames('chip !px-2 !py-0 text-xs', ACTION_LABELS[e.action]?.cls)}>{ACTION_LABELS[e.action]?.label ?? e.action}</span>
                <span className="font-medium text-slate-700">{TABLE_LABELS[e.table_name] ?? e.table_name}</span>
                <span className="mr-auto text-xs text-slate-500">{fmt(e.at)}</span>
                <span className="basis-full text-xs text-slate-600">{e.user_name || 'מערכת'}</span>
                {e.label && <span dir="auto" className="basis-full font-medium text-slate-800 [overflow-wrap:anywhere]">{e.label}</span>}
                {e.changed_fields.length > 0 && (
                  <span className="basis-full text-xs text-slate-500">
                    שדות ששונו: {e.changed_fields.map((c) => FIELD_LABELS[c] ?? c).join(', ')}
                  </span>
                )}
                {e.detail && typeof e.detail === 'object' && !Array.isArray(e.detail) && (e.detail as Record<string, unknown>).as_user_name != null && (
                  <span className="chip border-amber-200 bg-amber-50 !px-2 !py-0 text-xs text-amber-700">
                    מצב מפתח · בהתחזות ל-{String((e.detail as Record<string, unknown>).as_user_name)}
                  </span>
                )}
                {e.table_name === 'profiles' && e.detail && typeof e.detail === 'object' && !Array.isArray(e.detail) && (
                  <span className="text-xs text-violet-700">
                    הרשאה: {String((e.detail as Record<string, unknown>).role)} · {(e.detail as Record<string, unknown>).active === 'true' ? 'פעיל' : 'מושבת'}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {(log.data ?? []).length >= f.limit && (
            <button className="btn-secondary w-full" onClick={() => setF((x) => ({ ...x, limit: x.limit + 200 }))}>
              טען עוד
            </button>
          )}
        </>
      )}
      <p className="text-xs text-slate-500">
        היומן מתעד יצירה, עדכון ומחיקה של רופאים, בתי חולים, אנשי קשר, פגישות, משימות, סריקות, מסמכים ומשתמשים. פרטי המטופל בסריקות אינם נשמרים ביומן. צפייה בלבד, ללא אפשרות עריכה.
      </p>
    </div>
  )
}
