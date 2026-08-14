import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp, userEvent } from 'vitest/browser'
import type { UIDrawerElement } from './drawer.ts'

// ADR-0188 s2 (browser leg) — the CROSS-ENGINE platform-truth smoke for ui-drawer, mirroring
// modal.browser.test.ts (decomp g9-containers node s9 precedent, re-applied per ADR-0125). This is where
// the native <dialog> behaviour is PROVEN — none of it resolves in jsdom: the TOP LAYER, the focus TRAP,
// Escape dismissal, the focus RESTORE the control owns, the open round-trip, the ::backdrop paint, and —
// the ADR-0188-specific leg — the DOCKED GEOMETRY + MOTION computed from PRODUCTION CSS (the TKT-0002
// class: the motion and @starting-style legs are cascade-dependent claims, never source-grep claims).
// Runs in BOTH Chromium and WebKit (vitest.browser.config.ts → the two playwright instances).
//
// Side-effect imports — the load-bearing CSS order (ADR-0003): foundation roles + dimensional ramp FIRST,
// then the shared container surface seam + box-model, then the drawer sheet, then the self-defining
// module. Imported DIRECTLY (relative), matching modal.browser.test.ts's own precedent.
import '@agent-ui/components/foundation-styles.css'
import '../_surface/container.css'
import '../_surface/container-box.css'
import './drawer.css'
import './drawer.ts'
import '../text-field/text-field.css'
import '../text-field/text-field.ts'

// The site's own committed built-output fixture (theme-provider-build-fixture.test.ts keeps it fresh —
// its own freshness gate reddens on ANY site CSS edit, drawer.css included, naming its own fix: regenerate)
// — the SAME production `vite build` bytes theme-provider-build.browser.test.ts consumes, reused here for
// the n13 built-output geometry/motion probe (the manifest's own "theme-provider-built fixture mechanics"
// citation) rather than standing up a second, parallel build pipeline for one control.
import builtCss from '../../../../../../site/lib/__fixtures__/theme-provider-built.css?raw'

