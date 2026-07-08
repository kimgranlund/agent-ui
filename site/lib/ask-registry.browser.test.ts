// ask-registry.browser.test.ts — ADR-0097 §2: the per-ask lifecycle mechanism, proven in a REAL engine
// (Playwright via vitest-browser). jsdom-green ≠ done (CLAUDE.md) — the load-bearing fact this file proves
// that jsdom cannot is `inert`'s REAL behavior: it removes an element from the accessibility tree, kills
// tab order, and suppresses pointer/click dispatch platform-wide. `ask-registry.test.ts` (jsdom) already
// covers the pure routing helpers + the DOM-mutation contract (dataset/state bookkeeping); this file is
// the real-engine complement for the one thing that needs a real engine.

import { describe, it, expect, afterEach } from 'vitest'
import { userEvent } from 'vitest/browser'
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import '@agent-ui/components/components'
import { AskRegistry } from './ask-registry.ts'
import type { A2uiClientMessage } from '@agent-ui/a2ui'

const mounted: HTMLElement[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

function fixture(): { bubble: HTMLElement; mountEl: HTMLElement } {
  const bubble = document.createElement('div')
  const mountEl = document.createElement('div')
  bubble.append(mountEl)
  document.body.append(bubble)
  mounted.push(bubble)
  return { bubble, mountEl }
}

function ingestAskSurface(host: { ingest: (line: string) => void; finalize: () => void }, surfaceId: string): void {
  host.ingest(`{"version":"v1.0","createSurface":{"surfaceId":"${surfaceId}","catalogId":"agent-ui","sendDataModel":true}}`)
  host.ingest(
    `{"version":"v1.0","updateComponents":{"surfaceId":"${surfaceId}","components":[{"id":"root","component":"Button","label":"Go","action":{"action":"submit"}}]}}`,
  )
  host.finalize()
}

describe('AskRegistry — real-engine lifecycle (ADR-0097 §2)', () => {
  it('an ask surface renders a REAL clickable ui-button that emits an action', () => {
    const registry = new AskRegistry()
    const { bubble, mountEl } = fixture()
    const messages: A2uiClientMessage[] = []
    const entry = registry.create('ask-1', bubble, mountEl, (m) => messages.push(m))
    ingestAskSurface(entry.host, 'ask-1')

    const button = mountEl.querySelector('ui-button') as HTMLElement
    expect(button).not.toBeNull()
    button.click()
    expect(messages).toHaveLength(1)
    expect('action' in messages[0]! && messages[0].action.name).toBe('submit')
  })

  it('freeze() makes the bubble genuinely inert — a REAL user gesture on its button no longer reaches it (pointer events suppressed by the engine)', async () => {
    // `element.click()` (the programmatic DOM method, used everywhere else in this file) BYPASSES normal
    // hit-testing — it invokes the activation behavior directly and is NOT blocked by `inert`'s UA
    // `pointer-events:none`. Only a REAL user gesture (Playwright input via `userEvent`, going through the
    // actual browser input pipeline) is hit-test-gated and therefore actually proves `inert` bites.
    const registry = new AskRegistry()
    const { bubble, mountEl } = fixture()
    const messages: A2uiClientMessage[] = []
    const entry = registry.create('ask-1', bubble, mountEl, (m) => messages.push(m))
    ingestAskSurface(entry.host, 'ask-1')
    const button = mountEl.querySelector('ui-button') as HTMLElement

    registry.freeze('ask-1', 'answered')
    expect(bubble.inert).toBe(true) // the REAL IDL attribute — a genuine boolean, not an expando (unlike jsdom)
    expect(bubble.dataset.state).toBe('answered')

    await userEvent.click(button, { force: true }).catch(() => undefined) // an inert target may reject the click entirely
    expect(messages, 'a real user gesture on an inert bubble must not reach the control at all').toHaveLength(0)
  })

  it('freeze() removes the frozen subtree from the tab order — Tab navigation never lands inside it', async () => {
    const registry = new AskRegistry()
    const before = document.createElement('button')
    before.textContent = 'before'
    document.body.append(before)
    mounted.push(before)
    const { bubble, mountEl } = fixture()
    const entry = registry.create('ask-1', bubble, mountEl, () => {})
    ingestAskSurface(entry.host, 'ask-1')

    registry.freeze('ask-1', 'bypassed')
    before.focus()
    expect(document.activeElement).toBe(before)
    await userEvent.tab() // Tab from `before` — must skip the entire inert subtree
    expect(document.activeElement, 'Tab must not have landed inside the inert ask bubble').not.toBe(
      mountEl.querySelector('ui-button'),
    )
  })

  it('a NEW ask (a different, still-pending surfaceId) stays fully interactive while an OLDER one is frozen — freezing is per-entry, not global', () => {
    const registry = new AskRegistry()
    const older = fixture()
    const newer = fixture()
    const oldEntry = registry.create('ask-1', older.bubble, older.mountEl, () => {})
    ingestAskSurface(oldEntry.host, 'ask-1')
    registry.freeze('ask-1', 'bypassed')

    const messages: A2uiClientMessage[] = []
    const newEntry = registry.create('ask-2', newer.bubble, newer.mountEl, (m) => messages.push(m))
    ingestAskSurface(newEntry.host, 'ask-2')
    expect(newer.bubble.inert).toBe(false)

    const newButton = newer.mountEl.querySelector('ui-button') as HTMLElement
    newButton.click()
    expect(messages).toHaveLength(1) // the new ask is fully live even though an old one is frozen
  })

  it('disposeAll() tears down every host — the mounted controls are gone from the DOM', () => {
    const registry = new AskRegistry()
    const { bubble, mountEl } = fixture()
    const entry = registry.create('ask-1', bubble, mountEl, () => {})
    ingestAskSurface(entry.host, 'ask-1')
    expect(mountEl.querySelector('ui-button')).not.toBeNull()

    registry.disposeAll()
    expect(mountEl.querySelector('ui-button')).toBeNull()
  })
})
