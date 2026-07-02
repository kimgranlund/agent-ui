import { describe, it, expect, afterEach } from 'vitest'
import { server } from '@vitest/browser/context'

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
