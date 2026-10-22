import { useState } from 'react'
import { ChevronDown, LifeBuoy, Search } from 'lucide-react'
import { normalizeHe } from '../lib/contactMatch'
import { useAuth } from '../context/AuthProvider'

type Topic = { title: string; items: string[]; adminOnly?: boolean }

// The guide is short on purpose: what to do first, what each screen is for, what is easy to miss.
const TOPICS: Topic[] = [
  {
    title: 'התחלה מהירה',
    items: [
      'הכניסה היא עם המייל והסיסמה. משתמש חדש מחכה לאישור מנהל לפני שהוא נכנס.',
      'דף הבית מסכם את היום: פגישות, משימות באיחור, סריקות ומה שצריך טיפול. בכפתורים שבראש הדף יוצרים פגישה, משימה, ניתוח או סריקה.',
      '"דחוף עכשיו" (בתפריט) מרכז את כל מה שמחכה לך לפי דחיפות: באיחור, היום, השבוע, רופאים לחזור אליהם.',
      'בטלפון אפשר להתקין את האפליקציה: בתפריט הדפדפן "הוסף למסך הבית". היא עובדת גם בלי אינטרנט.',
    ],
  },
  {
    title: 'עבודה יומיומית',
    items: [
      'רופאים: רשימה עם מי צריך קשר עכשיו, קצב הקשר, ניתוחים ונאמנות. בלחיצה על שורה נפתח כרטיס הרופא. רופאים פוטנציאליים נמצאים באותו עמוד (לשונית "פוטנציאליים"), עם השלב במשפך והצעד הבא.',
      'בתי חולים: רשימה עם הסטטוס המסחרי, הפגישה האחרונה והניתוחים. המפה בלשונית נפרדת. בכל שורה: שיחה, ניווט, פגישה וניתוח חדשים.',
      'משימות: אפשר לכתוב בשפה חופשית ("לשלוח הצעה לשוחט עד יום חמישי דחוף") והמערכת מזהה תאריך, דחיפות, רופא ובית חולים. החלקה הצידה על משימה בטלפון מסמנת אותה כבוצעה, ויש "ביטול".',
      'פגישות: תיעוד, החלטות ומשימות מהפגישה. אפשר לשלוח סיכום במייל.',
      'לוז: תצוגה יומית, שבועית וחודשית כמו ב-Outlook, עם פגישות, ניתוחים, CT, סריקות חוזרות, מעקבים ומשימות עם תאריך יעד. לחיצה על שעה פנויה יוצרת פגישה, משימה או ניתוח בזמן הזה, ולחיצה על אירוע פותחת אותו ומאפשרת "הוסף ל-Outlook".',
      'סריקות MAKO: מעקב אחרי מטופלים, תאריכי CT, דיסק ותוכנית. מספרי הזהות מוצגים מוסתרים, ולחיצה על העין מציגה אותם.',
    ],
  },
  {
    title: 'דברים קטנים שחוסכים זמן',
    items: [
      'חיפוש בכל המערכת: Ctrl+K (או כפתור החיפוש). כפתור "חדש" או ה"+" בטלפון יוצרים כל דבר מכל עמוד.',
      'טופס שלא נשמר נשמר כטיוטה במכשיר, ובפתיחה הבאה מוצע להמשיך.',
      'שינוי בלי חיבור: המערכת שומרת אותו ושולחת כשהחיבור חוזר. הסימון בראש המסך מראה מה ממתין.',
      'שני אנשים שעורכים אותו רופא: נשמר רק מה ששינית. אם מישהו אחר שינה את אותו שדה, תישאל לפני שתדרוס אותו.',
      'בתפריט (הסמל עם המחוונים): מצב כהה, גודל התצוגה, ובמצב מפתח מעבר בין משתמשים. "התאמת התפריט" מאפשרת לבחור את המועדפים.',
    ],
  },
  {
    title: 'הכשרה ולמידה',
    items: [
      'לומדה: נושאים, כרטיסיות, שאלות, שיעורים וצבירת התקדמות. קבצים מהמידע הקליני אפשר לחבר ללומדה בלי להעלות פעמיים.',
      'הכשרות של סוכנים (שלבים, קורסים, ניתוחי ליווי) מנוהלות בכרטיס הסוכן ובעמוד "ניהול סוכנים".',
    ],
  },
  {
    title: 'קבצים',
    items: [
      'קובץ עד 25MB עולה מיד. תמונות גדולות מוקטנות אוטומטית.',
      'קובץ בין 25MB ל-50MB דורש אישור מנהל: נשלחת בקשה אוטומטית, וכשהיא מאושרת מופיעה הודעה ב"דחוף עכשיו" ואז מעלים אותו שוב.',
    ],
  },
  {
    title: 'למנהלים',
    adminOnly: true,
    items: [
      'ניהול סוכנים: סקירת צוות מול התקופה הקודמת, מי דורש תשומת לב, יעדים והכשרות. הלשונית "דוח להנהלה" מפיקה דוח להדפסה או PDF ומצגת לישיבה.',
      'הגדרות: רשימות (חברות, רובוטים, שלבי המשפך וסף ה"תקוע"), הליכים, ציוד, מידות שתל, מתכלים, בתי חולים, אנשי קשר, אישורי העלאה ובריאות המערכת.',
      'גיבוי: בהגדרות ← בריאות המערכת מוצג מצב הגיבוי. הורדת גיבוי אחת לשבוע ב"ניהול מערכת" ← גיבוי. בתוכנית החינמית אין גיבוי אוטומטי.',
      'בריאות המערכת: נפח מול המכסה, תקלות שהמשתמשים נתקלו בהן, ומתג להפעלת יצירת שאלות בבינה מלאכותית (עולה כסף, כבוי כברירת מחדל).',
    ],
  },
  {
    title: 'פרטיות ואבטחה',
    items: [
      'במערכת יש פרטי מטופלים (שם, ת״ז, טלפון): לא משתפים צילום מסך שלהם ולא מוציאים אותם מהמערכת בלי צורך.',
      'מכשיר שלא נגעו בו כמה שעות מתנתק לבד (נשאלים דקה לפני). להתנתקות ידנית: סמל היציאה בתפריט.',
      'כל שינוי נרשם ביומן הפעולות (מי שינה מה ומתי), והמנהל רואה אותו.',
    ],
  },
  {
    title: 'שאלות נפוצות',
    items: [
      'שכחתי סיסמה: במסך הכניסה "שכחתי סיסמה", או בקשה ממנהל.',
      'אין אינטרנט: אפשר להמשיך לעבוד. מה שנשמר מחכה ונשלח כשהחיבור חוזר.',
      'משהו נראה ישן: סמל הרענון בתפריט. שינויים של אחרים מתעדכנים לבד.',
      'מסך נתקע או מציג שגיאה: "נסה שוב" או "רענון". התקלה נרשמת אצלנו.',
      'משהו לא ברור או חסר: לפנות למנהל המערכת.',
    ],
  },
]

