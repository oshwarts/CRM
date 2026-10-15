import { useState } from 'react'
import { ArrowDown, ArrowUp, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { Modal } from './ui'
import { useSaveAppSetting } from '../lib/api'
import { DEFAULT_GROUPS, MENU_SETTING_KEY, type MenuGroup } from '../lib/menuConfig'
import { toast } from '../lib/toast'

const copy = (groups: MenuGroup[]) => groups.map((g) => ({ ...g, paths: [...g.paths] }))

/** managers: rename the menu groups, move pages between them, add or remove a group */
export function MenuEditor({
  open,
  onClose,
  groups,
  labels,
}: {
  open: boolean
  onClose: () => void
  groups: MenuGroup[]
  /** page path → its name in the menu */
  labels: Record<string, string>
}) {
  const save = useSaveAppSetting()
  const [draft, setDraft] = useState<MenuGroup[]>(() => copy(groups))

  const rename = (id: string, title: string) => setDraft((d) => d.map((g) => (g.id === id ? { ...g, title } : g)))
  const move = (path: string, toId: string) =>
    setDraft((d) => d.map((g) => ({ ...g, paths: g.id === toId ? [...g.paths.filter((p) => p !== path), path] : g.paths.filter((p) => p !== path) })))
  const nudge = (id: string, path: string, dir: -1 | 1) =>
    setDraft((d) =>
      d.map((g) => {
        if (g.id !== id) return g
        const i = g.paths.indexOf(path)
        const j = i + dir
        if (i < 0 || j < 0 || j >= g.paths.length) return g
        const paths = [...g.paths]
        const t = paths[i]
        paths[i] = paths[j]
        paths[j] = t
        return { ...g, paths }
      }),
    )
  const nudgeGroup = (i: number, dir: -1 | 1) =>
    setDraft((d) => {
      const j = i + dir
      if (j < 0 || j >= d.length) return d
      const next = [...d]
      const t = next[i]
      next[i] = next[j]
      next[j] = t
      return next
    })
  const addGroup = () => setDraft((d) => [...d, { id: `g${Date.now().toString(36)}`, title: 'קטגוריה חדשה', paths: [] }])
  const removeGroup = (id: string) =>
    setDraft((d) => {
      const idx = d.findIndex((g) => g.id === id)
      if (idx < 0 || d.length === 1) return d
      const gone = d[idx]
      const rest = d.filter((g) => g.id !== id)
      // its pages are not lost: they join the group before it
      const target = rest[Math.max(0, idx - 1)]
      return rest.map((g) => (g.id === target.id ? { ...g, paths: [...g.paths, ...gone.paths] } : g))
    })

  async function submit() {
    const clean = draft.map((g) => ({ ...g, title: g.title.trim() || 'ללא שם' }))
    await save.mutateAsync({ key: MENU_SETTING_KEY, value: JSON.stringify(clean) })
    toast('התפריט עודכן לכל המשתמשים')
    onClose()
  }
  async function reset() {
    if (!window.confirm('להחזיר את התפריט לחלוקה המקורית, לכל המשתמשים?')) return
    await save.mutateAsync({ key: MENU_SETTING_KEY, value: '' })
    setDraft(copy(DEFAULT_GROUPS))
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="עריכת קטגוריות התפריט" size="lg">
      <p className="mb-3 text-sm text-slate-500">השינוי חל על כל המשתמשים. אפשר לשנות שם לקטגוריה, להעביר דפים ביניהן ולשנות סדר.</p>
      <div className="space-y-3">
        {draft.map((g, gi) => (
          <div key={g.id} className="rounded-xl border border-slate-200 p-3">
            <div className="flex items-center gap-2">
              <input className="input flex-1 font-semibold" value={g.title} aria-label="שם הקטגוריה" onChange={(e) => rename(g.id, e.target.value)} />
              <button type="button" className="btn-ghost !px-2" aria-label="הזז קטגוריה למעלה" disabled={gi === 0} onClick={() => nudgeGroup(gi, -1)}>
                <ArrowUp size={15} />
              </button>
              <button type="button" className="btn-ghost !px-2" aria-label="הזז קטגוריה למטה" disabled={gi === draft.length - 1} onClick={() => nudgeGroup(gi, 1)}>
                <ArrowDown size={15} />
              </button>
              <button type="button" className="btn-ghost !px-2 text-red-600" aria-label="מחק קטגוריה" disabled={draft.length === 1} onClick={() => removeGroup(g.id)}>
                <Trash2 size={15} />
              </button>
            </div>
            <ul className="mt-2 space-y-1">
              {g.paths.map((p, pi) => (
                <li key={p} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2 py-1.5 text-sm">
                  <span className="flex-1">{labels[p] ?? p}</span>
                  <button type="button" className="rounded p-1 hover:bg-slate-200 disabled:opacity-30" aria-label="למעלה" disabled={pi === 0} onClick={() => nudge(g.id, p, -1)}>
                    <ArrowUp size={14} />
                  </button>
                  <button type="button" className="rounded p-1 hover:bg-slate-200 disabled:opacity-30" aria-label="למטה" disabled={pi === g.paths.length - 1} onClick={() => nudge(g.id, p, 1)}>
                    <ArrowDown size={14} />
                  </button>
                  <select className="input !w-auto !py-1 text-xs" aria-label={`העבר את ${labels[p] ?? p} לקטגוריה`} value={g.id} onChange={(e) => move(p, e.target.value)}>
                    {draft.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.title}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
              {g.paths.length === 0 && <li className="px-2 py-1 text-xs text-slate-400">אין דפים בקטגוריה — העבר אליה דפים מקטגוריה אחרת</li>}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" className="btn-secondary" onClick={addGroup}>
          <Plus size={15} /> קטגוריה חדשה
        </button>
        <button type="button" className="btn-ghost" onClick={reset}>
          <RotateCcw size={15} /> חזרה לברירת המחדל
        </button>
        <span className="flex-1" />
        <button type="button" className="btn-secondary" onClick={onClose}>
          ביטול
        </button>
        <button type="button" className="btn-primary" disabled={save.isPending} onClick={submit}>
          שמירה
        </button>
      </div>
    </Modal>
  )
}
