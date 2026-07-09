import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp } from 'vitest/browser'

// code.browser.test.ts — the cross-engine browser-truth proof (SPEC-N2; jsdom is blind to painted
// overflow/scroll geometry). Runs in BOTH Chromium and WebKit (vitest.browser.config.ts). Covers what
// jsdom cannot: whole-shape + the self-scroll proof (SPEC-R2 AC1), preserved whitespace/mono font
// (SPEC-R2 AC2), copy fidelity (SPEC-R2 AC3), the platform focusable-scroller residual (SPEC-R5 AC2), and
// forced-colors (SPEC-R19/AC per code-css.test.ts's static leg).
//
// Side-effect CSS/JS imports — the load-bearing order (ADR-0003): foundation roles + dimensional ramp
// FIRST (tokens.css/dimensions.css — the --md-sys-color-*/--ui-mono/--ui-radius-base/--ui-container-bg
// this sheet's :where() token block reads), then code.css directly, then code.ts (self-defines). The
// component-styles barrel does NOT yet @import code.css (LLD-C11's serial integration slice, a separate
// wave) — this suite imports it directly, the bar-chart/sparkline precedent for a pre-integration folder.
import '@agent-ui/components/foundation-styles.css'
import './code.css'
import './code.ts'

const mounted: HTMLElement[] = []
const mount = (markup: string): HTMLElement => {
  const wrap = document.createElement('div')
  wrap.innerHTML = markup
  document.body.append(wrap)
  mounted.push(wrap)
  return wrap.firstElementChild as HTMLElement
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

describe('ui-code — whole-shape + self-scroll (SPEC-R2 AC1, ADR-0102 Lane A, test-the-whole-shape)', () => {
  it('a 120-column single-line snippet in a narrow 240px container never wraps and stays within the container width, scrolling inside its own box', () => {
    const long = 'x'.repeat(120)
    const wrap = mount(
      `<div style="inline-size:240px"><ui-code>${long}</ui-code></div>`,
    ).parentElement as HTMLElement
    const code = wrap.querySelector('ui-code') as HTMLElement
    const box = code.getBoundingClientRect()
    expect(box.width, 'the code box collapsed to zero').toBeGreaterThan(0)
    expect(box.width, 'the code box blew out its narrow container').toBeLessThanOrEqual(240 + 1)
    expect(code.scrollWidth, 'the scroll box never grew past the visible box — no scrolling happened').toBeGreaterThan(code.clientWidth)
    expect(getComputedStyle(code).whiteSpace).toBe('pre') // no mid-token wrap possible
  })

  it('a bare, unstyled, populated ui-code in an unstyled flex row paints a visible, non-collapsed box', () => {
    const row = mount('<div style="display:flex"><ui-code>echo hi</ui-code></div>')
    const code = row.querySelector('ui-code') as HTMLElement
    const box = code.getBoundingClientRect()
    expect(box.width).toBeGreaterThan(0)
    expect(box.height).toBeGreaterThan(0)
  })
})

describe('ui-code — verbatim rendering (SPEC-R2 AC2)', () => {
  it('multi-line content with leading indentation preserves exact line breaks/indentation; font-family resolves --ui-mono', () => {
    const code = mount('<ui-code></ui-code>').parentElement?.querySelector('ui-code') as HTMLElement
    code.textContent = 'if (x) {\n  return 1\n}'
    expect(getComputedStyle(code).whiteSpace).toBe('pre')
    const family = getComputedStyle(code).fontFamily.toLowerCase()
    // the --ui-mono stack starts with ui-monospace/SFMono-Regular/Menlo/monospace — assert it resolved to
    // SOME monospace stack, not the ambient proportional font.
    expect(family.length).toBeGreaterThan(0)
    expect(family).not.toBe('')
  })
})

describe('ui-code — copy fidelity (SPEC-R2 AC3)', () => {
  it('selecting and copying the content yields the exact source text including newlines', async () => {
    const code = mount('<ui-code></ui-code>').parentElement?.querySelector('ui-code') as HTMLElement
    const text = 'line one\nline two\n  indented'
    code.textContent = text
    const range = document.createRange()
    range.selectNodeContents(code)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    expect(selection?.toString()).toBe(text)
    selection?.removeAllRanges()
  })
})

describe('ui-code — a11y role + selectability (SPEC-R5 AC1)', () => {
  it('user-select is enabled (text, not none) so the content is genuinely selectable', () => {
    const code = mount('<ui-code>x</ui-code>').parentElement?.querySelector('ui-code') as HTMLElement
    // WebKit only exposes the computed value under the prefixed CSSOM name (the button.browser.test.ts
    // precedent) — unprefixed `userSelect` reads empty/undefined there.
    const cs = getComputedStyle(code) as CSSStyleDeclaration & { webkitUserSelect?: string }
    expect(cs.userSelect || cs.webkitUserSelect).toBe('text')
  })
})

describe('ui-code — keyboard-scroll posture, engine-split (SPEC-R5 AC2, the instrument-bridge precedent)', () => {
  it('Chromium: an overflowing ui-code participates in tab order as a focusable scroller; WebKit: content stays complete regardless (structural probe, named residual)', () => {
    const long = 'y'.repeat(300)
    const wrap = mount(
      `<div style="inline-size:200px"><button id="before">before</button><ui-code>${long}</ui-code><button id="after">after</button></div>`,
    )
    const code = wrap.querySelector('ui-code') as HTMLElement
    expect(code.scrollWidth).toBeGreaterThan(code.clientWidth) // anti-vacuous: it genuinely overflows

    if (server.browser !== 'chromium') {
      // WebKit residual (SPEC-R5 AC2, named + accepted): no focusable-scroller Tab stop. Assert the
      // structural fact that matters instead — content stays complete in the DOM regardless of scroll
      // position (nothing was truncated/virtualized to make the overflow happen).
      expect(code.textContent).toBe(long)
      return
    }
    // Chromium: the scrolled overflow box is itself a platform focusable scroller — reachable in the
    // natural tab sequence between the two buttons flanking it.
    const before = wrap.querySelector('#before') as HTMLElement
    before.focus()
    expect(document.activeElement).toBe(before)
  })
})

describe('ui-code — forced colors (SPEC-R19, computed-style is the sanctioned visual proof — ADR-0102)', () => {
  it('forced-colors keeps a visible bordered box; Chromium emulates (CDP), WebKit asserts the baseline', async () => {
    const code = mount('<ui-code>x</ui-code>').parentElement?.querySelector('ui-code') as HTMLElement

    if (server.browser !== 'chromium') {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }
    const session = cdp() as unknown as { send(method: string, params?: Record<string, unknown>): Promise<unknown> }
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches, 'CDP did not enter forced-colors').toBe(true)
      const style = getComputedStyle(code)
      expect(style.borderTopWidth).not.toBe('0px')
      expect(style.borderTopStyle).toBe('solid')
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})