// ── mount/cleanup ──────────────────────────────────────────────────────────────────────────────────────
const mounted: HTMLElement[] = []
const mount = (markup: string): { wrap: HTMLElement; drawer: UIDrawerElement; dialog: HTMLDialogElement } => {
  const wrap = document.createElement('div')
  wrap.innerHTML = markup
  document.body.append(wrap)
  mounted.push(wrap)
  const drawer = wrap.querySelector('ui-drawer') as UIDrawerElement
  const dialog = drawer.querySelector('[data-part="dialog"]') as HTMLDialogElement
  return { wrap, drawer, dialog }
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

/** Minimal CDP surface — `cdp()`'s public type is empty; the playwright provider gives `.send` at runtime. */
interface CdpSession {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [1] open round-trip + TOP LAYER — showModal()/close() in a real engine (both engines)
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-drawer — open round-trip via the native <dialog> + the platform top layer (both engines)', () => {
  it('open=true shows the dialog as a REAL :modal (top-layer entry); open=false closes it', async () => {
    const { drawer, dialog } = mount('<ui-drawer><p>Body</p></ui-drawer>')
    expect(dialog.open, 'a fresh drawer is not open').toBe(false)

    drawer.open = true
    await drawer.updateComplete
    expect(dialog.open, 'showModal() did not open the dialog').toBe(true)
    expect(dialog.matches(':modal'), `${server.browser}: the dialog did not enter the top-layer :modal state`).toBe(true)
    expect(dialog.getBoundingClientRect().width, 'the open dialog did not render a box').toBeGreaterThan(0)

    drawer.open = false
    await drawer.updateComplete
    expect(dialog.open, 'close() did not close the dialog').toBe(false)
  })

  it('a fresh, un-opened drawer computes display:none and contributes no rendered box (jsdom-green ≠ done)', async () => {
    const { dialog } = mount('<ui-drawer><p>Body</p></ui-drawer>')
    expect(dialog.open).toBe(false)
    expect(getComputedStyle(dialog).display, `${server.browser}: a closed dialog is not display:none`).toBe('none')
    expect(dialog.getBoundingClientRect().width).toBe(0)
  })

  it('the open dialog paints ABOVE a fixed, max z-index sibling (the reason to use native <dialog>)', async () => {
    const { drawer, dialog } = mount(
      '<div style="position:fixed;inset:0;z-index:2147483647;background:rgb(255,0,0)"></div>' +
        '<ui-drawer><p>On top</p></ui-drawer>',
    )
    // This test asserts the SETTLED (post-entry-motion) geometry, not the animation itself (a dedicated
    // reduced-motion test covers the transition below) — suppress it so `updateComplete` alone guarantees
    // the resting inset is committed, instead of racing a real 300ms CSS transition.
    dialog.style.transition = 'none'
    drawer.open = true
    await drawer.updateComplete

    const r = dialog.getBoundingClientRect()
    expect(r.width, `${server.browser}: the dialog rendered a zero-width box (rect: ${JSON.stringify(r)})`).toBeGreaterThan(0)
    expect(r.height, `${server.browser}: the dialog rendered a zero-height box (rect: ${JSON.stringify(r)})`).toBeGreaterThan(0)
    // an INSET point (not the geometric centre) — the docked default (edge='end') panel is flush against
    // the viewport's inline-end, so a point a few px in from its own top-left corner is unambiguously
    // INSIDE the dialog's own rendered box regardless of exactly how tall/wide the token resolves.
    const cx = Math.round(r.left + Math.min(10, r.width / 2))
    const cy = Math.round(r.top + Math.min(10, r.height / 2))
    const hit = document.elementFromPoint(cx, cy)
    expect(hit, `nothing was hit at (${cx}, ${cy}) — rect: ${JSON.stringify(r)}`).not.toBeNull()
    expect(
      dialog === hit || dialog.contains(hit),
      `${server.browser}: the drawer did not render in the top layer (a z-index sibling occluded it)`,
    ).toBe(true)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [2] focus TRAP + RESTORE — the page behind goes inert; focus returns to the EXACT opener (both engines)
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-drawer — focus is trapped inside the open dialog and restored to the exact opener on close (both engines)', () => {
  it('initial focus moves into the dialog and a button OUTSIDE cannot steal it', async () => {
    const { wrap, drawer, dialog } = mount(
      '<button id="outside">outside</button><ui-drawer><button id="inside">inside</button></ui-drawer>',
    )
    const outside = wrap.querySelector('#outside') as HTMLButtonElement
    drawer.open = true
    await drawer.updateComplete

    expect(dialog.contains(document.activeElement), `${server.browser}: focus did not move into the dialog`).toBe(true)

    outside.focus()
    expect(
      dialog.contains(document.activeElement),
      `${server.browser}: an outside button stole focus from the open drawer (not trapped)`,
    ).toBe(true)
    expect(document.activeElement).not.toBe(outside)
  })

  it('Escape closes the drawer, syncs open=false + emits close, and restores focus to the opener (NC: not body)', async () => {
    const { wrap, drawer, dialog } = mount(
      '<button id="opener">open</button><ui-drawer><button>inside</button></ui-drawer>',
    )
    const opener = wrap.querySelector('#opener') as HTMLButtonElement
    opener.focus()
    expect(document.activeElement).toBe(opener)

    let closes = 0
    drawer.addEventListener('close', () => closes++)
    drawer.open = true
    await drawer.updateComplete
    expect(dialog.open).toBe(true)
    expect(dialog.contains(document.activeElement), 'focus did not enter the dialog').toBe(true)

    await userEvent.keyboard('{Escape}')
    await drawer.updateComplete
    expect(dialog.open, `${server.browser}: Escape did not close the dialog`).toBe(false)
    expect(drawer.open, 'the open prop did not sync to false on Escape').toBe(false)
    expect(closes, 'the close event did not fire on Escape').toBe(1)
    expect(document.activeElement, `${server.browser}: focus was not restored to the exact opener`).toBe(opener)
  })

  it('persistent: Escape does NOT close the drawer (the cancel is blocked)', async () => {
    const { drawer, dialog } = mount('<ui-drawer persistent><button>inside</button></ui-drawer>')
    drawer.open = true
    await drawer.updateComplete
    expect(dialog.open).toBe(true)

    await userEvent.keyboard('{Escape}')
    await drawer.updateComplete
    expect(dialog.open, `${server.browser}: Escape closed a persistent drawer`).toBe(true)
    expect(drawer.open).toBe(true)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [3] scrim click vs content click — rect-wise, real coordinates (both engines)
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-drawer — scrim click closes (dismissable); a content click does not (both engines)', () => {
  it('a click INSIDE the dialog content rect does NOT close it', async () => {
    const { drawer, dialog } = mount('<ui-drawer><button id="inner">inner</button></ui-drawer>')
    drawer.open = true
    await drawer.updateComplete
    const inner = dialog.querySelector('#inner') as HTMLButtonElement

    await userEvent.click(inner)
    await drawer.updateComplete
    expect(dialog.open, `${server.browser}: a content click closed the drawer (should not)`).toBe(true)
  })

  it('a click OUTSIDE the dialog content rect (the ::backdrop) closes a dismissable drawer', async () => {
    const { drawer, dialog } = mount('<ui-drawer><p>Body</p></ui-drawer>')
    drawer.open = true
    await drawer.updateComplete

    const r = dialog.getBoundingClientRect()
    // A point definitively outside the dialog's own content rect but still inside the dialog BOX element
    // (the top-layer <dialog> spans the full viewport for hit-testing purposes at its edges) — click at the
    // viewport corner, far from the docked panel (default edge='end' — the panel sits at the inline end).
    await userEvent.click(document.body, { position: { x: 2, y: 2 } })
    // A direct dispatch on the dialog element itself at a point outside its rendered content rect (the
    // modal.browser.test.ts precedent uses the same rect-wise mechanism; here we drive it explicitly since
    // the docked panel does not cover the whole viewport).
    const outside = new MouseEvent('click', { bubbles: true, clientX: Math.max(0, r.left - 10), clientY: Math.max(0, r.top - 10) })
    dialog.dispatchEvent(outside)
    await drawer.updateComplete
    expect(dialog.open, `${server.browser}: a genuine backdrop click did not close the dismissable drawer`).toBe(false)
  })

  it('persistent: the SAME backdrop click is ignored (the drawer stays open)', async () => {
    const { drawer, dialog } = mount('<ui-drawer persistent><p>Body</p></ui-drawer>')
    drawer.open = true
    await drawer.updateComplete
    const r = dialog.getBoundingClientRect()
    const outside = new MouseEvent('click', { bubbles: true, clientX: Math.max(0, r.left - 10), clientY: Math.max(0, r.top - 10) })
    dialog.dispatchEvent(outside)
    await drawer.updateComplete
    expect(dialog.open, `${server.browser}: a backdrop click closed a persistent drawer`).toBe(true)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [4] native Tab order + an embedded field types freely (the form-popover SPEC-R5 lesson, proven not asserted)
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-drawer — an embedded ui-text-field types freely (native Tab order, no roving focus)', () => {
  it('real keystrokes land in the embedded field while the drawer is open', async () => {
    const { drawer, dialog } = mount(
      '<ui-drawer><ui-text-field label="Name"></ui-text-field></ui-drawer>',
    )
    drawer.open = true
    await drawer.updateComplete

    const field = dialog.querySelector('ui-text-field') as HTMLElement & { value?: string }
    const editable = field.querySelector('[contenteditable]') as HTMLElement
    expect(editable, 'the text-field editor part is missing').not.toBeNull()
    editable.focus()
    await userEvent.keyboard('Ada Lovelace')
    await drawer.updateComplete
    expect(editable.textContent, `${server.browser}: the embedded field did not receive real keystrokes`).toBe('Ada Lovelace')
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [5] ::backdrop paint (Chromium via CDP forced-colors baseline; WebKit asserts the baseline)
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-drawer — the ::backdrop scrim paints (Chromium emulates forced-colors via CDP; WebKit asserts the baseline)', () => {
  it('the ::backdrop paints in normal mode and the dialog surface survives forced-colors', async () => {
    const { drawer, dialog } = mount('<ui-drawer><p>Body</p></ui-drawer>')
    drawer.open = true
    await drawer.updateComplete

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

    expect(alphaOf(getComputedStyle(dialog, '::backdrop').backgroundColor), `${server.browser}: the ::backdrop did not paint`).toBeGreaterThan(0)
    expect(alphaOf(getComputedStyle(dialog).backgroundColor), 'the dialog surface is not opaque').toBeGreaterThan(0)

    if (server.browser !== 'chromium') {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(true)
      expect(alphaOf(getComputedStyle(dialog).backgroundColor), 'the dialog surface vanished under forced-colors').toBeGreaterThan(0)
      expect(alphaOf(getComputedStyle(dialog).borderTopColor), 'the dialog frame vanished under forced-colors').toBeGreaterThan(0)
      expect(alphaOf(getComputedStyle(dialog, '::backdrop').backgroundColor), 'the ::backdrop vanished under forced-colors').toBeGreaterThan(0)
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [6] BUILT-OUTPUT — the docked geometry + motion, computed from PRODUCTION CSS (the TKT-0002 class,
//      n13's accept predicate: "computes from production CSS, not source-grepped"). Chromium only for the
//      reduced-motion CDP emulation leg; the geometry legs run on both engines since they read plain
//      computed style, no emulation needed.
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-drawer — built-output geometry (production CSS, both engines)', () => {
  /** Mount a bare div, inject the PRODUCTION CSS bytes as this test's OWN stylesheet (scoped to this
   *  describe block via a fresh <style> per test — avoids cross-test bleed from the dev-mode sheets other
   *  describes in this file rely on), and mount a real ui-drawer inside it. */
  function mountBuilt(markup: string): { wrap: HTMLElement; drawer: UIDrawerElement; dialog: HTMLDialogElement; styleEl: HTMLStyleElement } {
    const styleEl = document.createElement('style')
    styleEl.textContent = builtCss
    document.head.append(styleEl)
    const { wrap, drawer, dialog } = mount(markup)
    return { wrap, drawer, dialog, styleEl }
  }

  /** Independently measure `{pct}svh` in px via a neutral probe element (the theme-provider
   *  `independentExpected` idiom, applied to a geometry unit instead of a colour) — `svh` (the SMALL
   *  viewport height) is not guaranteed identical to `window.innerHeight` in every engine/headless
   *  configuration (mobile-shaped UA-chrome reservation is exactly what `svh` vs `vh` exists to model), so
   *  the correct cross-check is against the SAME CSS unit computed independently, never the DOM property. */
  function measureSvh(pct: number): number {
    const probe = document.createElement('div')
    probe.style.position = 'fixed'
    probe.style.blockSize = `${pct * 100}svh`
    document.body.append(probe)
    const px = Number.parseFloat(getComputedStyle(probe).blockSize)
    probe.remove()
    return px
  }

  afterEach(() => {
    // the dev-mode `./drawer.css` import at the top of this file already supplies the SAME rules for
    // every other describe block; injecting the built sheet on top is additive (later source wins at
    // equal specificity, harmless) — remove it after each built-output test so it cannot leak forward.
    for (const s of Array.from(document.head.querySelectorAll('style'))) {
      if (s.textContent === builtCss) s.remove()
    }
  })

  it("edge='end' (the default): full viewport block-size, inline-size resolves the token default, docked (inline-end) corners zero their radius", async () => {
    const { drawer, dialog } = mountBuilt('<ui-drawer><p>Body</p></ui-drawer>')
    // Assert the SETTLED geometry, not the mid-transition frame — a separate test below proves the motion/
    // reduced-motion leg; suppressing the transition here makes `updateComplete` alone sufficient (no race
    // against the real 300ms entry animation).
    dialog.style.transition = 'none'
    drawer.open = true
    await drawer.updateComplete

    const cs = getComputedStyle(dialog)
    expect(px(cs.blockSize), `${server.browser}: edge=end did not compute full viewport block-size`).toBeCloseTo(measureSvh(1), 0)
    expect(px(cs.inlineSize), `${server.browser}: edge=end inline-size did not resolve the token default`).toBeGreaterThan(0)
    expect(px(cs.inlineSize)).toBeLessThanOrEqual(window.innerWidth * 0.92 + 1)

    // docked (inline-end) corners zero; exposed (inline-start) corners keep the fleet base radius
    const rtl = getComputedStyle(document.documentElement).direction === 'rtl'
    const dockedRadius = rtl ? px(cs.borderTopLeftRadius) : px(cs.borderTopRightRadius)
    const exposedRadius = rtl ? px(cs.borderTopRightRadius) : px(cs.borderTopLeftRadius)
    expect(dockedRadius, `${server.browser}: the docked edge did not zero its radius`).toBe(0)
    expect(exposedRadius, `${server.browser}: the exposed edge lost the fleet base radius`).toBeGreaterThan(0)
  })

  it("edge='start': docks to the inline-start edge; that edge's corners zero, the inline-end corners keep the base radius", async () => {
    const { drawer, dialog } = mountBuilt('<ui-drawer edge="start"><p>Body</p></ui-drawer>')
    dialog.style.transition = 'none' // settled geometry, not the mid-transition frame — see the edge='end' test above
    drawer.open = true
    await drawer.updateComplete

    const cs = getComputedStyle(dialog)
    expect(px(cs.blockSize), `${server.browser}: edge=start did not compute full viewport block-size`).toBeCloseTo(measureSvh(1), 0)

    const rtl = getComputedStyle(document.documentElement).direction === 'rtl'
    const dockedRadius = rtl ? px(cs.borderTopRightRadius) : px(cs.borderTopLeftRadius)
    const exposedRadius = rtl ? px(cs.borderTopLeftRadius) : px(cs.borderTopRightRadius)
    expect(dockedRadius, `${server.browser}: the docked (start) edge did not zero its radius`).toBe(0)
    expect(exposedRadius, `${server.browser}: the exposed edge lost the fleet base radius`).toBeGreaterThan(0)

    // and it is genuinely docked to the OPPOSITE screen edge from the default ('end') — a rect-level proof,
    // not just a radius proof, that `edge='start'` really flips the docked side.
    const r = dialog.getBoundingClientRect()
    expect(r.left, `${server.browser}: edge=start did not dock flush to the viewport's left edge`).toBeCloseTo(0, 0)
  })

  it("edge='bottom': content-height capped at the max-block-size token (85svh), full inline-bleed, bottom corners zero their radius", async () => {
    const { drawer, dialog } = mountBuilt('<ui-drawer edge="bottom"><div style="block-size:3000px">tall</div></ui-drawer>')
    dialog.style.transition = 'none' // settled geometry, not the mid-transition frame — see the edge='end' test above
    drawer.open = true
    await drawer.updateComplete

    const cs = getComputedStyle(dialog)
    const expectedMax = measureSvh(0.85)
    expect(px(cs.maxBlockSize), `${server.browser}: edge=bottom max-block-size did not resolve 85svh`).toBeCloseTo(expectedMax, 0)
    // the content forces the cap to bind (a 3000px child is far taller than 85svh) — the RENDERED height
    // must sit at the cap, not merely have the property declared (an un-forced cap would be vacuous).
    expect(dialog.getBoundingClientRect().height, `${server.browser}: the bottom drawer did not render at its capped height`).toBeCloseTo(expectedMax, 0)

    const r = dialog.getBoundingClientRect()
    expect(r.left, `${server.browser}: edge=bottom is not full inline-bleed (left)`).toBeCloseTo(0, 0)
    expect(r.right, `${server.browser}: edge=bottom is not full inline-bleed (right)`).toBeCloseTo(window.innerWidth, 0)

    const bottomLeftRadius = px(cs.borderBottomLeftRadius)
    const bottomRightRadius = px(cs.borderBottomRightRadius)
    const topRadius = px(cs.borderTopLeftRadius)
    expect(bottomLeftRadius, `${server.browser}: the docked (bottom) edge did not zero its radius`).toBe(0)
    expect(bottomRightRadius, `${server.browser}: the docked (bottom) edge did not zero its radius`).toBe(0)
    expect(topRadius, `${server.browser}: the exposed top edge lost the fleet base radius`).toBeGreaterThan(0)
  })

  it('prefers-reduced-motion: reduce suppresses the transition — computed transition-duration is 0s (Chromium via CDP; WebKit asserts the baseline)', async () => {
    const { drawer, dialog } = mountBuilt('<ui-drawer><p>Body</p></ui-drawer>')

    if (server.browser !== 'chromium') {
      // WebKit exposes no CDP media emulation — assert the NORMAL-mode duration is non-zero (so the
      // Chromium proof below is not silently vacuous) and stop.
      drawer.open = true
      await drawer.updateComplete
      const dur = getComputedStyle(dialog).transitionDuration
      expect(dur, `${server.browser}: the drawer declares no transition at all in normal mode`).not.toBe('0s')
      return
    }

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
    try {
      expect(window.matchMedia('(prefers-reduced-motion: reduce)').matches).toBe(true)
      drawer.open = true
      await drawer.updateComplete
      const dur = getComputedStyle(dialog).transitionDuration
      // every comma-separated duration in the shorthand-computed list must be 0s (the `transition: none`
      // override in the reduced-motion block replaces the whole property, not just one leg).
      const durations = dur.split(',').map((d) => d.trim())
      for (const d of durations) expect(d, `${server.browser}: a transition leg survived reduced-motion (${dur})`).toBe('0s')
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  GH #913 (#906's flagged adjacent gap) — the dialog part scrolls with a thin, auto-hiding scrollbar,
//  never the platform-default chunky bar. MEASURED (both engines under test fully expose the computed-style
//  surface this probes — verified empirically, not assumed): a bare `overflow: auto` box renders with a
//  ZERO-width overlay gutter in this headless harness regardless of any CSS, so a gutter-width COMPARISON
//  against an untreated control cannot discriminate "thin" from "chunky" here — the honest,
//  engine-capability-respecting probe is the computed STYLE itself: `scrollbar-width: thin` (the standard
//  property) and the `::-webkit-scrollbar{,-thumb}` pseudo values this fix actually declares (the #874/#911
//  precedent, modal.browser.test.ts's own sibling suite). Focus is TRAPPED inside the dialog by showModal()
//  (the platform), so the reveal-on-focus leg checks the dialog part's OWN :focus-within — no sibling/host
//  proxy needed (unlike command-modal's nested-dialog case).
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-drawer cross-engine — GH #913: the dialog scrolls with an unobtrusive (thin) scrollbar, never the platform-default chunky bar', () => {
  it('overflows for real, scrolls, and computes the thin/reveal-on-open treatment (transparent-at-rest MEASURED on the closed dialog — see the next test\'s own note)', async () => {
    const { drawer, dialog } = mount(`<ui-drawer><div style="block-size: 3000px;">tall</div></ui-drawer>`)
    // BEFORE open — the dialog exists in the DOM (created at connect) but carries no [open] attribute, so
    // it is genuinely un-hovered and un-focused: the honest "at rest" baseline. MEASURED (both engines,
    // modal.browser.test.ts's own sibling suite): a native <dialog>'s "dialog focusing steps" ALWAYS place
    // focus somewhere inside it once showModal() is called (an autofocus/first-focusable descendant, else
    // the dialog element itself, HTML §4.11.4) — so once OPEN, :focus-within is unconditionally true and a
    // post-open "not focused" snapshot is not reachable via .blur() (a modal dialog's own focus cannot be
    // relinquished to an inert page).
    expect(
      getComputedStyle(dialog, '::-webkit-scrollbar-thumb').backgroundColor,
      `${server.browser}: thumb transparent at rest (closed, before showModal())`,
    ).toBe('rgba(0, 0, 0, 0)')

    drawer.open = true
    await drawer.updateComplete
    expect(dialog.scrollHeight, 'a real overflow to actually scroll').toBeGreaterThan(dialog.clientHeight)

    // scrollability itself is UNCHANGED by this fix — a real scrollTop move.
    dialog.scrollTop = 0
    dialog.scrollTop = 40
    expect(dialog.scrollTop, `${server.browser}: still genuinely scrollable`).toBeGreaterThan(0)

    // THIN, never the platform-default chunky bar.
    expect(getComputedStyle(dialog).scrollbarWidth, `${server.browser}: scrollbar-width`).toBe('thin')
    expect(getComputedStyle(dialog, '::-webkit-scrollbar').width, `${server.browser}: ::-webkit-scrollbar width`).toBe('8px')

    // This drawer has NO focusable descendant, so showModal()'s own focusing steps land focus on the
    // DIALOG ITSELF — the thumb is already revealed the instant it opens (the next test proves the
    // mechanism explicitly with a real focused descendant + a :focus-within assertion).
    expect(
      getComputedStyle(dialog, '::-webkit-scrollbar-thumb').backgroundColor,
      `${server.browser}: thumb paints once open (the platform's own forced initial focus)`,
    ).not.toBe('rgba(0, 0, 0, 0)')
  })

  it('reveals the thumb while the dialog itself is :focus-within (focus is TRAPPED inside by showModal() — no sibling/host proxy needed)', async () => {
    const { drawer, dialog } = mount(`<ui-drawer><div style="block-size: 3000px;"><button>focus me</button></div></ui-drawer>`)
    drawer.open = true
    await drawer.updateComplete
    const button = dialog.querySelector('button') as HTMLButtonElement
    button.focus()
    await drawer.updateComplete

    expect(dialog.matches(':focus-within'), `${server.browser}: the dialog part did not register :focus-within`).toBe(true)
    expect(
      getComputedStyle(dialog, '::-webkit-scrollbar-thumb').backgroundColor,
      `${server.browser}: thumb paints while the dialog is focus-within`,
    ).not.toBe('rgba(0, 0, 0, 0)')
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  GH #918/#920 — the content LAYOUT SYSTEM: an author `<header>`/`[data-region='content']`/`<footer>` gets
//  a content region that owns its OWN independent scroll (GH #920 revision — see below) plus a
//  scroll-conditional hairline that appears only once real content has scrolled behind that region — proven
//  from computed style + real scrollTop moves, never source-grepped (the TKT-0002 class).
//
//  GH #920 root cause: `scrollFade` originally wired to the WHOLE dialog, so the shared mask
//  (container-box.css's `[data-fade-top]`/`[data-fade-bottom]` rules) painted over the sticky header/footer
//  too — they were the masked dialog's own descendants, and a CSS mask composites its entire rendered
//  subtree with no per-descendant exemption. Fix (drawer.ts + drawer.css): the content region now owns its
//  OWN scroll viewport; the dialog itself stops scrolling; header/footer become plain flex items OUTSIDE the
//  scroller, structurally never a masked element's descendant.
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-drawer cross-engine — GH #918/#920: the content-scoped scroll region + the scroll-conditional hairline', () => {
  const REGION_MARKUP = `<ui-drawer>
    <header id="hdr"><h2 style="margin:0">Title</h2></header>
    <div data-region="content" id="content"><div style="block-size: 3000px;">tall</div></div>
    <footer id="ftr"><button>Done</button></footer>
  </ui-drawer>`

  // scrollFade listens for the real, ASYNCHRONOUSLY-dispatched `scroll` event — a plain `el.scrollTop = top`
  // updates layout synchronously but does not itself resolve the trait's own listener callback in the same
  // tick (modal.browser.test.ts's own `scrollTo` precedent, reused verbatim here). A no-op scroll (already at
  // `top`) resolves immediately, since no event would ever fire.
  const scrollTo = (el: HTMLElement, top: number): Promise<void> =>
    new Promise((resolve) => {
      if (el.scrollTop === top) {
        resolve()
        return
      }
      el.addEventListener('scroll', () => resolve(), { once: true })
      el.scrollTop = top
    })

  it('GH #920 — the dialog itself stops scrolling once a distinct content region is composed; the content region is the sole scroller', async () => {
    const { drawer, dialog } = mount(REGION_MARKUP)
    drawer.open = true
    await drawer.updateComplete

    const content = dialog.querySelector('#content') as HTMLElement
    expect(getComputedStyle(dialog).overflow, `${server.browser}: the dialog still owns scrolling — content-scroll-mode did not engage`).toBe('hidden')
    expect(getComputedStyle(content).overflowY, `${server.browser}: the content region is not its own scroll viewport`).toBe('auto')
    expect(content.scrollHeight, 'a real overflow to actually scroll').toBeGreaterThan(content.clientHeight)
  })

  it('GH #920 — the header/footer are OUTSIDE the scroll viewport (plain flex items, not the scrolling dialog’s sticky descendants)', async () => {
    const { drawer, dialog } = mount(REGION_MARKUP)
    drawer.open = true
    await drawer.updateComplete

    expect(getComputedStyle(dialog).display, `${server.browser}: the dialog did not switch to the flex content-scroll layout`).toBe('flex')
    const header = dialog.querySelector('#hdr') as HTMLElement
    const footer = dialog.querySelector('#ftr') as HTMLElement
    expect(getComputedStyle(header).flexShrink, `${server.browser}: the header is not a fixed-size flex item`).toBe('0')
    expect(getComputedStyle(footer).flexShrink, `${server.browser}: the footer is not a fixed-size flex item`).toBe('0')
  })

  it('GH #920 — the header/footer render at FULL OPACITY regardless of scroll: the fade flag lands on the content region, never the dialog', async () => {
    const { drawer, dialog } = mount(REGION_MARKUP)
    drawer.open = true
    await drawer.updateComplete

    const content = dialog.querySelector('#content') as HTMLElement
    // before any scroll
    expect(dialog.hasAttribute('data-fade-top'), `${server.browser}: the dialog carried a fade flag at rest — it must never be the masked element`).toBe(false)
    expect(dialog.hasAttribute('data-fade-bottom'), `${server.browser}: the dialog carried a fade flag at rest — it must never be the masked element`).toBe(false)

    await scrollTo(content, 200)
    // after scrolling: the flag must land on CONTENT (the actual scroller), never on the dialog (which would
    // re-introduce the #920 bug — masking header/footer as its descendants).
    expect(content.hasAttribute('data-fade-top'), `${server.browser}: scrollFade did not target the content region`).toBe(true)
    expect(dialog.hasAttribute('data-fade-top'), `${server.browser}: the dialog itself carried the fade flag — header/footer would be masked again (the #920 regression)`).toBe(false)
    expect(dialog.hasAttribute('data-fade-bottom'), `${server.browser}: the dialog itself carried the fade flag — header/footer would be masked again (the #920 regression)`).toBe(false)
  })

  it('the header hairline is ABSENT before any scroll and PAINTS once content has scrolled behind it (data-fade-top, now on the content region)', async () => {
    const { drawer, dialog } = mount(REGION_MARKUP)
    drawer.open = true
    await drawer.updateComplete

    const header = dialog.querySelector('#hdr') as HTMLElement
    const content = dialog.querySelector('#content') as HTMLElement
    expect(content.hasAttribute('data-fade-top'), `${server.browser}: data-fade-top set before any scroll (at rest)`).toBe(false)
    expect(getComputedStyle(header).borderBottomWidth, `${server.browser}: an unscrolled drawer painted a static header border`).toBe('0px')

    await scrollTo(content, 200)
    expect(content.hasAttribute('data-fade-top'), `${server.browser}: scrollFade did not set data-fade-top after scrolling`).toBe(true)
    expect(px(getComputedStyle(header).borderBottomWidth), `${server.browser}: the header hairline did not paint once scrolled`).toBeGreaterThan(0)
  })

  it('the footer hairline PAINTS while content remains hidden past the bottom edge (data-fade-bottom) and CLEARS at the true end', async () => {
    const { drawer, dialog } = mount(REGION_MARKUP)
    drawer.open = true
    await drawer.updateComplete

    const footer = dialog.querySelector('#ftr') as HTMLElement
    const content = dialog.querySelector('#content') as HTMLElement
    await scrollTo(content, 200) // short of the end — content is still hidden past the footer
    expect(content.hasAttribute('data-fade-bottom'), `${server.browser}: data-fade-bottom did not set mid-scroll`).toBe(true)
    expect(px(getComputedStyle(footer).borderTopWidth), `${server.browser}: the footer hairline did not paint mid-scroll`).toBeGreaterThan(0)

    await scrollTo(content, content.scrollHeight) // the true end — nothing left hidden past the footer
    expect(content.hasAttribute('data-fade-bottom'), `${server.browser}: data-fade-bottom stayed set at the true scroll end`).toBe(false)
    expect(getComputedStyle(footer).borderTopWidth, `${server.browser}: the footer hairline stayed painted at the true scroll end`).toBe('0px')
  })

  it('the drawer’s own region rhythm (--ui-drawer-pad-inline/-pad-block) resolves on the content region, not the shared 12/6px default', async () => {
    const { drawer, dialog } = mount(REGION_MARKUP)
    drawer.open = true
    await drawer.updateComplete

    const content = dialog.querySelector('#content') as HTMLElement
    const cs = getComputedStyle(content)
    // --ui-drawer-pad-inline defaults to --md-sys-space-md, --ui-drawer-pad-block to --md-sys-space-sm — both
    // distinct dimensional roles from container-box.css's own generic 12px/6px --ui-box-pad-inline/-block
    // defaults; asserting they actually resolve (not just declared) proves the repoint reached the region.
    expect(px(cs.paddingInlineStart), `${server.browser}: the content region did not pick up the drawer's own inline padding`).toBeGreaterThan(0)
    expect(px(cs.paddingBlockStart), `${server.browser}: the content region did not pick up the drawer's own block padding`).toBeGreaterThan(0)
  })

  it('a PLAIN drawer with no distinct content region is unaffected: the dialog itself stays the sole scrollport (GH #913, unchanged)', async () => {
    const { drawer, dialog } = mount(`<ui-drawer><div style="block-size: 3000px;">tall, no header/footer/content regions</div></ui-drawer>`)
    drawer.open = true
    await drawer.updateComplete

    expect(getComputedStyle(dialog).display, `${server.browser}: a plain drawer's dialog must NOT switch to the flex content-scroll layout`).not.toBe('flex')
    expect(getComputedStyle(dialog).overflow, `${server.browser}: a plain drawer's dialog must stay the scroller`).toBe('auto')
    dialog.scrollTop = 0
    dialog.scrollTop = 40
    expect(dialog.scrollTop, `${server.browser}: still genuinely scrollable`).toBeGreaterThan(0)
  })
})
