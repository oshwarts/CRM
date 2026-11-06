import { Link } from 'react-router-dom'
import { ArrowRight, Accessibility } from 'lucide-react'
import { BrandLogo } from '../components/BrandLogo'
import { useAuth } from '../context/AuthProvider'

/** content shared between the standalone (pre-login) page and the one shown inside the app to signed-in users */
function Content() {
  return (
    <div className="space-y-5 text-sm leading-relaxed text-slate-700">
      <section className="space-y-1.5">
        <h2 className="text-base font-semibold text-brand-800">כללי</h2>
        <p>
          AMI JR CRM היא מערכת פנים-ארגונית לניהול קשרי בתי חולים, רופאים ותיאום לוגיסטי. אנו שואפים שהמערכת תהיה נגישה לשימוש גם
          על-ידי אנשים עם מוגבלות, בהתאם לתקן הישראלי ת״י 5568 (רמה AA), המבוסס על הנחיות הנגישות הבינלאומיות WCAG 2.1.
        </p>
      </section>

      <section className="space-y-1.5">
        <h2 className="text-base font-semibold text-brand-800">ההתאמות שבוצעו</h2>
        <ul className="list-disc space-y-1 pr-5">
          <li>תמיכה בניווט ובהפעלה מלאה באמצעות מקלדת, כולל קיצור "דלג לתוכן" בראש כל עמוד.</li>
          <li>ניגודיות צבעים עומדת בדרישת המינימום (4.5:1 לטקסט רגיל) לאחר בדיקה ותיקון שבוצעו באוקטובר 2026.</li>
          <li>תוויות מקושרות לכל שדה טופס, כולל הודעות שגיאה המוקראות על-ידי טכנולוגיה מסייעת.</li>
          <li>חלונות דו-שיח (modal) עם מלכודת פוקוס תקנית, סגירה במקש Escape, והחזרת הפוקוס למקום שממנו נפתחו.</li>
          <li>תמיכה בכיווניות מעורבת (RTL/LTR) לתוכן בעברית לצד טקסט לועזי (שמות, טלפונים, כתובות דוא״ל).</li>
          <li>הכרזות קוליות (aria-live) להודעות מערכת ועדכונים דינמיים.</li>
        </ul>
      </section>

      <section className="space-y-1.5">
        <h2 className="text-base font-semibold text-brand-800">מגבלות ידועות</h2>
        <p>
          ייתכנו מסכים או רכיבים שטרם נבדקו באופן מלא. אנו ממשיכים לבצע בדיקות ותיקונים באופן שוטף. אם נתקלתם בקושי נגישות —
          נשמח שתדווחו לנו (ראו פרטי יצירת קשר למטה) ונטפל בכך בהקדם.
        </p>
      </section>

      <section className="space-y-1.5">
        <h2 className="text-base font-semibold text-brand-800">יצירת קשר בנושאי נגישות</h2>
        <p>
          רכז/ת נגישות: <span className="font-medium text-slate-500">[להשלים שם ופרטי קשר]</span>
          <br />
          דוא״ל: <span dir="ltr" className="font-medium text-slate-500">[להשלים]</span>
        </p>
      </section>

      <p className="text-xs text-slate-400">הצהרת נגישות זו עודכנה לאחרונה: אוקטובר 2026, לאחר בדיקה וביצוע תיקונים בקוד המערכת.</p>
    </div>
  )
}

/** the page shown to a signed-in user, inside the app's own layout */
export function AccessibilityStatementPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-brand-800 sm:text-3xl">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#00326d] text-white">
            <Accessibility size={20} aria-hidden />
          </span>
          הצהרת נגישות
        </h1>
      </div>
      <div className="card p-5">
        <Content />
      </div>
    </div>
  )
}

/** the standalone page reachable without signing in (from the login screen) */
export default function AccessibilityStatement() {
  const { session } = useAuth()
  if (session) return <AccessibilityStatementPage />
  return (
    <main className="min-h-full bg-slate-50 p-4">
      <div className="mx-auto max-w-2xl space-y-5 py-8">
        <div className="flex justify-center">
          <BrandLogo size="lg" />
        </div>
        <div className="card space-y-4 p-5 sm:p-7">
          <Link to="/login" className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline">
            <ArrowRight size={16} aria-hidden />
            חזרה להתחברות
          </Link>
          <h1 className="text-xl font-semibold text-brand-800">הצהרת נגישות</h1>
          <Content />
        </div>
      </div>
    </main>
  )
}
