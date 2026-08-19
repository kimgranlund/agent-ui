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
//   [7] the GH #1339 IACVT guard — a popup with no box (its own ancestor `display:none`, the exact
// Residual sub-case, recorded (code-review 2026-08-19): these probes keep the ANCHOR visible. In the
// real FormPopover shape the anchor is ALSO boxless at open — the fallback's position() then reads a
// zero rect and parks the popup at ~(0,4) until the first scroll/resize re-derivation (the trait has no
// reveal hook). Expected-and-known, not covered by these probes; a reveal re-derivation hook is the
// builder-optional follow-up named on GH #1339.
//       FormPopover repro shape) makes the enhanced path fall back to the JS path for that open
//       cycle, correctly anchored once revealed; a later reopen lands back on the enhanced path.
//       Two other forcing mechanisms were tried first and did NOT reproduce the failure signature —
//       see that section's own header comment for what was tried, measured, and why.

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
  // border-box + zeroed padding/border — the UA default `[popover]` stylesheet adds its OWN
  // padding/border on top of a content-box `width`/`height` (measured: a plain 150×80 rendered at
  // 164×94 in real engines), which silently made the popup's TRUE footprint wider than the test
  // fixture's own clearance math assumed — a real trap the 8-placement matrix test caught (a
  // popup that doesn't actually fit its declared box overflows, and the CSS spec's OWN correctly-
  // functioning "least overflow" fallback then legitimately picks a DIFFERENT placement than the
  // one under test, misreading as a positioning-logic bug when the fixture was the culprit).
  el.popup.style.boxSizing = 'border-box'
  el.popup.style.padding = '0'
  el.popup.style.border = 'none'
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
    // Self-contained — mounts + opens TWO independent overlay() instances itself, rather than relying
    // on residue left by an earlier test in this file (that made the assertion pass only by accident
    // of run order; filtered to run alone, e.g. `-t`, it read count 0 and failed spuriously).
    const first = makeHost()
    const second = makeHost()
    first.el.handle!.open()
    second.el.handle!.open()

    const styles = document.head.querySelectorAll('#ui-overlay-anchor-tries')
    expect(styles.length, `${server.browser}: expected exactly one injected @position-try stylesheet`).toBe(1)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [2b] the FULL 8-placement matrix (both engines) — code-checker MAJOR fold: the wiring test above
//  only ever exercised bottom-start/top-start; every one of the 8 `OverlayPlacement` values gets its
//  own behavioral proof here — the resolved geometry relation AND `data-placement`, for BOTH sides
//  the SIDE axis can land on and BOTH ends the ALIGN axis can land on. The anchor sits centered in a
//  generous, edge-clear rect so no flip fires for ANY of the 8 — this is a no-flip placement proof,
//  not a flip proof (section [3] below owns flip).
// ════════════════════════════════════════════════════════════════════════════════════════════════

const ALL_PLACEMENTS_UNDER_TEST = [
  'bottom-start', 'bottom-end', 'top-start', 'top-end',
  'left-start', 'left-end', 'right-start', 'right-end',
] as const

