import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { server } from 'vitest/browser'
import { UIElement } from '../dom/index.ts'
import { overlay } from './overlay.ts'
import type { OverlayHandle, OverlayOptions } from './overlay.ts'

// overlay.browser.test.ts — cross-engine proof for the CSS Anchor Positioning enhanced path (GH #951,
// overlay-controller LLD-C1..C4 · ADR-0043/0045 the ONE overlay controller gate: a Chromium-only pass
// is not a pass).
//
// Engine-support matrix MEASURED against this repo's pinned Playwright build before writing any of the
// tests below (`CSS.supports`/`@position-try` insertRule probes, both engines):
//   chromium (playwright ^1.61.1 bundled build) — anchor-name/position-anchor/position-try-fallbacks/
//     position-try (shorthand)/anchor()/anchor-size()/`@position-try` at-rule: ALL supported.
//   webkit   (playwright webkit-2311, "WebKit 26.5" — at/after Safari 26, the ADR-0043-gate-relevant
//     line) — ALL of the same probes: ALL supported.
// Both engines land on the ENHANCED path in every test below — there is no Chromium-only-with-a-
// WebKit-baseline-leg fork needed here (that fork is reserved for when the pinned WebKit genuinely
// lacks a feature, e.g. popover.browser.test.ts's forced-colors leg — CDP has no WebKit analogue,
// which IS an engine gap; anchor positioning is not, on this pinned build).
//
// What's proven here (none of this resolves in jsdom — see overlay.test.ts for the JS-path unit
// probes, unmodified by this ticket):
//   [1] feature-detect matrix — both engines resolve to the enhanced path (informational + a live
//       regression trip-wire: a future Playwright bump that drops WebKit anchor-positioning support
//       would fail this first, loudly, rather than silently degrading data-placement fidelity)
//   [2] enhanced path wiring — anchor-name / position-anchor / position-try-fallbacks land on the
//       real elements; `position: fixed` + placement insets resolve; data-placement matches
//   [3] flip parity — an anchor with no room on the preferred side resolves to the JS path's SAME
//       single opposite-side flip (never a rotation through all 4 sides)
//   [4] NO scroll/resize capture-phase listeners registered on the enhanced path (the entire point)
//   [5] the JS path still works, byte-identical, when the feature is UNSUPPORTED — proven live in
//       these same real engines by stubbing `CSS.supports` to force the fallback branch
//   [6] the ADR-0101 announce contract is unchanged by path choice (open/close/toggle discrimination
//       still holds on the enhanced path)

class OverlayEl extends UIElement {
  handle: OverlayHandle | null = null
  readonly popup: HTMLElement = document.createElement('div')
  readonly anchor: HTMLButtonElement = document.createElement('button')
  overlayOpts: Partial<Omit<OverlayOptions, 'popup' | 'anchor'>> = {}

  protected connected(): void {
    this.handle = overlay(this, { popup: this.popup, anchor: this.anchor, ...this.overlayOpts })
  }
}
if (!customElements.get('ui-overlay-browser-test')) {
  customElements.define('ui-overlay-browser-test', OverlayEl)
}

// A bare host that does NOT call overlay() itself — used by the forced-unsupported leg below so its
// anchor/popup pair is never touched by the enhanced-path module before the forced instance runs.
class BareHostEl extends UIElement {
  protected connected(): void {}
}
if (!customElements.get('ui-overlay-bare-host-test')) {
  customElements.define('ui-overlay-bare-host-test', BareHostEl)
}

const mounted: OverlayEl[] = []

function makeHost(opts: Partial<Omit<OverlayOptions, 'popup' | 'anchor'>> = {}): {
  el: OverlayEl
  popup: HTMLElement
  anchor: HTMLButtonElement
} {
  const el = new OverlayEl()
  el.overlayOpts = opts
  el.anchor.textContent = 'Toggle'
  el.popup.textContent = 'Panel content'
  el.popup.style.width = '150px'
  el.popup.style.height = '80px'
  document.body.append(el, el.anchor, el.popup)
  mounted.push(el)
  return { el, popup: el.popup, anchor: el.anchor }
}

afterEach(() => {
  while (mounted.length) {
    const el = mounted.pop()!
    try { el.handle?.cleanup() } catch { /* already gone */ }
    el.popup.remove()
    el.anchor.remove()
    el.remove()
  }
})

/** Wait a couple of frames — belt-and-braces headroom for the platform's own anchor-positioning pass
 * to settle before a geometry read. `data-placement` itself resolves SYNCHRONOUSLY inside `open()` on
 * both paths (a forced-layout `getBoundingClientRect()` read, see overlay.ts's `applyAnchoredPlacement`
 * doc comment) — this wait is not load-bearing for that attribute, only for the raw rect assertions
 * below that read real computed geometry. */
