import { Link } from 'react-router-dom'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import { BrandLogo } from '../components/BrandLogo'
import { useAuth } from '../context/AuthProvider'

/** content shared between the standalone (pre-login) page and the one shown inside the app to signed-in users */
function Content() {
  return (
    <div className="space-y-5 text-sm leading-relaxed text-slate-700">
      <section className="space-y-1.5">
        <h2 className="text-base font-semibold text-brand-800">כללי</h2>
        <p>
          AMI JR CRM היא מערכת פנים-ארגונית המשמשת את צוות AMI JR לניהול הקשר עם בתי חולים ורופאים ולתיאום לוגיסטי של
          סריקות וניתוחים (לרבות רובוטיקת MAKO). מדיניות זו מתארת אילו נתונים נשמרים במערכת, לשם מה, ומי יכול לגשת אליהם.
        </p>
      </section>

      <section className="space-y-1.5">
        <h2 className="text-base font-semibold text-brand-800">אילו נתונים נשמרים</h2>
        <ul className="list-disc space-y-1 pr-5">
          <li>פרטי קשר ועבודה של רופאים ואנשי קשר בבתי חולים.</li>
          <li>פרטי תיאום לוגיסטי של סריקות וניתוחים: שם מטופל ותאריך בלבד, לצורך תיאום בין הצדדים — לא נשמר מידע רפואי קליני (אבחנות, תוצאות בדיקה, היסטוריה רפואית).</li>
          <li>פרטי עובדי/סוכני AMI JR המשתמשים במערכת: שם, פרטי קשר, יומן עבודה ומערכת שעות.</li>
          <li>יומן פעולות טכני (מי שינה מה ומתי), לצורכי אבטחת מידע ובקרה.</li>
        </ul>
      </section>

      <section className="space-y-1.5">
        <h2 className="text-base font-semibold text-brand-800">מי יכול לגשת למידע</h2>
        <p>
          רק עובדי/סוכני AMI JR עם חשבון מאושר במערכת. הגישה מוגבלת לפי תפקיד: סוכן רואה בעיקר את מה שרלוונטי לעבודתו,
          ומנהל רואה תמונה רחבה יותר לצורכי ניהול. כל חשבון מזוהה אישית; אין חשבונות משותפים.
        </p>
      </section>

      <section className="space-y-1.5">
        <h2 className="text-base font-semibold text-brand-800">איך המידע מאובטח</h2>
        <ul className="list-disc space-y-1 pr-5">
          <li>הרשאות גישה ברמת מסד הנתונים, כך שכל משתמש רואה רק את מה שהוא מורשה לראות — גם אם ינסה לעקוף את הממשק.</li>
          <li>ניתוק אוטומטי ממכשיר שנשאר מחובר ללא פעילות במשך 30 דקות.</li>
          <li>תיעוד (audit log) של כל הוספה, עדכון ומחיקה של נתונים, לבקרה ולחקר אירועים.</li>
          <li>מידע מועבר בחיבור מוצפן (HTTPS) ומאוחסן אצל ספק ענן (Supabase) עם הצפנה במנוחה.</li>
          <li>מחיקה אוטומטית של יומני מערכת ישנים (מעבר לתקופת השמירה הנדרשת).</li>
        </ul>
      </section>

      <section className="space-y-1.5">
        <h2 className="text-base font-semibold text-brand-800">זכויותיך</h2>
        <p>
          מי שמידע עליו נשמר במערכת (לרבות רופא או איש קשר) רשאי לפנות אלינו בבקשה לעיין במידע הנוגע לו, לתקן אותו או
          לבקש את מחיקתו, בכפוף לכל דין.
        </p>
      </section>

      <section className="space-y-1.5">
        <h2 className="text-base font-semibold text-brand-800">יצירת קשר</h2>
        <p>
          בכל שאלה הנוגעת לפרטיות ולמידע הנשמר במערכת ניתן לפנות אל:{' '}
          <span dir="ltr" className="font-medium text-slate-500">[להשלים כתובת דוא״ל ליצירת קשר]</span>
        </p>
      </section>

      <p className="text-xs text-slate-400">
        מסמך זה מתאר את הנהוג במערכת בפועל נכון לאוקטובר 2026, לצורך שקיפות כלפי מי שמידע עליו נשמר בה. אין במסמך זה כדי להוות
        ייעוץ משפטי; לפני פרסום רשמי מומלץ לבדוק את הנוסח מול עורך דין.
      </p>
    </div>
  )
}

/** the page shown to a signed-in user, inside the app's own layout */
export function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-brand-800 sm:text-3xl">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#00326d] text-white">
            <ShieldCheck size={20} aria-hidden />
          </span>
          מדיניות פרטיות
        </h1>
      </div>
      <div className="card p-5">
        <Content />
      </div>
    </div>
  )
}

/** the standalone page reachable without signing in (from the login screen) */
export default function PrivacyPolicy() {
  const { session } = useAuth()
  if (session) return <PrivacyPolicyPage />
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
          <h1 className="text-xl font-semibold text-brand-800">מדיניות פרטיות</h1>
          <Content />
        </div>
      </div>
    </main>
  )
}
