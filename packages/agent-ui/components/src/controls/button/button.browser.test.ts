import { describe, it, expect } from 'vitest'

// Phase-1 s12 — the browser-truth harness PROOF (trivial, not the real geometry smoke — that's s13).
// This asserts only that the harness is alive: the family self-defines, the foundation + component CSS
// inject through Vite, and a real engine resolves the `--ui-button-*` token chain to a computed px frame.
// It runs in BOTH Chromium and WebKit (vitest.browser.config.ts → playwright instances).

// Side-effect imports. Order is the load-bearing CSS order (ADR-0003): foundation (the `--md-sys-color-*` colour
// roles + the `--ui-{height,font,gap}-*` ramp) FIRST, then the component sheet (button's `:where()`
// token block + `@scope` styles), then the self-defining family barrel (registers `ui-button`). Vite
// resolves the bare specifiers + the barrels' inner `@import '@agent-ui/shared/...'` and injects the CSS.
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import '@agent-ui/components/components'

describe('ui-button browser-truth harness (s12)', () => {
  it('mounts ui-button and a real engine resolves the --ui-button-* frame to a computed px', () => {
    const el = document.createElement('ui-button')
    el.textContent = 'Go'
    document.body.append(el)

    // block-size is `var(--ui-button-height)` → `var(--md-sys-height-md)` → `calc(28px * var(--md-sys-scale))`.
    // If the foundation/component CSS or the token chain hadn't resolved, this would not be a real px.
    const blockSize = getComputedStyle(el).blockSize
    expect(blockSize).toMatch(/px$/)
    expect(Number.parseFloat(blockSize)).toBeGreaterThan(0)
    expect(Number.parseFloat(blockSize)).toBe(28) // md frame @ scale 1 — the ramp truly resolved

    el.remove()
  })

  it('disables text selection on the control surface in a real engine (incl. WebKit)', () => {
    const el = document.createElement('ui-button')
    el.textContent = 'Go'
    document.body.append(el)

    // The label is a control affordance, not selectable text. WebKit/Safari only honours this via the
    // `-webkit-user-select` prefix AND exposes the computed value under the prefixed CSSOM name — the
    // unprefixed `userSelect` is empty there (proven by this test: it was the failure before the prefix).
    // Chromium exposes the unprefixed name. Read both so the assertion is cross-engine-true.
    const cs = getComputedStyle(el) as CSSStyleDeclaration & { webkitUserSelect?: string }
    expect(cs.userSelect || cs.webkitUserSelect).toBe('none')

    el.remove()
  })
})


// -- ADR-0223 (Fill by Default, slice 2 -- action/selection): the two-posture acceptance leg, the
//    generalized ADR-0021 smoke (the text-field pilot's shape): FILL -- a bare host in block flow
//    stretches to the container's inline size (the container IS the floor); [inline] -- the host hugs
//    its content and sits BELOW the container. No clause 3(b) content floor exists on this control (only ui-button's R3(a) squareness floor, which survives all states).
describe('ui-button -- ADR-0223 two postures (fill default / [inline] hug, both engines)', () => {
  it('bare host offsetWidth ~= container inline size (fill); [inline] host hugs below the container', async () => {
    const wrap = document.createElement('div')
    wrap.style.inlineSize = '640px' // a wide BLOCK container -- wider than any hug resolution
    wrap.innerHTML = `<ui-button>Save</ui-button>`
    document.body.append(wrap)
    const host = wrap.querySelector('ui-button') as HTMLElement & { updateComplete?: Promise<unknown> }
    await host.updateComplete
    // FILL (the default): block-level -- the host stretches to the container.
    const containerWidth = wrap.getBoundingClientRect().width
    expect(host.offsetWidth, 'the bare host did not FILL its block container (ADR-0223 cl.1)').toBeCloseTo(containerWidth, 0)
    expect(getComputedStyle(host).display, 'the default host is not block-level').toBe('grid')
    // HUG (the ONE opt-out): [inline] flips display level AND posture -- content-sized, below the container.
    host.setAttribute('inline', '')
    const hugged = host.offsetWidth
    expect(hugged, 'the [inline] host collapsed to nothing').toBeGreaterThan(0)
    // R3(a) -- the squareness floor (min-inline-size = height) survives BOTH states (ADR-0223 cl.3(a)).
    const floorPx = Number.parseFloat(getComputedStyle(host).minInlineSize)
    expect(floorPx, 'the squareness floor did not survive [inline]').toBeGreaterThan(0)
    expect(hugged, 'the [inline] host is narrower than its squareness floor').toBeGreaterThanOrEqual(Math.floor(floorPx))
    expect(hugged, 'the [inline] host did not HUG -- it still fills the container').toBeLessThan(containerWidth)
    expect(getComputedStyle(host).display, 'the [inline] host is not inline-level').toBe('inline-grid')
    wrap.remove()
  })
})
