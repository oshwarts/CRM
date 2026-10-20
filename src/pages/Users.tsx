import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, Search, ShieldCheck, UserX } from 'lucide-react'
import { useAllUsers, useUpdateUser, useUserActivity } from '../lib/api'
import { useAuth } from '../context/AuthProvider'
import { EmptyState, ErrorState, Spinner, Tab, TabList, TabPanel, Tabs } from '../components/ui'
import { AuditLog } from '../components/AuditLog'
import { BackupPanel } from '../components/BackupPanel'
import { DataQuality } from '../components/DataQuality'
import { ResetLinkButton } from '../components/ResetLinkButton'
import { normalizeHe } from '../lib/contactMatch'
import { classNames, formatDate } from '../lib/utils'
import type { Profile } from '../lib/types'

/** admin-only: users, activity log and backup */
export default function Users() {
  const { isAdmin } = useAuth()
  const [params] = useSearchParams()
  const [tab, setTab] = useState(params.get('tab') ?? 'users')
  if (!isAdmin) return <EmptyState title="אין הרשאה" hint="מסך הניהול זמין למנהלים בלבד" />
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-brand-800 sm:text-3xl">ניהול מערכת</h1>
      <Tabs value={tab} onChange={setTab}>
        <TabList>
          <Tab id="users">משתמשים</Tab>
          <Tab id="audit">יומן פעולות</Tab>
          <Tab id="quality">איכות נתונים</Tab>
          <Tab id="backup">גיבוי</Tab>
        </TabList>
        <TabPanel id="users">
          <UsersTab />
        </TabPanel>
        <TabPanel id="audit">
          <AuditLog />
        </TabPanel>
        <TabPanel id="quality">
          <DataQuality />
        </TabPanel>
        <TabPanel id="backup">
          <BackupPanel />
        </TabPanel>
      </Tabs>
    </div>
  )
}