const settle = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [1] feature-detect matrix (informational + regression trip-wire)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('overlay — CSS Anchor Positioning feature-detect matrix', () => {
  it(`${server.browser}: CSS.supports('anchor-name') is true on this repo's pinned build`, () => {
    expect(
      typeof CSS !== 'undefined' && CSS.supports('anchor-name: --x'),
      `${server.browser}: this test's whole premise (both engines take the enhanced path below) ` +
        'depends on this — if it ever goes false, the enhanced-path tests below would be silently ' +
        'vacuous; re-derive the matrix in this file\'s header comment before touching anything else',
    ).toBe(true)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [2] enhanced-path wiring: anchor-name / position-anchor / position-try-fallbacks / data-placement
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('overlay — enhanced path wiring (both engines)', () => {
  it(`${server.browser}: open() sets anchor-name/position-anchor/position-try-fallbacks and resolves data-placement`, async () => {
    const { el, popup, anchor } = makeHost()
    anchor.style.position = 'fixed'
    anchor.style.top = '100px'
    anchor.style.left = '100px'

    el.handle!.open()
    // NO await/settle before this read — every shipped consumer (menu/select/combo-box/popover/
    // form-popover/tooltip/nav-rail/text-field popups) reads data-placement synchronously right after
    // open(); this is the exact contract a first rAF-deferred draft broke (6 consumer-suite
    // regressions, caught live) before landing on the synchronous forced-layout read.
    expect(
      popup.getAttribute('data-placement'),
      `${server.browser}: data-placement must resolve SYNCHRONOUSLY inside open(), matching the JS path's own synchronous position() call`,
    ).toBe('bottom-start')
    await settle()

    expect(anchor.style.getPropertyValue('anchor-name'), `${server.browser}: anchor-name never set on the anchor`).toMatch(/^--ui-overlay-anchor-/)
    expect(popup.style.getPropertyValue('position-anchor'), `${server.browser}: position-anchor never set on the popup`).toMatch(/^--ui-overlay-anchor-/)
    expect(popup.style.getPropertyValue('position-try-fallbacks'), `${server.browser}: no position-try-fallbacks registered`).toMatch(/^--ui-overlay-try-/)
    expect(getComputedStyle(popup).position, `${server.browser}: popup is not position:fixed on the enhanced path`).toBe('fixed')

    expect(popup.getAttribute('data-placement'), `${server.browser}: data-placement not resolved on the enhanced path`).toBe('bottom-start')

    // Real geometry proof — the panel is actually BELOW the anchor (compositor-resolved, not a stub).
    const a = anchor.getBoundingClientRect()
    const p = popup.getBoundingClientRect()
    expect(p.top, `${server.browser}: panel top is not below the anchor's bottom edge`).toBeGreaterThanOrEqual(a.bottom - 1)
    expect(p.left, `${server.browser}: panel left is not anchor-aligned (start)`).toBeCloseTo(a.left, 0)
  })

  it(`${server.browser}: a shared @position-try stylesheet is injected exactly once per document`, () => {
    const styles = document.head.querySelectorAll('#ui-overlay-anchor-tries')
    expect(styles.length, `${server.browser}: expected exactly one injected @position-try stylesheet`).toBe(1)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [3] flip parity — SAME single opposite-side flip as the JS path, never a multi-side rotation
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('overlay — enhanced path flip parity (both engines)', () => {
  it(`${server.browser}: bottom-start flips to top-start when there is no room below (matches computePosition's binary flip)`, async () => {
    const { el, popup, anchor } = makeHost({ placement: 'bottom-start' })
    anchor.style.position = 'fixed'
    anchor.style.left = '100px'
    // Pin the anchor near the viewport's bottom edge — plenty of room above, none below.
    anchor.style.top = `${window.innerHeight - 30}px`

    el.handle!.open()
    await settle()

    expect(
      popup.getAttribute('data-placement'),
      `${server.browser}: expected the flip target top-start, never a rotation to left/right`,
    ).toBe('top-start')

    const a = anchor.getBoundingClientRect()
    const p = popup.getBoundingClientRect()
    expect(p.bottom, `${server.browser}: flipped panel bottom is not above the anchor's top edge`).toBeLessThanOrEqual(a.top + 1)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [4] NO scroll/resize capture-phase listeners on the enhanced path — the entire point (asserted)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('overlay — enhanced path registers no scroll/resize listeners (both engines)', () => {
  let addSpyCalls: Array<{ type: string; options: unknown }> = []
  let originalAddEventListener: typeof window.addEventListener

  beforeEach(() => {
    addSpyCalls = []
    originalAddEventListener = window.addEventListener.bind(window)
    window.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: unknown) => {
      addSpyCalls.push({ type, options })
      return originalAddEventListener(type, listener, options as AddEventListenerOptions | boolean)
    }) as typeof window.addEventListener
  })

  afterEach(() => {
    window.addEventListener = originalAddEventListener
  })

  it(`${server.browser}: open() on the enhanced path never calls window.addEventListener('scroll'|'resize', ...)`, async () => {
    const { el } = makeHost()
    el.handle!.open()
    await settle()

    const scrollOrResize = addSpyCalls.filter((c) => c.type === 'scroll' || c.type === 'resize')
    expect(
      scrollOrResize,
      `${server.browser}: the enhanced path registered ${scrollOrResize.length} scroll/resize listener(s) — ` +
        'defeats the whole point (compositor-driven positioning, zero JS churn)',
    ).toEqual([])
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [5] the JS path still works, byte-identical, when the feature is reported UNSUPPORTED — proven
//  live in these same real (anchor-positioning-capable) engines by forcing CSS.supports() to lie.
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('overlay — JS fallback path is unaffected (forced-unsupported, both engines)', () => {
  it(`${server.browser}: with CSS.supports stubbed false at module load, a fresh overlay() instance registers scroll/resize listeners and positions synchronously via computePosition`, async () => {
    // `supportsAnchorPositioning` is a MODULE-LEVEL const, snapshotted once when overlay.ts first
    // evaluates — not re-read per call. To force the JS branch LIVE in this real (anchor-positioning-
    // capable) engine, rather than only in jsdom (overlay.test.ts, where `CSS` is genuinely absent —
    // verified), stub `CSS.supports` to lie BEFORE importing a cache-busted fresh instance of the
    // module, so its top-level feature-detect const captures `false`.
    const realSupports = CSS.supports.bind(CSS)
    CSS.supports = ((prop: string, value?: string) =>
      prop.includes('anchor-name') ? false : realSupports(prop, value as string)) as typeof CSS.supports

    let forcedOverlay: typeof import('./overlay.ts')
    try {
      // A STATIC query string, held in a variable (not a string LITERAL in the import() call) — Vite
      // still resolves it fine relative to the plain `./overlay.ts` import at the top of this file
      // (busting the module cache, the whole point of this leg), while routing the specifier through
      // a variable keeps `tsc` from attempting its own module-resolution/type-declaration lookup on a
      // query-suffixed path that isn't a real resolvable module for its purposes — only Vite's dev
      // server understands it. The cast documents that it IS the same module shape, re-evaluated.
      const specifier = './overlay.ts?forced-unsupported'
      forcedOverlay = (await import(/* @vite-ignore */ specifier)) as typeof import('./overlay.ts')
    } finally {
      CSS.supports = realSupports
    }

    const addCalls: Array<{ type: string; options: unknown }> = []
    const originalAdd = window.addEventListener.bind(window)
    window.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: unknown) => {
      addCalls.push({ type, options })
      return originalAdd(type, listener, options as AddEventListenerOptions | boolean)
    }) as typeof window.addEventListener

    const host = new BareHostEl()
    const popup = document.createElement('div')
    const anchor = document.createElement('button')
    popup.style.width = '150px'
    popup.style.height = '80px'
    anchor.style.position = 'fixed'
    anchor.style.top = '100px'
    anchor.style.left = '100px'
    document.body.append(host, anchor, popup)
    const forcedHandle = forcedOverlay.overlay(host, { popup, anchor })

    try {
      forcedHandle.open()

      const scrollOrResize = addCalls.filter((c) => c.type === 'scroll' || c.type === 'resize')
      expect(
        scrollOrResize.length,
        `${server.browser}: the forced-unsupported JS path should register scroll+resize listeners`,
      ).toBe(2)
      expect(
        scrollOrResize.find((c) => c.type === 'scroll')?.options,
        `${server.browser}: the scroll listener must stay capture:true (unchanged by this ticket)`,
      ).toEqual({ signal: expect.anything(), capture: true, passive: true })

      // The JS path writes data-placement SYNCHRONOUSLY inside open() — no rAF settle needed, unlike
      // the enhanced path's one-shot geometry read.
      expect(
        popup.getAttribute('data-placement'),
        `${server.browser}: the forced JS path did not position synchronously`,
      ).toBe('bottom-start')
      expect(anchor.style.getPropertyValue('anchor-name'), `${server.browser}: the JS path must never set anchor-name`).toBe('')
      expect(popup.style.getPropertyValue('position-anchor'), `${server.browser}: the JS path must never set position-anchor`).toBe('')
    } finally {
      forcedHandle.cleanup()
      window.addEventListener = originalAdd
      host.remove()
      anchor.remove()
      popup.remove()
    }
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [6] ADR-0101 announce contract unchanged by path choice
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('overlay — ADR-0101 announce contract holds on the enhanced path (both engines)', () => {
  it(`${server.browser}: open() announces exactly one toggle; close() announces close then toggle`, async () => {
    const { el } = makeHost()
    let toggles = 0
    let order: string[] = []
    el.addEventListener('toggle', () => { toggles++; order.push('toggle') })
    el.addEventListener('close', () => { order.push('close') })

    el.handle!.open()
    await settle()
    expect(toggles, `${server.browser}: open() should announce exactly one toggle`).toBe(1)

    order = []
    el.handle!.close()
    expect(order, `${server.browser}: close must fire before toggle (ADR-0101 mechanic 3)`).toEqual(['close', 'toggle'])
  })
})
