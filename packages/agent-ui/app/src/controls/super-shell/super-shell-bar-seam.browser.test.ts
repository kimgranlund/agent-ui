// super-shell-bar-seam.browser.test.ts — ADR-0166 (GH #371) cross-engine browser truth for the
// bar-seam / per-side-corner redesign: the frame's block-axis `gap` is deleted, each bar draws a 1px
// hairline INSIDE its own border box, and a card's bar-facing corners square PER SIDE off a token pair
// that frame-level `:has()` rules zero. jsdom cannot settle any of it (computed borders, real rects,
// container queries, `:has()` matching against a nested subtree) — the source-presence half lives in
// super-shell.test.ts, this is the measurement half.
//
// GH #381 appends the CARD-EDGE half of the same contract: a floating overlay card's four-sided outline.
// It lands here rather than in super-shell-responsive.browser.test.ts for two reasons — this file already
// owns the overlay-card fixture (cl.6's posture exception A measures corners on the very same box), and
// the responsive file is a named FOCUS_TIMING_FILES member (zero file parallelism, its own shard), which
// is the wrong home for a suite that measures computed paint and races nothing.
//
// TWO standing rules for this file, both from ADR-0166 cl.8:
//   1. NEVER read the `borderRadius` SHORTHAND. `0px 0px 18px 18px` is a string that satisfies
//      `not.toBe('0px')` VACUOUSLY, which would let the header-only and footer-only rows of cl.5's
//      matrix pass while testing nothing. Every corner assertion reads the four logical LONGHANDS.
//   2. A negative control on a BOTH-BARS fixture is unsatisfiable by construction — both pairs zero, so
//      all four longhands compute `0` and nothing survives for a mutation to take away. The corner NCs
//      run on a HEADER-ONLY fixture, whose block-END pair stays 18px.
import { describe, it, expect, afterEach } from 'vitest'
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import './super-shell.css'
import { UISuperShellElement } from './super-shell.ts'

const mounted: HTMLElement[] = []
afterEach(() => { for (const el of mounted.splice(0)) el.remove() })

/** The four LOGICAL corner longhands of one box, each PAIRED WITH ITS PROPERTY NAME. The name is not
 *  decoration: every negative control in this file is required to red *naming the longhand it broke*
 *  (the decomposition's n12/n22 predicates), and an array-shaped `toEqual` red prints only values — it
 *  cannot tell `border-start-start-radius` from `border-end-end-radius`. So each corner is asserted on
 *  its own, with its property name in the assertion message. */
const CORNERS = [
  ['border-start-start-radius', 'borderStartStartRadius', 'start'],
  ['border-start-end-radius', 'borderStartEndRadius', 'start'],
  ['border-end-start-radius', 'borderEndStartRadius', 'end'],
  ['border-end-end-radius', 'borderEndEndRadius', 'end'],
] as const

/** Asserts a box's block-start pair reads `start` and its block-end pair reads `end`, one named longhand
 *  at a time. NEVER reads the `borderRadius` shorthand (ADR-0166 cl.8's vacuous-pass trap). */
function expectCorners(box: HTMLElement, want: { start: string; end: string }, label: string): void {
  const cs = getComputedStyle(box)
  for (const [name, key, axis] of CORNERS) {
    expect(cs[key], `${label} · ${name}`).toBe(axis === 'start' ? want.start : want.end)
  }
}

type Slot = 'header' | 'global-nav' | 'nav-pane' | 'content' | 'options-pane' | 'footer'

/** A fixed-size shell authoring exactly the named slots. `resizableStart` composes the pane-resizer
 *  (the third carded part) whenever a start pane exists. */
function mount(slots: readonly Slot[], opts: { width?: number; resizableStart?: boolean; attrs?: Record<string, string> } = {}): UISuperShellElement {
  const el = document.createElement('ui-super-shell') as UISuperShellElement
  el.style.position = 'fixed'
  el.style.insetBlockStart = '0px'
  el.style.insetInlineStart = '0px'
  el.style.inlineSize = `${opts.width ?? 900}px`
  el.style.blockSize = '400px'
  if (opts.resizableStart) el.resizableStart = true
  for (const [k, v] of Object.entries(opts.attrs ?? {})) el.setAttribute(k, v)
  for (const slot of slots) {
    const child = document.createElement('div')
    child.setAttribute('data-slot', slot)
    child.textContent = slot
    el.append(child)
  }
  document.body.append(el)
  mounted.push(el)
  return el
}

