import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useInfoCategories, useSaveInfoCategory } from '../lib/api'
import { classNames } from '../lib/utils'

const NEW = '__new__'

/** choose a category of the clinical-information library — or create a new one on the spot */
export function CategorySelect({
  value,
  onChange,
  emptyLabel = '— ללא קטגוריה —',
  className,
  invalid,
}: {
  value: string
  onChange: (id: string) => void
  emptyLabel?: string
  className?: string
  invalid?: boolean
}) {
  const categories = useInfoCategories()
  const save = useSaveInfoCategory()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  async function create() {
    const n = name.trim()
    if (!n) return
    const existing = (categories.data ?? []).find((c) => c.name.trim().toLowerCase() === n.toLowerCase())
    if (existing) {
      onChange(existing.id)
      setAdding(false)
      setName('')
      return
    }
    setError('')
    try {
      const id = await save.mutateAsync({ name: n, sort: Math.max(0, ...(categories.data ?? []).map((c) => c.sort)) + 1 })
      onChange(id)
      setAdding(false)
      setName('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'יצירת הקטגוריה נכשלה')
    }
  }

  return (
    <div className="space-y-1.5">
      <select
        className={classNames('input', invalid && '!border-amber-400', className)}
        value={adding ? NEW : value}
        onChange={(e) => {
          if (e.target.value === NEW) setAdding(true)
          else {
            setAdding(false)
            onChange(e.target.value)
          }
        }}
        aria-label="קטגוריה"
      >
        <option value="">{emptyLabel}</option>
        {(categories.data ?? []).map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
        <option value={NEW}>＋ קטגוריה חדשה…</option>
      </select>
      {adding && (
        <div className="flex gap-2">
          <input
            className="input !py-1 text-sm"
            dir="auto"
            autoFocus
            placeholder="שם הקטגוריה החדשה"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void create()
              }
            }}
          />
          <button type="button" className="btn-primary !py-1 text-xs" disabled={!name.trim() || save.isPending} onClick={() => void create()}>
            <Plus size={13} /> הוסף
          </button>
          <button type="button" className="btn-ghost !py-1 text-xs" onClick={() => { setAdding(false); setName('') }}>
            ביטול
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
