import { describe, expect, it } from 'vitest'
import { canReloadNow } from '../lib/autoUpdate'

const base = { outbox: 0, dialogOpen: false, typing: false, lastReloadAt: 0, now: 1_000_000 }

describe('reloading by itself for a new version', () => {
  it('reloads when nothing is in progress', () => {
    expect(canReloadNow(base)).toBe(true)
  })
  it('waits while changes are queued to be sent', () => {
    expect(canReloadNow({ ...base, outbox: 2 })).toBe(false)
  })
  it('waits while a dialog is open or the person is typing', () => {
    expect(canReloadNow({ ...base, dialogOpen: true })).toBe(false)
    expect(canReloadNow({ ...base, typing: true })).toBe(false)
  })
  it('does not reload twice within a minute (a deployment still spreading)', () => {
    expect(canReloadNow({ ...base, lastReloadAt: base.now - 30_000 })).toBe(false)
    expect(canReloadNow({ ...base, lastReloadAt: base.now - 61_000 })).toBe(true)
  })
})
