// super-shell.ts — UISuperShellElement (M5, GH #83): the shell-archetype family's grammar ceiling —
// the two-level recursive shell of shell-archetypes-m5.spec.md (SPEC-R1), spec-sourced from Kim's
// Figma frames 34-1486 / 34-1506 (GH #44). A BEHAVIOR-ONLY composition (ADR-0151 rule 2 / SPEC-R3):
// it owns geometry, collapse behavior, and slot placement — never data, transport, or navigation.
//
// Grammar (SPEC-R1, amended v0.2/SPEC-R5 — LLD-C3, GH #96): `[ header? | side-L? | content | side-R?
// | footer? ]`, a side = `rail? + pane*` (a rail plus ZERO OR MORE stacked panes — was one pane max;
// two Figma frames, GH #44's follow-up wave, showed a side needing an extra `section-nav` register
// beside the primary nav, and the two sides need not match in pane count). Every slot OPTIONAL — an
// unfilled slot is ABSENT (no box), so the inner canvas-shell level is just another <ui-super-shell>
// composed into `content` with no rails authored (R1b's ring-dropping recursion needs zero extra
// code). Consumers mark light-DOM children with `data-slot="header|global-nav|nav-pane|section-nav|
// content|options-pane|options-section|global-options|footer"`; unmarked children fold into
// `content` (the mandatory slot — console.warn when absent, the app-shell law). `section-nav`/
// `options-section` stack CLOSEST to `content` on their side (DOM order: rail, then panes outer-to-
// inner) — collapse is still WHOLE-SIDE (R2a unchanged): the paired toggle hides the rail and every
// stacked pane on its side together, never per-pane (YAGNI until a real frame needs it).
//
// Collapse (SPEC-R2): per-side toggles, HEADER-HOSTED (R2b — injected as the header row's leading/
// trailing affordances; no header ⇒ no toggles, permanent chrome is authored chrome), PAIRED restore
// (fork F1's default: one toggle drives its side's rail+pane together). State = the reflected
// `collapsed-start`/`collapsed-end` boolean props (R2d — observable + settable, so a consumer can
// persist). Narrow (<40rem container, SPEC-R4/F2): CSS auto-collapses both sides; a toggle-restored
// side overlays the canvas (super-shell.css) rather than squeezing it — and the auto state never
// writes the props, so the consumer's persisted wide-state choice survives (R4's no-clobber law).
//
// Logical direction (LLD-C4, GH #95): every side-facing name here — `data-side`, `collapsed-start/
// end`, `narrow-start/end`, `data-narrow-open` — is LOGICAL, never physical left/right. `#compose()`
// places `global-nav`/`nav-pane` FIRST in DOM order (`data-side="start"`) and `options-pane`/
// `global-options` SECOND (`data-side="end"`); `[data-part='middle']` is a plain row-flex container
// with no `flex-direction` override, so an ambient `dir="rtl"` mirrors DOM-first to the PHYSICAL
// right for free (ordinary CSS bidi — no `:dir()` selector or runtime direction read needed anywhere
// in this file or super-shell.css). "Start"/"end" here always mean "first/second in DOM order,"
// full stop, regardless of which physical side that renders on.
//
// Landmarks (LLD-C1, GH #94): every wrapper part gets a real ARIA `role` at compose time, from a
// slot→role map (header→banner, footer→contentinfo, content→main, the nav slots→navigation, the
// options slots→complementary) mirroring ui-app-shell-region's own map (ADR-0083) for cross-family
// vocabulary consistency — an independent implementation, not shared code (see the SPEC header's
// corrected "follows the pattern of" line). An authored child's `data-landmark="…"` overrides its
// slot's default, the same role-decoupled-from-placement idea ADR-0083 established.
//
// `controls → @agent-ui/components` + siblings only — never router/a2a (layering.test.ts).

import { UIElement, prop, paneResize, scrollFade, type PaneResizeHandle, type PropsSchema, type ReactiveProps } from '@agent-ui/components'
import '@agent-ui/components/controls/button'
import '@agent-ui/components/controls/icon'
import { SHELL_NARROW_BREAKPOINT_REM, SHELL_COMPACT_BREAKPOINT_REM } from '../../shell-breakpoint.ts'

const SLOTS = [
  'header',
  'global-nav', 'nav-pane', 'section-nav',
  'content',
  'options-section', 'options-pane', 'global-options',
  'footer',
] as const
type SlotName = (typeof SLOTS)[number]

// LLD-C1 (GH #94) — every slot's default ARIA landmark, keyed by slot name. Set as a real `role="…"`
// attribute directly on the plain <div> wrapper part at compose time (these wrappers are NOT custom
// elements — no ElementInternals handle exists on them — so this is the honest mechanism, unlike
// ui-app-shell-region's `internals.role`, which only a host custom element can use).
const SLOT_ROLE: Record<SlotName, string> = {
  header: 'banner',
  footer: 'contentinfo',
  content: 'main',
  'global-nav': 'navigation',
  'nav-pane': 'navigation',
  'section-nav': 'navigation',
  'global-options': 'complementary',
  'options-pane': 'complementary',
  'options-section': 'complementary',
}

// The override vocabulary — reused verbatim from ui-app-shell-region's own LANDMARK_VALUES (ADR-0083)
// for cross-family consistency, minus its own '' empty-string sentinel (here, ABSENCE of the
// data-landmark attribute is the sentinel, so '' never needs to be a legal member).
const LANDMARK_VALUES = new Set(['banner', 'navigation', 'main', 'complementary', 'contentinfo', 'region', 'form', 'search'])

/** The role a slot's wrapper part gets: the FIRST authored child's `data-landmark` override (ADR-0083's
 *  role-decoupled-from-placement precedent, data-attribute-driven since super-shell's placement is
 *  itself data-attribute-driven) if present and a real landmark value, else the slot's own default. */
function roleFor(slot: SlotName, children: readonly Element[]): string {
  const override = children[0]?.getAttribute('data-landmark')
  return override !== null && override !== undefined && LANDMARK_VALUES.has(override) ? override : SLOT_ROLE[slot]
}

