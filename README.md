# A.M.I. CRM – ניהול לקוחות רופאים

מערכת לניהול קשרי לקוחות מול רופאים: כרטיס רופא (העדפות קליניות, ציוד, בתי חולים),
עמוד פגישות עם מעקב, מפת בתי חולים, ודף בית אישי לכל סוכן עם "רופאים מועדפים".

## סטאק

- React + Vite + TypeScript + Tailwind (RTL / עברית)
- Supabase – Postgres, Auth (מייל+סיסמה), RLS
- מפה: react-leaflet + OpenStreetMap
- אירוח: Vercel

## הרצה מקומית

דרישה מוקדמת: Node.js 18+ (`winget install OpenJS.NodeJS.LTS`).

```bash
npm install
cp .env.example .env.local   # ומלא URL + anon key מ-Supabase
npm run dev
```

האתר יעלה ב-http://localhost:5173

## משתני סביבה

| משתנה | מקור |
|-------|------|
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → `anon` / publishable key |

## מסד נתונים

הסכימה והנתונים ההתחלתיים ב-`supabase/migrations/`. הם כבר הורצו על פרויקט
ה-Supabase של הפרויקט. להרצה מחדש על פרויקט אחר – הרץ את הקבצים לפי הסדר
ב-SQL Editor של Supabase.

**המשתמש הראשון שנרשם הופך אוטומטית ל-admin.** משתמשים נוספים נרשמים דרך מסך
ההתחברות ומקבלים תפקיד "סוכן"; מנהל יכול לשדרג אותם בהגדרות → משתמשים.

## פריסה ל-Vercel

1. חבר את הריפו ב-Vercel (Framework: Vite).
2. הגדר Environment Variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
3. Deploy. `vercel.json` כבר מגדיר rewrite ל-SPA.

## שלב שני (לא בגרסה זו)

- תזכורות מעקב במייל (Resend + Edge Function מתוזמנת)
- ייבוא נתונים מ-base44
- היסטוריית שינויים וקבצים מצורפים לפגישות
