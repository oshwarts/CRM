// The grouping of the side menu. The managers can rename the groups and move pages between them
// (stored once for everybody in app_settings, key "menu.layout").
export type MenuGroup = { id: string; title: string; paths: string[] }

export const MENU_SETTING_KEY = 'menu.layout'

export const DEFAULT_GROUPS: MenuGroup[] = [
  { id: 'daily', title: 'יומיומי', paths: ['/now', '/activity', '/tasks', '/schedule', '/meetings', '/scans'] },
  { id: 'doctors', title: 'רופאים', paths: ['/doctors', '/competitors'] },
  { id: 'work', title: 'עבודה וידע', paths: ['/projects', '/processes', '/map', '/info', '/learn', '/consumables', '/reports', '/help'] },
  { id: 'admin', title: 'ניהול', paths: ['/agents', '/users', '/settings'] },
]

export function parseMenuGroups(value: string | undefined): MenuGroup[] | null {
  if (!value) return null
  try {
    const raw = JSON.parse(value) as unknown
    if (!Array.isArray(raw)) return null
    const groups = raw
      .filter((g): g is MenuGroup => !!g && typeof g.id === 'string' && typeof g.title === 'string' && Array.isArray(g.paths))
      .map((g) => ({ id: g.id, title: g.title.trim() || 'ללא שם', paths: g.paths.filter((p) => typeof p === 'string') }))
    return groups.length > 0 ? groups : null
  } catch {
    return null
  }
}

/** the saved groups (or the defaults); a page that belongs to no group (a new page of the system) joins the last one, a page named twice stays in the first */
export function resolveGroups(saved: MenuGroup[] | null, available: string[]): MenuGroup[] {
  const base = (saved ?? DEFAULT_GROUPS).map((g) => ({ ...g, paths: [...g.paths] }))
  const seen = new Set<string>()
  for (const g of base) {
    g.paths = g.paths.filter((p) => {
      if (seen.has(p) || !available.includes(p)) return false
      seen.add(p)
      return true
    })
  }
  const loose = available.filter((p) => p !== '/' && !seen.has(p))
  if (loose.length > 0) base[base.length - 1].paths.push(...loose)
  return base
}
