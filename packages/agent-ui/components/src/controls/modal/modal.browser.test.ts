import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp, userEvent } from 'vitest/browser'
import type { UIModalElement } from './modal.ts'

// G9 s9 (browser leg) — the CROSS-ENGINE platform-truth smoke for ui-modal (decomp g9-containers node s9).
// This is where the native <dialog> behaviour is PROVEN — none of it resolves in jsdom (which ships a bare
// HTMLDialogElement): the TOP LAYER (above any z-index), the focus TRAP (the page behind goes inert), Escape
// dismissal, the focus RESTORE the control owns, the open round-trip, and the ::backdrop paint + forced-colors
// survival. Runs in BOTH Chromium and WebKit (vitest.browser.config.ts → the two playwright instances).
// Sibling to text-field-states.browser.test.ts — same harness, same engine-split (drive what both engines
// allow; reach the Chromium-only forced-colors leg via cdp() and assert a WebKit baseline there).
//
// Side-effect imports — the load-bearing CSS order (ADR-0003): foundation roles + dimensional ramp FIRST, then
// the shared container surface seam, then the modal sheet, then the self-defining module. Imported DIRECTLY
// (relative), not via the component-styles barrel — the s12 barrel wiring of container.css + modal.css lands
// after this slice, so the test is self-contained.
import '@agent-ui/components/foundation-styles.css'
import '../_surface/container.css'
import '../_surface/container-box.css' // the box-model layer — provides the [data-region] region padding
import './modal.css'
import './modal.ts'

// ── mount/cleanup ──────────────────────────────────────────────────────────────────────────────────────
const mounted: HTMLElement[] = []
const mount = (markup: string): { wrap: HTMLElement; modal: UIModalElement; dialog: HTMLDialogElement } => {
  const wrap = document.createElement('div')
  wrap.innerHTML = markup
  document.body.append(wrap)
  mounted.push(wrap)
  const modal = wrap.querySelector('ui-modal') as UIModalElement
  const dialog = modal.querySelector('[data-part="dialog"]') as HTMLDialogElement
  return { wrap, modal, dialog }
}
afterEach(async () => {
  await userEvent.unhover(document.body)
  while (mounted.length) {
    const m = mounted.pop()
    const dlg = m?.querySelector('dialog') as HTMLDialogElement | null
    if (dlg?.open) dlg.close() // drop any open top-layer dialog before the next test
    m?.remove()
  }
})

const px = (v: string): number => Number.parseFloat(v)

/** Two rAFs — ResizeObserver callbacks fire before-paint, on their own schedule (NOT a plain microtask), so
 *  `await el.updateComplete` alone does not guarantee scroll-fade's RO-driven remeasure() has run yet after a
 *  dialog transitions closed→open (display:none → flow-root IS a resize). The `container-box.css` fix
 *  (2026-07-07, closed dialog = genuine display:none) exposed this: scroll-fade's own INITIAL remeasure() now
 *  runs at connect while the dialog is still closed/zero-sized (correctly measuring "no overflow"), so the
 *  first REAL measurement only happens once the RO fires after `showModal()`. `scrollTo()` below skips waiting
 *  for a scroll event when already at the target scrollTop (0) — the fade tests that immediately assert at
 *  scrollTop 0 need this explicit frame instead. */
const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

/** The resolved mask — WebKit ships mask-image unprefixed too, but read both to be engine-agnostic. */
const maskOf = (el: HTMLElement): string => {
  const cs = getComputedStyle(el) as CSSStyleDeclaration & { webkitMaskImage?: string }
  return cs.maskImage || cs.webkitMaskImage || 'none'
}

/**
 * Scroll `el` to `top` and wait for the real (async, browser-native) `scroll` event before resolving — a
 * plain `el.scrollTop = top` updates layout synchronously, but the `scroll` EVENT the scrollFade trait
 * listens for is dispatched asynchronously by the engine. A no-op scroll (already at `top`) resolves
 * immediately (no event would ever fire).
 */
const scrollTo = (el: HTMLElement, top: number): Promise<void> =>
  new Promise((resolve) => {
    if (el.scrollTop === top) {
      resolve()
      return
    }
    el.addEventListener('scroll', () => resolve(), { once: true })
    el.scrollTop = top
  })

