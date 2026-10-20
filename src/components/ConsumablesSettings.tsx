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
import { ConfirmButton, Field, Modal, Spinner } from './ui'
import { ConsumableUsageEditor } from './ConsumableUsageEditor'
import { EmptyRow, Section } from './SettingsKit'
import {
  CONSUMABLES_EMAIL_KEY,
  CONSUMABLES_INTRO_KEY,
  DEFAULT_INTRO,
  HOSPITAL_PLACEHOLDER,
} from '../lib/consumables'
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

  const introSetting = useAppSetting(CONSUMABLES_INTRO_KEY)
  const [intro, setIntro] = useState('')
  const [introSaved, setIntroSaved] = useState(false)
  const [mail, setMail] = useState('')
  const [saved, setSaved] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState('')

  useEffect(() => setMail(email.data ?? ''), [email.data])
  useEffect(() => setIntro(introSetting.data ?? ''), [introSetting.data])

  async function saveIntro() {
    await saveSetting.mutateAsync({ key: CONSUMABLES_INTRO_KEY, value: intro.trim() })
    setIntroSaved(true)
    setTimeout(() => setIntroSaved(false), 2000)
  }

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

  const edit = (i: ConsumableItem) => {
    setError('')
    setDraft({
      id: i.id,
      category: i.category,
      catalog_number: i.catalog_number,
      name: i.name,
      default_min: String(i.default_min),
    })
  }

  return (
    <div className="space-y-3">
      <Section title="פריטי מתכלים" count={items.data?.length} defaultOpen>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="min-w-0 flex-1 basis-48 text-sm text-slate-600">המינימום כאן הוא ברירת המחדל; בעמוד המתכלים אפשר להתאים אותו לכל בית חולים.</p>
          <button
            className="btn-primary max-sm:w-full"
            onClick={() => {
              setError('')
              setDraft({ ...EMPTY })
            }}
          >
            <Plus size={16} aria-hidden />
            פריט חדש
          </button>
        </div>

        {items.isLoading ? (
          <Spinner />
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {(items.data ?? []).map((i) => (
              <li key={i.id} className="flex items-center gap-1 py-1.5">
                <div className="min-w-0 flex-1">
                  <p dir="ltr" className="text-left font-medium text-slate-800 [overflow-wrap:anywhere]">
                    {i.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {i.category || 'ללא קבוצה'}
                    {i.catalog_number ? ` · ${i.catalog_number}` : ''} · מינימום {i.default_min}
                  </p>
                </div>
                <button className="btn-ghost !px-2" onClick={() => edit(i)} aria-label={`עריכת ${i.name}`}>
                  <Pencil size={16} />
                </button>
                <ConfirmButton className="btn-ghost !px-2 text-red-600" label={`מחק את ${i.name}`} onConfirm={() => del.mutate(i.id)}>
                  <Trash2 size={16} />
                </ConfirmButton>
              </li>
            ))}
            {(items.data ?? []).length === 0 && <EmptyRow>עוד לא הוגדרו פריטי מתכלים.</EmptyRow>}
          </ul>
        )}
      </Section>

      <ConsumableUsageEditor />

      <Section title="מייל רשימת חוסרים" hint="כתובת ומשפט פתיחה">
        <div className="space-y-5">
          <div>
            <Field label="כתובת מייל לרשימת חוסרים">
              <div className="flex gap-2">
                <input
                  type="email"
                  inputMode="email"
                  autoCapitalize="none"
                  dir="ltr"
                  className="input text-right sm:max-w-sm"
                  placeholder="warehouse@company.co.il"
                  value={mail}
                  disabled={!isAdmin}
                  onChange={(e) => setMail(e.target.value)}
                />
                <button className="btn-primary shrink-0" onClick={saveMail} disabled={!isAdmin || saveSetting.isPending}>
                  {saved ? 'נשמר ✓' : 'שמירה'}
                </button>
              </div>
            </Field>
            <p className="mt-1 text-xs text-slate-500">הכפתור "פתח מייל חוסרים" בעמוד המתכלים פותח טיוטה לכתובת הזו — המייל לא נשלח עד שתאשר ותלחץ "שלח".</p>
            {!isAdmin && <p className="mt-1 text-xs text-amber-700">רק מנהל יכול לשנות את הכתובת.</p>}
          </div>

          <div>
            <Field label="משפט קבוע בראש המייל">
              <textarea className="input min-h-20" placeholder={DEFAULT_INTRO} value={intro} disabled={!isAdmin} onChange={(e) => setIntro(e.target.value)} />
            </Field>
            <p className="mt-1 text-xs text-slate-500">
              מופיע לפני רשימת החוסרים. המייל כולל רק מק״ט וכמה להשלים. בטקסט אפשר לכתוב{' '}
              <bdi className="rounded bg-slate-100 px-1">{HOSPITAL_PLACEHOLDER}</bdi> והמערכת תחליף אותו בשם בית החולים שבו נספרו המתכלים.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button className="btn-primary" onClick={saveIntro} disabled={!isAdmin || saveSetting.isPending}>
                {introSaved ? 'נשמר ✓' : 'שמירה'}
              </button>
              {intro.trim() === '' && <span className="text-xs text-slate-500">ריק = ישמש המשפט: "{DEFAULT_INTRO}"</span>}
            </div>
          </div>
        </div>
      </Section>

      {draft && (
        <Modal open onClose={() => setDraft(null)} title={draft.id ? 'עריכת פריט מתכלה' : 'פריט מתכלה חדש'} size="md">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="תיאור" className="sm:col-span-2" error={error && !draft.name.trim() ? error : undefined}>
              <input dir="ltr" className="input text-right" value={draft.name} autoFocus onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </Field>
            <Field label="קבוצה">
              <input className="input" list="consumable-cats" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} placeholder="KNEE / UNI / HIP…" />
              <datalist id="consumable-cats">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
            <Field label="מק״ט">
              <input dir="ltr" className="input text-right" value={draft.catalog_number} onChange={(e) => setDraft({ ...draft, catalog_number: e.target.value })} />
            </Field>
            <Field label="מינימום (ברירת מחדל)">
              <input type="number" inputMode="numeric" min={0} className="input" value={draft.default_min} onChange={(e) => setDraft({ ...draft, default_min: e.target.value })} />
            </Field>
          </div>
          <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
            {error && draft.name.trim() && (
              <p role="alert" className="basis-full rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}
            <button className="btn-secondary" onClick={() => setDraft(null)}>
              ביטול
            </button>
            <button className="btn-primary" onClick={saveItem} disabled={upsert.isPending}>
              {upsert.isPending ? 'שומר…' : 'שמירה'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
