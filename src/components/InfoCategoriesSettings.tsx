import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { useDeleteInfoCategory, useInfoCategories, useSaveInfoCategory } from '../lib/api'
import { ConfirmButton, Spinner } from './ui'

export function InfoCategoriesSettings() {
  const categories = useInfoCategories()
  const save = useSaveInfoCategory()
  const del = useDeleteInfoCategory()
  const [names, setNames] = useState<Record<string, string>>({})
  const [adding, setAdding] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setNames(Object.fromEntries((categories.data ?? []).map((c) => [c.id, c.name])))
  }, [categories.data])

  const list = categories.data ?? []

  async function run(fn: () => Promise<unknown>) {
    setError('')
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'הפעולה נכשלה')
    }
  }

  async function swap(i: number, dir: -1 | 1) {
    const a = list[i]
    const b = list[i + dir]
    if (!a || !b) return
    await run(async () => {
      await save.mutateAsync({ id: a.id, name: a.name, sort: b.sort })
      await save.mutateAsync({ id: b.id, name: b.name, sort: a.sort })
    })
  }

  if (categories.isLoading) return <Spinner />

  return (
    <div className="card space-y-4 p-4">
      <div>
        <h3 className="font-semibold text-slate-800">קטגוריות מסמכים (עמוד "מידע")</h3>
        <p className="text-sm text-slate-400">
          הקטגוריות משותפות לכל הפרוצדורות. מחיקת קטגוריה לא מוחקת מסמכים — הם יעברו ל"ללא קטגוריה".
        </p>
      </div>

      <div className="space-y-2">
        {list.map((c, i) => (
          <div key={c.id} className="flex items-center gap-1">
            <span className="w-5 text-center text-xs text-slate-400">{i + 1}</span>
            <input
              className="input max-w-sm"
              value={names[c.id] ?? ''}
              onChange={(e) => setNames((n) => ({ ...n, [c.id]: e.target.value }))}
              onBlur={() => {
                const name = (names[c.id] ?? '').trim()
                if (name && name !== c.name) run(() => save.mutateAsync({ id: c.id, name, sort: c.sort }))
                else setNames((n) => ({ ...n, [c.id]: c.name }))
              }}
            />
            <button type="button" className="btn-ghost !px-2" onClick={() => swap(i, -1)} disabled={i === 0} aria-label="למעלה">
              <ArrowUp size={16} />
            </button>
            <button type="button" className="btn-ghost !px-2" onClick={() => swap(i, 1)} disabled={i === list.length - 1} aria-label="למטה">
              <ArrowDown size={16} />
            </button>
            <ConfirmButton className="btn-ghost !px-2 text-red-500" onConfirm={() => run(() => del.mutateAsync(c.id))}>
              <Trash2 size={16} />
            </ConfirmButton>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 border-t border-slate-200 pt-3">
        <input
          className="input max-w-sm"
          placeholder="קטגוריה חדשה"
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
        />
        <button
          className="btn-primary"
          disabled={!adding.trim() || save.isPending}
          onClick={() =>
            run(async () => {
              await save.mutateAsync({ name: adding.trim(), sort: (list.length ? list[list.length - 1].sort : 0) + 1 })
              setAdding('')
            })
          }
        >
          <Plus size={16} />
          הוסף
        </button>
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}