const q = (el: HTMLElement, sel: string): HTMLElement => {
  const found = el.querySelector(sel) as HTMLElement | null
  expect(found, `missing ${sel}`).not.toBeNull()
  return found!
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// n18 — the flush-seam measurement suite (cl.1 · cl.2 · cl.5's row posture)
// ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('ADR-0166 cl.1/cl.2 — the frame inserts no space and each bar OWNS its seam', () => {
  it('cl.1 — the frame computes NO row gap (its only gap axis WAS the bar↔body seam)', () => {
    const el = mount(['header', 'nav-pane', 'content', 'footer'])
    const frame = q(el, '[data-part="frame"]')
    // an unset `gap` on a flex container computes to `normal` in both engines; `0px` is accepted too,
    // since a consumer repointing the token to zero is a lawful (if pointless) end state.
    expect(['normal', '0px']).toContain(getComputedStyle(frame).rowGap)
  })

  it('cl.2 — the header draws a 1px block-END hairline and sits FLUSH against middle', () => {
    const el = mount(['header', 'nav-pane', 'content'])
    const header = q(el, '[data-part="bar"][data-bar="header"]')
    const middle = q(el, '[data-part="middle"]')
    expect(getComputedStyle(header).borderBlockEndWidth).toBe('1px')
    expect(Math.abs(header.getBoundingClientRect().bottom - middle.getBoundingClientRect().top)).toBeLessThanOrEqual(1)
  })

  it('cl.2 — the footer draws a 1px block-START hairline and sits FLUSH against middle', () => {
    const el = mount(['nav-pane', 'content', 'footer'])
    const footer = q(el, '[data-part="bar"][data-bar="footer"]')
    const middle = q(el, '[data-part="middle"]')
    expect(getComputedStyle(footer).borderBlockStartWidth).toBe('1px')
    expect(Math.abs(middle.getBoundingClientRect().bottom - footer.getBoundingClientRect().top)).toBeLessThanOrEqual(1)
  })

  it('GH #626 — a bar is a padding-less RAIL: zero inline padding, and its content box reaches both frame edges', () => {
    // The other half of "background + seam only". ADR-0166 deferred a "sliver" — a consumer painting its
    // own surface on bar content saw the bar's `--ui-super-shell-surface` show through at both inline
    // extremes, because the bar's `padding-inline: calc(module / 3)` held that content 6px off each edge.
    // #626 removed the padding rather than repainting anything, so the leak has no geometry to occur in.
    // Longhands, never the `padding` shorthand — this file's standing rule 1 (the vacuous-pass trap).
    const el = mount(['header', 'content', 'footer'])
    for (const side of ['header', 'footer'] as const) {
      const bar = q(el, `[data-part="bar"][data-bar="${side}"]`)
      const cs = getComputedStyle(bar)
      expect(cs.paddingInlineStart, `${side} bar padding-inline-start`).toBe('0px')
      expect(cs.paddingInlineEnd, `${side} bar padding-inline-end`).toBe('0px')
      // `bar-content` deliberately carries no inset either: any box between the bar edge and the authored
      // content re-creates the sliver. The inset belongs on the authored content, off --ui-bar-inline-inset.
      const content = q(bar, '[data-part="bar-content"]')
      const barBox = bar.getBoundingClientRect()
      const contentBox = content.getBoundingClientRect()
      // The end edge is the shared one on both sides: this fixture authors no `options-*` slot, so no end
      // toggle exists and `bar-content` runs to the bar's end edge. The start edge carries the nav toggle
      // (a start side IS authored), so only the end edge is a clean flush assertion here.
      expect(Math.abs(contentBox.right - barBox.right), `${side} bar-content reaches the bar's end edge`).toBeLessThanOrEqual(0.5)
    }
  })

  it('GH #626 — with NO side toggles the bar content spans the frame edge-to-edge on BOTH inline edges', () => {
    // The toggle-free census case (a shell authoring only `content`), where both edges are assertable and
    // the sliver claim is total. Negative control, by hand: restore `padding-inline: calc(module / 3)` on
    // `[data-part='bar']` and both offsets read 6, not 0.
    const el = mount(['header', 'content'])
    const bar = q(el, '[data-part="bar"][data-bar="header"]')
    expect(bar.querySelector('[data-part="side-toggle"]'), 'the fixture is genuinely toggle-free').toBeNull()
    const barBox = bar.getBoundingClientRect()
    const contentBox = q(bar, '[data-part="bar-content"]').getBoundingClientRect()
    expect(Math.abs(contentBox.left - barBox.left), 'bar-content start edge').toBeLessThanOrEqual(0.5)
    expect(Math.abs(contentBox.right - barBox.right), 'bar-content end edge').toBeLessThanOrEqual(0.5)
  })

  it('GH #626 — bar-content FILLS the bar\'s block axis at the 54px minimum, on both bars', () => {
    // The bar sizes off `min-block-size`, so it is routinely taller than the text it holds; the bar's
    // `align-items: center` used to shrink-wrap `bar-content` to that text (~18px) and float it, leaving
    // a consumer's full-height header content laying out inside a box that was not the bar.
    // `clientHeight` is read deliberately: it IS the content-box block-size (padding is zero here, border
    // excluded), so this needs no border arithmetic and stays correct if the seam width is repointed.
    const el = mount(['header', 'content', 'footer'])
    for (const side of ['header', 'footer'] as const) {
      const bar = q(el, `[data-part="bar"][data-bar="${side}"]`)
      const content = q(bar, '[data-part="bar-content"]')
      // Anti-vacuous: the bar must genuinely be TALLER than the text, or "content fills bar" is satisfied
      // by a bar that shrank to its content and the assertion below proves nothing.
      expect(bar.clientHeight, `${side} bar is taller than its text row`).toBeGreaterThan(40)
      expect(Math.abs(content.getBoundingClientRect().height - bar.clientHeight), `${side} bar-content fills the bar's content box`).toBeLessThanOrEqual(0.5)
    }
  })

  it('GH #626 — bar-content still fills when the bar GROWS PAST its minimum (a taller sibling toggle)', () => {
    // Kim's stated case. The growth has to come from a SIBLING, not from the authored content itself:
    // tall authored content would make `bar-content` tall anyway and the probe would pass with or without
    // the fix. A side toggle forced past 54px is the discriminating fixture — the bar grows to match it
    // while `bar-content` still holds one short text row.
    // Negative control, by hand: drop `align-self: stretch` from `[data-part='bar-content']` and this
    // reads the text row's own ~18px against a 100px bar.
    const el = mount(['header', 'nav-pane', 'content'])
    const bar = q(el, '[data-part="bar"][data-bar="header"]')
    const toggle = q(bar, '[data-part="side-toggle"]')
    toggle.style.blockSize = '100px'
    const content = q(bar, '[data-part="bar-content"]')
    expect(bar.clientHeight, 'the bar genuinely grew past its 54px minimum').toBeGreaterThan(90)
    expect(Math.abs(content.getBoundingClientRect().height - bar.clientHeight), 'bar-content fills the GROWN bar').toBeLessThanOrEqual(0.5)
  })

  it('GH #626 — SHORT bar content stays vertically CENTRED (the fill must not top-anchor it)', () => {
    // The regression the #626 review caught (MEDIUM, measured on the live docs header): making
    // `bar-content` fill the bar is only half the contract. Filling alone left it a BLOCK box, so short
    // authored content sat at its top edge — a ~4.5px upward shift of every bar's content on every
    // super-shell surface, because the bar's `align-items: center` used to centre the shrink-wrapped
    // box and no longer had a short box to centre.
    // Asserted as equal top and bottom gaps rather than a pinned offset, so it survives a bar-size or
    // type-scale repoint. Negative control, by hand: drop `justify-content: center` from
    // `[data-part='bar-content']` and the top gap goes to 0 while the bottom keeps the slack.
    const el = mount(['header', 'content', 'footer'])
    for (const side of ['header', 'footer'] as const) {
      const bar = q(el, `[data-part="bar"][data-bar="${side}"]`)
      const content = q(bar, '[data-part="bar-content"]')
      const authored = q(content, '[data-slot]')
      const contentBox = content.getBoundingClientRect()
      const authoredBox = authored.getBoundingClientRect()
      const gapTop = authoredBox.top - contentBox.top
      const gapBottom = contentBox.bottom - authoredBox.bottom
      // Anti-vacuous: there must BE slack to distribute, or "centred" is trivially true.
      expect(gapTop + gapBottom, `${side} — the authored row is genuinely shorter than the bar`).toBeGreaterThan(8)
      expect(Math.abs(gapTop - gapBottom), `${side} — short content centred, not top-anchored`).toBeLessThanOrEqual(0.5)
    }
  })

  it('GH #626 — a FULL-HEIGHT child can still stretch to the bar\'s edges (the other half of Kim\'s ruling)', () => {
    // Kim ruled FILL + CENTRE CHILDREN: short content centres (probe above), AND a child that wants the
    // full height can still take it. Both halves need pinning, because the obvious way to satisfy the
    // first half destroys the second — `align-items: center` on a ROW centres short content but makes a
    // full-height child IMPOSSIBLE, since a centred flex item never stretches. The shipped
    // `flex-direction: column; justify-content: center` keeps both: centring is `justify-content` on the
    // main axis, so it yields to a child that claims main-axis space with `flex: 1`.
    // (`block-size: 100%` resolves too — `bar-content` has a definite height once stretched — but
    // `flex: 1` is the idiom this pins, since it composes with sibling children.)
    const el = mount(['header', 'content', 'footer'])
    const bar = q(el, '[data-part="bar"][data-bar="header"]')
    const content = q(bar, '[data-part="bar-content"]')
    const authored = q(content, '[data-slot]')
    authored.style.flex = '1'
    const contentBox = content.getBoundingClientRect()
    const authoredBox = authored.getBoundingClientRect()
    // Anti-vacuous: bar-content must itself be filling, or "child fills bar-content" proves nothing about
    // reaching the BAR's edges.
    expect(Math.abs(contentBox.height - bar.clientHeight), 'bar-content is itself filling the bar').toBeLessThanOrEqual(0.5)
    expect(Math.abs(authoredBox.height - contentBox.height), 'an opted-in child reaches the full height').toBeLessThanOrEqual(0.5)
  })

  it('GH #626 — the side toggles do NOT stretch with it (why this is align-self, not align-items on the bar)', () => {
    // The reason the fix lives on `bar-content` rather than flipping the bar to `align-items: stretch`.
    // A toggle is a centred square affordance; stretching it to a tall bar is a defect, not a fix. This
    // pins that the bar's own `align-items: center` still governs its other children.
    const el = mount(['header', 'nav-pane', 'content'])
    const bar = q(el, '[data-part="bar"][data-bar="header"]')
    bar.style.minBlockSize = '120px'
    const toggle = q(bar, '[data-part="side-toggle"]')
    expect(bar.clientHeight, 'the bar is genuinely tall for this probe').toBeGreaterThan(110)
    expect(toggle.getBoundingClientRect().height, 'the toggle stays its own size, centred').toBeLessThan(bar.clientHeight - 10)
  })

  it('cl.2 — the seam is drawn on the BAR-FACING edge only (a header has no top hairline, a footer no bottom)', () => {
    const el = mount(['header', 'content', 'footer'])
    expect(getComputedStyle(q(el, '[data-bar="header"]')).borderBlockStartWidth).toBe('0px')
    expect(getComputedStyle(q(el, '[data-bar="footer"]')).borderBlockEndWidth).toBe('0px')
  })

  it('cl.2 (n6) — the seam is ABSORBED inside the 54px: the bar\'s OUTER height is unchanged at 54', () => {
    // The load-bearing consequence of the bar's existing `box-sizing: border-box` + `min-block-size:
    // var(--ui-super-shell-bar-size)`. Its content box becomes 53px; the outer box does not move.
    // Negative control (run by hand, ADR-0166 cl.2): flip that declaration to `content-box` and this
    // must read 55.
    const el = mount(['header', 'content', 'footer'])
    expect(Math.round(q(el, '[data-bar="header"]').getBoundingClientRect().height)).toBe(54)
    expect(Math.round(q(el, '[data-bar="footer"]').getBoundingClientRect().height)).toBe(54)
  })

  it('cl.2 (n5) — a consumer REPOINTS the token, never a host property (the TKT-0062 law, proven live)', () => {
    const el = mount(['header', 'content', 'footer'])
    el.style.setProperty('--ui-super-shell-bar-seam', '3px solid red')
    expect(getComputedStyle(q(el, '[data-bar="header"]')).borderBlockEndWidth).toBe('3px')
    expect(getComputedStyle(q(el, '[data-bar="footer"]')).borderBlockStartWidth).toBe('3px')
    // and the ADR's named escape hatch for a consumer that wants the old, seamless look
    el.style.setProperty('--ui-super-shell-bar-seam', '0 solid transparent')
    expect(getComputedStyle(q(el, '[data-bar="header"]')).borderBlockEndWidth).toBe('0px')
  })

  it('cl.1 — middle RECLAIMS the deleted band: header + middle + footer fill the frame with no leftover', () => {
    const el = mount(['header', 'nav-pane', 'content', 'footer'])
    const frame = q(el, '[data-part="frame"]').getBoundingClientRect()
    const header = q(el, '[data-bar="header"]').getBoundingClientRect()
    const middle = q(el, '[data-part="middle"]').getBoundingClientRect()
    const footer = q(el, '[data-bar="footer"]').getBoundingClientRect()
    expect(Math.abs(header.height + middle.height + footer.height - frame.height)).toBeLessThanOrEqual(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// n19 — the corner matrix: cl.5's four bar configurations × the three carded parts
// ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('ADR-0166 cl.5 — the per-side corner matrix, row posture (four bar configurations × three carded parts)', () => {
  const CARDS = ['[data-part="rail"]', '[data-part="pane"]', '[data-part="pane-resizer"]'] as const
  const body: readonly Slot[] = ['global-nav', 'nav-pane', 'content']

  const rows: ReadonlyArray<{ label: string; slots: readonly Slot[]; start: string; end: string }> = [
    { label: 'none (the INERT arm)', slots: body, start: '18px', end: '18px' },
    { label: 'header only', slots: ['header', ...body], start: '0px', end: '18px' },
    { label: 'footer only', slots: [...body, 'footer'], start: '18px', end: '0px' },
    { label: 'header + footer', slots: ['header', ...body, 'footer'], start: '0px', end: '0px' },
  ]

  for (const row of rows) {
    it(`bars authored: ${row.label} ⇒ block-start pair ${row.start}, block-end pair ${row.end} — on ALL THREE carded parts`, () => {
      const el = mount(row.slots, { resizableStart: true })
      for (const sel of CARDS) {
        const card = q(el, sel)
        // FOUR longhands, asserted individually — never the shorthand (cl.8's vacuous-pass trap).
        expectCorners(card, { start: row.start, end: row.end }, `${row.label} · ${sel}`)
      }
    })
  }

  it('canvas and scrim carry no radius in any configuration (nothing to square — canvas paints no background)', () => {
    const el = mount(['header', 'global-nav', 'nav-pane', 'content', 'footer'], { resizableStart: true })
    for (const sel of ['[data-part="canvas"]', '[data-part="scrim"]']) {
      const box = q(el, sel)
      expectCorners(box, { start: '0px', end: '0px' }, sel)
    }
  })

  it('the INLINE axis is untouched: middle keeps its 18px inter-card gaps and the resizer its net-one-gap footprint', () => {
    const el = mount(['header', 'global-nav', 'nav-pane', 'content', 'footer'], { resizableStart: true })
    expect(getComputedStyle(q(el, '[data-part="middle"]')).columnGap).toBe('18px')
    const rail = q(el, '[data-part="rail"]').getBoundingClientRect()
    const pane = q(el, '[data-part="pane"]').getBoundingClientRect()
    expect(Math.round(pane.left - rail.right)).toBe(18)
  })
})

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// n20 — the inert arm, byte-stable; and the `:has()`-argument leak the child combinator prevents
// ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('ADR-0166 cl.5 — the INERT arm (a bars-free shell) is untouched by the whole mechanism', () => {
  // The two shipped bars-free slot sets: `ui-agent-admin` composes content + options-pane
  // (agent-admin.ts:405/515/669); `gen-ui-live` composes nav-pane + content (gen-ui-live.ts:186/190).
  const SHAPES: ReadonlyArray<{ label: string; slots: readonly Slot[] }> = [
    { label: "agent-admin's set (content + options-pane)", slots: ['content', 'options-pane'] },
    { label: "gen-ui-live's set (nav-pane + content)", slots: ['nav-pane', 'content'] },
  ]

  for (const shape of SHAPES) {
    it(`${shape.label}: every carded part keeps all FOUR corners at 18px, and middle fills the frame exactly`, () => {
      const el = mount(shape.slots)
      for (const card of el.querySelectorAll<HTMLElement>('[data-part="pane"], [data-part="rail"]')) {
        expectCorners(card, { start: '18px', end: '18px' }, `${shape.label} · ${card.getAttribute('data-part')}`)
      }
      const frame = q(el, '[data-part="frame"]').getBoundingClientRect()
      const middle = q(el, '[data-part="middle"]').getBoundingClientRect()
      const pane = q(el, '[data-part="pane"]').getBoundingClientRect()
      // no bar ⇒ middle IS the frame's whole block extent, and the pane starts where middle starts
      expect(Math.round(pane.top)).toBe(Math.round(middle.top))
      expect(Math.round(frame.height)).toBe(Math.round(middle.height))
    })
  }

  it('MEASURED EXCEPTION to cl.5 — a bars-free shell that authors `narrow-*=\'tabs\'` is NOT inert below 40rem, and moves by exactly -12px', () => {
    // ADR-0166 cl.5 lists `ui-agent-admin` under "bars authored: none — the INERT arm" and calls that arm
    // "byte-stable by construction", which Kim's constraint 1 requires. It is not, and the ADR's own
    // Context fact 3 is what contradicts cl.5: the narrow-tabs strip is a FRAME CHILD. `ui-agent-admin`
    // sets `narrow-end='tabs'` (agent-admin.ts:402), so below the 40rem line its frame has TWO visible
    // children — the strip and middle — and the frame's deleted `gap` was LIVE between them, with no bar
    // anywhere in sight. Measured on the real page at the fleet-default 414px viewport:
    //   main:  frame h=241, rowGap=18px, [narrow-tabs h=37 top=41 mbs=0px][middle h=186 top=96]
    //   here:  frame h=229, rowGap=normal, [narrow-tabs h=37 top=47 mbs=6px][middle h=186 top=84]
    // = -18px (the gap) + 6px (cl.7's new strip seam) = -12px, deterministic in both engines.
    // Pinned rather than left to a future baseline diff: the shell's own mechanism, not a consumer bug.
    // The gap-deletion inertness claim holds only for a frame with ONE visible child — which agent-admin
    // is at WIDE (the strip is display:none there), and which gen-ui-live's bars-free shell is at every
    // width. Escalated on GH #371 together with cl.7's DOM-order error.
    // GH #380 (coordinated repair, the A5 drift) — the 6px moved from the strip's OWN outer margin to
    // `padding-block-start` inside its box (composition-check.py's law: "a piece must not set its own
    // outer margin"). Same footprint (`padding(6) + box-height` == the old `margin(6) + box-height`),
    // so the strip's OWN box is now flush against the frame's content edge (0px, not 6) while middle
    // stays flush under the strip exactly as before — the −12px Kim accepted (GH #380 Findings
    // comment, 2026-07-31; the REV 2026-07-30 only measured it) is unmoved by this refactor.
    const el = mount(['content', 'options-pane'], { width: 360, attrs: { 'narrow-end': 'tabs' } })
    const frame = q(el, '[data-part="frame"]')
    const strip = q(el, 'ui-tabs[data-part="narrow-tabs"]')
    const middle = q(el, '[data-part="middle"]')
    // no bar anywhere — this really is a bars-free shell
    expect(el.querySelector('[data-part="bar"]')).toBeNull()
    // ...yet the frame has TWO visible children, which is why the deleted gap was not inert here
    expect([...frame.children].filter((c) => getComputedStyle(c as HTMLElement).display !== 'none')).toHaveLength(2)
    expect(['normal', '0px']).toContain(getComputedStyle(frame).rowGap)
    expect(getComputedStyle(strip).marginBlockStart).toBe('0px') // no self-owned outer margin
    expect(getComputedStyle(strip).paddingBlockStart).toBe('6px') // the seam, absorbed inside the box
    // the strip's own box is now FLUSH against the frame's content edge, and middle is flush under the strip
    expect(Math.round(strip.getBoundingClientRect().top - frame.getBoundingClientRect().top)).toBe(0)
    expect(Math.round(middle.getBoundingClientRect().top - strip.getBoundingClientRect().bottom)).toBe(0)
    // and the corner mechanism IS inert here, which is the half of cl.5 that does hold
    expectCorners(q(el, '[data-part="pane"]'), { start: '18px', end: '18px' }, 'the bars-free tabs shell\'s pane')
  })

  it("cl.3 — a bars-free shell NESTED inside a bar-bearing one keeps its cards ROUND (the `:has()`-argument leak the `> ` combinator prevents)", () => {
    // THE fixture that bites. `@scope (…) to (ui-super-shell)`'s lower limit constrains what a selector
    // may MATCH, NOT what a `:has()` argument can SEE — so a DESCENDANT-form rule makes the OUTER frame
    // match on the INNER shell's bar. Here the direction is the one that matters for the inert arm: the
    // INNER shell authors no bar, so its OWN frame must not match either rule, and its cards stay round.
    // A flat, un-nested fixture cannot exhibit the leak and reads as a false green.
    const outer = mount(['header', 'content', 'footer'])
    const inner = document.createElement('ui-super-shell') as UISuperShellElement
    inner.style.blockSize = '200px'
    for (const slot of ['nav-pane', 'content'] as const) {
      const child = document.createElement('div')
      child.setAttribute('data-slot', slot)
      child.textContent = slot
      inner.append(child)
    }
    q(outer, '[data-part="canvas"]').append(inner)

    const innerPane = q(inner, '[data-part="pane"]')
    expectCorners(innerPane, { start: '18px', end: '18px' }, 'the NESTED bars-free shell\'s pane')
    // and the OUTER shell's own cards are unaffected by the nesting (it authored both bars itself)
    const outerCanvas = q(outer, '[data-part="canvas"]')
    expect(outerCanvas.contains(inner)).toBe(true)
  })

  it('cl.3 — the converse direction: a bar-bearing shell nested inside a BARS-FREE one leaves the OUTER cards round', () => {
    // The mutation-sensitive direction named in the decomposition's n20: with the descendant form, the
    // outer (bars-free) frame matches on the inner shell's bars and squares its OWN cards against
    // nothing. With the child form it cannot see them.
    const outer = mount(['nav-pane', 'content'])
    const inner = document.createElement('ui-super-shell') as UISuperShellElement
    inner.style.blockSize = '200px'
    for (const slot of ['header', 'content', 'footer'] as const) {
      const child = document.createElement('div')
      child.setAttribute('data-slot', slot)
      child.textContent = slot
      inner.append(child)
    }
    q(outer, '[data-part="canvas"]').append(inner)

    const outerPane = q(outer, '[data-part="pane"]')
    expectCorners(outerPane, { start: '18px', end: '18px' }, "the OUTER bars-free shell's pane")
  })
})

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// n12 / n13 — the posture exceptions that must NOT square
// ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('ADR-0166 cl.6 — posture exception A: a floating overlay is INSET, not flush, and stays fully round', () => {
  it('a collapse side, overlay-open at 360px on a header+footer shell, keeps ALL FOUR corners at 18px', async () => {
    const el = mount(['header', 'nav-pane', 'content', 'footer'], { width: 360, attrs: { 'narrow-start': 'collapse' } })
    await el.updateComplete
    const toggle = q(el, '[data-part="side-toggle"][data-side="start"]')
    toggle.click()
    await el.updateComplete
    const pane = q(el, '[data-part="pane"][data-side="start"]')
    // the overlay arm is live (out of flow, inset inside middle) — the precondition for the assertion
    expect(getComputedStyle(pane).position).toBe('absolute')
    // NC (ADR-0166 cl.6): delete the token restore from this narrow overlay arm and this must red
    // naming `border-start-start-radius`.
    expectCorners(pane, { start: '18px', end: '18px' }, 'the overlay-open collapse side')
  })
})

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// GH #381 — the floating overlay card's four-sided outline. Cross-engine because this is the ONE bug
// class jsdom cannot see at all (computed border widths/colors, container queries, a real color role
// resolving through the token chain) AND that a light-scheme screenshot cannot see either: the defect
// was `neutral-surface` on `neutral-surface` in the DARK scheme, where the card had no edge to read.
// ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('GH #381 — a floating overlay card is bordered on ALL FOUR sides, off --ui-super-shell-overlay-outline', () => {
  const SIDES = [
    ['border-block-start-width', 'borderBlockStartWidth'],
    ['border-block-end-width', 'borderBlockEndWidth'],
    ['border-inline-start-width', 'borderInlineStartWidth'],
    ['border-inline-end-width', 'borderInlineEndWidth'],
  ] as const
  const COLOR_SIDES = ['borderBlockStartColor', 'borderBlockEndColor', 'borderInlineStartColor', 'borderInlineEndColor'] as const

  /** Every side named individually — an `toEqual`-shaped array assertion prints values but cannot say
   *  WHICH edge lost its border, and "all four sides" is the whole claim of the issue. */
  function expectFourBorders(box: HTMLElement, want: string, label: string): void {
    const cs = getComputedStyle(box)
    for (const [name, key] of SIDES) expect(cs[key], `${label} · ${name}`).toBe(want)
  }

  /** The one honest way to compare a computed border color against a color ROLE: paint a probe with the
   *  role and let the engine normalize both to the same computed-color format. Comparing the raw custom
   *  property text (`#…`) against `rgb(…)` would pass or fail for the wrong reason. */
  function resolvedRole(host: HTMLElement, role: string): string {
    const probe = document.createElement('div')
    probe.style.color = `var(${role})`
    host.append(probe)
    const value = getComputedStyle(probe).color
    probe.remove()
    expect(value, `${role} must resolve to a real color (an empty/invalid role would make every assertion vacuous)`).toMatch(/^(rgb|color|oklch|lab)/)
    return value
  }

  /** Opens the narrow (<40rem) overlay on a header+footer collapse shell and hands back the overlaid card. */
  async function openNarrowOverlay(slots: readonly Slot[] = ['header', 'nav-pane', 'content', 'footer'], card = '[data-part="pane"][data-side="start"]'): Promise<{ el: UISuperShellElement; pane: HTMLElement }> {
    const el = mount(slots, { width: 360, attrs: { 'narrow-start': 'collapse' } })
    await el.updateComplete
    q(el, '[data-part="side-toggle"][data-side="start"]').click()
    await el.updateComplete
    const pane = q(el, card)
    expect(getComputedStyle(pane).position, 'the overlay arm must be LIVE or every border assertion below is about an in-flow card').toBe('absolute')
    return { el, pane }
  }

  it('the narrow overlay (arms 3+4) carries a 1px border on all four sides, in the fleet floating-card outline ROLE', async () => {
    const { el, pane } = await openNarrowOverlay()
    // NC (run by hand, both engines): delete `border: var(--ui-super-shell-overlay-outline)` from the
    // narrow overlay arm in super-shell.css and all four assertions below read `0px`.
    expectFourBorders(pane, '1px', 'the narrow overlay pane')
    const role = resolvedRole(el, '--md-sys-color-neutral-outline-variant')
    const cs = getComputedStyle(pane)
    for (const key of COLOR_SIDES) expect(cs[key], `the narrow overlay pane · ${key}`).toBe(role)
  })

  it('the border is drawn off the TOKEN, not a hardcoded value — a consumer repoint moves all four sides (the TKT-0062 law)', async () => {
    const { el, pane } = await openNarrowOverlay()
    // The discriminator the bar seam's own n5 probe uses: a hardcoded `1px solid …` in the arm would pass
    // the width/color assertions above and be COMPLETELY INERT here.
    el.style.setProperty('--ui-super-shell-overlay-outline', '3px solid rgb(1, 2, 3)')
    expectFourBorders(pane, '3px', 'the repointed overlay pane')
    const cs = getComputedStyle(pane)
    for (const key of COLOR_SIDES) expect(cs[key], `the repointed overlay pane · ${key}`).toBe('rgb(1, 2, 3)')
    // and the named escape hatch, identical in shape to the bar seam's
    el.style.setProperty('--ui-super-shell-overlay-outline', '0 solid transparent')
    expectFourBorders(pane, '0px', 'the outline-suppressed overlay pane')
  })

  it('the compact-band overlay (arms 5+6 — the arm the DOCS SITE renders) carries the same four borders', async () => {
    // 700px sits ABOVE the 40rem/640px narrow line and BELOW the 52.5rem/840px compact line, so ONLY the
    // compact block can be responsible for what this measures — the narrow block is out of the question.
    const el = mount(['header', 'nav-pane', 'content', 'footer'], { width: 700, attrs: { 'narrow-start': 'collapse', 'collapse-band': 'compact' } })
    await el.updateComplete
    q(el, '[data-part="side-toggle"][data-side="start"]').click()
    await el.updateComplete
    const pane = q(el, '[data-part="pane"][data-side="start"]')
    expect(getComputedStyle(pane).position).toBe('absolute')
    expectFourBorders(pane, '1px', 'the compact-band overlay pane')
  })

  it('the mid-window overlay (SPEC-R14, arms 1+2) carries the same four borders', async () => {
    // The JS-owned `data-auto-collapsed-*` is set directly here: this probe is about the CSS ARM, and
    // reproducing #syncFitCollapse's measurement window would make the test about the measurement instead.
    // 900px is above BOTH container lines, so neither band block can account for the result.
    const el = mount(['header', 'nav-pane', 'content', 'footer'], { width: 900 })
    await el.updateComplete
    el.setAttribute('data-auto-collapsed-start', '')
    el.setAttribute('data-narrow-open', 'start')
    const pane = q(el, '[data-part="pane"][data-side="start"]')
    expect(getComputedStyle(pane).position, 'the mid-window overlay arm must be live').toBe('absolute')
    expectFourBorders(pane, '1px', 'the mid-window overlay pane')
  })

  it('cl.6 SURVIVES the border: the overlay keeps all four corners round, so the border follows the rounded corner', async () => {
    // The `border` shorthand resets `border-image`, NOT `border-radius` — but a future "tidy-up" to a
    // longhand set or an added `border-radius: 0` would square the card and leave a boxy hairline on a
    // rounded surface. Pinned here, on the same box, in the same run.
    const { pane } = await openNarrowOverlay()
    expectCorners(pane, { start: '18px', end: '18px' }, 'the bordered overlay pane')
  })

  it('the hairline is ABSORBED, not added: an overlaid pane AND an overlaid rail keep their exact outer footprint', async () => {
    // The pane already declared `box-sizing: border-box`; a RAIL did not, and off its 54px `inline-size`
    // would have rendered 56px wide — silently breaking R9d's "the far-edge canvas gap stays exactly one
    // bar wide" cap. NC: delete `box-sizing: border-box` from the narrow overlay arm and the rail reads 56.
    const { pane } = await openNarrowOverlay()
    expect(Math.round(pane.getBoundingClientRect().width), 'the overlaid pane keeps its 252px outer width').toBe(252)

    const railShell = mount(['header', 'global-nav', 'content', 'footer'], { width: 360, attrs: { 'narrow-start': 'collapse' } })
    await railShell.updateComplete
    q(railShell, '[data-part="side-toggle"][data-side="start"]').click()
    await railShell.updateComplete
    const rail = q(railShell, '[data-part="rail"][data-side="start"]')
    expect(getComputedStyle(rail).position).toBe('absolute')
    expectFourBorders(rail, '1px', 'the overlaid rail')
    expect(Math.round(rail.getBoundingClientRect().width), 'the overlaid rail keeps its 54px outer width — the seam is absorbed').toBe(54)
  })

  it('the border rides ONLY the floating arms: a wide in-flow pane/rail and a narrow-STACK card have NO border', async () => {
    // The decision half of #381, measured rather than asserted in prose. A stacked card is flush against a
    // bar that already draws --ui-super-shell-bar-seam on that same edge, so a second hairline there would
    // DOUBLE the seam to 2px — a different defect, not this one.
    const wide = mount(['header', 'global-nav', 'nav-pane', 'content', 'footer'], { width: 900 })
    await wide.updateComplete
    expectFourBorders(q(wide, '[data-part="pane"]'), '0px', 'the WIDE in-flow pane')
    expectFourBorders(q(wide, '[data-part="rail"]'), '0px', 'the WIDE in-flow rail')

    const stacked = mount(['header', 'nav-pane', 'content', 'footer'], { width: 360, attrs: { 'narrow-start': 'stack' } })
    await stacked.updateComplete
    const card = q(stacked, '[data-part="pane"][data-side="start"]')
    expect(getComputedStyle(q(stacked, '[data-part="middle"]')).flexDirection).toBe('column') // the stack posture is live
    expectFourBorders(card, '0px', "the narrow-start='stack' card")
  })
})

