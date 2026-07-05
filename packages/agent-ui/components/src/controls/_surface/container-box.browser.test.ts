import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp } from 'vitest/browser'

// container-box.browser.test.ts — the CROSS-ENGINE z-depth-scope proof (ADR-0052). Runs in BOTH Chromium and
// WebKit (vitest.browser.config.ts). Where container-box.test.ts pins the DECLARED `isolation: isolate`, this
// pins the RENDERED consequence a real engine resolves — ANTI-VACUOUS both ways: a huge z-index INSIDE one
// [data-box] cannot paint over a LATER sibling box (the isolation law), and the NEGATIVE control proves the
// probe bites (the same markup WITHOUT [data-box] — no isolation — lets the huge z-index win, so a regression
// that drops the declaration flips the first assertion, not just this file's assumptions).
//
// Side-effect CSS import: container-box.css alone — the law under test is the shared box-model layer's, not
// any element's (plain <div data-box> carriers keep the probe element-independent, like the sheet itself).
import './container-box.css'

const mounted: HTMLElement[] = []
const mount = (markup: string): HTMLElement => {
  const wrap = document.createElement('div')
  wrap.innerHTML = markup
  document.body.append(wrap)
  mounted.push(wrap)
  return wrap.firstElementChild as HTMLElement
}
afterEach(() => {
  for (const el of mounted.splice(0)) el.remove()
})

/** Two overlapping surfaces: the FIRST holds a positioned z-index:9999 child; the SECOND (later in DOM order,
 *  pulled up over the first via a negative margin) holds plain content. `boxed` toggles [data-box] on both. */
const overlap = (boxed: boolean): { probe: HTMLElement; second: HTMLElement } => {
  const attr = boxed ? ' data-box' : ''
  const host = mount(`<div>
    <div id="first"${attr} style="block-size: 60px; background: #eee;">
      <div id="probe" style="position: relative; z-index: 9999; block-size: 40px; background: crimson;">on top?</div>
    </div>
    <div id="second"${attr} style="block-size: 60px; background: #ddd; margin-block-start: -30px; position: relative;">
      <div style="block-size: 40px; background: navy;">sibling content</div>
    </div>
  </div>`)
  return {
    probe: host.querySelector('#probe') as HTMLElement,
    second: host.querySelector('#second') as HTMLElement,
  }
}

/** The element the engine actually paints topmost at the vertical centre of the overlap band. */
const topAtOverlap = (second: HTMLElement): Element | null => {
  const r = second.getBoundingClientRect()
  return document.elementFromPoint(r.left + r.width / 2, r.top + 5) // 5px into the second box = inside the band
}