/** approve new sign-ups, change roles, deactivate accounts */
function UsersTab() {
  const { isAdmin, user, isDeveloper } = useAuth()
  const users = useAllUsers()
  const activity = useUserActivity()
  const update = useUpdateUser()
  const [q, setQ] = useState('')
  const [error, setError] = useState('')

  const words = normalizeHe(q).split(' ').filter(Boolean)
  const list = useMemo(
    () =>
      (users.data ?? []).filter((u) => {
        if (!words.length) return true
        const hay = normalizeHe(`${u.full_name} ${u.email}`)
        return words.every((w) => hay.includes(w))
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [users.data, q],
  )

  if (!isAdmin) {
    return <EmptyState title="אין הרשאה" hint="מסך ניהול המשתמשים זמין למנהלים בלבד" />
  }
  if (users.isLoading) return <Spinner />
  if (users.error && !users.data) return <ErrorState error={users.error} /> // cached data stays visible when only a background refresh failed

  const inactive = list.filter((u) => !u.active)
  const active = list.filter((u) => u.active)
  const all = users.data ?? []
  const admins = all.filter((u) => u.active && u.role === 'admin').length
  const waiting = all.filter((u) => !u.active && !u.status_changed_at).length

  function change(u: Profile, patch: { role?: string; active?: boolean; is_content_editor?: boolean }) {
    setError('')
    update.mutate(
      { id: u.id, ...patch },
      { onError: (e) => setError(translate(e instanceof Error ? e.message : '')) },
    )
  }

  const lastSeen = (id: string) => {
    const v = activity.data?.get(id)
    return v ? formatDate(v.slice(0, 10)) : '—'
  }

  return (
    <div className="space-y-4">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Stat label="משתמשים פעילים" value={all.filter((u) => u.active).length} />
        <Stat label="מנהלים" value={admins} />
        <Stat label="ממתינים לאישור" value={waiting} warn />
      </div>

      <label className="relative block">
        <Search size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          className="input !pr-10"
          placeholder="חיפוש לפי שם או אימייל…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </label>

      {inactive.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-brand-800">
            ממתינים לאישור / מושבתים <span className="text-sm font-normal text-slate-400">{inactive.length}</span>
          </h2>
          <ul className="space-y-2">
            {inactive.map((u) => (
              <li key={u.id} className="card flex flex-wrap items-center justify-between gap-2 border-amber-200 bg-amber-50/40 p-3">
                <Who u={u} sub={u.status_changed_at ? 'חשבון מושבת' : `נרשם ${formatDate(u.created_at.slice(0, 10))}`} />
                <button className="btn-primary" onClick={() => change(u, { active: true })} disabled={update.isPending}>
                  <Check size={16} />
                  {u.status_changed_at ? 'הפעל מחדש' : 'אשר גישה'}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-brand-800">
          משתמשים פעילים <span className="text-sm font-normal text-slate-400">{active.length}</span>
        </h2>
        {active.length === 0 ? (
          <EmptyState title="לא נמצאו משתמשים" />
        ) : (
          <ul className="space-y-2">
            {active.map((u) => {
              const me = u.id === user?.id
              return (
                <li key={u.id} className="card flex flex-wrap items-center justify-between gap-3 p-3">
                  <Who u={u} me={me} sub={`נרשם ${formatDate(u.created_at.slice(0, 10))} · כניסה אחרונה ${lastSeen(u.id)}`} />
                  <div className="flex flex-wrap items-center gap-2">
                    {u.role === "agent" && (
                      <label className="flex items-center gap-1.5 text-xs text-slate-600" title="עורך תוכן יכול להוסיף ולערוך שיעורים, שאלות ומקרים בלומדה. מה שהוא כותב מתפרסם אחרי אישור מנהל.">
                        <input type="checkbox" checked={u.is_content_editor} disabled={update.isPending} onChange={(e) => change(u, { is_content_editor: e.target.checked })} />
                        עורך תוכן
                      </label>
                    )}
                    {!me && !u.is_developer && (u.role !== 'admin' || isDeveloper) && <ResetLinkButton user={u} />}
                    <select
                      className="input !w-auto"
                      aria-label={`הרשאה של ${u.full_name || u.email}`}
                      value={u.role}
                      disabled={me || update.isPending}
                      title={me ? 'לא ניתן לשנות את ההרשאה של עצמך' : undefined}
                      onChange={(e) => change(u, { role: e.target.value })}
                    >
                      <option value="agent">סוכן</option>
                      <option value="admin">מנהל</option>
                    </select>
                    <button
                      className={classNames('btn-secondary', !me && 'text-red-600')}
                      disabled={me || update.isPending}
                      title={me ? 'לא ניתן להשבית את עצמך' : undefined}
                      onClick={() => {
                        if (confirm(`להשבית את ${u.full_name || u.email}? המשתמש לא יוכל לגשת לנתונים.`)) change(u, { active: false })
                      }}
                    >
                      <UserX size={16} />
                      השבתה
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <p className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
        <ShieldCheck size={14} className="mt-0.5 shrink-0" />
        משתמש חדש שנרשם במסך ההתחברות לא רואה שום נתון עד שמנהל מאשר אותו. משתמש מושבת נחסם ברמת בסיס הנתונים. מחיקה מלאה של משתמש מתבצעת בלוח הבקרה של Supabase.
      </p>
    </div>
  )
}

function Who({ u, sub, me }: { u: Profile; sub: string; me?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-sm font-semibold text-slate-800">
        {u.full_name || '—'}
        {me && <span className="mr-2 text-xs font-normal text-brand-600">(אתה)</span>}
      </p>
      <p dir="ltr" className="text-right text-xs text-slate-500">
        {u.email}
      </p>
      <p className="text-xs text-slate-400">{sub}</p>
    </div>
  )
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className={classNames('card p-2.5 sm:p-3', warn && value > 0 && 'border-amber-300 bg-amber-50')}>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      <p className="text-[11px] leading-tight text-slate-500 sm:text-xs">{label}</p>
    </div>
  )
}

function translate(msg: string) {
  if (msg.includes('last active admin')) return 'לא ניתן להסיר את המנהל הפעיל האחרון — מנה קודם מנהל נוסף.'
  if (msg.includes('only admins')) return 'רק מנהל יכול לבצע פעולה זו.'
  return msg || 'הפעולה נכשלה'
}
