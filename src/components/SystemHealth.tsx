import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Activity, AlertTriangle, CheckCircle2, DatabaseBackup, Sparkles, Trash2 } from 'lucide-react'
import { useAppSetting, useSaveAppSetting } from '../lib/api'
import { supabase } from '../lib/supabase'
import { toast } from '../lib/toast'
import { classNames, formatDate } from '../lib/utils'
import { Spinner } from './ui'

const db = supabase as unknown as SupabaseClient

type Health = {
  db_bytes: number
  storage: { bucket: string; files: number; bytes: number }[]
  tables: { name: string; rows: number; bytes: number }[]
  users: { total: number; active: number }
  audit: { rows: number; oldest: string | null }
  errors_24h: number
  errors_7d: number
}
type ClientError = { id: number; at: string; message: string; url: string; app_version: string; user: { full_name: string } | null }

// the limits of the free plan of Supabase
const DB_LIMIT = 500 * 1024 * 1024
const STORAGE_LIMIT = 1024 * 1024 * 1024
const mb = (n: number) => (n >= 1024 * 1024 * 100 ? `${(n / 1024 / 1024).toFixed(0)}MB` : `${(n / 1024 / 1024).toFixed(1)}MB`)

function Meter({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = Math.min(100, (used / limit) * 100)
  return (
    <div className="card p-4">
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="text-xs text-slate-500">
          {mb(used)} מתוך {mb(limit)}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div className={classNames('h-full rounded-full', pct > 85 ? 'bg-red-500' : pct > 60 ? 'bg-amber-500' : 'bg-emerald-500')} style={{ width: `${Math.max(1, pct)}%` }} />
      </div>
      <p className="mt-1 text-xs text-slate-500">{pct < 1 ? 'פחות מ-1%' : `${pct.toFixed(1)}%`} מהמכסה בתוכנית החינמית</p>
    </div>
  )
}

/** managers: how the system is doing — the room left, the errors people hit, the last backup, and the switch of the paid AI question generator */
export function SystemHealth() {
  const qc = useQueryClient()
  const health = useQuery({ queryKey: ['system-health'], queryFn: async () => {
    const { data, error } = await db.rpc('system_health')
    if (error) throw error
    return data as Health
  }, staleTime: 60_000 })
  const errors = useQuery({ queryKey: ['client-errors'], queryFn: async () => {
    const { data, error } = await db.from('client_errors').select('id, at, message, url, app_version, user:profiles!user_id(full_name)').order('at', { ascending: false }).limit(20)
    if (error) throw error
    return (data ?? []) as unknown as ClientError[]
  } })
  const clear = useMutation({
    mutationFn: async () => {
      const { error } = await db.from('client_errors').delete().gte('id', 0)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['client-errors'] })
      void qc.invalidateQueries({ queryKey: ['system-health'] })
    },
  })
  const backup = useAppSetting('backup.last')
  const ai = useAppSetting('ai.enabled')
  const save = useSaveAppSetting()

  if (health.isLoading) return <Spinner />
  if (health.error || !health.data) return <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">לא ניתן לקרוא את מצב המערכת: {health.error instanceof Error ? health.error.message : ''}</p>
  const h = health.data
  const storage = h.storage.reduce((n, b) => n + b.bytes, 0)
  const files = h.storage.reduce((n, b) => n + b.files, 0)
  const lastBackup = backup.data ? backup.data.slice(0, 10) : ''
  const backupDays = lastBackup ? Math.round((Date.now() - new Date(`${lastBackup}T12:00:00`).getTime()) / 86_400_000) : null
  const backupOld = backupDays === null || backupDays > 7
  const aiOn = ai.data === '1'

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <Meter label="מסד הנתונים" used={h.db_bytes} limit={DB_LIMIT} />
        <Meter label={`אחסון קבצים (${files} קבצים)`} used={storage} limit={STORAGE_LIMIT} />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <section className={classNames('card p-4', backupOld && 'border-amber-300 bg-amber-50')}>
          <h2 className="mb-1 flex items-center gap-2 text-base font-semibold text-slate-800">
            <DatabaseBackup size={16} aria-hidden /> גיבוי
          </h2>
          <p className={classNames('text-sm', backupOld ? 'font-medium text-amber-800' : 'text-slate-600')}>
            {lastBackup ? `הגיבוי האחרון: ${formatDate(lastBackup)} (לפני ${backupDays} ימים)` : 'עוד לא נעשה גיבוי'}
          </p>
          <p className="mt-1 text-xs text-slate-500">בתוכנית החינמית אין גיבוי אוטומטי: מומלץ להוריד גיבוי אחת לשבוע.</p>
          <Link to="/users?tab=backup" className="mt-2 inline-block text-sm font-medium text-brand-600 underline">
            להורדת גיבוי ←
          </Link>
        </section>
        <section className="card p-4">
          <h2 className="mb-1 flex items-center gap-2 text-base font-semibold text-slate-800">
            <Activity size={16} aria-hidden /> משתמשים ויומן שינויים
          </h2>
          <p className="text-sm text-slate-600">
            {h.users.active} משתמשים פעילים מתוך {h.users.total}
          </p>
          <p className="text-sm text-slate-600">
            {h.audit.rows} שורות ביומן השינויים{h.audit.oldest ? `, הישנה ${formatDate(h.audit.oldest.slice(0, 10))}` : ''}
          </p>
          <p className="mt-1 text-xs text-slate-500">שורות מעל 12 חודשים נמחקות אוטומטית כל לילה.</p>
        </section>
        <section className="card p-4">
          <h2 className="mb-1 flex items-center gap-2 text-base font-semibold text-slate-800">
            <Sparkles size={16} aria-hidden /> שאלות בבינה מלאכותית
          </h2>
          <p className="text-sm text-slate-600">{aiOn ? 'פועל — כל יצירת שאלות עולה כסף.' : 'כבוי — חוסך עלויות.'}</p>
          <button
            type="button"
            className={classNames('mt-2', aiOn ? 'btn-secondary' : 'btn-primary')}
            disabled={save.isPending}
            onClick={() => save.mutate({ key: 'ai.enabled', value: aiOn ? '0' : '1' }, { onSuccess: () => toast(aiOn ? 'יצירת שאלות בבינה מלאכותית כובתה' : 'יצירת שאלות בבינה מלאכותית הופעלה') })}
          >
            {aiOn ? 'כבה' : 'הפעל'}
          </button>
        </section>
      </div>

      <section className="card p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-800">
            {h.errors_7d === 0 ? <CheckCircle2 size={16} className="text-emerald-600" /> : <AlertTriangle size={16} className="text-amber-600" />}
            תקלות שהמשתמשים נתקלו בהן
          </h2>
          <span className="text-xs text-slate-500">
            24 שעות: {h.errors_24h} · 7 ימים: {h.errors_7d}
          </span>
        </div>
        {(errors.data ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">לא נרשמו תקלות.</p>
        ) : (
          <>
            <ul className="divide-y divide-slate-100 text-sm">
              {(errors.data ?? []).map((e) => (
                <li key={e.id} className="py-1.5">
                  <p dir="auto" className="text-slate-800 [overflow-wrap:anywhere]">
                    {e.message}
                  </p>
                  <p className="text-xs text-slate-500 [overflow-wrap:anywhere]">
                    {formatDate(e.at.slice(0, 10))} · {e.url}
                    {e.user?.full_name ? ` · ${e.user.full_name}` : ''}
                    {e.app_version ? ` · ${e.app_version.slice(0, 4)}` : ''}
                  </p>
                </li>
              ))}
            </ul>
            <button type="button" className="btn-ghost mt-2 text-red-600" onClick={() => window.confirm('למחוק את כל התקלות שנרשמו?') && clear.mutate()}>
              <Trash2 size={14} /> נקה
            </button>
          </>
        )}
        <p className="mt-2 text-xs text-slate-500">תקלות נמחקות אוטומטית אחרי 90 יום. הכשל בחיבור לרשת אינו נרשם.</p>
      </section>

      <section className="card p-4">
        <h2 className="mb-2 text-base font-semibold text-slate-800">הטבלאות הגדולות</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-right text-xs text-slate-500">
              <th className="py-1.5 font-medium">טבלה</th>
              <th className="py-1.5 text-center font-medium">שורות</th>
              <th className="py-1.5 text-center font-medium">גודל</th>
            </tr>
          </thead>
          <tbody>
            {h.tables.map((t) => (
              <tr key={t.name} className="border-b border-slate-100">
                <td className="py-1 text-slate-700" dir="ltr">
                  {t.name}
                </td>
                <td className="py-1 text-center">{t.rows}</td>
                <td className="py-1 text-center text-xs text-slate-500">{mb(t.bytes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
