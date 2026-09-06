import { useState } from 'react'
import { useUpdateMyProfile } from '../lib/api'
import { useAuth } from '../context/AuthProvider'
import { Field, Modal } from './ui'

export function ProfileModal({ onClose }: { onClose: () => void }) {
  const { profile, refreshProfile } = useAuth()
  const update = useUpdateMyProfile()
  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setError(null)
    try {
      await update.mutateAsync(fullName.trim())
      await refreshProfile()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שמירה נכשלה')
    }
  }

  return (
    <Modal open onClose={onClose} title="הפרופיל שלי" size="md">
      <div className="space-y-3">
        <Field label="שם מלא">
          <input
            className="input"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoFocus
          />
        </Field>
        <Field label="אימייל">
          <input
            className="input bg-slate-50 text-slate-400"
            dir="ltr"
            value={profile?.email ?? ''}
            disabled
          />
        </Field>
        <Field label="תפקיד במערכת">
          <input
            className="input bg-slate-50 text-slate-400"
            value={profile?.role === 'admin' ? 'מנהל' : 'סוכן'}
            disabled
          />
        </Field>
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="mt-5 flex justify-end gap-2 border-t border-slate-200 pt-4">
        <button className="btn-secondary" onClick={onClose}>
          ביטול
        </button>
        <button className="btn-primary" onClick={save} disabled={update.isPending}>
          שמירה
        </button>
      </div>
    </Modal>
  )
}