const props = {
  // SPEC-R2d — the two side states, reflected so CSS keys off the host and a consumer can persist.
  // LOGICAL (LLD-C4): "start"/"end" always mean DOM-first/DOM-second, never a physical side.
  collapsedStart: { ...prop.boolean(false), reflect: true, attribute: 'collapsed-start' },
  collapsedEnd: { ...prop.boolean(false), reflect: true, attribute: 'collapsed-end' },
  // SPEC-R4 / fork F2, widened with ADR-0084's own region vocabulary: what a side does at narrow —
  // `collapse` (default: hide, overlay on toggle-restore — the frames' all-collapsed story) or
  // `stack` (stay in flow, full-width above/below the canvas — the docs site's shipped nav UX,
  // where the ui-nav-rail's OWN collapse="menu" dropdown takes over). Pure-CSS arms.
  // SPEC-R7b — widened with the 'tabs' arm (ADR-0154): a side's panes join the shell-owned
  // narrow-tabs strip instead of collapsing/stacking (mutually exclusive with collapse/stack, per side).
  narrowStart: { ...prop.enum(['collapse', 'stack', 'tabs'] as const, 'collapse'), reflect: true, attribute: 'narrow-start' },
  narrowEnd: { ...prop.enum(['collapse', 'stack', 'tabs'] as const, 'collapse'), reflect: true, attribute: 'narrow-end' },
  // SPEC-R8b (ADR-0155) — which band line auto-collapses THIS shell's collapse-MODE sides: `narrow`
  // (40rem, default — every shipped shell byte-compatible) or `compact` (52.5rem, ADR-0150's number).
  // `stack`/`tabs` sides are NOT governed by this — their reflow answers "the row is too cramped for
  // side-by-side," which stays the 40rem narrow line regardless (the per-side band read in #belowBandLine).
  collapseBand: { ...prop.enum(['narrow', 'compact'] as const, 'narrow'), reflect: true, attribute: 'collapse-band' },
  // SPEC-R6a — per-side opt-in for the INNERMOST pane only (rails/outer stacked panes stay fixed).
  resizableStart: { ...prop.boolean(false), reflect: true, attribute: 'resizable-start' },
  resizableEnd: { ...prop.boolean(false), reflect: true, attribute: 'resizable-end' },
  // SPEC-R6d — the committed size in px; `null` ⇒ the token default (--ui-super-shell-pane-size).
  sizeStart: { ...prop.number(null), reflect: true, attribute: 'size-start' },
  sizeEnd: { ...prop.number(null), reflect: true, attribute: 'size-end' },
} satisfies PropsSchema

type NarrowTab = { value: string; label: string; participant: HTMLElement; segmentIndex?: number }

export interface UISuperShellElement extends ReactiveProps<typeof props> {}
export class UISuperShellElement extends UIElement {
  static props = props

  #frame: HTMLElement | null = null
  // LLD-C1 (SPEC-R6) — the one resizable pane per side (undefined ⇒ that side has no pane, or isn't
  // opted in). Captured at compose time so the drag/keyboard handlers never re-query the DOM per event.
  #innermostPane: { start?: HTMLElement; end?: HTMLElement } = {}
  #resizeHandle: PaneResizeHandle | null = null
  // Per-drag baseline (pane's own start width + the canvas's start width, both real px) — set on the
  // FIRST onResize of a drag (commit=false, baseline null), cleared on commit. Bounding the pane's growth
  // by the canvas's OWN available slack (rather than re-deriving every other rail/pane's width) is what
  // makes R6c's two-sided clamp correct regardless of how many other rails/panes a side stacks (R5b).
  #dragBaseline: { pane: number; canvasAvail: number; paneMin: number; canvasMin: number } | null = null
  // LLD-C2 (SPEC-R7b) — the shell-owned narrow-tabs strip + its derived tab list, built once at compose
  // (build-once law) when at least one side declares `narrow-*="tabs"`.
  #narrowTabsHost: HTMLElement | null = null
  #narrowTabs: NarrowTab[] = []
  #idSeq = 0
  // LLD-C2 (SPEC-R9c/R9d) — the overlay's focus landing per side (the side's first box, tabindex=-1 at
  // compose) and the toggle that opened the current overlay (focus returns to it on close). The band
  // observer is the ONE shell-owned ResizeObserver (SPEC-R9c) — visibility-only (attributes, never a
  // reparent — the R7c survival law extends to it verbatim); it clears a stale overlay + re-syncs ARIA.
  #overlayFocusTarget: { start?: HTMLElement; end?: HTMLElement } = {}
  #openerToggle: HTMLElement | null = null
  #bandObserver: ResizeObserver | null = null
  // SPEC-R10b — the shell-owned scroll regions (pane boxes + active segments) captured ONCE at compose;
  // scrollFade is (re)wired from connected() on EVERY connect, because the trait rides host.effect (the
  // CONNECTION scope — it disposes at disconnect and must re-arm, the nav-rail.ts:106-121 `wired` precedent).
  #scrollViewports: HTMLElement[] = []

