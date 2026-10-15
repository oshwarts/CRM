import { useMemo } from 'react'
import { useAuth } from '../context/AuthProvider'
import { useAppSetting } from './api'
import { MENU_SETTING_KEY, parseMenuGroups, resolveGroups } from './menuConfig'
import { DEFAULT_FAVORITES, NAV } from './navItems'
import { useLocalSetting } from './useLocalSetting'

/** what the menu shows for this person: the pages they may open, the groups (set by the managers), their favourites (set by them) */
export function useMenu() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const navItems = useMemo(() => NAV.filter((n) => !('adminOnly' in n) || isAdmin), [isAdmin])
  const setting = useAppSetting(MENU_SETTING_KEY)
  const groups = useMemo(() => resolveGroups(parseMenuGroups(setting.data), navItems.map((n) => n.to)), [setting.data, navItems])
  const [favorites, setFavorites] = useLocalSetting<string[]>('menu.favorites', DEFAULT_FAVORITES)
  return { navItems, groups, favorites, setFavorites, isAdmin, loadingGroups: setting.isLoading }
}
