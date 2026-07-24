// a2ui-live.browser.test.ts — LLD-C9/SPEC-R8/ADR-0156 cross-engine equivalence proof for the [chat | canvas]
// chrome, built on `<ui-super-shell>` (re-hosted off `<ui-app-shell>`, ADR-0156 — the migration campaign)
// in place of the bespoke two-pane flex CSS the original build replaced. Real-number regression gates
// (SPEC-R8 AC3), not eyeballing — isolating the ONE thing this slice changes (the pane ASSEMBLY mechanism)
// from the surrounding site chrome (`_page.css`'s nav rail / context header, untouched and out of scope):
// both legs mount inside an identically-sized `[data-page-content]`-shaped wrapper rather than the whole
// site shell.
//
// SCOPE OF THE CLAIM (unchanged from the ADR-0083/0084 wave — this is NOT "unchanged at every width"): the
// chat pane is a FIXED 26rem sidebar, byte-identical to the pre-ADR-0156 `ui-app-shell` page only at its
// WIDE resting shape (content width ≳ 1050px, the "wide" leg below). In the ~640–1050px MID-BAND (above the
// shell's 40rem/640px reflow) the two-region layout still holds the fixed 26rem — the "mid-band" leg below.
//
// ADR-0156 RE-HOST, the numbers that MOVED and why (re-baselined against the new markup at 2026-07-21 —
// this IS the migration campaign's own acceptance criterion: a re-measure, never a regression):
//   - `.chat-pane`/`.canvas-pane` are no longer the sized boxes themselves (they were, as `ui-app-shell-
//     region` elements) — `ui-super-shell` wraps each authored slot child in its OWN part
//     (`[data-part='pane'][data-side='start']`, `[data-part='canvas']`) and sizes THAT wrapper. The 26rem
//     chat width is now set via `--ui-super-shell-pane-size: 26rem` (a2ui-live.css), a token override, not
//     an `inline-size` rule on `.chat-pane` itself — `.chat-pane` (`box-sizing: border-box` now, was
//     unset/content-box before) auto-fills its wrapper's exact content-box width instead of adding its own
//     border on top, so its measured OUTER width is now 416px (26rem, box-sizing: border-box) rather than
//     the OLD 418px (416px content-box + 1px border × 2, content-box) — a genuine, expected 2px shift.
//   - The two panes are no longer edge-to-edge: `ui-super-shell`'s middle row separates its parts with a
//     REAL `gap` (`--ui-super-shell-gap`, 18px) instead of a shared border — so the canvas pane's `x` shifts
//     right by the gap width relative to the old adjacent layout, and there is no more "single owner
//     divider" to arbitrate (see the re-keyed describe block below).
import { describe, it, expect, afterEach } from 'vitest'
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/app/app-shell.css'
import '@agent-ui/app/app-shell'
import { UIAppShellRegionElement } from '@agent-ui/app/app-shell'
import '@agent-ui/app/super-shell.css'
import '@agent-ui/app/super-shell'
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
  const shell = document.createElement('ui-super-shell')
  shell.setAttribute('narrow-start', 'stack')
  const chat = document.createElement('div')
  chat.setAttribute('data-slot', 'nav-pane')
  chat.setAttribute('data-landmark', 'complementary')
  chat.className = 'chat-pane'
  const canvas = document.createElement('div')
  canvas.setAttribute('data-slot', 'content')
  canvas.className = 'canvas-pane'
  shell.append(chat, canvas)
  content.append(shell)
  document.body.append(content)
  mounted.push(content)
  return { chat, canvas }
}

// Probe subclass re-exposing the protected `internals` (the app package's own app-shell.test.ts precedent) —
// a NEW tag, since the real class already claimed `ui-app-shell-region` at import time above.
// `ui-app-shell`/`ui-app-shell-region` stay in-tree, functional, and gate-covered for the whole ADR-0156
// deprecation window (clause 1) — the two describe blocks below exercise THAT component's own landmark-
// override behavior in isolation and are UNCHANGED by this migration (they are not this page's composition).
class ProbeRegion extends UIAppShellRegionElement {
  get ii(): ElementInternals {
    return this.internals
  }
}
if (!customElements.get('a2ui-live-region-probe')) customElements.define('a2ui-live-region-probe', ProbeRegion)

