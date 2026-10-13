import type { TaskRow } from './types'
import { daysUntil } from './utils'

export const TASK_STATUS: Record<string, { label: string; chip: string; dot: string }> = {
  todo: { label: 'טרם התחיל', chip: 'border-slate-200 bg-slate-50 text-slate-600', dot: 'bg-slate-400' },
  in_progress: { label: 'בתהליך', chip: 'border-sky-200 bg-sky-50 text-sky-700', dot: 'bg-sky-500' },
  blocked: { label: 'תקוע', chip: 'border-red-200 bg-red-50 text-red-600', dot: 'bg-red-500' },
  done: { label: 'הושלם', chip: 'border-emerald-200 bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
}
export const STATUS_ORDER = ['todo', 'in_progress', 'blocked', 'done'] as const

export const PROJECT_STATUS: Record<string, string> = { active: 'פעיל', on_hold: 'מוקפא', done: 'הושלם' }

export const isOverdue = (t: Pick<TaskRow, 'due_date' | 'status'>) => t.status !== 'done' && !!t.due_date && (daysUntil(t.due_date) ?? 0) < 0

export type ProjectStats = {
  total: number
  done: number
  percent: number
  blocked: TaskRow[]
  overdue: TaskRow[]
  /** the next things to do: overdue first, then by due date; blocked tasks are not "next steps" */
  next: TaskRow[]
}

export function projectStats(tasks: TaskRow[]): ProjectStats {
  const total = tasks.length
  const done = tasks.filter((t) => t.status === 'done').length
  const open = tasks.filter((t) => t.status !== 'done')
  const rank = (t: TaskRow) => (isOverdue(t) ? 0 : t.status === 'in_progress' ? 1 : 2)
  return {
    total,
    done,
    percent: total ? Math.round((done / total) * 100) : 0,
    blocked: open.filter((t) => t.status === 'blocked'),
    overdue: open.filter(isOverdue),
    next: open
      .filter((t) => t.status !== 'blocked')
      .sort((a, b) => rank(a) - rank(b) || (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'))
      .slice(0, 6),
  }
}

/* ---------------- templates ----------------
   A starting point for a project that repeats: areas with their tasks. Everything can be edited afterwards. */
export type ProjectTemplate = { key: string; name: string; areas: { name: string; tasks: string[] }[] }

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    key: 'mako_integration',
    name: 'אינטגרציית MAKO בבית חולים',
    areas: [
      {
        name: 'רכש',
        tasks: [
          'הצעת מחיר לבית החולים',
          'אישור ההצעה על ידי בית החולים',
          'הוצאת הזמנת רכש (PO)',
          'אישור תקציב / מימון ותנאי תשלום',
          'הזמנת רובוט, מגשים ומתכלים מהחברה',
        ],
      },
      {
        name: 'הנדסה רפואית',
        tasks: [
          'סיור באתר וקביעת חדר הניתוח לרובוט',
          'בדיקת תשתיות: חשמל, שטח וגובה, אוורור, רשת',
          'אישור הנדסה רפואית של בית החולים לאתר',
          'קבלת הציוד והתקנה בחדר הניתוח',
          'בדיקות בטיחות ואישור הפעלה',
        ],
      },
      {
        name: 'אישורים',
        tasks: [
          'אישור ועדת ציוד / רכש',
          'אישור הנהלת בית החולים',
          'אישור מנהל המחלקה האורתופדית',
          'אישור אבטחת מידע ו-IT (חיבור לרשת, DICOM)',
          'ביטוח ואחריות',
        ],
      },
      {
        name: 'לוגיסטיקה והתקנה',
        tasks: ['תיאום משלוח עם החברה', 'קבלת הרובוט והמגשים בבית החולים', 'התקנה וכיול', 'פרוטוקול קבלה וחתימה'],
      },
      {
        name: 'הדרכה והכשרה',
        tasks: ['הדרכת מנתחים', 'הדרכת צוות חדר ניתוח וסטריליזציה', 'הדרכת הנדסה רפואית / טכנאים', 'מלאי מתכלים התחלתי וספירה'],
      },
      {
        name: 'ניתוח ראשון וסגירה',
        tasks: ['תיאום הניתוח הראשון בליווי', 'ניתוח ראשון', 'מעקב אחרי החודש הראשון', 'סגירת הפרויקט וסיכום'],
      },
    ],
  },
]