describe('ADR-0166 cl.7 — posture exception B (fork F2): in a COLUMN, a card\'s canvas-facing corners stay round', () => {
  it("narrow-start='stack' on a header+footer shell: block-START squared (faces the header), block-END round (faces canvas)", async () => {
    const el = mount(['header', 'nav-pane', 'content', 'footer'], { width: 360, attrs: { 'narrow-start': 'stack' } })
    await el.updateComplete
    const middle = q(el, '[data-part="middle"]')
    expect(getComputedStyle(middle).flexDirection).toBe('column') // the column posture is live
    const stacked = q(el, '[data-part="pane"][data-side="start"]')
    expectCorners(stacked, { start: '0px', end: '18px' }, "the narrow-start='stack' side")
  })

  it("narrow-end='stack' on a header+footer shell: the pairing INVERTS (block-start round, block-end squared)", async () => {
    const el = mount(['header', 'content', 'options-pane', 'footer'], { width: 360, attrs: { 'narrow-end': 'stack' } })
    await el.updateComplete
    expect(getComputedStyle(q(el, '[data-part="middle"]')).flexDirection).toBe('column')
    const stacked = q(el, '[data-part="pane"][data-side="end"]')
    expectCorners(stacked, { start: '18px', end: '0px' }, "the narrow-end='stack' side")
  })

  it('BOTH sides stacked: each side restores only its OWN canvas-facing pair', async () => {
    const el = mount(['header', 'nav-pane', 'content', 'options-pane', 'footer'], {
      width: 360,
      attrs: { 'narrow-start': 'stack', 'narrow-end': 'stack' },
    })
    await el.updateComplete
    const start = q(el, '[data-part="pane"][data-side="start"]')
    const end = q(el, '[data-part="pane"][data-side="end"]')
    expectCorners(start, { start: '0px', end: '18px' }, 'the start side (header above, canvas below)')
    expectCorners(end, { start: '18px', end: '0px' }, 'the end side (canvas above, footer below)')
  })
})