describe('a2ui-live chrome re-host (ADR-0156) — wide resting shape', () => {
  const WIDTH = 1200 // px — comfortably past the OLD layout's cap threshold (~1050px), see the file banner

  // Measured against the POST-ADR-0156 `ui-super-shell` markup/CSS at WIDTH=1200, box-sizing border-box,
  // padding 1.25rem/1.5rem: chat pinned to its 26rem token override (416px, box-sizing: border-box — no
  // added border, unlike the old ui-app-shell-region measurement), canvas filling the remainder minus the
  // shell's own 18px gap. Re-capture these (mountChrome + getBoundingClientRect()) if this test ever needs
  // to be re-baselined; do not hand-tune them to pass.
  const EXPECTED_CHAT = { x: 24, y: 20, width: 416, height: 560, right: 440 }
  const EXPECTED_CANVAS = { x: 458, y: 20, width: 718, height: 560, right: 1176 }

  it('the ui-super-shell composition renders the re-baselined rects', () => {
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

  it("negative control: mounting the SAME slots without the page's [data-page-content] ancestor drops the pane-size override — the assertion above bites", () => {
    // No `[data-page-content]` wrapper this time, so a2ui-live.css's `[data-page-content] > ui-super-shell`
    // token-override selector never matches — the chat pane falls through to the component's OWN default
    // pane size (14 modules = 252px), genuinely different from the page's 26rem (416px) override.
    const shell = document.createElement('ui-super-shell')
    const chat = document.createElement('div')
    chat.setAttribute('data-slot', 'nav-pane')
    chat.className = 'chat-pane'
    const canvas = document.createElement('div')
    canvas.setAttribute('data-slot', 'content')
    canvas.className = 'canvas-pane'
    shell.append(chat, canvas)
    shell.style.width = `${WIDTH}px`
    shell.style.height = '600px'
    document.body.append(shell)
    mounted.push(shell)
    const rect = chat.getBoundingClientRect()
    expect(rect.width).not.toBeCloseTo(EXPECTED_CHAT.width, 0)
  })
})

describe('a2ui-live chrome re-host (ADR-0156) — mid-band (~900px): the fixed sidebar holds', () => {
  const WIDTH = 900 // px — inside the ~640–1050px band where a shrinkable flex sidebar would have diverged
  // from a fixed one; the fixed-26rem design (unchanged by ADR-0156) holds identically here too.

  // Measured against the POST-ADR-0156 markup/CSS at WIDTH=900 — the chat pane holds its fixed 26rem
  // (unaffected by content width), canvas fills what's left of the shell's content slot minus the gap.
  // Re-capture the same way (mount at WIDTH, read getBoundingClientRect()) if this ever needs re-baselining;
  // do not hand-tune to pass.
  const EXPECTED_CHAT = { x: 24, y: 20, width: 416, height: 560, right: 440 }
  const EXPECTED_CANVAS = { x: 458, y: 20, width: 418, height: 560, right: 876 }

  it('the chat pane stays pinned at its fixed 26rem width — it does not shrink with content width', () => {
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

    // anti-vacuous, the OTHER direction: a shrinkable-flex chat pane at this same content width (~360px,
    // the pre-ADR-0083 shape) is GENUINELY different from the fixed width here — this leg would catch a
    // regression back to a shrink behaviour, not just a totally-broken layout.
    expect(chatRect.width).not.toBeCloseTo(360, 0)
  })

  it("negative control: mounting the SAME slots without the page's [data-page-content] ancestor drops the pane-size override — the assertion above bites", () => {
    const shell = document.createElement('ui-super-shell')
    const chat = document.createElement('div')
    chat.setAttribute('data-slot', 'nav-pane')
    chat.className = 'chat-pane'
    const canvas = document.createElement('div')
    canvas.setAttribute('data-slot', 'content')
    canvas.className = 'canvas-pane'
    shell.append(chat, canvas)
    shell.style.width = `${WIDTH}px`
    shell.style.height = '600px'
    document.body.append(shell)
    mounted.push(shell)
    const rect = chat.getBoundingClientRect()
    expect(rect.width).not.toBeCloseTo(EXPECTED_CHAT.width, 0)
  })
})

describe('a2ui-live chrome re-host (ADR-0156) — the two panes are independent gapped cards, not a shared-edge divider', () => {
  // RE-KEYED (was "the divider border is single-owned, not duplicated"): the OLD ui-app-shell layout placed
  // the two regions EDGE-TO-EDGE, so exactly one of them could own the shared border — that single-owner
  // rule is what the old describe block asserted. ui-super-shell's middle row instead separates its parts
  // with a REAL `gap` (super-shell.css) — the two cards are no longer adjacent, so there is no shared edge
  // to arbitrate: each pane now owns a complete, un-arbitrated border on all four sides.
  it('the shell keeps a real, non-zero gap between the panes; each pane owns a complete border on all four sides', () => {
    const { chat, canvas } = mountChrome(1200)
    const chatRect = chat.getBoundingClientRect()
    const canvasRect = canvas.getBoundingClientRect()
    // --ui-super-shell-gap === --ui-super-shell-module === 18px (super-shell.css's token block) — a REAL
    // gap, not the old adjacent shared edge.
    expect(canvasRect.left - chatRect.right).toBeCloseTo(18, 0)

    for (const style of [getComputedStyle(chat), getComputedStyle(canvas)]) {
      expect(style.borderTopWidth).toBe('1px')
      expect(style.borderRightWidth).toBe('1px')
      expect(style.borderBottomWidth).toBe('1px')
      expect(style.borderLeftWidth).toBe('1px')
    }
  })

  it('negative control: dropping the chat pane\'s own inline-end border (the OLD single-owner assumption) leaves a real, detectable gap in its border — the assertion above bites', () => {
    const { chat } = mountChrome(1200)
    chat.style.borderInlineEndWidth = '0px' // simulates re-introducing the retired ui-app-shell-era rule
    expect(getComputedStyle(chat).borderRightWidth).not.toBe('1px')
  })
})

describe('a2ui-live pane radius stays CONCENTRIC with its shell wrapper (GH #253 bug 2)', () => {
  // ROOT CAUSE (verified via a real-browser corner screenshot + a canvas-decoded RGB diff, both engines):
  // `.chat-pane` flush-fills its `[data-part='pane'][data-side='start']` wrapper with ZERO gap (the
  // wrapper declares no padding by design, agent-admin.css's own comment on that same base rule confirms
  // THIS page is the one shipped consumer relying on the flush fill) — and that wrapper is ALSO a
  // decorated box (`border-radius: var(--ui-super-shell-radius)` + its own background, super-shell.css —
  // the same "floating card" treatment rail/pane/pane-resizer keep, GH #253 bug 1). Two boxes at an
  // IDENTICAL rect need the SAME radius (the G9 nested-radius law, ADR-0018: `r_child = max(0, r_parent −
  // padding_parent)`, here padding=0 so r_child MUST equal r_parent) — a mismatched literal (the old bare
  // `12px`) left a thin sliver of the wrapper's own (differently-toned) background peeking around
  // `.chat-pane`'s tighter corner, reading as a cut/discontinuous border right at the corner (next to the
  // pane-title heading). The fix: `.chat-pane`/`.canvas-pane` consume `var(--ui-super-shell-radius)`
  // (inherited from the `ui-super-shell` host) instead of an unrelated hardcoded literal.
  it('.chat-pane\'s own radius equals its [data-part="pane"] wrapper\'s radius exactly (concentric, zero-gap fill)', () => {
    const { chat } = mountChrome(1200)
    const wrapper = chat.parentElement as HTMLElement
    expect(wrapper.dataset.part, 'the wrapper under test must be the shell\'s own pane part').toBe('pane')
    const chatRadius = getComputedStyle(chat).borderRadius
    const wrapperRadius = getComputedStyle(wrapper).borderRadius
    expect(chatRadius).toBe(wrapperRadius)
    expect(chatRadius).not.toBe('0px') // anti-vacuous — both are genuinely rounded, not both flat
  })

  it('.canvas-pane shares the SAME radius as its sibling .chat-pane (visual consistency between the two cards — [data-part="canvas"] itself stays undecorated, no bug there to begin with)', () => {
    const { chat, canvas } = mountChrome(1200)
    const canvasWrapper = canvas.parentElement as HTMLElement
    expect(canvasWrapper.dataset.part).toBe('canvas')
    expect(getComputedStyle(canvasWrapper).borderRadius, 'the canvas wrapper itself must stay undecorated (super-shell.css, by design)').toBe('0px')
    expect(getComputedStyle(canvas).borderRadius).toBe(getComputedStyle(chat).borderRadius)
    expect(getComputedStyle(canvas).borderRadius).not.toBe('0px')
  })

  it('negative control: an unrelated fixed 12px literal (the OLD hardcoded radius) is NOT what either pane computes today — the concentric assertions above are not vacuously true', () => {
    const { chat, canvas } = mountChrome(1200)
    expect(getComputedStyle(chat).borderRadius).not.toBe('12px')
    expect(getComputedStyle(canvas).borderRadius).not.toBe('12px')
  })
})

describe('a2ui-live chrome re-host (ADR-0083, unchanged) — the chat composer lands on the CORRECT ARIA landmark', () => {
  it('resolves role="complementary" via internals, decoupled from its "navigation" column — never a host attribute', () => {
    const el = new ProbeRegion()
    el.region = 'navigation' // the LEFT column (ui-app-shell-region's own vocabulary, unrelated to this page)
    el.landmark = 'complementary'
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

describe('a2ui-live chrome re-host (ADR-0156, was ADR-0084) — the chat composer stays REACHABLE when narrow', () => {
  const NARROW_WIDTH = 300 // px — well below the shell's 40rem/640px narrow-reflow threshold

  it('narrow-start="stack" keeps the composer visible + full-width; the END side (default narrow-end="collapse") still vanishes — the biting NC', () => {
    const content = document.createElement('main')
    content.setAttribute('data-page-content', '')
    content.style.width = `${NARROW_WIDTH}px`
    content.style.height = '600px'
    const shellEl = document.createElement('ui-super-shell')
    shellEl.setAttribute('narrow-start', 'stack') // a2ui-live.ts's real attribute — the fix under test
    const chat = document.createElement('div')
    chat.setAttribute('data-slot', 'nav-pane')
    chat.setAttribute('data-landmark', 'complementary')
    chat.className = 'chat-pane'
    const canvas = document.createElement('div')
    canvas.setAttribute('data-slot', 'content')
    canvas.className = 'canvas-pane'
    // The negative-control SIBLING: a genuine END-side pane left at the DEFAULT `narrow-end` ("collapse") —
    // proves the shell's narrow reflow still hides a side that does NOT opt into `narrow-*="stack"` (the fix
    // is real, targeted, not a blanket "sides never hide anymore").
    const aside = document.createElement('div')
    aside.setAttribute('data-slot', 'options-pane')
    shellEl.append(chat, canvas, aside) // chat-then-canvas mirrors a2ui-live.ts's real DOM order
    content.append(shellEl)
    document.body.append(content)
    mounted.push(content)

    // The narrow-reflow rules key off `[data-part='middle'] > [data-side='start'|'end']` — the WRAPPER part
    // ui-super-shell composes around each authored slot child, not the authored child itself (`chat`'s own
    // `display` is unaffected by an ancestor's `display:none`, per getComputedStyle's own per-element
    // contract — asserting on `chat` directly here would be vacuous).
    const chatWrapper = chat.parentElement!
    const asideWrapper = aside.parentElement!
    expect(getComputedStyle(chatWrapper).display, 'the composer vanished narrow — narrow-start="stack" did not hold').not.toBe('none')
    expect(getComputedStyle(asideWrapper).display, 'the NC sibling side stayed visible — narrow-end="collapse" default did not fire').toBe(
      'none',
    )

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
    // `key` (not `value`) is ui-tab's identity attribute since the TKT-0069 rename (`value` is reserved
    // fleet-wide for the FACE form value, naming.md §12) — mirrors a2ui-live.ts's own real tab authoring
    // (a2ui-live.ts:145). This fixture predates that rename (2026-07-06, commit d41f2e8) and was missed by
    // the rename wave's residue sweep (2026-07-16, commit d6a93cb) because it lives in a LOCAL test helper,
    // not the production markup the sweep grepped — GH #20's root cause: `tab.key` stayed '' for every tab,
    // so ui-tabs' commit/resolve logic (tabs.ts's documented, tested "value, else DOM index" fallback)
    // correctly fell back to the index, exactly as designed for a genuinely key-less tab.
    t.setAttribute('key', value)
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
  // below the tablist and owns the scroll.
  //
  // CORRECTED (live-repro finding): a prior version of this test asserted only `flexDirection`/`flexGrow` and
  // explicitly declined to assert `display`, reasoning that a full fill-measurement was "cascade-order fragile
  // in the isolated harness" and that "the live page's own layout then realizes" the fill regardless. That
  // reasoning was WRONG, not just imprecise — a live Playwright repro against the running page found
  // `.canvas-tabs` computing `display: block`, not `flex`, REGARDLESS of source order: tabs.css declares
  // `:scope { display: block }` inside `@scope (ui-tabs) { … }`, and per the CSS cascade, scoping PROXIMITY is
  // the tiebreaker checked BEFORE source order when two rules tie on specificity — an unscoped selector (the
  // old plain `.canvas-tabs`) is treated as having the worst (infinite) proximity, so it can NEVER win against
  // an equal-specificity `@scope`-scoped rule, no matter which stylesheet loads last. The result in production:
  // `flex-direction`/`flex-grow` were set but INERT (block layout ignores them), `.canvas-stage`'s
  // `block-size: 100%` collapsed to 0, and its `overflow: auto` clipped every rendered A2UI surface out of
  // view — a real, correctly-built DOM tree that was silently invisible. The fix (a2ui-live.css) raises
  // `.canvas-tabs`'s selector to `ui-tabs.canvas-tabs` (specificity 0,1,1 — checked BEFORE proximity, so it
  // beats `:scope`'s 0,1,0 outright). This leg now asserts `display` directly so a future regression back to a
  // tied-specificity selector fails HERE, not silently in the browser.
  // (Diagnostic detail from the independent origin fix e99f090: flex-direction/flex-grow report their
  // SPECIFIED values via getComputedStyle regardless of whether display is actually flex — which is
  // exactly why the display assertion is the load-bearing one and the old two-property check was vacuous.)
  it('the stage-fill is wired: .canvas-tabs computes display:flex (beats @scope proximity), the active panel is flex:1 1 auto, and a hidden panel takes no box', () => {
    const tabs = mountCanvasTabs('canvas')
    const panels = tabs.querySelectorAll('ui-tab-panel')
    expect(getComputedStyle(tabs).display, '.canvas-tabs must actually COMPUTE display:flex — not just declare it — to beat tabs.css\'s @scope :scope{display:block}').toBe('flex')
    expect(getComputedStyle(tabs).flexDirection, '.canvas-tabs must be the flex column a2ui-live.css establishes').toBe('column')
    expect(getComputedStyle(panels[0]!).flexGrow, 'the active panel must be flex-grow:1 so it fills the stage, not the pane').toBe('1')
    expect((panels[1] as HTMLElement).getBoundingClientRect().height, 'a hidden panel must take zero box (display:none)').toBe(0)
  })

  // Strengthening 3 (real pixel fill, the whole-shape proof) — mounts the tabs compound inside a DEFINITE-height
  // container (mirroring the real page's app-shell → pane → tabs chain) and asserts the active panel's rendered
  // height actually reaches that container, not just that the CSS properties are declared. This is the assertion
  // that would have failed outright under the pre-fix `display:block` bug (the panel would have shrunk to its
  // own content's block-flow height, nowhere near the container).
  it('the active panel genuinely FILLS a real sized container (not just declares flex:1 1 auto)', () => {
    const wrap = document.createElement('div')
    wrap.style.display = 'flex'
    wrap.style.flexDirection = 'column'
    wrap.style.height = '400px'
    wrap.style.width = '300px'
    const tabs = mountCanvasTabs('canvas')
    mounted.pop() // mountCanvasTabs already queued `tabs` for its own cleanup; re-home it under `wrap` instead
    wrap.append(tabs)
    document.body.append(wrap)
    mounted.push(wrap)
    const panel = tabs.querySelector('ui-tab-panel:not([hidden])') as HTMLElement
    expect(panel.getBoundingClientRect().height, 'the active panel must fill the 400px container, not shrink to its own content').toBeGreaterThan(300)
  })
})
