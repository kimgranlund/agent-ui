// a2ui-live.browser.test.ts — LLD-C9/SPEC-R8 cross-engine equivalence proof for the [chat | canvas] chrome,
// built on `<ui-app-shell>` in place of the bespoke two-pane flex CSS it replaces. Real-number regression
// gates (SPEC-R8 AC3), not eyeballing — isolating the ONE thing this slice changes (the pane ASSEMBLY
// mechanism) from the surrounding site chrome (`_page.css`'s nav rail / context header, untouched and out of
// C9's scope): both legs mount inside an identically-sized `[data-page-content]`-shaped wrapper rather than
// the whole site shell.
//
// SCOPE OF THE CLAIM (review fix — this is NOT "unchanged at every width"): the OLD `.chat-pane` was a
// SHRINKABLE flex item (`flex: 1 1 20rem; max-inline-size: 26rem`); the NEW one is a FIXED `inline-size:
// 26rem` sidebar (a2ui-live.css's own banner has the full rationale). The two are byte-IDENTICAL only at the
// old layout's WIDE resting shape (content width ≳ 1050px, where the old flex math had already saturated at
// its 26rem cap) — the "wide" leg below. In the ~640–1050px MID-BAND (above the shell's 40rem/640px reflow,
// i.e. ordinary laptop widths) the two INTENTIONALLY diverge — the "mid-band" leg below captures the NEW
// shape there (still pinned to 26rem) rather than masking the divergence with an overstated claim.
//
// ADR-0083/0084 rework: the chat region now carries `landmark="complementary"` (the correct ARIA role,
// decoupled from `region="navigation"`'s column duty) and `collapse="stack"` (stays visible + full-width
// narrow instead of vanishing) — `mountChrome` below mirrors a2ui-live.ts's real attributes exactly, so the
// wide/mid-band legs keep testing the ACTUAL composition; neither attribute touches wide-layout CSS, so
// those two legs' expected numbers are UNCHANGED from before this rework.
import { describe, it, expect, afterEach } from 'vitest'
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/app/app-shell.css'
import '@agent-ui/app/app-shell'
import { UIAppShellRegionElement } from '@agent-ui/app/app-shell'
import '@agent-ui/components/component-styles.css' // the [hidden] panel rule + tab chrome (Batch C tabs legs)
import '@agent-ui/components/components' // self-defines ui-tabs / ui-tab / ui-tab-panel
import './a2ui-live.css'