  protected connected(): void {
    this.#compose()
    // SPEC-R10b — (re)wire the scroll-fade affordance on EVERY connect: the trait rides host.effect (the
    // connection scope), so a disconnect (ADR-0082 isolation toggle, a DOM relocation) disposes it and it
    // must re-arm, else `scrollbar-width:none` would persist with no fade left as the scroll signal (the
    // nav-rail.ts:106-121 disclosure-rewire precedent). The viewport set was captured once at compose.
    for (const viewport of this.#scrollViewports) scrollFade(this, { viewport })
    this.effect(() => {
      // SPEC-R9c — aria-expanded is truthful at EVERY band, not just wide. Read both collapse signals
      // so this effect re-runs on a wide-state flip; #syncAria then derives the per-side band-aware truth
      // (below its line: `data-narrow-open === side`; above: `!collapsed`). The band observer (below) is
      // the other driver — a band crossing writes no prop, so only the RO re-fires #syncAria there.
      void this.collapsedStart
      void this.collapsedEnd
      this.#syncAria()
      // GH #205 (independent-review MAJOR-1) — a PUBLIC collapse/restore is exactly as capable of
      // pushing the row below fit as a resize is: restoring a side via its toggle can return it to a
      // row that can no longer hold it (the band-line→natural-fit window, side hidden ⇒ fits, side
      // shown ⇒ doesn't), and collapsing a side can just as easily free enough room to clear a STALE
      // auto-collapse on the OTHER side (#syncFitCollapse's reset-then-recompute handles that for
      // free). Without this call, only the next ambient host resize re-checks fit — a visible overflow
      // (or a stale auto-collapsed side + hidden toggle) would persist until then.
      this.#syncFitCollapse()
    })
    // SPEC-R6d — "observable AND settable": a consumer assigning `sizeStart`/`sizeEnd` (a persistence
    // restore) must apply onto the pane, not just reflect the attribute. #onResize/#handleResizerKeydown
    // also assign these props themselves on commit — this effect re-running then is a harmless idempotent
    // re-write of the SAME value, never a second distinct source of truth.
    this.effect(() => {
      const start = this.sizeStart
      const end = this.sizeEnd
      if (start !== null && this.#innermostPane.start) this.#innermostPane.start.style.setProperty('--ui-super-shell-pane-size-start', `${start}px`)
      if (end !== null && this.#innermostPane.end) this.#innermostPane.end.style.setProperty('--ui-super-shell-pane-size-end', `${end}px`)
      // GH #205 — a persisted committed size (a consumer restoring sizeStart/sizeEnd, no live resize
      // event involved) can itself be what pushes the row below natural fit; re-check the fit right
      // after applying it, not just on the next ambient resize/band crossing.
      this.#syncFitCollapse()
    })
    // LLD-C1 — idempotent like #compose (guarded so a reconnect never installs a second listener); the
    // trait's own outer pointerdown listener rides `host.listen`, auto-removed on disconnect.
    if (this.#resizeHandle === null) {
      this.#resizeHandle = paneResize(this, {
        separators: () => [...this.querySelectorAll<HTMLElement>('[data-part="pane-resizer"]')],
        axis: () => 'horizontal',
        rtl: () => getComputedStyle(this).direction === 'rtl',
        onResize: (index, deltaRatio, commit) => this.#onResize(index, deltaRatio, commit),
      })
    }

    // SPEC-R9c — the ONE shell-owned band-hygiene ResizeObserver: visibility-only (attributes only —
    // never a reparent, the R7c survival law), guarded like #resizeHandle so a reconnect never installs
    // a second one. It clears a stale `data-narrow-open` on leaving the OPEN side's overlay band and
    // re-syncs each toggle's aria-expanded per its OWN side's line. Feature-detected for jsdom parity.
    if (this.#bandObserver === null && typeof ResizeObserver !== 'undefined') {
      this.#bandObserver = new ResizeObserver(() => this.#onBandChange())
      this.#bandObserver.observe(this)
    }
    // SPEC-R9d — Escape dismisses an open overlay (rides the connection AbortSignal, auto-removed on
    // disconnect). Non-modal: no focus trap, only this one-key escape hatch beside the scrim + re-tap.
    this.listen(this, 'keydown', (event) => {
      if ((event as KeyboardEvent).key === 'Escape' && this.hasAttribute('data-narrow-open')) this.#closeOverlay()
    })
    // GH #205 (SPEC-R13b) — measurement-based auto-collapse, LAST so the frame/panes/toggles it reads
    // are all composed and wired first: correct on FIRST PAINT, not just after a later resize.
    this.#syncFitCollapse()
    // GH #206 (independent-review MAJOR-2) — SPEC-R6b names aria-valuenow/-valuemin/-valuemax as part
    // of the RENDERED separator, not just its post-interaction state: a freshly-mounted, never-touched
    // resizer must already carry the trio, or an SR user tabbing to it hears no value at all. AFTER
    // #syncFitCollapse (not before): an auto-collapsed side's resizer is display:none, so its pane
    // measures a genuine zero-width and #syncResizerValues' own guard correctly skips it (nothing to
    // announce on a hidden, untabbable control).
    this.#syncResizerValues()
  }

  protected override disconnected(): void {
    this.#resizeHandle?.release() // ends any in-flight drag WITHOUT a commit (the ui-split precedent)
    this.#resizeHandle = null
    this.#dragBaseline = null
    this.internals.states?.delete('dragging') // GH #185 — clear the baseline/state together, split.ts's own precedent
    this.#bandObserver?.disconnect()
    this.#bandObserver = null
  }

  /** Idempotent (the fleet's #compose law): sort the authored children into the frame ONCE. */
  #compose(): void {
    if (this.#frame) return
    const authored = new Map<SlotName, Element[]>()
    for (const slot of SLOTS) authored.set(slot, [])
    for (const child of [...this.children]) {
      const name = child.getAttribute('data-slot')
      const slot: SlotName = SLOTS.includes(name as SlotName) ? (name as SlotName) : 'content'
      authored.get(slot)!.push(child)
    }
    if (authored.get('content')!.length === 0) console.warn('ui-super-shell: no content slot authored — the one mandatory slot (SPEC-R1)')

    // SPEC-R9a — a side toggle composes ONLY when its side has authored content (no dead end-toggle on a
    // one-sided shell — GH #170 defect 2). A side's content is any of its rail/pane slots being non-empty.
    const hasContent = (slots: readonly SlotName[]): boolean => slots.some((s) => authored.get(s)!.length > 0)
    const hasStartContent = hasContent(['global-nav', 'nav-pane', 'section-nav'])
    const hasEndContent = hasContent(['options-section', 'options-pane', 'global-options'])

    const frame = document.createElement('div')
    frame.setAttribute('data-part', 'frame')

    // header row — hosts the side toggles (SPEC-R2b) around the authored header content. The content
    // is wrapped in its own `bar-content` box (flex:1 1 auto, super-shell.css) so it fills the space
    // between the two toggles by construction — a consumer's header content (e.g. the docs site's own
    // `.app-context-header`) needs no bespoke CSS of its own to stretch edge-to-edge (component-reviewer
    // finding: an un-wrapped `flex:0 0 auto` header child shrink-wraps to its own content width in
    // `[data-part='bar']`'s row-flex layout, leaving the rest of the bar visibly empty).
    const headerChildren = authored.get('header')!
    if (headerChildren.length > 0) {
      const header = document.createElement('div')
      header.setAttribute('data-part', 'bar')
      header.setAttribute('data-bar', 'header')
      header.setAttribute('role', roleFor('header', headerChildren)) // LLD-C1
      const barContent = document.createElement('div')
      barContent.setAttribute('data-part', 'bar-content')
      barContent.append(...headerChildren)
      // SPEC-R9a — only an authored side gets a toggle; bar-content (flex:1) fills whatever space the
      // present toggle(s) leave, so a one-sided shell's header is still edge-to-edge with no dead button.
      const headerParts: HTMLElement[] = []
      if (hasStartContent) headerParts.push(this.#makeToggle('start'))
      headerParts.push(barContent)
      if (hasEndContent) headerParts.push(this.#makeToggle('end'))
      header.append(...headerParts)
      frame.append(header)
    }

    // middle row — [ rail | pane* | content | pane* | rail ], absent slots contribute nothing (R1).
    // R5b (LLD-C3, GH #96): each side is an ORDERED STACK (rail outermost, panes inner-to-content) —
    // no longer one fixed rail+pane pair; the two sides compose independently (asymmetric pane counts
    // are legal, R5b). Collapse stays whole-side: every part on a side shares that side's `data-side`
    // attribute, so the existing `[data-side='start'|'end']` CSS selectors (collapse/narrow/overlay)
    // already apply to the WHOLE stack with zero CSS changes (R5d).
    const middle = document.createElement('div')
    middle.setAttribute('data-part', 'middle')
    // SPEC-R9d — the overlay scrim, composed once as the middle row's first child (like every part). CSS
    // keeps it display:none except at narrow/compact while a side is overlay-open; a tap dismisses.
    const scrim = document.createElement('div')
    scrim.setAttribute('data-part', 'scrim')
    scrim.addEventListener('click', () => this.#closeOverlay())
    middle.append(scrim)
    const place = (slot: SlotName, part: string, side?: 'start' | 'end'): HTMLElement | undefined => {
      const children = authored.get(slot)!
      if (children.length === 0) return undefined
      const box = document.createElement('div')
      box.setAttribute('data-part', part)
      box.setAttribute('data-slot-name', slot)
      box.setAttribute('role', roleFor(slot, children)) // LLD-C1
      if (side) box.setAttribute('data-side', side)
      box.append(...children)
      if (part === 'pane') this.#applySegments(box) // SPEC-R7a — a no-op when no child carries data-segment
      middle.append(box)
      return box
    }
    const startStack: ReadonlyArray<readonly [SlotName, string]> = [
      ['global-nav', 'rail'],
      ['nav-pane', 'pane'],
      ['section-nav', 'pane'],
    ]
    const endStack: ReadonlyArray<readonly [SlotName, string]> = [
      ['options-section', 'pane'],
      ['options-pane', 'pane'],
      ['global-options', 'rail'],
    ]
    // R5b's DOM order (rail outermost, panes inner-to-content) means the LAST pane a side's loop places
    // is the one adjacent to content — the innermost, and the only one R6a allows to be resizable.
    const startPaneBoxes: HTMLElement[] = []
    let startFirstBox: HTMLElement | undefined // the side's first box in DOM order — the overlay focus landing (R9d)
    for (const [slot, part] of startStack) {
      const box = place(slot, part, 'start')
      if (box) { startFirstBox ??= box; if (part === 'pane') startPaneBoxes.push(box) }
    }
    // SPEC-R6b — the resizer sits directly adjacent to canvas, so it is ALWAYS the innermost pane's own
    // separator regardless of how many outer panes/rails the side stacks (R5b's asymmetric-count case).
    // `#innermostPane` is assigned BEFORE `#makeResizer` runs (code-reviewer MAJOR fix) — the resizer's
    // own aria-controls/id-minting reads it at creation time, not after.
    this.#innermostPane.start = startPaneBoxes.at(-1)
    if (this.resizableStart && startPaneBoxes.length > 0) middle.append(this.#makeResizer('start'))
    const canvasBox = place('content', 'canvas')
    const endPaneBoxes: HTMLElement[] = []
    let endFirstBox: HTMLElement | undefined // the end side's first box post-canvas — its overlay focus landing (R9d)
    for (const [slot, part] of endStack) {
      const box = place(slot, part, 'end')
      if (box) { endFirstBox ??= box; if (part === 'pane') endPaneBoxes.push(box) }
    }
    this.#innermostPane.end = endPaneBoxes[0] // options-section (if present) is placed FIRST post-canvas
    if (this.resizableEnd && endPaneBoxes.length > 0) {
      // Inserted AFTER the end panes above (wrong DOM order) then moved into place — endPaneBoxes[0] is
      // the innermost, adjacent to canvas, so the resizer belongs directly before it.
      middle.insertBefore(this.#makeResizer('end'), endPaneBoxes[0]!)
    }
    // SPEC-R9d — the overlay's focus landing per side (its first box); `tabindex="-1"` makes it
    // programmatically focusable without joining the tab order (a non-modal drawer, ADR-0155 clause 2).
    if (startFirstBox) { startFirstBox.setAttribute('tabindex', '-1'); this.#overlayFocusTarget.start = startFirstBox }
    if (endFirstBox) { endFirstBox.setAttribute('tabindex', '-1'); this.#overlayFocusTarget.end = endFirstBox }
    frame.append(middle)
    this.#buildNarrowTabs(frame, canvasBox, startPaneBoxes, endPaneBoxes)

    // SPEC-R10b — capture the shell-owned scroll regions ONCE (the scrollFade wiring itself happens in
    // connected(), re-armed every connect — the trait is connection-scoped, see #scrollViewports). A
    // segmented pane's SEGMENTS are the live viewports (each `overflow-y:auto` when active); a plain pane
    // box is its own viewport. The trait's own observers no-op on a display:none (collapsed) box.
    for (const box of [...startPaneBoxes, ...endPaneBoxes]) {
      if (box.hasAttribute('data-segmented')) {
        this.#scrollViewports.push(...box.querySelectorAll<HTMLElement>(':scope > [data-segment]'))
      } else {
        this.#scrollViewports.push(box)
      }
    }

    // Footer has no toggles (SPEC-R2c: header/footer are permanent chrome) — but its content gets the
    // SAME bar-content flex:1 wrapper, so a footer authored the same way as a header behaves identically.
    const footerChildren = authored.get('footer')!
    if (footerChildren.length > 0) {
      const footer = document.createElement('div')
      footer.setAttribute('data-part', 'bar')
      footer.setAttribute('data-bar', 'footer')
      footer.setAttribute('role', roleFor('footer', footerChildren)) // LLD-C1
      const barContent = document.createElement('div')
      barContent.setAttribute('data-part', 'bar-content')
      barContent.append(...footerChildren)
      footer.append(barContent)
      frame.append(footer)
    }

    this.append(frame)
    this.#frame = frame
  }

  /** One header-hosted side toggle (SPEC-R2b) — flips its side's reflected state; paired restore
   *  (F1: the rail+pane pair rides ONE state, realized in CSS off the host attribute). `side` is
   *  LOGICAL (LLD-C4): no physical left/right anywhere in this method — DOM order + the browser's
   *  own bidi reversal place the button and its rail/pane on the correct physical side under RTL. */
  #makeToggle(side: 'start' | 'end'): HTMLElement {
    const button = document.createElement('ui-button')
    button.setAttribute('variant', 'ghost')
    button.setAttribute('icon-only', '') // button.md's icon-only-button idiom (the toast.ts close-button
    // precedent) — WITHOUT this the button reserves a dead 1fr label track and renders non-square/
    // near-invisible against the bar (the regression a real browser screenshot caught, GH #90).
    button.setAttribute('data-part', 'side-toggle')
    button.setAttribute('data-side', side)
    button.setAttribute('aria-label', side === 'start' ? 'Toggle start panes' : 'Toggle end panes')
    // SPEC-R9b — BOTH glyphs composed in the leading cell (icon-only's single square column, button.md):
    // `list` (menu, shown by default) + `x` (close). CSS swaps their visibility off the host's
    // `data-narrow-open` INSIDE the band container query, so the X is band-correct by construction — a
    // stale attribute can never paint an X at wide, with or without JS. Only one paints at a time (the
    // other is display:none, removed from the grid), so the two children share the one column cleanly.
    for (const [glyph, role] of [['list', 'menu'], ['x', 'close']] as const) {
      const icon = document.createElement('ui-icon')
      icon.setAttribute('slot', 'leading') // the icon-only anatomy's ONE adornment cell (button.md)
      icon.setAttribute('data-role', 'icon')
      icon.setAttribute('glyph', glyph)
      icon.setAttribute('data-glyph', role)
      button.append(icon)
    }
    button.addEventListener('click', () => {
      // SPEC-R9 — below its OWN band line a `collapse`-mode side drives the one-at-a-time OVERLAY state
      // (the no-clobber law: a narrow/compact visit never rewrites the persisted wide choice). A
      // `stack`/`tabs` side's toggle is CSS-hidden below the 40rem line (R9a), and above the line every
      // side takes the wide arm — so the below-line arm only ever runs for a collapse side (the old
      // `tabs` no-op guard + the stack-conflict overlay arm are now unreachable and gone).
      const narrowArm = side === 'start' ? this.narrowStart : this.narrowEnd
      if (narrowArm === 'collapse' && this.#belowBandLine(side)) {
        if (this.getAttribute('data-narrow-open') === side) this.#closeOverlay()
        else this.#openOverlay(side)
        return
      }
      if (side === 'start') this.collapsedStart = !this.collapsedStart
      else this.collapsedEnd = !this.collapsedEnd
    })
    return button
  }

  // ── SPEC-R9: the band-read + overlay/ARIA state (the ONE JS band source of truth) ─────────────────

  /** SPEC-R9c — the ONLY JS band read: is the host below the line that governs THIS side? A `collapse`
   *  side uses the shell's `collapse-band` line (40 or 52.5rem); a `stack`/`tabs` side ALWAYS uses the
   *  40rem narrow line (SPEC-R8b — those sides are not governed by `collapse-band`). Derived from
   *  shell-breakpoint.ts's rem constants × the live root font-size, so px ≠ rem under a non-16px root is
   *  handled correctly (the raw `< 640` literal this replaces was the GH #170 defect 4 drift). The
   *  `width > 0` guard keeps jsdom (0-width rects) on the wide arm, matching the shipped unit-test model. */
  #belowBandLine(side: 'start' | 'end'): boolean {
    const arm = side === 'start' ? this.narrowStart : this.narrowEnd
    const lineRem = arm === 'collapse' && this.collapseBand === 'compact' ? SHELL_COMPACT_BREAKPOINT_REM : SHELL_NARROW_BREAKPOINT_REM
    const rootFontPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
    const width = this.getBoundingClientRect().width
    return width > 0 && width < lineRem * rootFontPx
  }

  /** SPEC-R9d — open a side's narrow/compact overlay: set the single-value `data-narrow-open`, remember
   *  the opener toggle (focus returns to it on close), move focus to the side's landing box, re-sync ARIA. */
  #openOverlay(side: 'start' | 'end'): void {
    this.setAttribute('data-narrow-open', side)
    this.#openerToggle = this.querySelector<HTMLElement>(`[data-part="side-toggle"][data-side="${side}"]`)
    this.#overlayFocusTarget[side]?.focus()
    this.#syncAria()
  }

  /** SPEC-R9d — dismiss the open overlay (toggle re-tap, scrim tap, or Escape all route here): clear
   *  `data-narrow-open`, return focus to the opener toggle, re-sync ARIA. Idempotent when nothing is open. */
  #closeOverlay(): void {
    if (!this.hasAttribute('data-narrow-open')) return
    this.removeAttribute('data-narrow-open')
    this.#openerToggle?.focus()
    this.#openerToggle = null
    this.#syncAria()
  }

  /** SPEC-R9c — the band-hygiene RO callback: if a side is overlay-open but the host is no longer below
   *  THAT side's line (a resize back up past the band), clear the stale overlay; then re-sync ARIA.
   *  GH #205 — every resize is also a fit re-check (the row's natural-fit arithmetic is a function of
   *  live width, so a passive resize is exactly when the auto-collapse decision can flip either way). */
  #onBandChange(): void {
    const open = this.getAttribute('data-narrow-open') as 'start' | 'end' | null
    if (open && !this.#belowBandLine(open)) this.#closeOverlay()
    else this.#syncAria()
    this.#syncFitCollapse()
  }

  // ── SPEC-R13b: measurement-based auto-collapse (GH #205) ──────────────────────────────────────────

  /** GH #205 (SPEC-R13b) — fills the strictly-ABOVE-the-band-line gap R13a/R13b named: a `collapse`-mode
   *  side whose fixed geometry (plus every other visible box + the canvas floor) doesn't fit the row at
   *  its CURRENT live width auto-collapses, so R2e's no-overflow law holds unconditionally rather than
   *  only "at or above natural fit" (the interim AC20 qualification this build retires). Measurement-
   *  based, not compile-time band arithmetic — natural fit varies per authored configuration and any
   *  consumer token override, and a `@container` condition can't take a `var()` operand to express it.
   *
   *  Internal, NON-reflected attributes (`data-auto-collapsed-start`/`-end`) — deliberately NEVER the
   *  public `collapsed-start`/`-end` props: this is ambient, JS-decided fallback layout, not a user
   *  choice, and must never masquerade as one (persisted state, `sizeStart`/`sizeEnd` round-trips,
   *  etc. must never see it). CSS hides the side (and its toggle — no overlay-restore affordance: a
   *  restored side has nowhere to go but back to not fitting, the R9a "no dead toggle" precedent) purely
   *  off these attributes, unconditionally (no `@container` — JS already decided).
   *
   *  Reset-then-recompute EACH call (idempotent under repeat RO/effect firings): both sides are always
   *  re-examined from a clean slate, `end` first (the file's start-primacy convention read backwards —
   *  R9's own DOM order places `end` second, so it is the first one asked to yield). Only a side whose
   *  narrow arm is `collapse` AND that is not ALREADY hidden by the existing CSS band mechanism
   *  (`#belowBandLine`) is a candidate — `stack`/`tabs` semantics and the below-the-line case are both
   *  untouched, unrelated mechanisms (R4/R8). */
  #syncFitCollapse(): void {
    const middle = this.#frame?.querySelector<HTMLElement>('[data-part="middle"]')
    if (!middle) return
    this.removeAttribute('data-auto-collapsed-start')
    this.removeAttribute('data-auto-collapsed-end')
    for (const side of ['end', 'start'] as const) {
      const arm = side === 'start' ? this.narrowStart : this.narrowEnd
      if (arm !== 'collapse' || this.#belowBandLine(side)) continue
      // Re-measured live on EVERY iteration (never a stale snapshot): collapsing `end` above may
      // already have resolved the overflow, so `start` is asked again against the NOW-current layout —
      // this is the escalation-only-if-needed law, not a fixed two-side rule.
      if (middle.scrollWidth > middle.clientWidth + 1) this.setAttribute(`data-auto-collapsed-${side}`, '')
    }
  }

  /** SPEC-R9c — aria-expanded truthful per band, per side: below its line it tracks `data-narrow-open`;
   *  above it, the wide `!collapsed` effect. Attributes only (the R7c visibility-only survival law). */
  #syncAria(): void {
    const narrowOpen = this.getAttribute('data-narrow-open')
    for (const side of ['start', 'end'] as const) {
      const toggle = this.querySelector<HTMLElement>(`[data-part="side-toggle"][data-side="${side}"]`)
      if (!toggle) continue
      const collapsed = side === 'start' ? this.collapsedStart : this.collapsedEnd
      const expanded = this.#belowBandLine(side) ? narrowOpen === side : !collapsed
      toggle.setAttribute('aria-expanded', String(expanded))
    }
  }

  // ── SPEC-R6: the resizable inner pane ──────────────────────────────────────────────────────────

  /** One resize separator (SPEC-R6b) — `data-separator` is the pane-resize trait's own discovery
   *  selector; `aria-controls` references the pane box's id (minted if the box has none yet). */
  #makeResizer(side: 'start' | 'end'): HTMLElement {
    const pane = side === 'start' ? this.#innermostPane.start : this.#innermostPane.end
    if (pane && !pane.id) pane.id = this.#nextId('pane')
    const el = document.createElement('div')
    el.setAttribute('data-part', 'pane-resizer')
    el.setAttribute('data-side', side)
    el.setAttribute('data-separator', '')
    el.setAttribute('role', 'separator')
    el.setAttribute('aria-orientation', 'vertical')
    el.setAttribute('tabindex', '0')
    el.setAttribute('aria-label', side === 'start' ? 'Resize start pane' : 'Resize end pane')
    if (pane?.id) el.setAttribute('aria-controls', pane.id)
    el.addEventListener('keydown', (event) => this.#handleResizerKeydown(event as KeyboardEvent, side))
    return el
  }

  /** The pane-resize trait's onResize callback. `deltaRatio` is measured since the press point against
   *  the HOST's own live extent (pane-resize.ts); re-expanding it by the host's CURRENT width recovers a
   *  real px delta. The FIRST call of a drag (baseline null) snapshots the pane's and canvas's own
   *  current widths — R6c's bounds are expressed against the canvas's OWN available slack, not by
   *  re-deriving every other rail/pane's width, so the clamp is correct regardless of how many other
   *  boxes a side stacks (R5b). */
  #onResize(index: number, deltaRatio: number, commit: boolean): void {
    const separators = [...this.querySelectorAll<HTMLElement>('[data-part="pane-resizer"]')]
    const sep = separators[index]
    const side = sep?.dataset.side as 'start' | 'end' | undefined
    const pane = side === 'start' ? this.#innermostPane.start : side === 'end' ? this.#innermostPane.end : undefined
    const canvas = this.#frame?.querySelector<HTMLElement>('[data-part="canvas"]')
    if (!side || !pane || !canvas) return

    // A moveless click (pointerdown → pointerup/lostpointercapture with zero pointermoves between —
    // pane-resize.ts's own commitEnd fires unconditionally) reaches here with the baseline still null
    // AND commit already true: a real drag always calls at least one commit=false pointermove first, so
    // this combination only ever means nothing moved — skip the commit below rather than firing a
    // spurious `change` for an unchanged size.
    const isMovelessClick = this.#dragBaseline === null && commit
    if (this.#dragBaseline === null) {
      this.#dragBaseline = {
        pane: pane.getBoundingClientRect().width,
        canvasAvail: canvas.getBoundingClientRect().width,
        paneMin: this.#resolvePx('--ui-super-shell-pane-min-size', 162),
        canvasMin: this.#resolvePx('--ui-super-shell-canvas-min-size', 162),
      }
      // GH #185 (parity gap a) — mirrors split.ts's #applyPointerDelta exactly: armed on the drag's
      // first live move (baseline null → set), cleared on commit below. super-shell.css's
      // `:scope:state(dragging) [data-part='pane-resizer']` keeps the hover/drag fill live for the
      // WHOLE gesture even once the pointer sweeps off the thin resizer box.
      this.internals.states?.add('dragging')
    }
    const hostWidth = this.getBoundingClientRect().width
    const rawDeltaPx = deltaRatio * hostWidth
    const signedDeltaPx = side === 'start' ? rawDeltaPx : -rawDeltaPx
    const newSize = this.#clampPaneSize(this.#dragBaseline.pane + signedDeltaPx, this.#dragBaseline)

    pane.style.setProperty(`--ui-super-shell-pane-size-${side}`, `${newSize}px`)
    sep?.setAttribute('aria-valuenow', String(Math.round(newSize)))
    // GH #206 (SPEC-R6b) — valuemin/-max alongside valuenow, same rounding, resolved off the SAME
    // drag baseline the clamp above already used (#maxPaneSize mirrors #clampPaneSize's own bound).
    sep?.setAttribute('aria-valuemin', String(Math.round(this.#dragBaseline.paneMin)))
    sep?.setAttribute('aria-valuemax', String(Math.round(this.#maxPaneSize(this.#dragBaseline))))
    if (commit) {
      this.#dragBaseline = null
      this.internals.states?.delete('dragging')
      if (!isMovelessClick) {
        if (side === 'start') this.sizeStart = newSize
        else this.sizeEnd = newSize
        this.emit('change')
      }
    }
  }

  /** Arrow keys step by one module (SPEC-R6b); Home/End jump straight to the resolved bounds (R6c) —
   *  each keypress is both the live update and the commit in one atomic action (the ui-split keyboard
   *  precedent), so no drag baseline is needed here. Growing the END pane is the physical MIRROR of
   *  growing the START pane (dragging the end separator LEFT grows it, matching #onResize's own
   *  `side === 'start' ? +delta : -delta` convention) — the key mapping inverts by side, THEN by RTL. */
  #handleResizerKeydown(event: KeyboardEvent, side: 'start' | 'end'): void {
    const pane = side === 'start' ? this.#innermostPane.start : this.#innermostPane.end
    const canvas = this.#frame?.querySelector<HTMLElement>('[data-part="canvas"]')
    if (!pane || !canvas) return
    const rtl = getComputedStyle(this).direction === 'rtl'
    const growsRight = side === 'start' ? !rtl : rtl
    const growKey = growsRight ? 'ArrowRight' : 'ArrowLeft'
    const shrinkKey = growsRight ? 'ArrowLeft' : 'ArrowRight'
    const module = this.#resolvePx('--ui-super-shell-module', 18)
    const current = pane.getBoundingClientRect().width
    const baseline = {
      pane: current,
      canvasAvail: canvas.getBoundingClientRect().width,
      paneMin: this.#resolvePx('--ui-super-shell-pane-min-size', 162),
      canvasMin: this.#resolvePx('--ui-super-shell-canvas-min-size', 162),
    }

    let next: number | null = null
    switch (event.key) {
      case growKey: next = current + module; break
      case shrinkKey: next = current - module; break
      case 'Home': next = -Infinity; break // clamp drives it straight to the pane minimum
      case 'End': next = Infinity; break // clamp drives it straight to the pane maximum
      default: return
    }
    event.preventDefault()
    const clamped = this.#clampPaneSize(next, baseline)
    pane.style.setProperty(`--ui-super-shell-pane-size-${side}`, `${clamped}px`)
    const sep = event.currentTarget as HTMLElement
    sep.setAttribute('aria-valuenow', String(Math.round(clamped)))
    // GH #206 (SPEC-R6b) — valuemin/-max alongside valuenow, same rounding, off this keypress's OWN
    // freshly-measured baseline (mirrors #onResize's drag-baseline write above).
    sep.setAttribute('aria-valuemin', String(Math.round(baseline.paneMin)))
    sep.setAttribute('aria-valuemax', String(Math.round(this.#maxPaneSize(baseline))))
    if (side === 'start') this.sizeStart = clamped
    else this.sizeEnd = clamped
    this.emit('change')
  }

  /** GH #206 — the upper bound half of R6c's clamp, extracted so the aria-valuemax write sites (#onResize,
   *  #handleResizerKeydown) can report the SAME resolved max the clamp below enforces, never a re-derived
   *  or approximate one. What the canvas's OWN token floor leaves available, measured from `baseline`. */
  #maxPaneSize(baseline: { pane: number; canvasAvail: number; canvasMin: number }): number {
    return baseline.pane + (baseline.canvasAvail - baseline.canvasMin)
  }

  /** R6c's two-sided clamp: the pane never shrinks below its own token floor, and never grows past
   *  what the canvas's OWN token floor leaves available (measured from `baseline`, a real-px snapshot
   *  taken once per drag/keypress — never re-derived from every other rail/pane on the side). `paneMin`/
   *  `canvasMin` are resolved once into `baseline` at that same snapshot point (not re-probed here on
   *  every pointermove of a drag — `#resolvePx` forces a throwaway-element layout each call). */
  #clampPaneSize(want: number, baseline: { pane: number; canvasAvail: number; paneMin: number; canvasMin: number }): number {
    return Math.min(this.#maxPaneSize(baseline), Math.max(baseline.paneMin, want))
  }

  /** GH #206 (independent-review MAJOR-2, SPEC-R6b) — the trio is part of the RENDERED separator's
   *  contract, not just its post-interaction state (#onResize/#handleResizerKeydown only ever write it
   *  on a live drag/keypress). Called once, at rest (end of connected(), after #syncFitCollapse so an
   *  auto-collapsed side's now-hidden resizer is correctly skipped). Width>0-guarded like every other
   *  measurement read in this file, so jsdom's zero-width layout (or a genuinely display:none side)
   *  never writes a garbage/misleading zero. */
  #syncResizerValues(): void {
    for (const side of ['start', 'end'] as const) {
      const sep = this.#frame?.querySelector<HTMLElement>(`[data-part="pane-resizer"][data-side="${side}"]`)
      const pane = side === 'start' ? this.#innermostPane.start : this.#innermostPane.end
      const canvas = this.#frame?.querySelector<HTMLElement>('[data-part="canvas"]')
      if (!sep || !pane || !canvas) continue
      const paneWidth = pane.getBoundingClientRect().width
      if (paneWidth <= 0) continue // jsdom, or a genuinely hidden (collapsed/auto-collapsed) side
      const baseline = {
        pane: paneWidth,
        canvasAvail: canvas.getBoundingClientRect().width,
        paneMin: this.#resolvePx('--ui-super-shell-pane-min-size', 162),
        canvasMin: this.#resolvePx('--ui-super-shell-canvas-min-size', 162),
      }
      sep.setAttribute('aria-valuenow', String(Math.round(paneWidth)))
      sep.setAttribute('aria-valuemin', String(Math.round(baseline.paneMin)))
      sep.setAttribute('aria-valuemax', String(Math.round(this.#maxPaneSize(baseline))))
    }
  }

  /** Resolves a length custom property to a real px number — `--ui-super-shell-*` tokens are `calc()`
   *  expressions the browser does not resolve through a bare `getComputedStyle().getPropertyValue()`
   *  read (unlike a real layout property). A throwaway probe applies the var to `inline-size`, which
   *  the browser DOES resolve concretely (the `min-inline-size` reads elsewhere in this fleet's own
   *  bounds-checking code, `ui-split`'s precedent, use the same trick against a real property instead). */
  #resolvePx(varName: string, fallbackPx: number): number {
    const probe = document.createElement('div')
    probe.style.position = 'absolute'
    probe.style.visibility = 'hidden'
    probe.style.inlineSize = `var(${varName})`
    this.append(probe)
    const px = probe.getBoundingClientRect().width
    probe.remove()
    return px > 0 ? px : fallbackPx
  }

  #nextId(prefix: string): string {
    this.#idSeq += 1
    return `ui-super-shell-${prefix}-${this.#idSeq}`
  }

  // ── SPEC-R7a: pane segments (wide) ──────────────────────────────────────────────────────────────

  /** A no-op unless the pane's authored children carry `data-segment` (R7a). Builds the pane-local
   *  `[data-part='pane-tabs']` strip once, at compose (the build-once law), and activates the first
   *  segment by default. */
  #applySegments(box: HTMLElement): void {
    const segments = [...box.children].filter((c) => c.hasAttribute('data-segment'))
    if (segments.length === 0) return
    box.setAttribute('data-segmented', '')
    const strip = document.createElement('div')
    strip.setAttribute('data-part', 'pane-tabs')
    strip.setAttribute('role', 'tablist')
    segments.forEach((seg, i) => {
      if (!seg.id) seg.id = this.#nextId('segment')
      const tab = document.createElement('ui-button')
      tab.setAttribute('variant', 'ghost')
      tab.setAttribute('data-part', 'pane-tab')
      tab.setAttribute('role', 'tab')
      tab.setAttribute('aria-controls', seg.id)
      tab.setAttribute('aria-selected', i === 0 ? 'true' : 'false')
      tab.textContent = seg.getAttribute('data-segment') ?? `Segment ${i + 1}`
      tab.addEventListener('click', () => this.#setActiveSegment(box, i))
      strip.append(tab)
    })
    box.prepend(strip)
    this.#setActiveSegment(box, 0)
  }

  /** The ONE mechanism both the wide pane-tabs strip and a narrow-tabs segment selection drive (SPEC-R7c
   *  — visibility-only, never a reparent): sets `data-active` on the addressed segment, clears it from
   *  its siblings, and syncs the strip's `aria-selected`. */
  #setActiveSegment(box: HTMLElement, index: number): void {
    const segments = [...box.querySelectorAll(':scope > [data-segment]')]
    const clamped = Math.max(0, Math.min(index, segments.length - 1))
    for (const s of segments) s.removeAttribute('data-active')
    segments[clamped]?.setAttribute('data-active', '')
    box.setAttribute('data-active-segment', String(clamped))
    const strip = box.querySelector(':scope > [data-part="pane-tabs"]')
    if (strip) for (const [i, tabEl] of [...strip.children].entries()) tabEl.setAttribute('aria-selected', String(i === clamped))
  }

  // ── SPEC-R7b: the shell-owned narrow-tabs strip ────────────────────────────────────────────────────

  /** Composed ONCE (build-once law) when at least one side declares `narrow-*='tabs'` — content always
   *  first, then each `tabs`-side's panes in DOM order, a segmented pane flattening to one tab per
   *  segment (R7b — reproduces agent-admin's Chat/Settings/Context trio structurally). A no-op when
   *  neither side opts in — sides on `collapse`/`stack` keep their existing R4 behavior untouched. */
  #buildNarrowTabs(frame: HTMLElement, canvasBox: HTMLElement | undefined, startPaneBoxes: HTMLElement[], endPaneBoxes: HTMLElement[]): void {
    const wantsStart = this.narrowStart === 'tabs' && startPaneBoxes.length > 0
    const wantsEnd = this.narrowEnd === 'tabs' && endPaneBoxes.length > 0
    if (!wantsStart && !wantsEnd || !canvasBox) return

    const tabs: NarrowTab[] = []
    canvasBox.setAttribute('data-narrow-tab-target', '')
    tabs.push({ value: 'content', label: canvasBox.firstElementChild?.getAttribute('data-tab-label') ?? 'Content', participant: canvasBox })

    const addSideTabs = (boxes: HTMLElement[]): void => {
      for (const box of boxes) {
        box.setAttribute('data-narrow-tab-target', '')
        const slot = box.getAttribute('data-slot-name')!
        const segments = [...box.querySelectorAll(':scope > [data-segment]')]
        if (segments.length > 0) {
          segments.forEach((seg, i) => {
            tabs.push({ value: `${slot}:${i}`, label: seg.getAttribute('data-segment') ?? `Segment ${i + 1}`, participant: box, segmentIndex: i })
          })
        } else {
          tabs.push({ value: slot, label: box.firstElementChild?.getAttribute('data-tab-label') ?? slot, participant: box })
        }
      }
    }
    if (wantsStart) addSideTabs(startPaneBoxes)
    if (wantsEnd) addSideTabs(endPaneBoxes)

    const strip = document.createElement('div')
    strip.setAttribute('data-part', 'narrow-tabs')
    strip.setAttribute('role', 'tablist')
    for (const t of tabs) {
      const btn = document.createElement('ui-button')
      btn.setAttribute('variant', 'ghost')
      btn.setAttribute('data-part', 'narrow-tab')
      btn.setAttribute('role', 'tab')
      btn.setAttribute('aria-selected', String(t.value === 'content'))
      btn.textContent = t.label
      btn.addEventListener('click', () => this.#selectNarrowTab(t.value))
      strip.append(btn)
    }
    frame.querySelector('[data-part="middle"]')!.before(strip)
    this.#narrowTabsHost = strip
    this.#narrowTabs = tabs
    this.setAttribute('data-narrow-tab', 'content')
    canvasBox.setAttribute('data-narrow-active', '') // content is the always-legal default selection
  }

  /** Selects one narrow tab (content, a plain pane, or `{slot}:{i}` for one segment) — visibility-only
   *  (R7c): moves `data-narrow-active` between participants, syncs the strip's `aria-selected`, and — for
   *  a segment tab — drives the SAME `#setActiveSegment` the wide strip uses, so a wide↔narrow crossing
   *  never disagrees about which segment is current. */
  #selectNarrowTab(value: string): void {
    const tab = this.#narrowTabs.find((t) => t.value === value)
    if (!tab) return
    this.setAttribute('data-narrow-tab', value)
    for (const t of this.#narrowTabs) t.participant.removeAttribute('data-narrow-active')
    tab.participant.setAttribute('data-narrow-active', '')
    if (tab.segmentIndex !== undefined) this.#setActiveSegment(tab.participant, tab.segmentIndex)
    if (this.#narrowTabsHost) {
      for (const [i, tabEl] of [...this.#narrowTabsHost.children].entries()) tabEl.setAttribute('aria-selected', String(this.#narrowTabs[i] === tab))
    }
  }
}

if (!customElements.get('ui-super-shell')) customElements.define('ui-super-shell', UISuperShellElement)
