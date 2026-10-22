// Extra data for the APP SHELL only (menu, search, badges, developer switcher). Active with ?shell=1 so that it does not
// disturb the screens of the other agents:  /qa.html?path=/&role=developer&shell=1   (&as=test|real = the developer acts as another user)
// It is added to what the other seeds put in (not instead of it) and runs after all of them (at 0, 0.1, 0.9 and 1.5 s).
import { queryClient } from '../../lib/queryClient'
import { mkTask, qaProfile, seed, d } from '../seed'

type Row = { id: string; [k: string]: unknown }
/** adds rows to a seeded list (a row with the same id is replaced) */
function addTo(key: unknown[], rows: Row[]) {
  const have = queryClient.getQueryData<Row[]>(key) ?? []
  const ids = new Set(rows.map((r) => r.id))
  seed(key, [...have.filter((r) => !ids.has(r.id)), ...rows])
}

if (new URLSearchParams(window.location.search).has('shell')) {
  // the other seed files also seed late (up to 800 ms): this one runs again after them; seeding twice changes nothing
  const apply = () => {
    const base = { ...(qaProfile('agent') as object), created_at: '2026-02-01T00:00:00Z' }
    addTo(['all-users'], [
      { ...base, id: 'u-new', full_name: 'נרשם חדש עם שם ארוך מאוד שצריך להיחתך בכרטיס', email: 'new@qa.test', active: false }, // waiting for approval: the badge next to "ניהול מערכת"
      { ...base, id: 'u-new2', full_name: 'נרשמת נוספת', email: 'new2@qa.test', active: false },
      { ...base, id: 'u-test', full_name: 'סוכן פיקטיבי', email: 'fake@qa.test', is_test: true }, // for the developer switcher
      { ...base, id: 'u-real', full_name: 'דנה מנהלת עם שם ארוך מאוד שצריך להיחתך בתפריט הבחירה', email: 'dana@qa.test', role: 'admin' },
    ])
    addTo(['contacts'], [
      { id: 'c1', name: 'רוני רכש', role: 'מנהלת רכש', phone: '03-1234567', office_phone: '', email: 'roni@qa.test', doctor_id: null, hospital_id: 'h1' },
      { id: 'c2', name: 'מירב מזכירה', role: 'מזכירה', phone: '', office_phone: '', email: '', doctor_id: 'd1', hospital_id: 'h1' },
      { id: 'c3', name: 'איש קשר יתום', role: '', phone: '', office_phone: '', email: '', doctor_id: null, hospital_id: null }, // belongs to nobody: only managers can open it
    ])
    addTo(['projects'], [{ id: 'pr1', name: 'הטמעת רובוט באיכילוב', description: 'פרויקט בדיקה', areas: [] }])
    addTo(['learn-topics'], [{ id: 'l1', title: 'ברך מלאה — שלבי הניתוח', description: 'MAKO', cards: 12, sort: 1 }])
    // overdue tasks of mine (the counter next to "משימות") and an awkward one for the search rows
    addTo(['tasks'], [
      mkTask('t7', 'משימה באיחור של שבוע', d(-7)),
      mkTask('t8', 'משימה עם שם ארוך מאוד שמערבת עברית English words 🙂 and a very long tail that must never overflow the search result row xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', d(1)),
    ])
    // a manager's customised menu: renamed groups, a page that does not exist, a page named twice, an empty title, a favourite moved into a group
    seed(['app-setting', 'menu.layout'], JSON.stringify([
      { id: 'g1', title: 'קבוצה עם שם ארוך מאוד שבודקת גלישה בתפריט הצד', paths: ['/reports', '/nope', '/tasks', '/reports', '/schedule'] },
      { id: 'g2', title: '', paths: ['/settings', '/users', '/agents'] },
    ]), { keepWhenEmpty: true })
  }
  ;[0, 100, 900, 1500].forEach((ms) => setTimeout(apply, ms))
}