describe('overlay — the full 8-placement matrix, no flip (both engines)', () => {
  for (const placement of ALL_PLACEMENTS_UNDER_TEST) {
    const [side, align] = placement.split('-') as ['bottom' | 'top' | 'left' | 'right', 'start' | 'end']

    it(`${server.browser}: ${placement} resolves data-placement and lands the popup on the correct side + edge`, async () => {
      const { el, popup, anchor } = makeHost({ placement })
      anchor.style.position = 'fixed'
      // A SMALL anchor, centered in the fleet-default 414×896 viewport, with SYMMETRIC clearance on
      // all four sides comfortably exceeding the 150×80 popup's footprint + gap (~154×84) in every
      // direction — no side has to flip for ANY of the 8 placements checked here (flip parity is
      // section [3]'s own job). A first draft used an off-center anchor with exactly-tight
      // clearance on one axis (150px available vs. ~154px needed once the anchor↔panel gap counted)
      // — the popup genuinely didn't fit, and the CSS spec's OWN correctly-functioning "least
      // overflow" fallback selection legitimately picked a different placement, misreading as a
      // positioning-logic bug when the fixture's own clearance math was the culprit.
      anchor.style.top = '430px'
      anchor.style.left = '197px'
      anchor.style.width = '20px'
      anchor.style.height = '20px'

      el.handle!.open()
      // Synchronous read — the same contract [2]'s wiring test already pins; repeated here per
      // placement rather than assumed to generalize.
      expect(popup.getAttribute('data-placement'), `${server.browser}: ${placement} did not resolve synchronously`).toBe(placement)
      await settle()

      const a = anchor.getBoundingClientRect()
      const p = popup.getBoundingClientRect()
      const EPS = 1

      if (side === 'bottom') expect(p.top, `${server.browser}: ${placement} panel is not below the anchor`).toBeGreaterThanOrEqual(a.bottom - EPS)
      else if (side === 'top') expect(p.bottom, `${server.browser}: ${placement} panel is not above the anchor`).toBeLessThanOrEqual(a.top + EPS)
      else if (side === 'right') expect(p.left, `${server.browser}: ${placement} panel is not right of the anchor`).toBeGreaterThanOrEqual(a.right - EPS)
      else expect(p.right, `${server.browser}: ${placement} panel is not left of the anchor`).toBeLessThanOrEqual(a.left + EPS)

      if (side === 'bottom' || side === 'top') {
        if (align === 'start') expect(p.left, `${server.browser}: ${placement} is not left-aligned to the anchor`).toBeCloseTo(a.left, 0)
        else expect(p.right, `${server.browser}: ${placement} is not right-aligned to the anchor`).toBeCloseTo(a.right, 0)
      } else {
        if (align === 'start') expect(p.top, `${server.browser}: ${placement} is not top-aligned to the anchor`).toBeCloseTo(a.top, 0)
        else expect(p.bottom, `${server.browser}: ${placement} is not bottom-aligned to the anchor`).toBeCloseTo(a.bottom, 0)
      }
    })
  }
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

  it(`${server.browser}: bottom-start flips ALIGN to bottom-end when a side-flip alone can't fix a right-edge overflow (the real tabs.browser.test.ts / GH #586 regression shape)`, async () => {
    // The exact shape that broke tabs.browser.test.ts's overflow-menu commit relay: an anchor sitting
    // at the viewport's right edge with align:start overflows the popup's far (right) edge on EITHER
    // side (top or bottom) — only a same-side ALIGN flip (pinning the popup's right edge to the
    // anchor's own right edge instead) actually fits. Proven directly here at the trait level, not
    // only indirectly via the consuming control's own suite.
    const { el, popup, anchor } = makeHost({ placement: 'bottom-start' })
    anchor.style.position = 'fixed'
    anchor.style.top = '400px' // plenty of room both above and below — this is NOT a side overflow
    anchor.style.left = '390px' // near/past the 414px fleet-default viewport's right edge
    anchor.style.width = '36px'
    anchor.style.height = '36px'

    el.handle!.open()
    await settle()

    expect(
      popup.getAttribute('data-placement'),
      `${server.browser}: expected the align-flip target bottom-end, not a side-flip (there was room on both top and bottom) or bottom-start (that's what overflows)`,
    ).toBe('bottom-end')

    const p = popup.getBoundingClientRect()
    expect(p.right, `${server.browser}: the align-flipped panel must fit within the viewport's right edge`).toBeLessThanOrEqual(window.innerWidth + 1)
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

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [7] IACVT guard (GH #1339)
//
//  What was tried and DIDN'T reproduce the failure signature live (recorded, not silently dropped —
//  the first mechanism this test file tried before landing on the one below):
//    - Hiding the ANCHOR itself (`display:none`) before `open()`. Measured directly in both pinned
//      engines: `popup.style.top` stayed the literal, unresolved `anchor(...)` CSS text — the guard
//      never fired.
//    - Repointing `position-anchor` at an `anchor-name` matching no element (a genuinely
//      spec-invalid reference). Measured directly: same non-trigger.
//    Root cause of BOTH non-reproductions, also measured directly (a throwaway diagnostic probe run
//    once against this repo's pinned engines while deriving this section, not kept): CSSOM's
//    `getComputedStyle()` resolved-value algorithm returns the USED value (a real pixel number, e.g.
//    `0px`) for `top`/`right`/`bottom`/`left` on any element that HAS a box and IS positioned — even
//    when the underlying computed value is the IACVT fallback `auto` — because the "does this
//    property apply" special case only routes to the literal computed-value string when the element
//    genuinely has NO BOX at all. A boxless ANCHOR or an invalid anchor reference still leaves the
//    POPUP itself laid out (it has its own box, positioned via the static-position algorithm) — so
//    `getComputedStyle(popup)` reads back real (if wrong) pixel numbers, never the string `'auto'`.
//
//  What DOES reproduce it live, in BOTH pinned engines, measured directly: giving the POPUP ITSELF no
//  box — its own flat-tree ancestor is `display:none` — the exact FormPopover repro shape (a card's
//  tab panel, containing both trigger and panel, hidden at build). `:popover-open` stays `true`
//  (`showPopover()` does not throw), and `getComputedStyle(popup).{top,right,bottom,left}` read the
//  literal string `'auto'` on ALL FOUR — this IS the guard's exact trigger condition, forced without
//  relying on any self-healing/non-reproducible engine quirk. This also proves the "opened while
//  hidden, then revealed" shape the ticket named — the JS fallback's `position()` call still measures
//  the ANCHOR's real (visible) geometry even while the popup itself has no box, so the fixed top/left
//  it writes are already correct BEFORE the reveal; no reveal-lifecycle hook is needed for THIS shape
//  to resolve correctly once the ancestor becomes visible again (a hook the trait genuinely does not
//  have — confirmed absent, `overlay.ts`'s own header comment — would only matter for a scroll/resize
//  re-derivation AFTER reveal, which this guard's one-shot open-time check does not attempt either).
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('overlay — IACVT guard (GH #1339): a popup with no box (hidden ancestor) falls back to the JS path', () => {
  it(`${server.browser}: opening while the popup's own ancestor is display:none falls back to the JS path and lands correctly anchored once revealed`, async () => {
    const { el, popup, anchor } = makeHost({ placement: 'bottom-start' })
    anchor.style.position = 'fixed'
    anchor.style.top = '120px'
    anchor.style.left = '120px'

    // Move the popup under a display:none ancestor — no box, matching the FormPopover repro shape
    // (a card's tab panel hidden at build). The anchor stays visible/laid out.
    const hiddenAncestor = document.createElement('div')
    hiddenAncestor.style.display = 'none'
    document.body.append(hiddenAncestor)
    hiddenAncestor.append(popup)

    const addCalls: Array<{ type: string }> = []
    const originalAdd = window.addEventListener.bind(window)
    window.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: unknown) => {
      addCalls.push({ type })
      return originalAdd(type, listener, options as AddEventListenerOptions | boolean)
    }) as typeof window.addEventListener

    try {
      el.handle!.open()
      await settle()

      // Direct proof the guard fired: applyAnchoredPlacement() always writes the raw `anchor(...)`
      // CSS text into style.top first; the guard overwriting it with a literal pixel value is the
      // observable sign the JS fallback took over THIS cycle.
      expect(
        popup.style.top,
        `${server.browser}: expected the IACVT guard to overwrite the failed anchor() inset with a literal JS-computed pixel value`,
      ).toMatch(/^-?\d+(\.\d+)?px$/)

      const scrollOrResize = addCalls.filter((c) => c.type === 'scroll' || c.type === 'resize')
      expect(
        scrollOrResize.length,
        `${server.browser}: the IACVT fallback should register the JS path's scroll+resize listeners for this cycle`,
      ).toBe(2)

      // Reveal the ancestor — the popup gains a real box. No reopen, no reveal hook: the JS
      // fallback already measured the ANCHOR's real geometry at open() time and wrote a correct
      // fixed top/left, so revealing alone is enough to prove "anchored, not static".
      hiddenAncestor.style.display = ''
      await settle()

      const a = anchor.getBoundingClientRect()
      const p = popup.getBoundingClientRect()
      expect(p.top, `${server.browser}: revealed panel is not below the anchor's bottom edge (still static-positioned)`).toBeGreaterThanOrEqual(a.bottom - 1)
      expect(p.left, `${server.browser}: revealed panel is not anchor-aligned (start) — looks static-positioned`).toBeCloseTo(a.left, 0)
    } finally {
      window.addEventListener = originalAdd
      hiddenAncestor.remove()
    }
  })

  it(`${server.browser}: a REOPEN after the ancestor is already revealed lands on the enhanced path, correctly anchored`, async () => {
    const { el, popup, anchor } = makeHost({ placement: 'bottom-start' })
    anchor.style.position = 'fixed'
    anchor.style.top = '200px'
    anchor.style.left = '150px'

    const hiddenAncestor = document.createElement('div')
    hiddenAncestor.style.display = 'none'
    document.body.append(hiddenAncestor)
    hiddenAncestor.append(popup)

    el.handle!.open() // falls back this cycle (previous test proves the mechanism directly)
    await settle()
    hiddenAncestor.style.display = '' // reveal
    await settle()
    el.handle!.close()

    el.handle!.open() // a genuine reopen, now that the popup has a real box again
    await settle()

    expect(
      popup.getAttribute('data-placement'),
      `${server.browser}: reopen after the ancestor was revealed did not resolve a real placement`,
    ).toBe('bottom-start')
    expect(
      popup.style.top,
      `${server.browser}: reopen after reveal should have landed back on the enhanced (anchor()) path, not stayed on the JS fallback`,
    ).toContain('anchor(')

    const a = anchor.getBoundingClientRect()
    const p = popup.getBoundingClientRect()
    expect(p.top, `${server.browser}: reopened panel is not below the anchor's bottom edge (still static-positioned)`).toBeGreaterThanOrEqual(a.bottom - 1)
    expect(p.left, `${server.browser}: reopened panel is not anchor-aligned (start) — still looks static-positioned`).toBeCloseTo(a.left, 0)

    hiddenAncestor.remove()
  })
})

