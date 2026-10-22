// Automatic checks inside the QA harness: go to a screen without reloading, and measure what a human tester would notice.
//   await __qa.go('/doctors')                       open a screen (in-app navigation)
//   await __qa.smoke(['/', '/doctors', '/tasks'])   → one row per screen: overflow, bad texts, console errors, unnamed controls …
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { queryClient } from '../lib/queryClient'

export type SmokeRow = {
  path: string
  final: string
  title: string
  h1: string
  textLength: number
  /** the page is wider than the window (a horizontal scrollbar on the whole page) */
  pageOverflowX: boolean
  /** elements that stick out of the window sideways (tag.class, up to 4) */
  overflowing: string[]
  /** text that should never be shown to a person */
  badText: string[]
  consoleErrors: string[]
  /** buttons / links / inputs without an accessible name */
  unnamed: string[]
  /** images without alt */
  imgNoAlt: number
  /** visible controls smaller than 24×24 px */
  tinyTargets: number
  /** an error / not-found message is on the screen */
  errorShown: boolean
}

const BAD = /\bundefined\b|\bNaN\b|Invalid Date|\[object Object\]|\bnull\b(?!\w)/
const errors: string[] = []
let patched = false
function patchConsole() {
  if (patched) return
  patched = true
  const keep = (a: unknown[]) => a.map((x) => (x instanceof Error ? x.message : typeof x === 'string' ? x : JSON.stringify(x))).join(' ').slice(0, 220)
  for (const level of ['error', 'warn'] as const) {
    const orig = console[level].bind(console)
    console[level] = (...a: unknown[]) => {
      const m = keep(a)
      // the fake network answers every read with "Failed to fetch" on purpose
      if (!/Failed to fetch|ERR_CONNECTION|net::|WebSocket|realtime|Download the React DevTools/i.test(m)) errors.push(`${level}: ${m}`)
      orig(...a)
    }
  }
  window.addEventListener('error', (e) => errors.push(`error: ${e.message}`.slice(0, 220)))
  window.addEventListener('unhandledrejection', (e) => {
    const m = String((e.reason as Error)?.message ?? e.reason)
    if (!/Failed to fetch/.test(m)) errors.push(`rejection: ${m}`.slice(0, 220))
  })
}

const label = (el: Element) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(/\s+/).slice(0, 2).join('.') : ''}`
const visible = (el: Element) => {
  const r = (el as HTMLElement).getBoundingClientRect()
  const s = getComputedStyle(el as HTMLElement)
  return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'
}
const nameOf = (el: Element) =>
  (el.getAttribute('aria-label') || el.getAttribute('title') || (el as HTMLElement).innerText || el.getAttribute('alt') || '').trim() ||
  (el.id && document.querySelector(`label[for="${el.id}"]`)?.textContent?.trim()) ||
  (el.closest('label')?.textContent?.trim() ?? '') ||
  (el.getAttribute('aria-labelledby') ? document.getElementById(el.getAttribute('aria-labelledby')!)?.textContent?.trim() ?? '' : '') ||
  (el.querySelector('img[alt]')?.getAttribute('alt') ?? '') ||
  (el.querySelector('svg title')?.textContent ?? '')

function measure(path: string): SmokeRow {
  const root = document.querySelector('main') ?? document.body
  const text = (root as HTMLElement).innerText ?? ''
  const w = window.innerWidth
  const overflowing: string[] = []
  for (const el of Array.from(document.querySelectorAll('body *'))) {
    if (overflowing.length >= 4) break
    if (!visible(el)) continue
    // content inside a horizontal scroller is allowed to be wider
    let scroller = false
    for (let p = el.parentElement; p; p = p.parentElement) {
      const o = getComputedStyle(p).overflowX
      if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') {
        scroller = true
        break
      }
    }
    if (scroller) continue
    const r = (el as HTMLElement).getBoundingClientRect()
    if (r.right > w + 2 || r.left < -2) overflowing.push(label(el))
  }
  const unnamed: string[] = []
  for (const el of Array.from(document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, [role=button]'))) {
    if (!visible(el)) continue
    if (!nameOf(el) && !(el as HTMLInputElement).placeholder) unnamed.push(label(el))
  }
  let tiny = 0
  for (const el of Array.from(document.querySelectorAll('button, a[href], input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select'))) {
    if (!visible(el)) continue
    const r = (el as HTMLElement).getBoundingClientRect()
    if (r.width < 24 || r.height < 24) tiny++
  }
  return {
    path,
    final: window.location.pathname,
    title: document.title,
    h1: (document.querySelector('h1') as HTMLElement | null)?.innerText?.slice(0, 40) ?? '',
    textLength: text.length,
    pageOverflowX: document.documentElement.scrollWidth > w + 1,
    overflowing,
    badText: (text.match(new RegExp(BAD, 'g')) ?? []).slice(0, 3),
    consoleErrors: [...new Set(errors.splice(0))].slice(0, 4),
    unnamed: unnamed.slice(0, 4),
    imgNoAlt: Array.from(document.querySelectorAll('img')).filter((i) => visible(i) && !i.hasAttribute('alt')).length,
    tinyTargets: tiny,
    errorShown: /שגיאה בטעינת|לא נמצא|אירעה שגיאה/.test(text),
  }
}

/** mounted inside the router of the harness: gives the console the in-app navigation */
export function QaBridge() {
  const navigate = useNavigate()
  useEffect(() => {
    patchConsole()
    const go = async (path: string) => {
      navigate(path)
      await new Promise((r) => setTimeout(r, 50))
    }
    window.__qa.go = go
    window.__qa.resetQuery = async (key) => {
      await queryClient.resetQueries({ queryKey: key })
    }
    window.__qa.smoke = async (paths, opts = {}) => {
      const rows: SmokeRow[] = []
      for (const p of paths) {
        errors.length = 0
        await go(p)
        await new Promise((r) => setTimeout(r, opts.wait ?? 700))
        rows.push(measure(p))
      }
      return rows
    }
  }, [navigate])
  return null
}
