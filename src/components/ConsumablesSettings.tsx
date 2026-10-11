import { useEffect, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import {
  useAppSetting,
  useConsumableItems,
  useDeleteConsumableItem,
  useSaveAppSetting,
  useUpsertConsumableItem,
} from '../lib/api'
import { useAuth } from '../context/AuthProvider'
import { ConfirmButton, Spinner } from './ui'
import { CONSUMABLES_EMAIL_KEY } from '../lib/consumables'
import type { ConsumableItem } from '../lib/types'

type Draft = { id?: string; category: string; catalog_number: string; name: string; default_min: string }
const EMPTY: Draft = { category: '', catalog_number: '', name: '', default_min: '0' }

export function ConsumablesSettings() {
  const { isAdmin } = useAuth()
  const items = useConsumableItems()
  const upsert = useUpsertConsumableItem()
  const del = useDeleteConsumableItem()
  const email = useAppSetting(CONSUMABLES_EMAIL_KEY)
  const saveSetting = useSaveAppSetting()

  const [mail, setMail] = useState('')
  const [saved, setSaved] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState('')

  useEffect(() => setMail(email.data ?? ''), [email.data])

  const categories = [...new Set((items.data ?? []).map((i) => i.category).filter(Boolean))]

  async function saveMail() {
    await saveSetting.mutateAsync({ key: CONSUMABLES_EMAIL_KEY, value: mail.trim() })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function saveItem() {
    if (!draft) return
    if (!draft.name.trim()) return setError('הזן תיאור פריט')
    setError('')
    try {
      await upsert.mutateAsync({
        id: draft.id,
        category: draft.category.trim(),
        catalog_number: draft.catalog_number.trim(),
        name: draft.name.trim(),
        default_min: Math.max(0, Math.round(Number(draft.default_min) || 0)),
        ...(draft.id ? {} : { sort: Math.max(0, ...(items.data ?? []).map((i) => i.sort)) + 1 }),
      })
      setDraft(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שמירה נכשלה')
    }
  }

  const edit = (i: ConsumableItem) =>
    setDraft({
      id: i.id,
      category: i.category,
      catalog_number: i.catalog_number,
      name: i.name,
      default_min: String(i.default_min),
    })

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <h3 className="mb-1 font-semibold text-slate-800">כתובת מייל לרשימת חוסרים</h3>
        <p className="mb-3 text-sm text-slate-400">
          הכפתור "שלח חוסרים במייל" בעמוד המתכלים פותח טיוטה לכתובת הזו.
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            type="email"
            dir="ltr"
            className="input max-w-sm text-right"
            placeholder="warehouse@company.co.il"
            value={mail}
            disabled={!isAdmin}
            onChange={(e) => setMail(e.target.value)}
          />
          <button className="btn-primary" onClick={saveMail} disabled={!isAdmin || saveSetting.isPending}>
            {saved ? 'נשמר ✓' : 'שמירה'}
          </button>
        </div>
        {!isAdmin && <p className="mt-2 text-xs text-amber-600">רק מנהל יכול לשנות את הכתובת.</p>}
      </div>

      <div className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-800">פריטי מתכלים</h3>
            <p className="text-sm text-slate-400">
              המינימום כאן הוא ברירת המחדל; בעמוד המתכלים אפשר להתאים אותו לכל בית חולים.
            </p>
          </div>
          <button className="btn-secondary" onClick={() => setDraft({ ...EMPTY })}>
            <Plus size={16} />
            פריט חדש
          </button>
        </div>

        {draft && (
          <div className="mb-4 space-y-3 rounded-xl border border-brand-200 bg-brand-50/40 p-3">
            <div className="grid gap-3 sm:grid-cols-4">
              <label className="block">
                <span className="label">קבוצה</span>
                <input className="input" list="consumable-cats" value={draft.category}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })} placeholder="KNEE / UNI / HIP…" />
                <datalist id="consumable-cats">
                  {categories.map((c) => <option key={c} value={c} />)}
                </datalist>
              </label>
              <label className="block">
                <span className="label">מק״ט</span>
                <input dir="ltr" className="input text-right" value={draft.catalog_number}
                  onChange={(e) => setDraft({ ...draft, catalog_number: e.target.value })} />
              </label>
              <label className="block sm:col-span-2">
                <span className="label">תיאור</span>
                <input dir="ltr" className="input text-right" value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </label>
              <label className="block">
                <span className="label">מינימום (ברירת מחדל)</span>
                <input type="number" inputMode="numeric" min={0} className="input" value={draft.default_min}
                  onChange={(e) => setDraft({ ...draft, default_min: e.target.value })} />
              </label>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => { setDraft(null); setError('') }}>ביטול</button>
              <button className="btn-primary" onClick={saveItem} disabled={upsert.isPending}>שמירה</button>
            </div>
          </div>
        )}

        {items.isLoading ? (
          <Spinner />
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {(items.data ?? []).map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p dir="ltr" className="text-left text-slate-800 [overflow-wrap:anywhere]">{i.name}</p>
                  <p className="text-xs text-slate-400">
                    {i.category || 'ללא קבוצה'}{i.catalog_number ? ` · ${i.catalog_number}` : ''} · מינימום {i.default_min}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button className="btn-ghost !px-2" onClick={() => edit(i)} aria-label="עריכה">
                    <Pencil size={15} />
                  </button>
                  <ConfirmButton className="btn-ghost !px-2 text-red-500" onConfirm={() => del.mutate(i.id)}>
                    <Trash2 size={15} />
                  </ConfirmButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
