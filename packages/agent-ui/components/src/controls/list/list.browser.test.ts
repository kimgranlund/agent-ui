import { describe, it, expect } from 'vitest'

// G9 s5 — the ui-list cross-engine smoke (Chromium + WebKit via Playwright; npm run test:browser). jsdom
// can't compute flex/gap or honour the [density] ramp — a REAL engine resolves `display:flex; flex-direction
// :column`, the `--ui-space × [density]` gap, and the host-at-boundary AX role. Anti-vacuous: the gap px must
// actually CHANGE across two [density] containers.
//
// Host-at-boundary: the component-styles barrel does NOT yet @import container.css / list.css (that wiring is
// s12), so this test injects the needed sheets DIRECTLY — the foundation tokens (the --c-* roles + the
// --ui-space ladder + the [density] selectors), the SHARED surface/container-type seam, then list.css — and
// imports ./list.ts to self-define `ui-list`.
import '@agent-ui/components/foundation-styles.css' // --c-* roles + the --ui-{height,font,gap,space}-* ramp + [scale]/[density]
import '../_surface/container.css' // the shared surface seam + container-type (s2)
import './list.css' // the element's flex layout
import { UIListElement } from './list.ts' // self-defines ui-list

// Re-expose the protected `internals` so a probe can read the host-at-boundary AX role a real engine applied.
class ProbeList extends UIListElement {
  get probeInternals(): ElementInternals {
    return this.internals
  }
}
if (!customElements.get('ui-list-probe')) customElements.define('ui-list-probe', ProbeList)

/** Mount a ui-list with two items under an optional [density] wrapper; returns the list + a cleanup. */
function mount(tag: string, attrs: Record<string, string>, density?: string): { el: HTMLElement; done: () => void } {
  const wrapper = document.createElement('div')
  if (density) wrapper.setAttribute('density', density)
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  el.append(document.createElement('span'), document.createElement('span')) // two items → a gap BETWEEN them
  wrapper.append(el)
  document.body.append(wrapper)
  return { el, done: () => wrapper.remove() }
}

describe('ui-list cross-engine smoke (s5)', () => {
  it('is a real flex COLUMN (the ui-column specialization) — a real engine resolves display + direction', () => {
    const { el, done } = mount('ui-list', { gap: 'md' })
    const cs = getComputedStyle(el)
    expect(cs.display).toBe('flex')
    expect(cs.flexDirection).toBe('column') // the vertical stack
    done()
  })

  it('host-at-boundary AX: role=list rides internals — a real engine applies it, the host has no role attr', () => {
    const { el, done } = mount('ui-list-probe', {})
    expect((el as ProbeList).probeInternals.role).toBe('list') // the AX role a real engine retained
    expect(el.getAttribute('role')).toBeNull() // NEVER a host attribute
    done()
  })

  it('gap responds to [density] — the row-gap px CHANGES with the ancestor density (anti-vacuous)', () => {
    // gap='md' → var(--ui-space-md) = calc(12px * var(--ui-density)). compact 0.5 → 6px; spacious 1.5 → 18px.
    const compact = mount('ui-list', { gap: 'md' }, 'compact')
    const spacious = mount('ui-list', { gap: 'md' }, 'spacious')

    const compactGap = Number.parseFloat(getComputedStyle(compact.el).rowGap)
    const spaciousGap = Number.parseFloat(getComputedStyle(spacious.el).rowGap)

    expect(compactGap).toBe(6) // 12 × 0.5
    expect(spaciousGap).toBe(18) // 12 × 1.5
    expect(spaciousGap).toBeGreaterThan(compactGap) // anti-vacuous: the gap actually CHANGED with [density]

    compact.done()
    spacious.done()
  })
})
