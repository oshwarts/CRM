import { useState } from 'react'
import { ArrowDown, ArrowUp, GripVertical, LayoutList, Plus, RotateCcw, Star, Trash2, X } from 'lucide-react'
import { Spinner } from '../components/ui'
import { useSaveAppSetting } from '../lib/api'
import { MENU_SETTING_KEY, resolveGroups, type MenuGroup } from '../lib/menuConfig'
import { DEFAULT_FAVORITES, NAV } from '../lib/navItems'
import { toast } from '../lib/toast'
import { useMenu } from '../lib/useMenu'
import { classNames } from '../lib/utils'

const copy = (groups: MenuGroup[]) => groups.map((g) => ({ ...g, paths: [...g.paths] }))
const labelOf = (path: string) => NAV.find((n) => n.to === path)?.label ?? path
const iconOf = (path: string) => NAV.find((n) => n.to === path)?.icon

function PageName({ path }: { path: string }) {
  const Icon = iconOf(path)
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      {Icon && <Icon size={16} className="shrink-0 text-brand-500" />}
      <span className="truncate">{labelOf(path)}</span>
    </span>
  )
}

/** everybody: which pages are shown at the top of the menu, and in which order (kept on this device) */
function Favorites() {
  const { navItems, favorites, setFavorites } = useMenu()
  const available = navItems.map((n) => n.to).filter((p) => p !== '/')
  const mine = favorites.filter((p) => available.includes(p))
  const others = available.filter((p) => !mine.includes(p))
  const nudge = (i: number, dir: -1 | 1) =>
    setFavorites((f) => {
      const list = f.filter((p) => available.includes(p))
      const j = i + dir
      if (j < 0 || j >= list.length) return f
      const next = [...list]
      const t = next[i]
      next[i] = next[j]
      next[j] = t
      return next
    })

  return (
    <section className="card space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Star size={18} className="fill-amber-400 text-amber-500" /> המועדפים שלי
          </h2>
          <p className="text-sm text-slate-500">הדפים האלה מופיעים למעלה בתפריט, בסדר שתבחר. זה נשמר במכשיר הזה בלבד.</p>
        </div>
        <button type="button" className="btn-ghost shrink-0 !text-xs" onClick={() => setFavorites(DEFAULT_FAVORITES)}>
          <RotateCcw size={14} /> ברירת מחדל
        </button>
      </div>

      <ul className="space-y-1.5">
        {mine.map((p, i) => (
          <li key={p} className="flex items-center gap-1 rounded-xl bg-slate-50 px-3 py-2 text-sm">
            <PageName path={p} />
            <button type="button" className="rounded-lg p-2 hover:bg-slate-200 disabled:opacity-30" aria-label={`הזז את ${labelOf(p)} למעלה`} disabled={i === 0} onClick={() => nudge(i, -1)}>
              <ArrowUp size={16} />
            </button>
            <button type="button" className="rounded-lg p-2 hover:bg-slate-200 disabled:opacity-30" aria-label={`הזז את ${labelOf(p)} למטה`} disabled={i === mine.length - 1} onClick={() => nudge(i, 1)}>
              <ArrowDown size={16} />
            </button>
            <button type="button" className="rounded-lg p-2 text-red-500 hover:bg-red-50" aria-label={`הסר את ${labelOf(p)} מהמועדפים`} onClick={() => setFavorites((f) => f.filter((x) => x !== p))}>
              <X size={16} />
            </button>
          </li>
        ))}
        {mine.length === 0 && <li className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-400">אין מועדפים — הוסף דפים מהרשימה למטה</li>}
      </ul>

      {others.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold text-slate-500">הוסף למועדפים</p>
          <div className="flex flex-wrap gap-2">
            {others.map((p) => {
              const Icon = iconOf(p)
              return (
                <button
                  key={p}
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-white px-3 py-1.5 text-sm text-brand-700 hover:bg-brand-50"
                  onClick={() => setFavorites((f) => [...f.filter((x) => x !== p), p])}
                >
                  <Plus size={14} />
                  {Icon && <Icon size={14} />}
                  {labelOf(p)}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}

/** managers: the groups of the menu for everybody — names, which page sits where, the order */
function Structure({ saved }: { saved: MenuGroup[] }) {
  const { navItems } = useMenu()
  const save = useSaveAppSetting()
  const [draft, setDraft] = useState<MenuGroup[]>(() => copy(saved))
  const [drag, setDrag] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)

  const rename = (id: string, title: string) => setDraft((d) => d.map((g) => (g.id === id ? { ...g, title } : g)))
  /** puts a page into a group, before another page of it (or at the end) */
  const place = (path: string, toId: string, before: string | null) =>
    setDraft((d) => {
      const without = d.map((g) => ({ ...g, paths: g.paths.filter((p) => p !== path) }))
      return without.map((g) => {
        if (g.id !== toId) return g
        const i = before ? g.paths.indexOf(before) : -1
        const paths = [...g.paths]
        paths.splice(i < 0 ? paths.length : i, 0, path)
        return { ...g, paths }
      })
    })
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
      const rest = d.filter((g) => g.id !== id)
      // its pages are not lost: they join the group before it
      const target = rest[Math.max(0, idx - 1)]
      return rest.map((g) => (g.id === target.id ? { ...g, paths: [...g.paths, ...d[idx].paths] } : g))
    })

  async function submit() {
    const clean = draft.map((g) => ({ ...g, title: g.title.trim() || 'ללא שם' }))
    await save.mutateAsync({ key: MENU_SETTING_KEY, value: JSON.stringify(clean) })
    setDraft(clean)
    toast('התפריט עודכן לכל המשתמשים')
  }
  async function reset() {
    if (!window.confirm('להחזיר את הקטגוריות לחלוקה המקורית, לכל המשתמשים?')) return
    await save.mutateAsync({ key: MENU_SETTING_KEY, value: '' })
    setDraft(resolveGroups(null, navItems.map((n) => n.to)))
    toast('התפריט הוחזר לברירת המחדל')
  }

  return (
    <section className="space-y-4">
      <div className="card space-y-1 p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <LayoutList size={18} className="text-brand-500" /> קטגוריות התפריט — לכל המשתמשים
        </h2>
        <p className="text-sm text-slate-500">
          שנה שם לקטגוריה, גרור דף (בעזרת הידית) לקטגוריה אחרת, או השתמש בחצים ובתיבת "העבר ל". השינוי נכנס לתוקף אחרי "שמירה".
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {draft.map((g, gi) => (
          <div
            key={g.id}
            className={classNames('card space-y-2 p-3 transition', drag && 'ring-1 ring-brand-200')}
            onDragOver={(e) => drag && e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              if (drag) place(drag, g.id, null)
              setDrag(null)
              setOver(null)
            }}
          >
            <div className="flex items-center gap-1">
              <input className="input flex-1 font-semibold" value={g.title} aria-label="שם הקטגוריה" onChange={(e) => rename(g.id, e.target.value)} />
              <button type="button" className="rounded-lg p-2 hover:bg-slate-100 disabled:opacity-30" aria-label="הזז קטגוריה למעלה" disabled={gi === 0} onClick={() => nudgeGroup(gi, -1)}>
                <ArrowUp size={16} />
              </button>
              <button type="button" className="rounded-lg p-2 hover:bg-slate-100 disabled:opacity-30" aria-label="הזז קטגוריה למטה" disabled={gi === draft.length - 1} onClick={() => nudgeGroup(gi, 1)}>
                <ArrowDown size={16} />
              </button>
              <button type="button" className="rounded-lg p-2 text-red-500 hover:bg-red-50 disabled:opacity-30" aria-label="מחק קטגוריה" disabled={draft.length === 1} onClick={() => removeGroup(g.id)}>
                <Trash2 size={16} />
              </button>
            </div>
            <ul className="space-y-1">
              {g.paths.map((p, pi) => (
                <li
                  key={p}
                  draggable
                  onDragStart={() => setDrag(p)}
                  onDragEnd={() => {
                    setDrag(null)
                    setOver(null)
                  }}
                  onDragOver={(e) => {
                    if (!drag) return
                    e.preventDefault()
                    setOver(p)
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    if (drag && drag !== p) place(drag, g.id, p)
                    setDrag(null)
                    setOver(null)
                  }}
                  className={classNames(
                    'flex flex-wrap items-center gap-1 rounded-xl bg-slate-50 px-2 py-1.5 text-sm',
                    drag === p && 'opacity-40',
                    over === p && drag !== p && 'shadow-[0_-3px_0_0_var(--blue)]',
                  )}
                >
                  <GripVertical size={16} className="shrink-0 cursor-grab text-slate-400" aria-hidden />
                  <PageName path={p} />
                  <button type="button" className="rounded-lg p-1.5 hover:bg-slate-200 disabled:opacity-30" aria-label={`הזז את ${labelOf(p)} למעלה`} disabled={pi === 0} onClick={() => nudge(g.id, p, -1)}>
                    <ArrowUp size={15} />
                  </button>
                  <button type="button" className="rounded-lg p-1.5 hover:bg-slate-200 disabled:opacity-30" aria-label={`הזז את ${labelOf(p)} למטה`} disabled={pi === g.paths.length - 1} onClick={() => nudge(g.id, p, 1)}>
                    <ArrowDown size={15} />
                  </button>
                  <select
                    className="input order-last basis-full !py-1 text-xs sm:order-none sm:!w-auto sm:basis-auto sm:max-w-[7.5rem]"
                    aria-label={`העבר את ${labelOf(p)} לקטגוריה`}
                    value={g.id}
                    onChange={(e) => place(p, e.target.value, null)}
                  >
                    {draft.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.title}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
              {g.paths.length === 0 && <li className="rounded-xl border border-dashed border-slate-300 px-3 py-4 text-center text-xs text-slate-400">ריק — גרור לכאן דף, או העבר דף בעזרת "העבר ל"</li>}
            </ul>
          </div>
        ))}
      </div>

      <div className={classNames('z-10 flex flex-wrap items-center gap-2 rounded-2xl border border-brand-100 bg-white p-2 shadow-pop', dirty && 'sticky bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] md:bottom-4')}>
        <button type="button" className="btn-secondary !px-3 !text-xs" onClick={addGroup}>
          <Plus size={15} /> קטגוריה חדשה
        </button>
        <button type="button" className="btn-ghost !px-3 !text-xs" onClick={reset}>
          <RotateCcw size={15} /> ברירת מחדל
        </button>
        <span className="hidden flex-1 text-sm text-amber-700 sm:block">{dirty ? 'יש שינויים שלא נשמרו' : ''}</span><span className="flex-1" />
        {dirty && (
          <button type="button" className="btn-secondary !px-3 !text-xs" onClick={() => setDraft(copy(saved))}>
            ביטול שינויים
          </button>
        )}
        <button type="button" className="btn-primary" disabled={!dirty || save.isPending} onClick={submit}>
          שמירה
        </button>
      </div>
    </section>
  )
}

export default function MenuSettings() {
  const { groups, isAdmin, loadingGroups } = useMenu()
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-brand-800 sm:text-3xl">התאמת התפריט</h1>
        <p className="text-sm text-slate-500">בחר אילו דפים יהיו זמינים תמיד למעלה{isAdmin ? ', וארגן את הקטגוריות של כל המשתמשים' : ''}.</p>
      </div>
      <Favorites />
      {isAdmin && (loadingGroups ? <Spinner /> : <Structure saved={groups} />)}
    </div>
  )
}