describe('ADR-0166 cl.7 — posture exception C: the narrow-tabs strip owns its own block-start seam', () => {
  it("GH #380 (the A5 drift repair) — the strip's OWN box sets no outer margin (composition law); the seam is INSIDE its border box as padding", async () => {
    const el = mount(['header', 'content', 'options-pane', 'footer'], { width: 360, attrs: { 'narrow-end': 'tabs' } })
    await el.updateComplete
    const strip = q(el, 'ui-tabs[data-part="narrow-tabs"]')
    expect(getComputedStyle(strip).display).not.toBe('none') // the strip is live at narrow
    // No self-owned outer margin (composition-check.py's law: "a piece must not set its own outer margin").
    expect(getComputedStyle(strip).marginBlockStart).toBe('0px')
    // The seam itself moved INSIDE the box, absorbed as padding — same value, same mechanism cl.2's bar
    // seam already uses (border, not margin, inside a border-box).
    expect(getComputedStyle(strip).paddingBlockStart).toBe('6px')
    const header = q(el, '[data-bar="header"]').getBoundingClientRect()
    // The strip's own border-box is now FLUSH against the header (0px gap) — the direct, measured proof
    // the outer margin is gone, not just the property name.
    expect(Math.round(strip.getBoundingClientRect().top - header.bottom)).toBe(0)
  })

  it("GH #380 — the strip's VISIBLE content (the tablist row) still starts 6px below the header, the same effective offset the old outer margin produced (agent-admin's accepted −12px is unchanged by this refactor)", async () => {
    const el = mount(['header', 'content', 'options-pane', 'footer'], { width: 360, attrs: { 'narrow-end': 'tabs' } })
    await el.updateComplete
    const header = q(el, '[data-bar="header"]').getBoundingClientRect()
    const tablist = q(el, 'ui-tabs[data-part="narrow-tabs"] [data-part="tablist"]')
    // MEASURED frame order is `header | narrow-tabs | middle | footer` (super-shell.ts's
    // `middle.before(strip)`), NOT the "between middle and the footer" ADR-0166 Context fact 3 and cl.7
    // originally asserted. So the strip's own seam sits under the HEADER, and it is the pane's
    // block-START (not its block-END) that faces the strip — the coordinated repair's corner restore
    // (below) targets that pair; see the order pin in super-shell.test.ts.
    expect(Math.round(tablist.getBoundingClientRect().top - header.bottom)).toBe(6)
  })

  it("the ACTIVE narrow-tab pane restores its block-START corner pair (it faces the strip, not the header) while block-END stays squared against the footer", async () => {
    // GH #380 (coordinated repair, exception C's missing half). A consumer authoring a header AND
    // `narrow-*='tabs'` is the exposure this prevents (the GH #253 wedge family) — census: today's one
    // shipped tabs author, `ui-agent-admin`, composes no bar at all, so nothing live exhibits this without
    // this fixture deliberately authoring both.
    const el = mount(['header', 'content', 'options-pane', 'footer'], { width: 360, attrs: { 'narrow-end': 'tabs' } })
    await el.updateComplete
    // Baseline: the always-legal default selection (`content`, the canvas) carries no radius at all
    // (cl.4/cl.5 — canvas paints no background), so the exposure is invisible until a PANE tab is active.
    const narrowTabs = [...el.querySelectorAll('[data-part="narrow-tab"]')] as HTMLElement[]
    const paneTab = narrowTabs.find((t) => t.textContent === 'options-pane')
    expect(paneTab, 'the options-pane narrow tab exists').not.toBeUndefined()
    paneTab!.click()
    await el.updateComplete
    const pane = q(el, '[data-part="pane"][data-narrow-tab-target][data-narrow-active]')
    // block-END stays squared (0px) against the footer, unchanged by this repair — only block-START
    // (facing the strip, not the header) restores to round.
    expectCorners(pane, { start: '18px', end: '0px' }, 'the active narrow-tab pane, header+footer shell')
  })

  it("SCOPE FENCE — a MIXED posture (narrow-start='stack' + narrow-end='tabs') is ruled OUT OF SCOPE; this records what it DOES, and asserts nothing about what it should", async () => {
    // ADR-0166 cl.7: reachable from shipped API (chat-shell.ts:35's FORWARD_ATTRS carries both), no
    // shipped instance authors it, and "the first consumer to author a mixed posture files an issue and
    // this clause gains a row". So: no expectation on the corner outcome — only proof that it renders
    // without throwing and that BOTH arms are simultaneously live, which is the hazard itself.
    const el = mount(['header', 'nav-pane', 'content', 'options-pane', 'footer'], {
      width: 360,
      attrs: { 'narrow-start': 'stack', 'narrow-end': 'tabs' },
    })
    await el.updateComplete
    expect(getComputedStyle(q(el, '[data-part="middle"]')).flexDirection).toBe('column')
    expect(getComputedStyle(q(el, 'ui-tabs[data-part="narrow-tabs"]')).display).not.toBe('none')
    const stacked = q(el, '[data-part="pane"][data-side="start"]')
    // Recorded, not ruled: the stacked start side behaves exactly as the pure-stack posture does.
    expectCorners(stacked, { start: '0px', end: '18px' }, 'MIXED posture — the stacked start side (recorded, not ruled)')
  })
})