describe('container-box — [data-box] is its own z-depth scope (ADR-0052, rendered proof)', () => {
  it('a z-index:9999 inside one [data-box] CANNOT paint over a later sibling box', () => {
    const { second } = overlap(true)
    const top = topAtOverlap(second)
    // isolation scopes the 9999 inside #first; DOM order then stacks #second (later) above it.
    expect(second.contains(top)).toBe(true)
  })

  it('NEGATIVE CONTROL — without [data-box] (no isolation) the same z-index:9999 DOES win the overlap', () => {
    const { probe, second } = overlap(false)
    const top = topAtOverlap(second)
    // No isolation: the huge z-index joins the page's stacking order and paints over the sibling — the
    // exact leak the law exists to prevent, proven reachable so the positive assertion above is not vacuous.
    expect(top).toBe(probe)
    expect(second.contains(top)).toBe(false)
  })

  it('the sticky header keeps winning over its OWN box content (the local z-index:1 still works inside the scope)', () => {
    const box = mount(`<div data-box style="block-size: 80px; overflow: auto; background: #fff;">
      <header style="block-size: 24px;">pinned</header>
      <main><div style="block-size: 300px; position: relative;">tall scrolled content</div></main>
    </div>`)
    const header = box.querySelector('header') as HTMLElement
    box.scrollTop = 100
    const r = header.getBoundingClientRect()
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    // Isolation scopes the header's z-index:1 — it must still beat the scrolled content INSIDE the same box.
    expect(header.contains(top) || top === header).toBe(true)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  A [popover] carrier respects the UA hidden-until-shown rule (the s13 e2e finding, 2026-07-01 fix)
//
//  The unconditional `display: flow-root` on `:where([data-box])` is author-origin CSS, and author beats
//  user-agent regardless of specificity — so on a box ALSO carrying `[popover]` (select/menu/combo-box's
//  panels, ADR-0046) it silently defeated the UA's own `[popover]:not(:popover-open){display:none}` rule.
//  The rendered consequence: a CLOSED panel stayed in layout/focus (a real Tab landed inside it instead of
//  skipping to the next control). The fix re-asserts the UA semantics at specificity 0. Anti-vacuous both
//  ways: closed → none, open → flow-root (never vacuously "not none"). The rendered Tab-order consequence
//  itself is the journey-level assertion in form-e2e.browser.test.ts (a real ui-select, not a bare element).
// ════════════════════════════════════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  Region INSET (REVISED 2026-07-04) — header/content/footer are no longer full-bleed (margin:0); they now
//  carry the SAME `--ui-box-inset` margin as any other [data-box] child. The load-bearing rendered proof:
//  frame↔region AND region↔region gutters both measure the SAME 6px — the BFC's margin-collapse is what
//  keeps the between-region gap from doubling (naive per-region margins would give 12px there, not 6).
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('container-box — regions are INSET, uniform 6px gutters (rendered proof, both engines)', () => {
  it('frame→region AND region→region gaps both measure ~6px (not 0, not doubled to 12)', () => {
    // NO border on the carrier div (a bare div has none by default) — getBoundingClientRect() then returns
    // exactly the padding edge, so a frame↔region delta is pure margin with no border width to subtract.
    const box = mount(`<div data-box>
      <header style="block-size: 20px;">H</header>
      <div data-region="content"><p style="margin: 0;">Body</p></div>
    </div>`)
    const rect = box.getBoundingClientRect()
    const header = box.querySelector('header') as HTMLElement
    const content = box.querySelector('[data-region="content"]') as HTMLElement
    const headerRect = header.getBoundingClientRect()
    const contentRect = content.getBoundingClientRect()

    const frameToHeader = headerRect.top - rect.top // the box's OWN border-box to the header's margin box
    const headerToContent = contentRect.top - headerRect.bottom // between two adjacent regions
    const contentToFrame = rect.bottom - contentRect.bottom // the last region to the box's bottom edge

    expect(frameToHeader, `${server.browser}: frame→header gap is not ~6px`).toBeCloseTo(6, 0)
    expect(headerToContent, `${server.browser}: header→content gap is not ~6px (doubled to 12 would be the naive-margin bug)`).toBeCloseTo(6, 0)
    expect(contentToFrame, `${server.browser}: content→frame gap is not ~6px`).toBeCloseTo(6, 0)
    // anti-vacuous: the middle gutter is genuinely NOT double the edge gutter (the exact doubling bug this
    // model must avoid — a regression here would show ~12px, not ~6px, at headerToContent).
    expect(headerToContent, 'the between-region gap doubled (12px) instead of collapsing to one inset (6px)').toBeLessThan(frameToHeader * 1.5)
  })

  it('the sticky header keeps its OWN 6px margin as the resting offset once scrolled (margin survives sticky)', () => {
    const box = mount(`<div data-box style="block-size: 80px; overflow: auto;">
      <header style="block-size: 20px;">pinned</header>
      <main><div style="block-size: 300px;">tall scrolled content</div></main>
    </div>`)
    const header = box.querySelector('header') as HTMLElement
    box.scrollTop = 200 // scroll well past the header's natural flow position
    const boxRect = box.getBoundingClientRect()
    const headerRect = header.getBoundingClientRect()
    // The header is stuck at inset-block-start:0 relative to the box's PADDING edge, but its own 6px
    // margin-block-start is NOT collapsed away by the sticky offset — the resting gap is ~6px, not 0 (a
    // regression that dropped the margin during sticky positioning would measure ~0px here).
    const restingGap = headerRect.top - boxRect.top
    expect(restingGap, `${server.browser}: the sticky header's own margin did not survive scrolling (measured ~0, expected ~6)`).toBeCloseTo(6, 0)
  })
})

describe('container-box — a [popover] carrier stays UA-hidden while closed (the flow-root fix)', () => {
  it('closed: a [data-box][popover] computes display:none (both engines)', () => {
    const el = mount(`<div data-box popover="auto">panel content</div>`)
    expect(el.matches(':popover-open'), 'the popover should start closed').toBe(false)
    expect(getComputedStyle(el).display, `${server.browser}: a closed [data-box][popover] is not display:none — Tab can still reach inside it`).toBe('none')
  })

  it('open: the same [data-box][popover] resolves to flow-root once shown (both engines)', () => {
    const el = mount(`<div data-box popover="auto">panel content</div>`)
    el.showPopover()
    expect(el.matches(':popover-open'), 'showPopover() should open it').toBe(true)
    expect(getComputedStyle(el).display, `${server.browser}: an OPEN [data-box][popover] lost its flow-root BFC — the fix over-scoped`).toBe('flow-root')
    el.hidePopover()
  })

  it('NEGATIVE CONTROL — a [data-box] WITHOUT [popover] keeps flow-root regardless (the fix is popover-scoped only)', () => {
    const el = mount(`<div data-box>plain box</div>`)
    expect(getComputedStyle(el).display, 'a non-popover box lost its flow-root BFC').toBe('flow-root')
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  Edge-aware scroll fade — the PAINT mechanism (the gutter-exposure fix). `traits/scroll-fade.ts` is
//  proven in isolation (jsdom, scroll-fade.test.ts) — the decision logic. Each component's own
//  `.browser.test.ts` proves the full live-scroll integration. This is the missing middle link: does the
//  CSS the trait drives actually RESOLVE to the right mask in a real engine, bare, both ways (present +
//  absent) — a plain `[data-fade-top]`/`[data-fade-bottom]` carrier, no component involved.
// ════════════════════════════════════════════════════════════════════════════════════════════════════

/** Minimal CDP surface — `cdp()`'s public type is empty; the playwright provider gives `.send` at runtime. */
interface CdpSession {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>
}

/** The resolved mask — WebKit ships mask-image unprefixed too, but read both to be engine-agnostic. */
const maskOf = (el: HTMLElement): string => {
  const cs = getComputedStyle(el) as CSSStyleDeclaration & { webkitMaskImage?: string }
  return cs.maskImage || cs.webkitMaskImage || 'none'
}

describe('container-box — edge-aware scroll fade PAINTS the right mask (rendered, both engines)', () => {
  it('neither flag → no mask at all (a short/non-scrolling viewport is never faded)', () => {
    const el = mount(`<div style="block-size: 40px;">short</div>`)
    expect(maskOf(el), `${server.browser}: an unflagged element painted a mask`).toBe('none')
  })

  it('[data-fade-top] only → a real gradient mask resolves (not none)', () => {
    const el = mount(`<div data-fade-top style="block-size: 40px;">content</div>`)
    expect(maskOf(el), `${server.browser}: data-fade-top did not resolve to a mask`).toMatch(/gradient/)
  })

  it('[data-fade-bottom] only → a real gradient mask resolves (not none)', () => {
    const el = mount(`<div data-fade-bottom style="block-size: 40px;">content</div>`)
    expect(maskOf(el), `${server.browser}: data-fade-bottom did not resolve to a mask`).toMatch(/gradient/)
  })

  it('BOTH flags → still a real gradient mask (the symmetric case)', () => {
    const el = mount(`<div data-fade-top data-fade-bottom style="block-size: 40px;">content</div>`)
    expect(maskOf(el), `${server.browser}: both flags did not resolve to a mask`).toMatch(/gradient/)
  })

  it('removing the flags at runtime drops the mask back to none (the trait toggling live)', () => {
    const el = mount(`<div data-fade-top style="block-size: 40px;">content</div>`)
    expect(maskOf(el)).toMatch(/gradient/)
    el.removeAttribute('data-fade-top')
    expect(maskOf(el), `${server.browser}: the mask survived after the flag was removed`).toBe('none')
  })

  it('forced-colors drops the mask even with a flag present (Chromium emulates; WebKit asserts the baseline)', async () => {
    const el = mount(`<div data-fade-top data-fade-bottom style="block-size: 40px;">content</div>`)
    // baseline (both engines, normal mode): the mask genuinely paints, so the forced-colors drop below is not vacuous
    expect(maskOf(el)).toMatch(/gradient/)

    if (server.browser !== 'chromium') {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches, 'CDP did not enter forced-colors').toBe(true)
      expect(maskOf(el), 'the mask survived under forced-colors (harms system-text legibility)').toBe('none')
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  Presence-aware fade OFFSET — the mask consumes `--ui-box-head`/`--ui-box-foot` (each edge's sticky-bracket
//  band, published by traits/scroll-fade.ts) so the fade ramp reaches PAST a present header/footer, and a
//  bracketless edge (offset 0px) collapses to the exact pre-offset viewport-edge mask. scroll-fade.test.ts
//  proves the trait PUBLISHES the bands; this proves the CSS RESOLVES them into a different rendered mask.
// ════════════════════════════════════════════════════════════════════════════════════════════════════
describe('container-box — the fade offset (--ui-box-head/--ui-box-foot) shifts the rendered mask', () => {
  it('a top fade with --ui-box-head set resolves a DIFFERENT mask than with no offset (the band is consumed)', () => {
    const plain = mount(`<div data-fade-top style="block-size: 200px;">c</div>`)
    const offset = mount(`<div data-fade-top style="block-size: 200px; --ui-box-head: 48px;">c</div>`)
    expect(maskOf(plain)).toMatch(/gradient/)
    expect(maskOf(offset)).toMatch(/gradient/)
    expect(maskOf(offset), `${server.browser}: --ui-box-head did not shift the resolved top mask`).not.toBe(maskOf(plain))
  })

  it('a bottom fade consumes --ui-box-foot the same way', () => {
    const plain = mount(`<div data-fade-bottom style="block-size: 200px;">c</div>`)
    const offset = mount(`<div data-fade-bottom style="block-size: 200px; --ui-box-foot: 48px;">c</div>`)
    expect(maskOf(offset), `${server.browser}: --ui-box-foot did not shift the resolved bottom mask`).not.toBe(maskOf(plain))
  })

  it('an explicit 0px offset is identical to no offset at all (the presence-ABSENT = pre-offset guarantee)', () => {
    const unset = mount(`<div data-fade-top data-fade-bottom style="block-size: 200px;">c</div>`)
    const zero = mount(`<div data-fade-top data-fade-bottom style="block-size: 200px; --ui-box-head: 0px; --ui-box-foot: 0px;">c</div>`)
    expect(maskOf(zero), `${server.browser}: an explicit 0px offset diverged from the un-offset mask`).toBe(maskOf(unset))
  })
})
