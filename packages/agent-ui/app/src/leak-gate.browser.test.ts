// leak-gate.browser.test.ts: the app hosts' half of the standing no-leak gate (T-0543). Each app-surface
// composition is connected, removed and reconnected three times in a real engine (chromium and webkit via
// the `packages` project) and must leave no window or document listener, observer, interval, pending timer,
// open popover or stacked host listener behind. The counting layer and the verdict rules are the components
// package's `leak-instrument.ts` (the control half is `components/src/leak-gate.browser.test.ts`, which also
// carries the negative control that proves the checker bites).

import { describe, it, expect, vi } from 'vitest'
import { installLeakInstrument, runLeakCycle, leakFlags } from '../../components/src/leak-instrument.ts'

// GH #347 (REAL-TIMING HEADROOM): each cycle awaits frames and short real waits.
vi.setConfig({ testTimeout: 30_000 })

const inst = installLeakInstrument()

const errors: string[] = []
const RO_LOOP = 'ResizeObserver loop completed with undelivered notifications'
window.addEventListener('error', (e) => {
  if (!String(e.message).includes(RO_LOOP)) errors.push(String(e.message))
})
window.addEventListener('unhandledrejection', (e) => {
  errors.push(String((e as PromiseRejectionEvent).reason))
})

// `ui-agent-admin` mounts three lazy CodeMirror editors whose listeners land late but on a fixed schedule:
// the editors take the host from 1052 to 1133 listeners within a frame or two of the lazy import, and each
// editor's DOMObserver re-walks its scroll ancestors one second after its first IntersectionObserver callback
// (`parentCheck = setTimeout(listenForScroll, 1000)` in @codemirror/view), adding 54 scroll listeners up to
// 1187 in chromium (1190 in webkit). Every round settles to the same count and `destroy()` clears the timer
// and the listeners (T-0562), so its arm waits until the host's listener count has been still for longer than
// that one second before the snapshot.
const SETTLE_QUIET_MS = 1_500
const SETTLE_CAP_MS = 10_000
const settleHostListeners = async (el: HTMLElement): Promise<void> => {
  const wait = (ms: number): Promise<void> => new Promise((r) => inst.realSetTimeout(r, ms))
  const start = performance.now()
  let last = inst.snap(el).hostListeners
  let stillSince = performance.now()
  while (performance.now() - stillSince < SETTLE_QUIET_MS) {
    if (performance.now() - start > SETTLE_CAP_MS) throw new Error(`host listeners never settled (last ${last})`)
    await wait(50)
    const n = inst.snap(el).hostListeners
    if (n !== last) {
      last = n
      stillSince = performance.now()
    }
  }
}
const ARM: Record<string, (el: HTMLElement) => Promise<void>> = {
  'ui-agent-admin': settleHostListeners,
}

const APP_HOSTS: Record<string, () => Promise<unknown>> = {
  'ui-super-shell': () => import('./controls/super-shell/super-shell.ts'),
  'ui-workspace-shell': () => import('./controls/workspace-shell/workspace-shell.ts'),
  'ui-chat-shell': () => import('./controls/chat-shell/chat-shell.ts'),
  'ui-master-detail': () => import('./controls/master-detail/master-detail.ts'),
  'ui-nav-rail': () => import('./controls/nav-rail/nav-rail.ts'),
  'ui-settings': () => import('./controls/settings/settings.ts'),
  'ui-surface-host': () => import('./controls/surface-host/surface-host.ts'),
  'ui-conversation': () => import('./controls/conversation/conversation.ts'),
  'ui-conversation-dialog': () => import('./controls/conversation/conversation-dialog.ts'),
  'ui-conversation-header': () => import('./controls/conversation/conversation-header.ts'),
  'ui-conversation-composer': () => import('./controls/conversation/conversation-composer.ts'),
  'ui-agent-admin': () => import('./controls/agent-admin/agent-admin.ts'),
}

describe('app host leak gate: remove and reconnect leave nothing behind', () => {
  const tags = Object.keys(APP_HOSTS)

  it('covers the app hosts (anti-vacuous)', () => {
    expect(tags.length).toBeGreaterThanOrEqual(12)
  })

  it.each(tags)('%s', async (tag) => {
    await APP_HOSTS[tag]()
    expect(customElements.get(tag), `${tag} defined after its module loaded`).toBeDefined()
    const row = await runLeakCycle(inst, tag, { errors, arm: ARM[tag] })
    expect(leakFlags(row)).toEqual([])
  })
})
