import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { copyText } from '../lib/scanExport'
import { Modal } from './ui'
import type { Profile } from '../lib/types'

/** managers: creates a one-time link with which the user chooses a new password (nobody sees the password) */
export function ResetLinkButton({ user }: { user: Profile }) {
  const [busy, setBusy] = useState(false)
  const [link, setLink] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  async function create() {
    if (!window.confirm(`ליצור קישור לאיפוס סיסמה עבור ${user.full_name || user.email}? מי שיקבל את הקישור יוכל להגדיר סיסמה חדשה לחשבון. הפעולה נרשמת ביומן.`)) return
    setBusy(true)
    setError('')
    const { data, error: err } = await supabase.functions.invoke('admin-reset-link', { body: { user_id: user.id, origin: window.location.origin } })
    setBusy(false)
    if (err || !data?.link) {
      setError(data?.error ?? err?.message ?? 'יצירת הקישור נכשלה')
      return
    }
    setLink(data.link as string)
  }

  return (
    <>
      <button className="btn-secondary" disabled={busy} onClick={create} title="קישור חד-פעמי להגדרת סיסמה חדשה">
        <KeyRound size={16} />
        איפוס סיסמה
      </button>
      {error && <span className="basis-full text-xs text-red-600">{error}</span>}
      {link && (
        <Modal open onClose={() => setLink(null)} title={`קישור לאיפוס סיסמה — ${user.full_name || user.email}`} size="md">
          <div className="space-y-3 text-sm">
            <p className="text-slate-600">
              שלח את הקישור למשתמש בהודעה פרטית (וואטסאפ, מייל). הוא פותח את המערכת ומבקש לבחור סיסמה חדשה. הקישור חד-פעמי ותקף לזמן מוגבל, ומי שמחזיק בו יכול להיכנס לחשבון — אל תפרסם אותו.
            </p>
            <textarea className="input min-h-24 font-mono text-xs" dir="ltr" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
            <div className="flex justify-end gap-2">
              <button
                className="btn-primary"
                onClick={async () => {
                  setCopied(await copyText(link))
                }}
              >
                {copied ? 'הועתק ✓' : 'העתק קישור'}
              </button>
              <button className="btn-secondary" onClick={() => setLink(null)}>
                סגור
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
