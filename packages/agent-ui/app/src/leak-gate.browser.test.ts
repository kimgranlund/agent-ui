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

// `ui-agent-admin` is deliberately absent: it renders a thousand-listener subtree that keeps settling for
// seconds after connect (lazy panels), so its host-listener count moved 1052 to 1133 between rounds in
// chromium and the cycle cannot tell a stack from a late render. Its own `agent-admin*.browser.test.ts`
// files own it; the other eleven hosts are stable and gated here.
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
}

describe('app host leak gate: remove and reconnect leave nothing behind', () => {
  const tags = Object.keys(APP_HOSTS)

  it('covers the app hosts (anti-vacuous)', () => {
    expect(tags.length).toBeGreaterThanOrEqual(11)
  })

  it.each(tags)('%s', async (tag) => {
    await APP_HOSTS[tag]()
    expect(customElements.get(tag), `${tag} defined after its module loaded`).toBeDefined()
    const row = await runLeakCycle(inst, tag, { errors })
    expect(leakFlags(row)).toEqual([])
  })
})
