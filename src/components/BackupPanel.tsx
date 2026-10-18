import { useState } from 'react'
import { DatabaseBackup, Download } from 'lucide-react'
import { exportBackup, useSaveAppSetting } from '../lib/api'

/** admin: download every table of the system as one JSON file (a manual backup kept outside the system) */
export function BackupPanel() {
  const [busy, setBusy] = useState('')
  const [done, setDone] = useState('')
  const [error, setError] = useState('')
  const saveSetting = useSaveAppSetting()

  async function run() {
    setError('')
    setDone('')
    try {
      const data = await exportBackup((t) => setBusy(`מייצא: ${t}…`))
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ami-crm-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      // the date of the last backup is kept so that the managers are reminded when it gets old
      saveSetting.mutate({ key: 'backup.last', value: new Date().toISOString() })
      const rows = Object.values(data.tables).reduce((n, t) => n + t.length, 0)
      setDone(`הגיבוי ירד למחשב (${rows} רשומות ב-${Object.keys(data.tables).length} טבלאות).`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'הייצוא נכשל')
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-3 p-5">
        <h3 className="flex items-center gap-2 font-semibold text-slate-800">
          <DatabaseBackup size={18} className="text-brand-500" />
          גיבוי נתונים ידני
        </h3>
        <p className="text-sm text-slate-500">
          מוריד קובץ אחד עם כל נתוני המערכת (רופאים, בתי חולים, פגישות, משימות, סריקות, ספירות ועוד). מומלץ להוריד אחת לשבוע
          ולשמור במקום מאובטח של החברה. הקובץ כולל פרטי מטופלים — יש לטפל בו בהתאם.
        </p>
        <button className="btn-primary" onClick={run} disabled={!!busy}>
          <Download size={16} />
          {busy || 'הורדת גיבוי'}
        </button>
        {done && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{done}</p>}
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <p className="text-xs text-slate-400">הקבצים שהועלו לספריית "מידע קליני" אינם נכללים (נשמרים בנפרד באחסון), רק הרשימה שלהם.</p>
      </div>

      <div className="card space-y-2 p-5 text-sm text-slate-600">
        <h3 className="font-semibold text-slate-800">גיבוי אוטומטי ויציבות (בצד השרת)</h3>
        <ul className="list-disc space-y-1 pr-5">
          <li>בלוח הבקרה של Supabase (Settings ← Billing) יש לוודא תכנית <b>Pro</b>: גיבוי יומי אוטומטי, והמסד לא נעצר אחרי חוסר פעילות.</li>
          <li>למידע רגיש מומלץ להוסיף Point-in-Time Recovery (שחזור לכל דקה) — תוספת בתשלום באותה תכנית.</li>
          <li>בדף Database ← Backups ניתן לראות את הגיבויים ולשחזר.</li>
        </ul>
      </div>
    </div>
  )
}
