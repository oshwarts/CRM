import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('security headers (vercel.json)', () => {
  const v = JSON.parse(readFileSync('vercel.json', 'utf8')) as { headers: { source: string; headers: { key: string; value: string }[] }[] }
  const all = Object.fromEntries(v.headers.flatMap((h) => h.headers.map((x) => [x.key, x.value])))

  it('sends the content security policy and the other protective headers', () => {
    for (const k of ['Content-Security-Policy', 'X-Content-Type-Options', 'X-Frame-Options', 'Referrer-Policy', 'Permissions-Policy', 'Strict-Transport-Security']) expect(all[k], k).toBeTruthy()
  })
  it('the policy allows the one inline script of index.html (the theme script) by its hash, and no other inline script', () => {
    const html = readFileSync('index.html', 'utf8')
    const inline = [...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => `sha256-${createHash('sha256').update(m[1]).digest('base64')}`)
    expect(inline.length).toBe(1)
    const csp = all['Content-Security-Policy']
    expect(csp).toContain(`'${inline[0]}'`)
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/)
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-eval'/)
  })
  it('cannot be framed by another site', () => {
    expect(all['Content-Security-Policy']).toContain("frame-ancestors 'none'")
  })
})
