import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp, userEvent } from 'vitest/browser'

// content-family M1-a — ui-disclosure cross-engine browser-truth smoke (content-family.lld.md LLD-C10;
// SPEC-R15 AC1/AC4, SPEC-R17 AC1/AC2, SPEC-R18 AC1-AC3, SPEC-R19 AC2). Runs in BOTH Chromium and WebKit
// (vitest.browser.config.ts). jsdom-green ≠ done — this proves REAL painted geometry, real platform
// click/keyboard activation, and forced-colors survival.
//
// These imports are DIRECT (not the `@agent-ui/components/components` barrel / `component-styles.css`
// barrel) — the M1-a checkpoint ships this folder standalone; the barrel/style-barrel wiring is the
// LLD-C11 integration slice's job (a separate, single-writer wave). The checkbox.browser.test.ts precedent.
import '@agent-ui/components/foundation-styles.css' // tokens (--md-sys-color-*) + dimensions (--md-sys-height/font/space-*)
import './disclosure.css' // the control stylesheet (direct — pre-barrel)
import './disclosure.ts' // self-define (registers ui-disclosure)
// The summary-slot probes (ADR-0158) exercise the REAL consumer shape — a fleet ui-switch riding the
// heading row (the GH #225 agent-admin arrangement, now component-owned). Test-only import; the control
// source itself never imports a sibling control.
import '../switch/switch.css'
import '../switch/switch.ts'

const px = (v: string): number => Number.parseFloat(v)

/** Minimal CDP surface — `cdp()`'s public type is empty; the playwright provider gives `.send` at runtime. */
interface CdpSession {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>
}

