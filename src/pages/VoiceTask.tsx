import { useState } from 'react'
import { Check, Copy, Mic, Plus, Trash2 } from 'lucide-react'
import { useMyTokens, useCreateToken, useRevokeToken } from '../lib/voiceTokens'
import { ConfirmButton, Field, Spinner } from '../components/ui'
import { formatDate } from '../lib/utils'

const FUNCTION_URL = 'https://ajgmbytiuidjeiaklxdc.supabase.co/functions/v1/voice-add-task'

function CopyBox({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <code dir="ltr" className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap text-xs text-slate-700">
        {value}
      </code>
      <button
        type="button"
        className="btn-ghost shrink-0 !px-2"
        onClick={() => {
          navigator.clipboard.writeText(value).catch(() => undefined)
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        }}
        aria-label="העתק"
      >
        {copied ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
      </button>
    </div>
  )
}

/** step-by-step instructions for building the Siri Shortcut, with the actual token baked in once one was just created */
function Instructions({ token }: { token?: string }) {
  return (
    <div className="space-y-3 text-sm leading-relaxed text-slate-700">
      <p>באייפון, פתח את אפליקציית <strong>קיצורי דרך</strong> (Shortcuts) ← הקיצורים שלי ← + (קיצור חדש):</p>
      <ol className="list-decimal space-y-2 pr-5">
        <li>
          הוסף פעולה <strong>"הכתב טקסט"</strong> (Dictate Text) — זה מה שיקליט את מה שתגיד.
        </li>
        <li>
          הוסף פעולה <strong>"קבל תוכן של כתובת אתר"</strong> (Get Contents of URL):
          <ul className="mt-1 list-disc space-y-1 pr-5 text-xs text-slate-600">
            <li>
              URL: <code dir="ltr">{FUNCTION_URL}</code>
            </li>
            <li>שיטה (Method): POST</li>
            <li>
              כותרות (Headers): <code dir="ltr">Authorization</code> = <code dir="ltr">Bearer {token ?? '<הטוקן שלך>'}</code>
            </li>
            <li>
              גוף הבקשה (Request Body): JSON, שדה בשם <code dir="ltr">text</code> עם הערך של "הכתב טקסט" מהשלב הקודם
            </li>
          </ul>
        </li>
        <li>
          הוסף פעולה <strong>"הצג תוצאה"</strong> (Show Result) כדי לשמוע אישור.
        </li>
        <li>
          תן לקיצור שם כמו <strong>"הוסף משימה"</strong>, ולחץ על אייקון הקיצור ← הוסף ל-Siri, והקלט ביטוי כמו "הוסף משימה".
        </li>
      </ol>
      <p className="text-xs text-slate-500">
        מעכשיו: "<strong>היי סירי, הוסף משימה</strong>" ← תגיד את המשימה ← היא תיווצר במערכת עם תאריך היום, בלי לגעת בטלפון.
      </p>
    </div>
  )
}

export default function VoiceTask() {
  const tokens = useMyTokens()
  const create = useCreateToken()
  const revoke = useRevokeToken()
  const [label, setLabel] = useState('')
  const [justCreated, setJustCreated] = useState<string | null>(null)
  const [error, setError] = useState('')

  function submit() {
    setError('')
    create.mutate(label.trim() || 'המכשיר שלי', {
      onSuccess: (token) => {
        setJustCreated(token)
        setLabel('')
      },
      onError: () => setError('היצירה נכשלה'),
    })
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-brand-800 sm:text-3xl">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#00326d] text-white">
            <Mic size={20} aria-hidden />
          </span>
          הוספת משימה בקול
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          לדוגמה: אתה ברכב ורוצה להוסיף משימה בלי לגעת בטלפון. זה עובד דרך Siri (באייפון) — לא אפשרי לבנות "האזנה תמידית" בתוך דפדפן, אז הדרך
          האמינה היא ליצור כאן טוקן אישי, ולחבר אותו לקיצור Siri במכשיר שלך (פעם אחת, כמה דקות).
        </p>
        <p className="mt-1 text-sm text-slate-600">
          מה שתגיד מנותח בדיוק כמו בהוספה המהירה במסך המשימות: תאריך, דחיפות, רופא ובית חולים מזוהים אוטומטית מתוך המשפט — למשל "לשלוח הצעה
          לד״ר כהן בשיבא עד מחר, דחוף".
        </p>
      </div>

      {justCreated && (
        <div className="card space-y-3 border-2 border-emerald-300 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-800">הטוקן נוצר — זו הפעם היחידה שהוא יוצג. העתק אותו עכשיו.</p>
          <CopyBox value={justCreated} />
          <Instructions token={justCreated} />
          <button type="button" className="btn-secondary" onClick={() => setJustCreated(null)}>
            סיימתי, סגור
          </button>
        </div>
      )}

      {!justCreated && (
        <div className="card space-y-3 p-4">
          <Field label="שם למכשיר (כדי שתזהה אותו ברשימה)">
            <input className="input" dir="auto" placeholder="לדוגמה: אייפון שלי" value={label} onChange={(e) => setLabel(e.target.value)} />
          </Field>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <button type="button" className="btn-primary" disabled={create.isPending} onClick={submit}>
            <Plus size={16} /> {create.isPending ? 'יוצר…' : 'יצירת טוקן חדש'}
          </button>
        </div>
      )}

      <div className="card p-4">
        <h2 className="mb-2 text-base font-semibold text-slate-800">המכשירים שלי</h2>
        {tokens.isLoading ? (
          <Spinner />
        ) : (tokens.data ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">עדיין לא יצרת טוקן.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {(tokens.data ?? []).map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-slate-800">{t.label || 'ללא שם'}</p>
                  <p className="text-xs text-slate-500">
                    נוצר {formatDate(t.created_at)}
                    {t.last_used_at ? ` · שימוש אחרון ${formatDate(t.last_used_at)}` : ' · טרם נעשה בו שימוש'}
                  </p>
                </div>
                <ConfirmButton className="btn-ghost !px-2 text-slate-400 hover:text-red-500" message={`לבטל את הטוקן "${t.label || 'ללא שם'}"? הקיצור שמשתמש בו יפסיק לעבוד.`} onConfirm={() => revoke.mutate(t.id)}>
                  <Trash2 size={15} />
                </ConfirmButton>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!justCreated && (
        <div className="card p-4">
          <h2 className="mb-2 text-base font-semibold text-slate-800">איך מגדירים את הקיצור</h2>
          <Instructions />
        </div>
      )}
    </div>
  )
}
