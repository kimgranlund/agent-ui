// card-header-slot.test.ts — GH #808 S1, catalog SPEC-R2's jsdom-assertable half of AC1 (+ AC2's
// graceful-fallback leg). Drives the FULL renderer host (`createRenderer`) with the REAL default
// catalog/factories — proving the wire-to-DOM path end to end: an Icon/Badge payload carrying `slot`
// really lands the native `slot` ATTRIBUTE on the light-DOM child `ui-card-header` receives. The real
// three-column `auto 1fr auto` GRID PLACEMENT `:has([slot='leading'])` drives (cascade-dependent, the
// TKT-0002 class) is the sibling real-engine probe, `card-header-slot.browser.test.ts` — jsdom cannot
// see `:has()`-driven layout, only the DOM shape this file asserts.

import { describe, it, expect } from 'vitest'
import '@agent-ui/components/components' // self-defines ui-* controls (the real default-catalog factories)
import { createRenderer } from './renderer.ts'

function harness() {
  const r = createRenderer()
  const mount = document.createElement('div')
  document.body.append(mount)
  r.mount(mount)
  r.ingestMessage({ version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'agent-ui' } })
  return { r, mount, cleanup: () => { r.dispose(); mount.remove() } }
}

describe('CardHeader slot reachability — GH #808 S1, catalog SPEC-R2', () => {
  it('AC1: Icon(slot:leading) + Text + Badge(slot:trailing) land their `slot` attribute on the real light-DOM children', () => {
    const { r, mount, cleanup } = harness()
    r.ingestMessage({
      version: 'v1.0',
      updateComponents: {
        surfaceId: 's1',
        components: [
          { id: 'root', component: 'Card', children: ['header'] },
          { id: 'header', component: 'CardHeader', children: ['icon', 'title', 'badge'] },
          { id: 'icon', component: 'Icon', name: 'calendar', slot: 'leading' },
          { id: 'title', component: 'Text', text: 'Date selection' },
          { id: 'badge', component: 'Badge', label: 'Confirmed', intent: 'success', slot: 'trailing' },
        ],
      },
    })

    const header = mount.querySelector('ui-card-header')!
    expect(header).not.toBeNull()
    const icon = header.querySelector('ui-icon')!
    const badge = header.querySelector('ui-badge')!
    expect(icon.getAttribute('slot')).toBe('leading')
    expect(badge.getAttribute('slot')).toBe('trailing')
    // The centre title carries NO slot attribute — the label column is the slotless default.
    const title = header.querySelector('ui-text')!
    expect(title.hasAttribute('slot')).toBe(false)

    cleanup()
  })

  it('AC2: a CardHeader child with no `slot` still renders (graceful no-uptake, Lane C)', () => {
    const { r, mount, cleanup } = harness()
    r.ingestMessage({
      version: 'v1.0',
      updateComponents: {
        surfaceId: 's1',
        components: [
          { id: 'root', component: 'Card', children: ['header'] },
          { id: 'header', component: 'CardHeader', children: ['icon', 'title'] },
          { id: 'icon', component: 'Icon', name: 'calendar' }, // no slot — reads in the label column
          { id: 'title', component: 'Text', text: 'Date selection' },
        ],
      },
    })

    const header = mount.querySelector('ui-card-header')!
    const icon = header.querySelector('ui-icon')!
    expect(icon).not.toBeNull() // still rendered — no crash, no dropped node
    expect(icon.hasAttribute('slot')).toBe(false)

    cleanup()
  })
})
