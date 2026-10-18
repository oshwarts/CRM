# AMI JR CRM – מערכת ניהול לקוחות, רופאים ובתי חולים

מערכת לסוכנים ולמנהלים של A.M.I. Medical Technologies: רופאים (ומשפך הרופאים הפוטנציאליים), בתי חולים, פגישות, משימות,
סריקות MAKO וניתוחים, לוז שבועי, מתכלים, מתחרים, פרויקטים, הכשרות ולומדה, וניהול צוות עם דוח להנהלה.
ממשק בעברית (RTL), עובד בטלפון ובמחשב, ואפשר להתקין אותו כאפליקציה (PWA) ולעבוד גם בלי חיבור.

> מדריך למשתמשים: בתוך המערכת, "עזרה ומדריך" בתפריט. תפעול ותקלות: [docs/OPERATIONS.md](docs/OPERATIONS.md).

## סטאק

- React 18 + Vite + TypeScript (strict) + Tailwind (RTL, מצב כהה)
- TanStack Query עם מטמון שנשמר במכשיר (IndexedDB) ותור שינויים לעבודה בלי חיבור
- Supabase: Postgres + Auth + Storage + Realtime + Edge Functions, עם RLS על כל הטבלאות
- אירוח: Vercel (`vercel.json`: כותרות אבטחה ו-CSP)

## הרצה מקומית

דרישה מוקדמת: Node.js 20+.

```bash
npm install
cp .env.example .env.local   # ומלא VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
npm run dev                  # http://localhost:5173
```

| פקודה | מה היא עושה |
|-------|-------------|
| `npm run dev` | שרת פיתוח |
| `npm test` | בדיקות יחידה של הלוגיקה (תאריכים, משפך, התאמות, פענוח טקסט, כותרות אבטחה) |
| `npm run lint` | ESLint |
| `npm run build` | בדיקת טיפוסים ובנייה |
| `npm run check` | הכול יחד (כמו ב-CI) |

ב-GitHub Actions (`.github/workflows/ci.yml`) רצים lint, בדיקות ובנייה על כל push ו-PR.

## מבנה

```
src/
  pages/        מסך לכל נתיב (נטענים לפי דרישה)
  components/   רכיבים משותפים; components/team = סקירת צוות, דוח הנהלה ומצגת
  lib/          לוגיקה: api.ts (גישה לנתונים), *Stats.ts (חישובים טהורים ובדוקים), outbox.ts (עבודה בלי חיבור),
                liveUpdates.ts (עדכון חי), safeSave.ts (שמירה בלי דריסה), largeFiles.ts (קבצים גדולים)
  __tests__/    בדיקות
supabase/
  migrations/   הסכימה, לפי הסדר (001…)
  functions/    Edge Functions (admin-reset-link, generate-questions)
  tests/        smoke.sql – בדיקות הרשאות ונתיבי כתיבה מול המסד
api/            פונקציית שרת אחת (קריאת קבצי הפניה), מאומתת מול Supabase
docs/           תפעול ותקלות
```

## עקרונות שכדאי להכיר

- **הרשאות בצד השרת**: כל טבלה עם RLS. `effective_uid()` הוא המשתמש הפועל (כולל מצב מפתח); עמודות בעלות חדשות מקבלות אותו כברירת מחדל.
- **יומן שינויים**: טריגר `audit_row()` רושם כל שינוי; נמחק אחרי 12 חודשים.
- **שמירה**: טפסים כותבים רק שדות ששונו (`safeSave.ts`), ושינוי אחר באותו שדה מצריך אישור לדריסה. כתיבה בלי חיבור נכנסת לתור (`outbox.ts`).
- **קבצים**: כל העלאה עוברת ב-`infoStorage()`; מעל 25MB נדרש אישור מנהל (מיגרציה 068).
- **משתני סביבה בצד הלקוח הם ציבוריים** (`anon key`): האבטחה נשענת על RLS, לא על הסתרת המפתח.

## מסד נתונים ופריסה

מיגרציות ב-`supabase/migrations/` (מורצות לפי הסדר, `apply_migration` או SQL Editor). המשתמש הראשון שנרשם הופך ל-admin.
פריסה: חיבור הריפו ל-Vercel (Framework: Vite) והגדרת `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