/** Alpha of a computed colour — 0 ⇒ the paint has VANISHED (a bare system keyword with no rgb() is opaque).
 *  TKT-0019 — the legacy `rgba?(r,g,b,a)` parse first; a modern colour-function computed value (oklch()/
 *  color()/lab()/etc., e.g. the new --md-sys-color-dialog-backdrop role) serializes with the SAME trailing
 *  `/ alpha` syntax as rgb() under CSS Color 4, so a generic "alpha is whatever follows the last `/` before the
 *  closing paren" fallback reads it too — engines are free to keep an author's oklch() computed value verbatim
 *  instead of down-converting to rgb() when it's in-gamut, which real Chromium/WebKit do for this role. */
const alphaOf = (color: string): number => {
  if (color === 'transparent') return 0
  const m = color.match(/rgba?\(([^)]+)\)/i)
  if (m) {
    const parts = m[1].split(/[\s,/]+/).filter(Boolean)
    return parts.length >= 4 ? Number(parts[3]) : 1
  }
  const slash = color.match(/\/\s*([\d.]+)(%)?\s*\)\s*$/)
  if (slash) return slash[2] ? Number(slash[1]) / 100 : Number(slash[1])
  return 1
}

/** Minimal CDP surface — `cdp()`'s public type is empty; the playwright provider gives `.send` at runtime. */
interface CdpSession {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [1] open round-trip — showModal()/close() in a real engine (both engines)
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-modal — open round-trip via the native <dialog> (both engines)', () => {
  it('open=true shows the dialog (it is open + rendered); open=false closes it', async () => {
    const { modal, dialog } = mount('<ui-modal><p>Body</p></ui-modal>')
    expect(dialog.open, 'a fresh modal is not open').toBe(false)

    modal.open = true
    await modal.updateComplete
    expect(dialog.open, 'showModal() did not open the dialog').toBe(true)
    expect(dialog.getBoundingClientRect().width, 'the open dialog did not render a box').toBeGreaterThan(0)

    modal.open = false
    await modal.updateComplete
    expect(dialog.open, 'close() did not close the dialog').toBe(false)
  })

  // Regression: a `<ui-modal>` with NO `open` attribute must be genuinely INVISIBLE, not merely
  // `dialog.open === false` — the reported bug (container-box.css §dialog fix, 2026-07-07) was a dialog that
  // stayed `dialog.open === false` (jsdom-checkable) yet still COMPUTED `display: flow-root` and rendered
  // centred on the page (only a browser-measured `getComputedStyle` catches this).
  it('a fresh, un-opened modal computes display:none and contributes no rendered box (jsdom-green ≠ done)', async () => {
    const { dialog } = mount('<ui-modal><p>Body</p></ui-modal>')
    expect(dialog.open).toBe(false)
    expect(getComputedStyle(dialog).display, `${server.browser}: a closed dialog is not display:none — it renders as if open`).toBe('none')
    expect(dialog.getBoundingClientRect().width, 'a closed dialog contributed a non-empty rendered box').toBe(0)
  })

