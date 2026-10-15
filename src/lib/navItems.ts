import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Boxes,
  CalendarDays,
  CalendarRange,
  FolderKanban,
  GraduationCap,
  Home,
  ListChecks,
  Map as MapIcon,
  ScanLine,
  Settings,
  Stethoscope,
  Swords,
  Target,
  UserCheck,
  Users as UsersIcon,
} from 'lucide-react'

// every page of the menu; the grouping and the favourites are in menuConfig and the per-device settings
export const NAV = [
  { to: '/', label: 'דף הבית', short: 'בית', icon: Home, end: true },
  { to: '/now', label: 'דחוף עכשיו', short: 'עכשיו', icon: AlertTriangle, end: false },
  { to: '/doctors', label: 'רופאים', short: 'רופאים', icon: Stethoscope, end: false },
  { to: '/tasks', label: 'משימות', short: 'משימות', icon: ListChecks, end: false },
  { to: '/projects', label: 'פרויקטים', short: 'פרויקטים', icon: FolderKanban, end: false },
  { to: '/schedule', label: 'לוז שבועי', short: 'לוז', icon: CalendarRange, end: false },
  { to: '/meetings', label: 'פגישות', short: 'פגישות', icon: CalendarDays, end: false },
  { to: '/map', label: 'בתי חולים', short: 'בתי חולים', icon: MapIcon, end: false },
  { to: '/scans', label: 'סריקות MAKO', short: 'סריקות', icon: ScanLine, end: false },
  { to: '/info', label: 'מידע קליני', short: 'מידע קליני', icon: BookOpen, end: false },
  { to: '/learn', label: 'לומדה', short: 'לומדה', icon: GraduationCap, end: false },
  { to: '/consumables', label: 'מתכלים MAKO', short: 'מתכלים', icon: Boxes, end: false },
  { to: '/pipeline', label: 'פוטנציאליים', short: 'פוטנציאליים', icon: Target, end: false },
  { to: '/competitors', label: 'פעילות מתחרים', short: 'מתחרים', icon: Swords, end: false },
  { to: '/reports', label: 'דוחות', short: 'דוחות', icon: BarChart3, end: false },
  { to: '/settings', label: 'הגדרות', short: 'הגדרות', icon: Settings, end: false, adminOnly: true },
  { to: '/agents', label: 'ניהול סוכנים', short: 'סוכנים', icon: UserCheck, end: false, adminOnly: true },
  { to: '/users', label: 'ניהול מערכת', short: 'ניהול', icon: UsersIcon, end: false, adminOnly: true },
]

// shown at the top of the menu until the person picks their own (the star next to an item)
export const DEFAULT_FAVORITES = ['/doctors', '/tasks', '/meetings', '/projects', '/map', '/info', '/learn']