const mounted: HTMLElement[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

function mountChrome(width: number): { chat: HTMLElement; canvas: HTMLElement } {
  const content = document.createElement('main')
  content.setAttribute('data-page-content', '')
  content.style.width = `${width}px`
  content.style.height = '600px'
  const shell = document.createElement('ui-app-shell')
  const chat = document.createElement('ui-app-shell-region')
  chat.setAttribute('region', 'navigation')
  chat.setAttribute('landmark', 'complementary')
  chat.setAttribute('collapse', 'stack')
  chat.className = 'chat-pane'
  const canvas = document.createElement('ui-app-shell-region')
  canvas.setAttribute('region', 'main')
  canvas.className = 'canvas-pane'
  shell.append(chat, canvas)
  content.append(shell)
  document.body.append(content)
  mounted.push(content)
  return { chat, canvas }
}

// Probe subclass re-exposing the protected `internals` (the app package's own app-shell.test.ts precedent) —
// a NEW tag, since the real class already claimed `ui-app-shell-region` at import time above.
class ProbeRegion extends UIAppShellRegionElement {
  get ii(): ElementInternals {
    return this.internals
  }
}
if (!customElements.get('a2ui-live-region-probe')) customElements.define('a2ui-live-region-probe', ProbeRegion)

describe('a2ui-live chrome re-host (LLD-C9/SPEC-R8) — wide resting shape: byte-identical to the old page', () => {
  const WIDTH = 1200 // px — comfortably past the OLD layout's cap threshold (~1050px), see the file banner

  // Measured against the PRE-migration bespoke <section> markup/CSS at WIDTH=1200, box-sizing border-box,
  // padding 1.25rem/1.5rem: chat pinned to its 26rem cap (+ its 1px border each side = 418px), canvas
  // filling the remainder. Re-capture these (same method — a plain two-<section> flex harness against the
  // PRE-edit a2ui-live.css) if this test ever needs to be re-baselined; do not hand-tune them to pass.
  const EXPECTED_CHAT = { x: 24, y: 20, width: 418, height: 560, right: 442 }
  const EXPECTED_CANVAS = { x: 458, y: 20, width: 718, height: 560, right: 1176 }

  it('the ui-app-shell composition renders the SAME rects the pre-migration bespoke flex CSS did', () => {
    const { chat, canvas } = mountChrome(WIDTH)
    const chatRect = chat.getBoundingClientRect()
    const canvasRect = canvas.getBoundingClientRect()

    // anti-vacuous — genuinely two side-by-side, non-zero panes, not a collapsed stack
    expect(chatRect.width).toBeGreaterThan(0)
    expect(canvasRect.width).toBeGreaterThan(0)
    expect(chatRect.right).toBeLessThanOrEqual(canvasRect.left)

    expect(chatRect.x).toBeCloseTo(EXPECTED_CHAT.x, 0)
    expect(chatRect.y).toBeCloseTo(EXPECTED_CHAT.y, 0)
    expect(chatRect.width).toBeCloseTo(EXPECTED_CHAT.width, 0)
    expect(chatRect.height).toBeCloseTo(EXPECTED_CHAT.height, 0)
    expect(chatRect.right).toBeCloseTo(EXPECTED_CHAT.right, 0)

    expect(canvasRect.x).toBeCloseTo(EXPECTED_CANVAS.x, 0)
    expect(canvasRect.y).toBeCloseTo(EXPECTED_CANVAS.y, 0)
    expect(canvasRect.width).toBeCloseTo(EXPECTED_CANVAS.width, 0)
    expect(canvasRect.height).toBeCloseTo(EXPECTED_CANVAS.height, 0)
    expect(canvasRect.right).toBeCloseTo(EXPECTED_CANVAS.right, 0)
  })

  it('negative control: an un-sized chat pane (no inline-size rule) would NOT match — the assertion above bites', () => {
    const { chat } = mountChrome(WIDTH)
    chat.style.setProperty('inline-size', '10rem') // clobber the page rule the assertion depends on
    const rect = chat.getBoundingClientRect()
    expect(rect.width).not.toBeCloseTo(EXPECTED_CHAT.width, 0)
  })
})

describe('a2ui-live chrome re-host (LLD-C9/SPEC-R8) — mid-band (~900px): the INTENTIONAL divergence, captured', () => {
  const WIDTH = 900 // px — inside the ~640–1050px band where the OLD shrinkable flex and the NEW fixed
  // sidebar diverge (old chat would have shrunk to ~360px here; see the describe-block + file banner)

  // Measured against the CURRENT (post-migration) ui-app-shell markup/CSS at WIDTH=900 — the chat pane holds
  // its fixed 26rem (unaffected by content width, unlike the old shrinkable flex), canvas fills what's left
  // of the shell's `main` track. Re-capture the same way (mount at WIDTH, read getBoundingClientRect()) if
  // this ever needs re-baselining; do not hand-tune to pass.
  const EXPECTED_CHAT = { x: 24, y: 20, width: 418, height: 560, right: 442 }
  const EXPECTED_CANVAS = { x: 458, y: 20, width: 418, height: 560, right: 876 }

  it('the chat pane stays pinned at its fixed 26rem width — it does NOT shrink the way the old flex pane did', () => {
    const { chat, canvas } = mountChrome(WIDTH)
    const chatRect = chat.getBoundingClientRect()
    const canvasRect = canvas.getBoundingClientRect()

    expect(chatRect.width).toBeGreaterThan(0)
    expect(canvasRect.width).toBeGreaterThan(0)
    expect(chatRect.right).toBeLessThanOrEqual(canvasRect.left)

    expect(chatRect.x).toBeCloseTo(EXPECTED_CHAT.x, 0)
    expect(chatRect.width).toBeCloseTo(EXPECTED_CHAT.width, 0)
    expect(chatRect.right).toBeCloseTo(EXPECTED_CHAT.right, 0)

    expect(canvasRect.x).toBeCloseTo(EXPECTED_CANVAS.x, 0)
    expect(canvasRect.width).toBeCloseTo(EXPECTED_CANVAS.width, 0)
    expect(canvasRect.right).toBeCloseTo(EXPECTED_CANVAS.right, 0)

    // anti-vacuous, the OTHER direction: the OLD shrinkable-flex width at this same content width (~360px,
    // hand-derived from `flex: 1 1 20rem` shrinking against a 736px basis sum over an ~836px row) is
    // GENUINELY different from the new fixed width — this leg would catch a regression back to the old
    // shrink behaviour, not just a totally-broken layout.
    expect(chatRect.width).not.toBeCloseTo(360, 0)
  })

  it('negative control: an un-sized chat pane (no inline-size rule) would NOT match — the assertion above bites', () => {
    const { chat } = mountChrome(WIDTH)
    chat.style.setProperty('inline-size', '10rem')
    const rect = chat.getBoundingClientRect()
    expect(rect.width).not.toBeCloseTo(EXPECTED_CHAT.width, 0)
  })
})

describe('a2ui-live chrome re-host (LLD-C9/SPEC-R8) — the divider border is single-owned, not duplicated', () => {
  it("the chat pane's inline-end edge is painted by the shell's navigation divider, not a second local rule", () => {
    const { chat, canvas } = mountChrome(1200)
    const chatBorder = getComputedStyle(chat)
    const canvasBorder = getComputedStyle(canvas)
    // Both resolve to the SAME 1px divider token — the review fix removed `.chat-pane`'s own duplicate
    // border-inline-end declaration (a2ui-live.css), so this is now the shell's `[region=navigation]` divider
    // rule alone; `.canvas-pane` still owns its own end edge (no shell divider covers `main`). Same width/
    // colour either way (no visual change) — this asserts the resolved value stays a real, painted edge.
    expect(chatBorder.borderRightWidth).toBe('1px')
    expect(chatBorder.borderRightColor).toBe(canvasBorder.borderRightColor)
  })
})

describe('a2ui-live chrome re-host (ADR-0083) — the chat composer lands on the CORRECT ARIA landmark', () => {
  it('resolves role="complementary" via internals, decoupled from its "navigation" column — never a host attribute', () => {
    const el = new ProbeRegion()
    el.region = 'navigation' // the LEFT column (a2ui-live.ts's real value)
    el.landmark = 'complementary' // the override a2ui-live.ts's real chat pane carries
    document.body.append(el)
    mounted.push(el)
    expect(el.ii.role).toBe('complementary')
    expect(el.getAttribute('role')).toBeNull()
  })

  it('negative control: the SAME column WITHOUT the landmark override resolves to "navigation" — the assertion above bites', () => {
    const el = new ProbeRegion()
    el.region = 'navigation'
    document.body.append(el)
    mounted.push(el)
    expect(el.ii.role).toBe('navigation')
    expect(el.ii.role).not.toBe('complementary')
  })
})

describe('a2ui-live chrome re-host (ADR-0084) — the chat composer stays REACHABLE when narrow', () => {
  const NARROW_WIDTH = 300 // px — well below the shell's 40rem/640px narrow-reflow threshold

  it('collapse="stack" keeps the composer visible + full-width; a plain side region (collapse="hide", default) still vanishes — the biting NC', () => {
    const content = document.createElement('main')
    content.setAttribute('data-page-content', '')
    content.style.width = `${NARROW_WIDTH}px`
    content.style.height = '600px'
    const shellEl = document.createElement('ui-app-shell')
    const chat = document.createElement('ui-app-shell-region')
    chat.setAttribute('region', 'navigation')
    chat.setAttribute('landmark', 'complementary')
    chat.setAttribute('collapse', 'stack') // a2ui-live.ts's real attribute — the fix under test
    chat.className = 'chat-pane'
    const main = document.createElement('ui-app-shell-region')
    main.setAttribute('region', 'main')
    // The negative-control SIBLING: a genuine side region left at the DEFAULT collapse ("hide") — proves the
    // shell's narrow reflow still hides a region that does NOT opt into collapse="stack" (the fix is real,
    // targeted, not a blanket "side regions never hide anymore").
    const aside = document.createElement('ui-app-shell-region')
    aside.setAttribute('region', 'complementary')
    shellEl.append(chat, main, aside) // chat-then-main mirrors a2ui-live.ts's real DOM order
    content.append(shellEl)
    document.body.append(content)
    mounted.push(content)

    expect(getComputedStyle(chat).display, 'the composer vanished narrow — collapse="stack" did not hold').not.toBe('none')
    expect(getComputedStyle(aside).display, 'the NC sibling stayed visible — collapse="hide" default did not fire').toBe('none')

    const chatRect = chat.getBoundingClientRect()
    const shellRect = shellEl.getBoundingClientRect()
    expect(chatRect.width, 'the composer did not span the full narrow column').toBeCloseTo(shellRect.width, 0)
  })
})

// ── Batch C dogfood: the canvas tabs now consume the shipped `ui-tabs` compound (was a hand-rolled role=tablist
// strip + roving/selectTab). These mirror a2ui-live.ts's REAL tab authoring — as mountChrome mirrors the panes —
// and prove this page's CONSUMPTION: the tablist is a real PART, the host carries no role, selection toggles the
// panel `hidden`, and only a USER gesture emits the ONE `select` event. (The component's own ARIA/roving/motion
// is proven by tabs.test.ts; this slice does not re-prove it.) ─────────────────────────────────────────────────
function mountCanvasTabs(selected = 'canvas'): HTMLElement {
  const tabs = document.createElement('ui-tabs')
  tabs.className = 'canvas-tabs'
  tabs.setAttribute('selected', selected)
  const mk = (value: string, label: string): HTMLElement => {
    const t = document.createElement('ui-tab')
    t.setAttribute('value', value)
    t.textContent = label
    return t
  }
  const canvasPanel = document.createElement('ui-tab-panel')
  const jsonPanel = document.createElement('ui-tab-panel')
  const htmlPanel = document.createElement('ui-tab-panel')
  canvasPanel.textContent = 'canvas'
  jsonPanel.textContent = 'json'
  htmlPanel.textContent = 'html'
  tabs.append(mk('canvas', 'Canvas'), mk('json', 'JSON'), mk('html', 'HTML'), canvasPanel, jsonPanel, htmlPanel)
  document.body.append(tabs)
  mounted.push(tabs)
  return tabs
}

describe('a2ui-live canvas tabs (Batch C) — the shipped ui-tabs compound replaces the hand-rolled tablist', () => {
  it('authors as ui-tabs/ui-tab/ui-tab-panel: a real tablist PART, NO host role, and selected="canvas" shows only the Canvas panel', () => {
    const tabs = mountCanvasTabs()
    const strip = tabs.querySelector('[data-part="tablist"]')
    expect(strip, 'ui-tabs did not create its tablist strip part').not.toBeNull()
    expect(strip!.getAttribute('role')).toBe('tablist')
    expect(tabs.getAttribute('role'), 'the host must carry NO role attribute — ARIA rides internals (tabs.md)').toBeNull()
    expect(strip!.querySelectorAll('ui-tab')).toHaveLength(3) // the three tabs reparented into the strip
    const panels = tabs.querySelectorAll('ui-tab-panel')
    expect(panels).toHaveLength(3)
    expect(panels[0]!.hasAttribute('hidden'), 'the Canvas panel should be visible').toBe(false)
    expect(panels[1]!.hasAttribute('hidden'), 'the JSON panel should be hidden').toBe(true)
    expect(panels[2]!.hasAttribute('hidden'), 'the HTML panel should be hidden').toBe(true)
  })

  it('a USER click on the JSON tab commits: JSON shows, Canvas hides, `selected` reflects, and the ONE select event fires { value:"json", index:1 }', async () => {
    const tabs = mountCanvasTabs()
    const events: Array<{ value: string; index: number }> = []
    tabs.addEventListener('select', (e) => events.push((e as CustomEvent<{ value: string; index: number }>).detail))
    const jsonTab = tabs.querySelectorAll('ui-tab')[1] as HTMLElement
    jsonTab.click()
    await (tabs as unknown as { updateComplete: Promise<unknown> }).updateComplete // the selection effect is microtask-batched
    const panels = tabs.querySelectorAll('ui-tab-panel')
    expect(panels[0]!.hasAttribute('hidden'), 'Canvas should now be hidden').toBe(true)
    expect(panels[1]!.hasAttribute('hidden'), 'JSON should now be visible').toBe(false)
    expect(tabs.getAttribute('selected')).toBe('json') // reflected
    expect(events).toHaveLength(1)
    expect(events[0]).toEqual({ value: 'json', index: 1 })
  })

  it('negative control: a PROGRAMMATIC selected write (the showCanvas() path) applies but is SILENT — no select echoed; the click test above proves a real user commit, not the reflect', async () => {
    const tabs = mountCanvasTabs()
    const events: unknown[] = []
    tabs.addEventListener('select', (e) => events.push(e))
    ;(tabs as unknown as { selected: string }).selected = 'html'
    await (tabs as unknown as { updateComplete: Promise<unknown> }).updateComplete
    const panels = tabs.querySelectorAll('ui-tab-panel')
    expect(panels[2]!.hasAttribute('hidden'), 'the programmatic write should still apply (HTML shown)').toBe(false)
    expect(events, 'a programmatic selected write must NOT echo a select event (binding hygiene)').toHaveLength(0)
  })

  // Strengthening 1 (computed-display): the prior legs assert the `hidden` ATTRIBUTE toggles; this proves the
  // attribute actually RESOLVES to `display:none` — i.e. the component's `ui-tab-panel[hidden]{display:none}`
  // rule bites and a2ui-live.css (which deliberately sets NO `display` on the panels, so as not to clobber it)
  // does not defeat it. Guards the exact hazard the a2ui-live.css banner calls out.
  it('the `hidden` attribute resolves to computed display:none — the component hide rule bites, unclobbered by a2ui-live.css', () => {
    const tabs = mountCanvasTabs('canvas')
    const panels = tabs.querySelectorAll('ui-tab-panel')
    expect(getComputedStyle(panels[0]!).display, 'the selected Canvas panel must render (not display:none)').not.toBe('none')
    expect(getComputedStyle(panels[1]!).display, 'a hidden panel must COMPUTE display:none, not merely carry [hidden]').toBe('none')
    expect(getComputedStyle(panels[2]!).display).toBe('none')
  })

  // Strengthening 2 (stage-fill wiring): a2ui-live.css re-lays `.canvas-tabs` as a flex column and marks
  // `.canvas-tabs > ui-tab-panel { flex:1 1 auto }`, so the ACTIVE panel — not the whole pane — fills the stage
  // below the tablist and owns the scroll. Assert those two declarations actually reach the compound (the panel's
  // `flex-grow:1` has no competing component rule, so it's a robust, cascade-order-independent proof the fill is
  // wired), plus that a hidden panel takes no box (display:none). (A full pixel-fill measurement is cascade-order
  // fragile in the isolated harness — the component's adopted sheet can out-order the imported page CSS — so this
  // pins the WIRING the page relies on, which the live page's own layout then realizes.)
  it('the stage-fill is wired: .canvas-tabs is a flex column, the active panel is flex:1 1 auto, and a hidden panel takes no box', () => {
    const tabs = mountCanvasTabs('canvas')
    const panels = tabs.querySelectorAll('ui-tab-panel')
    expect(getComputedStyle(tabs).flexDirection, '.canvas-tabs must be the flex column a2ui-live.css establishes').toBe('column')
    expect(getComputedStyle(panels[0]!).flexGrow, 'the active panel must be flex-grow:1 so it fills the stage, not the pane').toBe('1')
    expect((panels[1] as HTMLElement).getBoundingClientRect().height, 'a hidden panel must take zero box (display:none)').toBe(0)
  })
})