  // The EXACT reported bug: two sibling `<ui-modal>`s, neither opened — they must not appear "stacked on top of
  // each other" (both centred, both visible) before any user interaction, and a trigger must open ONLY its own.
  it('TWO sibling modals stay invisible until their own trigger opens them (no cross-modal bleed)', async () => {
    const wrap = document.createElement('div')
    wrap.innerHTML = '<ui-modal id="a"><p>A</p></ui-modal><ui-modal id="b"><p>B</p></ui-modal>'
    document.body.append(wrap)
    mounted.push(wrap)
    const a = wrap.querySelector('#a') as UIModalElement
    const b = wrap.querySelector('#b') as UIModalElement
    const dialogA = a.querySelector('[data-part="dialog"]') as HTMLDialogElement
    const dialogB = b.querySelector('[data-part="dialog"]') as HTMLDialogElement

    expect(getComputedStyle(dialogA).display, `${server.browser}: modal A rendered before any trigger`).toBe('none')
    expect(getComputedStyle(dialogB).display, `${server.browser}: modal B rendered before any trigger`).toBe('none')

    a.open = true
    await a.updateComplete
    expect(dialogA.open, 'opening A did not open A').toBe(true)
    expect(dialogB.open, 'opening A also opened B (cross-modal bleed)').toBe(false)
    expect(getComputedStyle(dialogB).display, `${server.browser}: B rendered while only A was opened`).toBe('none')
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [2] TOP LAYER — the modal renders above a high z-index sibling (the reason to use native <dialog>)
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-modal — the platform top layer beats z-index (both engines)', () => {
  it('the open dialog paints ABOVE a fixed, max z-index sibling', async () => {
    const { modal, dialog } = mount(
      '<div style="position:fixed;inset:0;z-index:2147483647;background:rgb(255,0,0)"></div>' +
        '<ui-modal><p>On top</p></ui-modal>',
    )
    modal.open = true
    await modal.updateComplete

    // hit-test the viewport centre — the dialog is centred there. The top layer outranks the z-index sibling,
    // so elementFromPoint returns the dialog (or a child), NOT the red overlay (anti-vacuous: a light-DOM
    // overlay would lose to z-index here, which is exactly the failure native <dialog> avoids).
    const cx = Math.round(window.innerWidth / 2)
    const cy = Math.round(window.innerHeight / 2)
    const hit = document.elementFromPoint(cx, cy)
    expect(hit, 'nothing was hit at the viewport centre').not.toBeNull()
    expect(
      dialog === hit || dialog.contains(hit),
      `${server.browser}: the dialog did not render in the top layer (a z-index sibling occluded it)`,
    ).toBe(true)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [3] focus TRAP — the page behind the modal goes inert (both engines)
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-modal — focus is trapped inside the open dialog (both engines)', () => {
  it('initial focus moves into the dialog and a button OUTSIDE cannot steal it', async () => {
    const { wrap, modal, dialog } = mount(
      '<button id="outside">outside</button><ui-modal><button id="inside">inside</button></ui-modal>',
    )
    const outside = wrap.querySelector('#outside') as HTMLButtonElement
    modal.open = true
    await modal.updateComplete

    // showModal() moved initial focus INTO the dialog (the inside button / the dialog).
    expect(dialog.contains(document.activeElement), `${server.browser}: focus did not move into the dialog`).toBe(true)

    // the page behind is inert — focusing the outside button is a no-op (focus stays trapped in the dialog).
    outside.focus()
    expect(
      dialog.contains(document.activeElement),
      `${server.browser}: an outside button stole focus from the open modal (not trapped)`,
    ).toBe(true)
    expect(document.activeElement).not.toBe(outside)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [4] Escape — dismisses + syncs open=false + emits close + RESTORES focus to the EXACT opener
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-modal — Escape dismissal + focus restore (both engines)', () => {
  it('Escape closes the modal, syncs open=false + emits close, and restores focus to the opener (NC: not body)', async () => {
    const { wrap, modal, dialog } = mount(
      '<button id="opener">open</button><ui-modal><button>inside</button></ui-modal>',
    )
    const opener = wrap.querySelector('#opener') as HTMLButtonElement

    opener.focus() // the opener is the active element when the modal opens → the focus-restore target
    expect(document.activeElement).toBe(opener)

    let closes = 0
    modal.addEventListener('close', () => closes++)
    modal.open = true
    await modal.updateComplete
    expect(dialog.open).toBe(true)
    expect(dialog.contains(document.activeElement), 'focus did not enter the dialog').toBe(true)

    await userEvent.keyboard('{Escape}')
    await modal.updateComplete
    expect(dialog.open, `${server.browser}: Escape did not close the dialog`).toBe(false)
    expect(modal.open, 'the open prop did not sync to false on Escape').toBe(false)
    expect(closes, 'the close event did not fire on Escape').toBe(1)
    // the NEGATIVE control: focus returns to the EXACT opener element (the platform omits this — the control owns it)
    expect(document.activeElement, `${server.browser}: focus was not restored to the exact opener`).toBe(opener)
  })

  it('persistent: Escape does NOT close the modal (the cancel is blocked)', async () => {
    // `persistent` is a presence-boolean defaulting false — when set, the modal is non-dismissable. Unlike the old
    // `dismissable`, it CAN be expressed by attribute presence (`<ui-modal persistent>`): presence ⇒ true is exactly
    // the declarative override the inversion fixes (ADR-0020). Here we set the property, equivalent to that attribute.
    const { modal, dialog } = mount('<ui-modal><button>inside</button></ui-modal>')
    modal.persistent = true
    modal.open = true
    await modal.updateComplete
    expect(dialog.open).toBe(true)

    await userEvent.keyboard('{Escape}')
    await modal.updateComplete
    expect(dialog.open, `${server.browser}: Escape closed a persistent modal`).toBe(true)
    expect(modal.open).toBe(true)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [5] [density] — shell padding shifts (--ui-space-lg); frame (border + radius) HOLDS (both engines)
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-modal — [box-model] the dialog is a padding-less box; region padding + frame are density-invariant (both engines)', () => {
  it('the dialog shell has NO padding (box-model); a content region carries the FIXED 12/6 padding; the frame HOLDS', async () => {
    // Box-model rollout (container-box.css) — REVISED 2026-07-04: the dialog is a [data-box] with ZERO shell
    // padding — a content region inside carries the FIXED region padding (inline 0.75rem=12px · block
    // 0.375rem=6px, rem-based → NOT --ui-space × --ui-density, so density-INVARIANT). The frame (border 1px ·
    // radius) is invariant too.
    const { modal, dialog } = mount('<ui-modal><div data-region="content"><p>Body</p></div></ui-modal>')
    modal.open = true
    await modal.updateComplete
    const content = dialog.querySelector('[data-region="content"]') as HTMLElement

    // the dialog shell holds no padding — the region provides the inset
    expect(px(getComputedStyle(dialog).paddingTop), 'the dialog shell has padding (box-model expects 0)').toBe(0)

    // the content region's FIXED 12/6 region padding
    const padInlineBase = px(getComputedStyle(content).paddingLeft)
    const padBlockBase = px(getComputedStyle(content).paddingTop)
    const borderBase = px(getComputedStyle(dialog).borderTopWidth)
    const radiusBase = px(getComputedStyle(dialog).borderTopLeftRadius)
    expect(padInlineBase, 'content inline padding is not ~12px').toBeCloseTo(12, 0)
    expect(padBlockBase, 'content block padding is not ~6px').toBeCloseTo(6, 0)
    expect(borderBase, 'border is 0 (frame invariant is vacuous)').toBeGreaterThan(0)
    expect(radiusBase, 'radius is 0 (frame invariant is vacuous)').toBeGreaterThan(0)

    // density-INVARIANT: compact + spacious leave the region padding + frame unchanged (rem, not --ui-space)
    for (const d of ['compact', 'spacious']) {
      modal.setAttribute('density', d)
      expect(px(getComputedStyle(content).paddingLeft), `inline padding changed at ${d}`).toBeCloseTo(padInlineBase, 1)
      expect(px(getComputedStyle(content).paddingTop), `block padding changed at ${d}`).toBeCloseTo(padBlockBase, 1)
      expect(px(getComputedStyle(dialog).borderTopWidth), `border width changed at ${d}`).toBe(borderBase)
      expect(px(getComputedStyle(dialog).borderTopLeftRadius), `radius changed at ${d}`).toBe(radiusBase)
    }
  })

  it('REVISED 2026-07-04: header/content/footer are now INSET — uniform 6px gutters, never doubled between regions', async () => {
    // The dialog is a [data-box] flow-root BFC (container-box.css) — adjacent children's margins COLLAPSE to
    // one inset, so a naive-margin doubling bug is NOT reachable here the way it is for ui-card's CSS Grid; this
    // is the rendered proof that modal genuinely gets the shared model's collapsing behaviour for free.
    const { modal, dialog } = mount(
      '<ui-modal><header>H</header><div data-region="content"><p>Body</p></div><footer>F</footer></ui-modal>',
    )
    modal.open = true
    await modal.updateComplete
    const dialogRect = dialog.getBoundingClientRect()
    const borderTop = px(getComputedStyle(dialog).borderTopWidth)
    const header = dialog.querySelector('header') as HTMLElement
    const content = dialog.querySelector('[data-region="content"]') as HTMLElement
    const footer = dialog.querySelector('footer') as HTMLElement
    const headerRect = header.getBoundingClientRect()
    const contentRect = content.getBoundingClientRect()
    const footerRect = footer.getBoundingClientRect()

    const frameToHeader = headerRect.top - dialogRect.top - borderTop
    const headerToContent = contentRect.top - headerRect.bottom
    const contentToFooter = footerRect.top - contentRect.bottom
    const footerToFrame = dialogRect.bottom - footerRect.bottom - borderTop

    for (const [label, gap] of [
      ['frame→header', frameToHeader],
      ['header→content', headerToContent],
      ['content→footer', contentToFooter],
      ['footer→frame', footerToFrame],
    ] as const) {
      expect(gap, `${server.browser}: ${label} gap is not ~6px (got ${gap})`).toBeCloseTo(6, 0)
    }
  })

  it('REVISED 2026-07-04: the sticky header keeps its own 6px inset margin once scrolled (margin survives sticky)', async () => {
    // modal.css gives the dialog PART itself `overflow: auto` + `max-block-size: 85svh` — the header (a direct
    // child of the dialog, per container-box.css's [data-box] region pattern) sticks within THAT scrollport, so
    // a very tall content region (well beyond any reasonable viewport) forces the dialog itself to scroll.
    const { modal, dialog } = mount(
      '<ui-modal><header>H</header><div data-region="content"><div style="block-size: 3000px">tall</div></div></ui-modal>',
    )
    modal.open = true
    await modal.updateComplete
    const header = dialog.querySelector('header') as HTMLElement
    dialog.scrollTop = 200
    const dialogRect = dialog.getBoundingClientRect()
    const borderTop = px(getComputedStyle(dialog).borderTopWidth)
    const headerRect = header.getBoundingClientRect()
    const restingGap = headerRect.top - dialogRect.top - borderTop
    expect(
      restingGap,
      `${server.browser}: the sticky header's own 6px margin did not survive scrolling (measured ${restingGap})`,
    ).toBeCloseTo(6, 0)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  Edge-aware scroll fade (the gutter-exposure fix, 2026-07-04) — DEFAULT-ON, no opt-in prop (unlike
//  ui-card-content's `scroll-fade`). scroll-fade.test.ts proves the trait's decision logic (jsdom, stubbed
//  geometry); this proves the whole live wire on the real scroll viewport (the dialog part).
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-modal — the dialog scroll viewport gets an edge-aware fade by default (both engines)', () => {
  it('at the TOP: data-fade-bottom (more below), not data-fade-top (nothing above)', async () => {
    const { modal, dialog } = mount(
      '<ui-modal><header>H</header><div data-region="content"><div style="block-size: 3000px">tall</div></div><footer>F</footer></ui-modal>',
    )
    modal.open = true
    await modal.updateComplete
    await raf() // let scroll-fade's RO-driven remeasure() catch up to the real (now correctly closed→open) geometry
    await scrollTo(dialog, 0)
    expect(dialog.hasAttribute('data-fade-top'), `${server.browser}: fresh dialog wrongly fades the top`).toBe(false)
    expect(dialog.hasAttribute('data-fade-bottom'), `${server.browser}: the dialog did not fade its bottom`).toBe(true)
  })

  it('scrolled to the BOTTOM: data-fade-top, not data-fade-bottom (nothing left below)', async () => {
    const { modal, dialog } = mount(
      '<ui-modal><div data-region="content"><div style="block-size: 3000px">tall</div></div></ui-modal>',
    )
    modal.open = true
    await modal.updateComplete
    await raf() // let scroll-fade's RO-driven remeasure() catch up to the real (now correctly closed→open) geometry
    await scrollTo(dialog, dialog.scrollHeight) // the engine clamps to the real max
    expect(dialog.hasAttribute('data-fade-top'), `${server.browser}: end-of-scroll did not fade the top`).toBe(true)
    expect(dialog.hasAttribute('data-fade-bottom'), `${server.browser}: end-of-scroll wrongly kept the bottom faded`).toBe(false)
  })

  it('a SHORT modal (content fits, no scrollable overflow) never fades either edge', async () => {
    const { modal, dialog } = mount('<ui-modal><p>short body</p></ui-modal>')
    modal.open = true
    await modal.updateComplete
    await raf() // let scroll-fade's RO-driven remeasure() catch up to the real (now correctly closed→open) geometry
    expect(dialog.scrollHeight, 'the dialog unexpectedly overflows (test setup is vacuous)').toBeLessThanOrEqual(dialog.clientHeight)
    expect(dialog.hasAttribute('data-fade-top')).toBe(false)
    expect(dialog.hasAttribute('data-fade-bottom')).toBe(false)
    expect(maskOf(dialog), `${server.browser}: a short dialog painted a mask`).toBe('none')
  })

  it('the rendered mask PAINTS a gradient exactly when a flag is present', async () => {
    const { modal, dialog } = mount(
      '<ui-modal><div data-region="content"><div style="block-size: 3000px">tall</div></div></ui-modal>',
    )
    modal.open = true
    await modal.updateComplete
    await raf() // let scroll-fade's RO-driven remeasure() catch up to the real (now correctly closed→open) geometry
    await scrollTo(dialog, 0)
    expect(maskOf(dialog), `${server.browser}: the dialog's fade flag did not paint a mask`).toMatch(/gradient/)
  })

  it('the sticky header still occludes content scrolled directly beneath it (z-index, unaffected by the fade)', async () => {
    const { modal, dialog } = mount(
      '<ui-modal><header>Header</header><div data-region="content"><div style="block-size: 3000px; position: relative;">tall</div></div></ui-modal>',
    )
    modal.open = true
    await modal.updateComplete
    await raf() // let scroll-fade's RO-driven remeasure() catch up to the real (now correctly closed→open) geometry
    const header = dialog.querySelector('header') as HTMLElement
    await scrollTo(dialog, 60)
    const r = header.getBoundingClientRect()
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    expect(
      header.contains(top) || top === header,
      `${server.browser}: scrolled content showed through the sticky header`,
    ).toBe(true)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [6] ::backdrop — paints a scrim AND survives forced-colors (Chromium via CDP; WebKit asserts the baseline)
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-modal — the ::backdrop scrim (Chromium emulates forced-colors via CDP; WebKit asserts the baseline)', () => {
  it('the ::backdrop paints in normal mode and the dialog surface survives forced-colors', async () => {
    const { modal, dialog } = mount('<ui-modal><p>Body</p></ui-modal>')
    modal.open = true
    await modal.updateComplete

    // baseline (BOTH engines, normal mode): the ::backdrop paints a visible scrim + the dialog surface is opaque
    // — so the forced-colors assertions below cannot be vacuous.
    expect(
      alphaOf(getComputedStyle(dialog, '::backdrop').backgroundColor),
      `${server.browser}: the ::backdrop did not paint a scrim`,
    ).toBeGreaterThan(0)
    // TKT-0019 — black 80% opacity (Kim-specified), not the old lighter --md-sys-color-neutral-scrim (30%).
    expect(
      alphaOf(getComputedStyle(dialog, '::backdrop').backgroundColor),
      `${server.browser}: the ::backdrop is not the ruled black-80% (TKT-0019)`,
    ).toBeCloseTo(0.8, 1)
    expect(alphaOf(getComputedStyle(dialog).backgroundColor), 'the dialog surface is not opaque').toBeGreaterThan(0)

    if (server.browser !== 'chromium') {
      // WebKit exposes no CDP / forced-colors emulation (the documented split) — assert we are genuinely NOT in
      // forced-colors (so the Chromium proof is not silently faked) and stop.
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(true) // the engine REALLY entered forced-colors

      // the dialog surface + frame + ink survive as system colours (the forced-colors block repaints them); the
      // wash drops (background-image: none) so it cannot defeat the forced Canvas base.
      expect(
        alphaOf(getComputedStyle(dialog).backgroundColor),
        'the dialog surface vanished under forced-colors',
      ).toBeGreaterThan(0)
      expect(
        alphaOf(getComputedStyle(dialog).borderTopColor),
        'the dialog frame vanished under forced-colors',
      ).toBeGreaterThan(0)
      // the ::backdrop still paints — the blocking layer must not vanish (the modal stays distinguishable).
      expect(
        alphaOf(getComputedStyle(dialog, '::backdrop').backgroundColor),
        'the ::backdrop vanished under forced-colors',
      ).toBeGreaterThan(0)
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})
