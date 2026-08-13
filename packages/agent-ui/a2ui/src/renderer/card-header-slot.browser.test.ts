// card-header-slot.browser.test.ts — GH #808 S1, catalog SPEC-R2 AC1's real-engine half: the
// three-column `auto 1fr auto` grid `card.css`'s `:has([slot='leading'])`/`:has([slot='trailing'])`
// pair drives is CASCADE-dependent (the TKT-0002 class — `:has()` selector matching is not something
// jsdom can see), so it needs a real Chromium/WebKit computed-style read. `card-header-slot.test.ts`
// (jsdom) owns the DOM-shape half (the `slot` attribute really lands on the right child).

import { describe, it, expect } from 'vitest'
// Side-effect CSS imports — load-bearing ORDER (foundation tokens/ramp first, then the shipped component
// sheets incl. card.css's `:has([slot=…])` grid this file probes; the `component-styles.css` barrel
// precedent, verified against `packages/agent-ui/app/src/controls/*.browser.test.ts`). `factories.ts`
// (pulled in by `createRenderer`) only self-defines the CUSTOM ELEMENTS (`@agent-ui/components/components`)
// — it carries zero CSS bytes (the framework's own JS/CSS split, plan §2) — so a renderer-level browser
// test that reads COMPUTED STYLE must import the stylesheet barrels itself, same as every other consumer.
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
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

describe('CardHeader slot reachability — real-engine cell placement (GH #808 S1, catalog SPEC-R2 AC1)', () => {
  it('a wire payload carrying both Icon(slot:leading) and Badge(slot:trailing) resolves the real three-column auto 1fr auto grid', () => {
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

    const header = mount.querySelector('ui-card-header') as HTMLElement
    const columns = getComputedStyle(header).gridTemplateColumns.trim().split(/\s+/)
    expect(columns).toHaveLength(3) // [leading | label | trailing] — auto 1fr auto (card.css)

    // Real layout, not just the declared template: the icon sits left of the title, the badge right of it.
    const icon = header.querySelector('ui-icon')!.getBoundingClientRect()
    const title = header.querySelector('ui-text')!.getBoundingClientRect()
    const badge = header.querySelector('ui-badge')!.getBoundingClientRect()
    expect(icon.left).toBeLessThan(title.left)
    expect(title.left).toBeLessThan(badge.left)

    cleanup()
  })

  it('a wire payload carrying only Icon(slot:leading) resolves the two-column auto 1fr grid (AC2 fallback shape stays a live 2-col grid, not a crash)', () => {
    const { r, mount, cleanup } = harness()
    r.ingestMessage({
      version: 'v1.0',
      updateComponents: {
        surfaceId: 's1',
        components: [
          { id: 'root', component: 'Card', children: ['header'] },
          { id: 'header', component: 'CardHeader', children: ['icon', 'title'] },
          { id: 'icon', component: 'Icon', name: 'calendar', slot: 'leading' },
          { id: 'title', component: 'Text', text: 'Date selection' },
        ],
      },
    })

    const header = mount.querySelector('ui-card-header') as HTMLElement
    const columns = getComputedStyle(header).gridTemplateColumns.trim().split(/\s+/)
    expect(columns).toHaveLength(2) // [leading | label] — auto 1fr

    cleanup()
  })

  it('no slotted children at all resolves the slotless single-column grid (AC2: no-uptake is graceful)', () => {
    const { r, mount, cleanup } = harness()
    r.ingestMessage({
      version: 'v1.0',
      updateComponents: {
        surfaceId: 's1',
        components: [
          { id: 'root', component: 'Card', children: ['header'] },
          { id: 'header', component: 'CardHeader', children: ['icon', 'title'] },
          { id: 'icon', component: 'Icon', name: 'calendar' }, // no slot — stacks in the label column
          { id: 'title', component: 'Text', text: 'Date selection' },
        ],
      },
    })

    const header = mount.querySelector('ui-card-header') as HTMLElement
    const columns = getComputedStyle(header).gridTemplateColumns.trim().split(/\s+/)
    expect(columns).toHaveLength(1) // [label] — slotless, the pre-S1 shape, still legal

    cleanup()
  })
})
