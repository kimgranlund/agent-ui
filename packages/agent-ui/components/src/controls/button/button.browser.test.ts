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

    // block-size is `var(--ui-button-height)` → `var(--ui-height-md)` → `calc(28px * var(--ui-scale))`.
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
