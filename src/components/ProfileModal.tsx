import { useRef, useState } from 'react'
import { useUpdateMyProfile } from '../lib/api'
import { useAuth } from '../context/AuthProvider'
import { Field, Modal } from './ui'

export function ProfileModal({ onClose }: { onClose: () => void }) {
  const { profile, refreshProfile } = useAuth()
  const update = useUpdateMyProfile()
  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [error, setError] = useState<string | null>(null)
  const [nameError, setNameError] = useState('')
  const saving = useRef(false)

  async function save() {
    if (saving.current) return // a second tap in the same instant
    setError(null)
    const name = fullName.trim()
    if (!name) {
      setNameError('נא למלא שם')
      return
    }
    saving.current = true
    try {
      await update.mutateAsync(name)
      await refreshProfile()
      onClose()
    } catch (err) {
      const msg = typeof err === 'object' && err && 'message' in err ? String((err as { message: unknown }).message) : ''
      setError(msg ? `שמירה נכשלה: ${msg}` : 'שמירה נכשלה')
    } finally {
      saving.current = false
    }
  }

  return (
    <Modal open onClose={onClose} title="הפרופיל שלי" size="md">
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <div className="space-y-3">
          <Field label="שם מלא" error={nameError}>
            <input
              className="input"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value)
                setNameError('')
              }}
              autoFocus
              autoComplete="name"
              maxLength={80}
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
          <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2 border-t border-slate-200 pt-4">
          <button type="button" className="btn-secondary" onClick={onClose}>
            ביטול
          </button>
          <button type="submit" className="btn-primary" disabled={update.isPending}>
            שמירה
          </button>
        </div>
      </form>
    </Modal>
  )
}