const mounted: HTMLElement[] = []
function mount(markup: string): { wrap: HTMLElement; host: HTMLElement; summary: HTMLElement; chevron: HTMLElement; body: HTMLElement } {
  const wrap = document.createElement('div')
  wrap.innerHTML = markup
  document.body.append(wrap)
  mounted.push(wrap)
  const host = wrap.querySelector('ui-disclosure') as HTMLElement
  return {
    wrap,
    host,
    summary: host.querySelector('[data-part="summary"]') as HTMLElement,
    chevron: host.querySelector('[data-part="chevron"]') as HTMLElement,
    body: host.querySelector('[data-part="body"]') as HTMLElement,
  }
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

const nextToggle = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

describe('ui-disclosure — mounts + a real engine resolves the geometry (whole-shape, SPEC-R19 AC2)', () => {
  it('a bare instance in an unstyled flex row paints a non-collapsed summary row at the md ramp step', () => {
    const row = document.createElement('div')
    row.style.display = 'flex'
    document.body.append(row)
    mounted.push(row)
    row.innerHTML = '<ui-disclosure summary="Details"><p>Body text</p></ui-disclosure>'
    const host = row.querySelector('ui-disclosure') as HTMLElement
    const summary = host.querySelector('[data-part="summary"]') as HTMLElement

    // md ramp @ scale 1: height 28, font 14 (dimensions.css §1).
    expect(px(getComputedStyle(summary).blockSize)).toBeCloseTo(28, 0)
    expect(px(getComputedStyle(summary).fontSize)).toBeCloseTo(14, 0)
    expect(px(getComputedStyle(summary).paddingBlockStart)).toBe(0) // NEVER block-padding (geometry.md)
    // the h/2 slotless-edge inline pad
    expect(px(getComputedStyle(summary).paddingInlineStart)).toBeCloseTo(14, 0)
    // the host box itself is non-collapsed (test-the-whole-shape — a bare instance must paint correct)
    const box = host.getBoundingClientRect()
    expect(box.width).toBeGreaterThan(0)
    expect(box.height).toBeGreaterThan(0)
  })

  it('the chevron is sized = font (never the icon ramp) and rotates 90deg under [open] — no transition', () => {
    const { host, chevron } = mount('<ui-disclosure summary="X"><p>Y</p></ui-disclosure>')
    const glyphSize = px(getComputedStyle(chevron).inlineSize)
    const fontSize = px(getComputedStyle(host.querySelector('[data-part="summary"]') as HTMLElement).fontSize)
    expect(glyphSize).toBeCloseTo(fontSize, 0) // = font, the inline-affordance law (geometry.md)

    expect(getComputedStyle(chevron).rotate).toBe('0deg') // closed: no rotation (authored 0deg, not the UA `none`)
    // Toggle the DETAILS part's own native [open] directly — this leg proves the CSS SELECTOR match, not
    // the JS open↔prop pipeline (covered elsewhere); real activation is proven by the click/keyboard legs below.
    const details = host.querySelector('[data-part="details"]') as HTMLDetailsElement
    details.open = true
    expect(getComputedStyle(chevron).rotate).toMatch(/90deg/) // open: rotated
    // no transition/animation is declared anywhere on the chevron (the jsdom css probe pins the source
    // absence; here the computed transitionDuration must be the UA default 0s — never animated)
    expect(getComputedStyle(chevron).transitionDuration).toMatch(/^0s/)
  })

  it("GH #1102: a NESTED fold's caret tracks its OWN state, not an open ancestor's — closed-inside-open paints 0deg (the agent-admin Content-fold bug)", async () => {
    // The exact live shape that shipped broken: an inner fold in an OPEN outer fold's body. @scope has no
    // lower boundary, so the old descendant-hop [open] rule (scope root = the OUTER host, whose details IS
    // open) rotated the INNER chevron to 90deg in BOTH inner states — collapsed and expanded read identical.
    const { host: outer } = mount(
      '<ui-disclosure summary="Section" open><ui-disclosure summary="Content"><p>Body</p></ui-disclosure></ui-disclosure>',
    )
    await nextToggle() // let both hosts connect + build parts
    const inner = outer.querySelector('ui-disclosure ui-disclosure') as HTMLElement & { open: boolean }
    const outerChevron = outer.querySelector('[data-part="chevron"]') as HTMLElement
    const innerChevron = inner.querySelector('[data-part="chevron"]') as HTMLElement

    expect(getComputedStyle(outerChevron).rotate).toMatch(/90deg/) // the open outer fold's own caret: down
    expect(getComputedStyle(innerChevron).rotate).toBe('0deg') // the CLOSED inner fold's caret: right — never inherited-down

    const innerDetails = inner.querySelector('[data-part="details"]') as HTMLDetailsElement
    innerDetails.open = true
    expect(getComputedStyle(innerChevron).rotate).toMatch(/90deg/) // the inner fold's OWN open state still rotates it
    innerDetails.open = false
    expect(getComputedStyle(innerChevron).rotate).toBe('0deg') // and collapsing reads different again — the whole complaint
  })

  it('the DEFAULT fold is UNPADDED with no chrome (GH #1283 — the ruled inversion): zero body padding, transparent host, square corners', () => {
    const { host, body } = mount('<ui-disclosure summary="X" open><p>Y</p></ui-disclosure>')
    expect(px(getComputedStyle(body).paddingBlockStart)).toBe(0)
    expect(px(getComputedStyle(body).paddingInlineStart)).toBe(0)
    const hostStyle = getComputedStyle(host)
    expect(hostStyle.backgroundColor).toBe('rgba(0, 0, 0, 0)') // no surface paint
    expect(px(hostStyle.borderTopLeftRadius)).toBe(0)
  })

  it('[contained] restores the body padding and paints the surface bg + the shared fleet radius (GH #1283 / ADR-0015 cl.5)', () => {
    const { host, body } = mount('<ui-disclosure summary="X" open contained><p>Y</p></ui-disclosure>')
    expect(px(getComputedStyle(body).paddingBlockStart)).toBeGreaterThan(0) // --md-sys-space-sm
    expect(px(getComputedStyle(body).paddingInlineStart)).toBeGreaterThan(0) // --md-sys-space-md
    const hostStyle = getComputedStyle(host)
    expect(hostStyle.backgroundColor).not.toBe('rgba(0, 0, 0, 0)') // the neutral surface paints
    // the ONE shared radius constant (--md-sys-shape-corner-base) — non-zero, and the whole shape agrees
    expect(px(hostStyle.borderTopLeftRadius)).toBeGreaterThan(0)
    expect(hostStyle.borderBottomRightRadius).toBe(hostStyle.borderTopLeftRadius)
  })

  it('[contained] on an OUTER fold never pads a NESTED fold\'s body (the GH #1102 direct-child law, applied to #1283)', () => {
    const { host } = mount(
      '<ui-disclosure summary="Outer" open contained><ui-disclosure summary="Inner" open><p>Y</p></ui-disclosure></ui-disclosure>',
    )
    const innerHost = host.querySelector('ui-disclosure') as HTMLElement // adopted into the outer body part
    const innerBody = innerHost.querySelector('[data-part="body"]') as HTMLElement
    expect(px(getComputedStyle(innerBody).paddingBlockStart)).toBe(0) // the inner fold stays the simple mode
    expect(getComputedStyle(innerHost).backgroundColor).toBe('rgba(0, 0, 0, 0)')
  })

  it('[density] changes the CONTAINED body padding but leaves the summary row height/font untouched (the Pattern-class split, SPEC-R18 AC2)', () => {
    const { host, summary, body } = mount('<ui-disclosure summary="X" open contained><p>Y</p></ui-disclosure>')
    const heightComfortable = px(getComputedStyle(summary).blockSize)
    const padComfortable = px(getComputedStyle(body).paddingBlockStart)

    host.parentElement?.setAttribute('density', 'compact')
    const heightCompact = px(getComputedStyle(summary).blockSize)
    const padCompact = px(getComputedStyle(body).paddingBlockStart)

    expect(heightCompact).toBe(heightComfortable) // the frame is density-INVARIANT
    expect(padCompact).not.toBe(padComfortable) // the body rhythm rides density (anti-vacuous: it DID move)
  })
})

describe('ui-disclosure — real platform click/keyboard activation (SPEC-R15 AC1, SPEC-R17 AC2)', () => {
  it('a real pointer click on the summary opens the fold and fires exactly one toggle (open already true at listener time)', async () => {
    const { host, summary } = mount('<ui-disclosure summary="X"><p>Y</p></ui-disclosure>')
    let toggles = 0
    let openAtEmit: string | null = null
    host.addEventListener('toggle', () => {
      toggles++
      openAtEmit = host.getAttribute('open')
    })

    await userEvent.click(summary)
    await nextToggle()

    expect(host.hasAttribute('open')).toBe(true)
    expect(toggles).toBe(1)
    expect(openAtEmit).not.toBeNull() // the attribute had already settled when the listener ran
  })

  it('Enter on the focused summary toggles the fold (native <summary> activation — platform, not reimplemented)', async () => {
    const { host, summary } = mount('<ui-disclosure summary="X"><p>Y</p></ui-disclosure>')
    summary.focus()
    let toggles = 0
    host.addEventListener('toggle', () => toggles++)

    await userEvent.keyboard('{Enter}')
    await nextToggle()

    expect(host.hasAttribute('open')).toBe(true)
    expect(toggles).toBe(1)
  })

  it('Space on the focused summary toggles the fold', async () => {
    const { host, summary } = mount('<ui-disclosure summary="X"><p>Y</p></ui-disclosure>')
    summary.focus()
    let toggles = 0
    host.addEventListener('toggle', () => toggles++)

    await userEvent.keyboard(' ')
    await nextToggle()

    expect(host.hasAttribute('open')).toBe(true)
    expect(toggles).toBe(1)
  })

  it('the summary is a real tab stop (native focusability — no tabbable trait needed)', async () => {
    const { summary } = mount('<ui-disclosure summary="X"><p>Y</p></ui-disclosure>')
    await userEvent.tab()
    expect(document.activeElement).toBe(summary)
  })

  it('the shared fleet focus ring draws on keyboard focus (:focus-visible, ADR-0009)', async () => {
    const { summary } = mount('<ui-disclosure summary="X"><p>Y</p></ui-disclosure>')
    await userEvent.tab()
    expect(document.activeElement).toBe(summary)
    const outline = getComputedStyle(summary).outlineStyle
    expect(outline).toBe('solid')
  })
})

// TKT-0047 (revised) — the summary was the one Pattern-class interactive row (siblings: tabs, menu)
// with zero hover feedback. An ink-step (matching tabs.css) turned out visually inert here — disclosure's
// idle ink already sits at the ceiling of the neutral ramp, so no ink-step value could ever show. Fixed
// with a background-tint wash instead (the combo-box.css active-descendant precedent) — a mechanism with
// real headroom regardless of ink. Real cross-engine proof only possible here (jsdom can't compute colour).
describe('ui-disclosure — hover (TKT-0047, background-tint revision)', () => {
  it('the summary paints a real background tint on real pointer hover', async () => {
    const { summary } = mount('<ui-disclosure summary="X"><p>Y</p></ui-disclosure>')
    const idleBg = getComputedStyle(summary).backgroundColor

    await userEvent.hover(summary)
    const hoverBg = getComputedStyle(summary).backgroundColor
    expect(hoverBg, 'the summary background did not repaint on hover').not.toBe(idleBg)

    await userEvent.unhover(summary)
  })
})

describe('ui-disclosure — the native marker is replaced (SPEC-R18 AC1)', () => {
  it('no native ::marker/::-webkit-details-marker triangle survives (list-style: none holds)', () => {
    const { summary } = mount('<ui-disclosure summary="X"><p>Y</p></ui-disclosure>')
    expect(getComputedStyle(summary).listStyleType).toBe('none')
  })
})

describe('ui-disclosure — find-in-page auto-expand (SPEC-R15 AC4 — the instrument-bridge leg)', () => {
  // Playwright drives PAGE content, not the browser CHROME's find-in-page dialog (Ctrl+F) — there is no
  // page-level API to trigger a real UA text search from either engine. The substitute proof (both
  // engines): the folded body content is STRUCTURALLY present in the DOM while closed — the platform
  // contract find-in-page relies on (native <details> reveals hidden-until-matched content because it is
  // real DOM, merely display:none'd by the UA stylesheet while closed, not absent). Re-test trigger: a
  // Playwright release exposing a page-level find-in-page/Ctrl+F automation API.
  it('folded body content stays in the DOM (queryable) while closed — the structural fact find-in-page depends on', () => {
    const { host, body } = mount('<ui-disclosure summary="X"><p id="needle">findable text</p></ui-disclosure>')
    expect(host.hasAttribute('open')).toBe(false)
    expect(body.querySelector('#needle')?.textContent).toBe('findable text')
  })
})

describe('ui-disclosure — the summary slot, cross-engine (ADR-0158; GH #226/#225)', () => {
  it('a real ui-switch on the heading row: a pointer click flips the switch WITHOUT folding; the summary still folds; the switch survives the fold', async () => {
    const { host, summary } = mount(
      '<ui-disclosure summary="Agent" open><ui-switch slot="summary" aria-label="Agent active"></ui-switch><p>Config body</p></ui-disclosure>',
    )
    const el = host as HTMLElement & { open: boolean }
    const sw = host.querySelector('ui-switch') as HTMLElement & { checked: boolean }
    expect(summary.contains(sw), 'the switch rides the summary part').toBe(true)
    expect(sw.getBoundingClientRect().width, 'the switch paints on the heading row').toBeGreaterThan(0)
    const wasChecked = sw.checked

    // The component-owned activation guard: the click flips the switch, never the fold (ADR-0158 cl.3).
    await userEvent.click(sw)
    await nextToggle()
    expect(sw.checked).toBe(!wasChecked)
    expect(el.open, 'the fold did not toggle').toBe(true)

    // The summary's own click is untouched by the guard — the fold collapses to its heading row, and the
    // switch stays visible ON it (the "way back never folds away" shape, GH #225).
    summary.click()
    await nextToggle()
    expect(el.open).toBe(false)
    expect(sw.getBoundingClientRect().width, 'the switch survives the fold').toBeGreaterThan(0)
    summary.click()
    await nextToggle()
    expect(el.open).toBe(true)
  })

  it('a destructive clobber rebuild rescues the switch onto the FRESH heading row — same node, still guarded (GH #226)', async () => {
    const { host } = mount(
      '<ui-disclosure summary="Agent" open><ui-switch slot="summary" aria-label="Agent active"></ui-switch><p>original body</p></ui-disclosure>',
    )
    const el = host as HTMLElement & { open: boolean }
    const sw = host.querySelector('ui-switch') as HTMLElement & { checked: boolean }

    host.textContent = 'fresh body' // clobbers every child — the heal rebuild path (disclosure.ts)
    await nextToggle() // covers the observer microtask + the platform's queued toggle task

    const freshSummary = host.querySelector('[data-part="summary"]') as HTMLElement
    expect(freshSummary.contains(sw), 'the SAME switch node was rescued into the fresh summary part').toBe(true)
    expect(sw.getBoundingClientRect().width, 'and it paints').toBeGreaterThan(0)
    expect(host.querySelector('[data-part="body"]')?.textContent).toBe('fresh body')

    // Still guarded + still functional after the rebuild (the re-wired listeners).
    const wasChecked = sw.checked
    await userEvent.click(sw)
    await nextToggle()
    expect(sw.checked).toBe(!wasChecked)
    expect(el.open, 'the rebuilt fold did not toggle on the switch click').toBe(true)
  })

  it('activation-carrying slot content, cross-engine (review fix, ADR-0158 cl.3): a nested fold toggles ITSELF (outer stays) and a slotted native button runs un-prevented', async () => {
    // The scoped guard's stand-down arm: the inner element is the click's single activation target, so
    // the outer fold could never toggle from these clicks — and a preventDefault would cancel the INNER
    // behavior (the review-proven hazard: inner.open stayed false under the unscoped first draft).
    const { host, summary } = mount(
      '<ui-disclosure summary="Outer"><ui-disclosure slot="summary" summary="Inner"><p>inner body</p></ui-disclosure><p>outer body</p></ui-disclosure>',
    )
    const outer = host as HTMLElement & { open: boolean }
    const inner = summary.querySelector('ui-disclosure') as HTMLElement & { open: boolean }
    expect(summary.contains(inner), 'the nested fold rides the outer summary row').toBe(true)
    const innerSummary = inner.querySelector('[data-part="summary"]') as HTMLElement
    innerSummary.click()
    await nextToggle()
    expect(inner.open, 'the inner fold toggles — the guard stood down').toBe(true)
    expect(outer.open, 'the outer fold stays').toBe(false)

    const { host: host2 } = mount(
      '<ui-disclosure summary="X"><button slot="summary" id="slot-btn" type="button">Do</button><p>body</p></ui-disclosure>',
    )
    const el2 = host2 as HTMLElement & { open: boolean }
    const btn = host2.querySelector('#slot-btn') as HTMLButtonElement
    let captured: Event | null = null
    btn.addEventListener('click', (e) => (captured = e))
    await userEvent.click(btn)
    await nextToggle()
    expect(captured).not.toBeNull()
    expect((captured as unknown as Event).defaultPrevented, 'no preventDefault reached the button click').toBe(false)
    expect(el2.open, 'the fold never toggles — the button owned the activation').toBe(false)
  })

  it('the accessible name is the summary label, not the switch text — aria-labelledby scopes name-from-content (ADR-0158 cl.4)', () => {
    const { summary } = mount(
      '<ui-disclosure summary="Agent"><ui-switch slot="summary" aria-label="Agent active"></ui-switch><p>b</p></ui-disclosure>',
    )
    const label = summary.querySelector('[data-part="summary-text"]') as HTMLElement
    expect(label.id).not.toBe('')
    expect(summary.getAttribute('aria-labelledby')).toBe(label.id)
    expect(label.textContent).toBe('Agent')
  })
})

describe('ui-disclosure — forced-colors survival (SPEC-R18 AC3)', () => {
  it('forced-colors keeps the summary ink visible — Chromium emulates (CDP); WebKit asserts the baseline', async () => {
    const { summary } = mount('<ui-disclosure summary="X"><p>Y</p></ui-disclosure>')

    if (server.browser !== 'chromium') {
      // WebKit exposes no CDP / forced-colors emulation (the documented cross-engine split, the
      // button-geometry.browser.test.ts precedent) — assert we are genuinely NOT in forced-colors and stop.
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(true)
      const color = getComputedStyle(summary).color
      expect(color).not.toBe('') // an opaque system ink is painted (CanvasText), never vanished
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})