/** the guide of the system: short sections that open and close */
export default function Help() {
  const { isAdmin } = useAuth()
  const [q, setQ] = useState('')
  const words = normalizeHe(q).split(' ').filter(Boolean)
  const visible = TOPICS.filter((t) => !t.adminOnly || isAdmin)
    .map((t) => ({ ...t, items: words.length ? t.items.filter((x) => words.every((w) => normalizeHe(x + ' ' + t.title).includes(w))) : t.items }))
    .filter((t) => t.items.length > 0)
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-brand-800 sm:text-3xl">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#00326d] text-white">
            <LifeBuoy size={20} />
          </span>
          עזרה ומדריך
        </h1>
        <p className="mt-1 text-sm text-slate-600">מה עושים בכל מסך, ומה קל לפספס.</p>
      </div>
      <label className="relative block">
        <span className="sr-only">חיפוש במדריך</span>
        <Search size={18} aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="search" enterKeyHint="search" className="input !pr-10" placeholder="חיפוש במדריך, למשל: סיסמה, גיבוי, משימה…" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      {visible.length === 0 && <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">לא נמצא במדריך. נסה מילה אחרת, או פנה למנהל המערכת.</p>}
      {visible.map((t, i) => (
        <details key={t.title + (words.length ? '-q' : '')} className="card group px-4 py-1" open={words.length > 0 || i === 0}>
          <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-2 text-base font-semibold text-brand-800">
            {t.title}
            <ChevronDown size={18} aria-hidden className="shrink-0 transition group-open:rotate-180" />
          </summary>
          <ul className="mb-3 mt-1 list-disc space-y-2.5 pr-5 text-sm leading-relaxed text-slate-700">
            {t.items.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  )
}
