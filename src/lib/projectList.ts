// The rules of the projects list: what needs attention, how the list is sorted and filtered. No data access here.
import type { ProjectStats } from './projects'

export type ListProject = {
  id: string
  name: string
  status: string
  target_date: string | null
  owner_id: string | null
  hospital_id: string | null
  hospital: { id: string; name: string } | null
  owner: { id: string; full_name: string } | null
}
export type ProjectRow = { p: ListProject; stats: ProjectStats }

export type Attention = 'high' | 'medium' | 'none'

const dayMs = 86400000
const daysTo = (target: string, today: string) => Math.round((new Date(`${target}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime()) / dayMs)

/** high: a stuck task or the target date has passed; medium: a late task or the target is within a week and the project is not done */
export function attention(r: ProjectRow, today: string): Attention {
  if (r.p.status === 'done') return 'none'
  const left = r.p.target_date ? daysTo(r.p.target_date, today) : null
  if (r.stats.blocked.length > 0 || (left !== null && left < 0)) return 'high'
  if (r.stats.overdue.length > 0 || (left !== null && left <= 7 && r.stats.percent < 100)) return 'medium'
  return 'none'
}

export type ProjectSort = 'urgent' | 'target' | 'name' | 'progress'
export type ProjectFilters = { status: 'open' | 'done' | 'all'; q: string; mine: boolean; attentionOnly: boolean; hospitalId: string; sort: ProjectSort }
export const defaultProjectFilters: ProjectFilters = { status: 'open', q: '', mine: false, attentionOnly: false, hospitalId: '', sort: 'urgent' }

const rank: Record<Attention, number> = { high: 0, medium: 1, none: 2 }
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()

export function filterProjects(rows: ProjectRow[], f: ProjectFilters, today: string, me: string | null | undefined): ProjectRow[] {
  const words = norm(f.q).split(' ').filter(Boolean)
  return rows.filter((r) => {
    if (f.status === 'open' && r.p.status === 'done') return false
    if (f.status === 'done' && r.p.status !== 'done') return false
    if (f.mine && r.p.owner_id !== me) return false
    if (f.hospitalId && r.p.hospital_id !== f.hospitalId) return false
    if (f.attentionOnly && attention(r, today) === 'none') return false
    if (words.length) {
      const hay = norm(`${r.p.name} ${r.p.hospital?.name ?? ''} ${r.p.owner?.full_name ?? ''}`)
      if (!words.every((w) => hay.includes(w))) return false
    }
    return true
  })
}

export function sortProjects(rows: ProjectRow[], sort: ProjectSort, today: string): ProjectRow[] {
  const byDate = (a: ProjectRow, b: ProjectRow) => (a.p.target_date ?? '9999').localeCompare(b.p.target_date ?? '9999')
  const byName = (a: ProjectRow, b: ProjectRow) => a.p.name.localeCompare(b.p.name, 'he')
  return [...rows].sort((a, b) => {
    if (sort === 'name') return byName(a, b)
    if (sort === 'target') return byDate(a, b) || byName(a, b)
    if (sort === 'progress') return a.stats.percent - b.stats.percent || byName(a, b)
    return rank[attention(a, today)] - rank[attention(b, today)] || byDate(a, b) || byName(a, b)
  })
}

export function projectTotals(rows: ProjectRow[], today: string) {
  const open = rows.filter((r) => r.p.status !== 'done')
  return {
    open: open.length,
    done: rows.length - open.length,
    needAttention: open.filter((r) => attention(r, today) !== 'none').length,
    blocked: open.reduce((n, r) => n + r.stats.blocked.length, 0),
    overdue: open.reduce((n, r) => n + r.stats.overdue.length, 0),
  }
}
