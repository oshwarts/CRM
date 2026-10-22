// Every QA tab gets its own IndexedDB and its own BroadcastChannel, so that the unsent changes (outbox) and the saved cache of one
// tab never leak into another tab that a different agent is testing at the same moment. The id lives in sessionStorage: a reload of
// the same tab keeps its data (a refresh in the middle of a form), a new tab starts clean. Must be the FIRST import of the harness.
let tabId = ''
try {
  tabId = sessionStorage.getItem('qa.tab') ?? ''
  if (!tabId) {
    tabId = Math.random().toString(36).slice(2, 8)
    sessionStorage.setItem('qa.tab', tabId)
  }
} catch {
  tabId = 'x'
}

const realOpen = indexedDB.open.bind(indexedDB)
indexedDB.open = ((name: string, version?: number) => realOpen(`${name}.qa-${tabId}`, version)) as typeof indexedDB.open

const NativeChannel = window.BroadcastChannel
window.BroadcastChannel = class extends NativeChannel {
  constructor(name: string) {
    super(`${name}.qa-${tabId}`)
  }
} as typeof BroadcastChannel
export {}
