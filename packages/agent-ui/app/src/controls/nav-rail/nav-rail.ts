// nav-rail.ts — UINavRailElement, the unified nav-rail family coordinator (ADR-0130; SPEC nav-rail-
// family.spec.md SPEC-R1/R2/R3/R5/R8; LLD nav-rail-family.lld.md LLD-C1). Importing this module registers
// all three family tags (it imports nav-rail-group.ts / nav-rail-item.ts), the `ui-tabs` "one entry
// registers the compound" precedent.
//
// `UIElement` (structural — NOT `UIFormElement`; the rail itself carries no value, only its items commit
// selections upward as events). Host-as-list: `render()` stays the inherited void; children (`ui-nav-rail-
// group`/`ui-nav-rail-item`) render themselves, the rail only derives shared coordination state from them.
//
// Role derivation (SPEC-R3, ADR-0130 cl.4) — a connected() effect wraps a `MutationObserver` on the rail's
// subtree (childList + the `href` attribute — the ONLY structural facts role derivation depends on) so
// LATER-added children re-derive too (SPEC-R2 AC2): every descendant `ui-nav-rail-item` link-shaped
// (non-empty `href`) ⇒ `role=navigation`; every one bare (empty `href`) ⇒ `role=tablist` (each item stamps
// its OWN `role=tab` on ITS OWN activator — LLD-C3 — no cross-element internals reach needed here). A
// mixed or empty rail defaults to `navigation` (SPEC §7 non-goal, never throws).
//
// Selection commit (SPEC-R3/R2) — ONE delegated `click` listener on the host: a bare (button-shaped)
// item's activation sets its `selected`, clears siblings, and emits the rail's own `select`/`change`
// (never intercepting a link-shaped item's native navigation — no `preventDefault`, the `href` check gates
// it out entirely).
//
// `collapse="icon-popover"` one-open-at-a-time coordination (SPEC-R8 AC3, ADR-0130 cl.6) — listens for
// `toggle` bubbling from any descendant `ui-menu` (each group's own composed flyout, nav-rail-group.ts) and
// closes every OTHER open one — the `ui-radio-group` sibling-clearing precedent applied to overlay state.
//
// `collapse="menu"` narrow flyout (SPEC-R5/AC3, LLD-C4; GH #368) — a plain `<button data-part="trigger">`
// plus a `[data-part="list"]` panel wired through the fleet's ONE overlay mechanism, `overlay()`
// (ADR-0043/0045): the panel is a TOP-LAYER `popover=auto`, so no clipping/stacking ancestor can trap it
// (the GH #260 class) and dismissal (Escape, outside-click) is PLATFORM-owned — this control hand-rolls
// neither. The `ui-popover` precedent, not `ui-menu`: the two arms diverge in CONTENT MODEL only
// (`icon-popover` flattens one group into a composed `ui-menu`; this arm carries the WHOLE grouped rail —
// context-label headings + name|tag rows — which `ui-menu`'s menuitem model cannot express), so the trait
// is called DIRECTLY on this control's own panel part.
//
// The threshold bridge (GH #368) — the panel is only ARMED as an overlay below the `@container` collapse
// line. `overlay()` has no disarm path of its own (it sets the `popover` attribute once, at :165, and
// `cleanup()` clears neither that attribute nor the six inline styles `position()` writes at :189-194), so
// `#armMenu`/`#disarmMenu` below own that seam explicitly and the wide arm stays byte-clean (no stranded
// `popover`, no inline-style residue). The band is read from the SAME box the `@container
// ui-nav-rail-collapse` query resolves against — see `#resolveCollapseContainer`.
//
// `controls → @agent-ui/components` (incl. `ui-menu`, transitively via nav-rail-group.ts) only — NEVER
// `ui-master-detail`/`@agent-ui/router` (SPEC §5 layering gate; `collapse="drill-in"` contributes anatomy
// ONLY, the consumer composes `ui-master-detail`, ADR-0130 cl.5).
//
// `collapseContainer` (TKT-0035) — the `collapse="menu"` `@container` threshold's WHICH-BOX seam: 'self'
// (default) measures the rail's own inline-size (unchanged); 'ancestor' relinquishes it to a named
// `@container ui-nav-rail-collapse` a consumer opts an ancestor into — the narrow-sidebar escape hatch (a
// docs-nav-column rail can track the shell/viewport instead of its own ~15rem box). The CSS half lives in
// nav-rail.css; since GH #368 the same seam also picks WHICH box the JS band observer watches, so the two
// halves can never disagree (`#resolveCollapseContainer`).

import { UIElement, prop, type PropsSchema, type ReactiveProps } from '@agent-ui/components'
// The Overlay controller rides its OWN declared subpath, not the root barrel: re-exporting it there
// measured +945 B gz on the reactive+dom foundation row every consumer pays for (7442 → 8387 against a
// 7680 B gz budget, GH #368). Same shape as the `controls/menu` import below.
import { overlay } from '@agent-ui/components/traits/overlay'
import type { UIMenuElement } from '@agent-ui/components/controls/menu'
import { SHELL_NARROW_BREAKPOINT_REM } from '../../shell-breakpoint.ts'
import './nav-rail-group.ts'
import { UINavRailItemElement } from './nav-rail-item.ts'

// 'menu' leads = the enum-fallback default (ADR-0130 cl.2). 'none' (GH #170/ADR-0155) = a plain,
// never-collapsing vertical rail: no disclosure, no icon-popover, no drill-in anatomy — for a consumer
// (e.g. the docs site, whose SHELL now owns the narrow hide/overlay) that wants the rail's wide vertical
// list at EVERY band. The `if (this.collapse !== 'menu') return` disclosure guard already skips 'none';
// the icon-popover/drill-in arms are CSS-keyed to their own `[collapse=…]`, so 'none' renders bare.
const COLLAPSE_VALUES = ['menu', 'drill-in', 'icon-popover', 'none'] as const

// `collapseContainer` (TKT-0035) — an orthogonal axis from `collapse`: WHICH box the `collapse="menu"`
// `@container` query measures. 'self' (default, byte-identical to pre-TKT-0035 behaviour) — the rail
// measures its OWN inline-size, the right default for a full-width rail. 'ancestor' — the rail relinquishes
// its own containment (nav-rail.css `:scope[collapse-container='ancestor'] { container-type: normal }`) so
// the NAMED `@container ui-nav-rail-collapse (…)` query walks up to the nearest ancestor the CONSUMER has
// opted in via `container-type: inline-size; container-name: ui-nav-rail-collapse` — the supported seam for
// a narrow-sidebar rail (e.g. a ~15rem docs nav column) whose collapse should track the shell/viewport, not
// its own box. Pure-CSS (attribute-selector consumption only, nav-rail.css) — no `.ts` behaviour here.
const COLLAPSE_CONTAINER_VALUES = ['self', 'ancestor'] as const

// The NAMED `@container` this family's collapse threshold queries (nav-rail.css `:scope`). The JS band
// observer resolves the very same name over COMPUTED containment, so the two halves share one identifier.
const COLLAPSE_CONTAINER_NAME = 'ui-nav-rail-collapse'

// Module-level stable-id counter for the panel part's id (the `aria-controls` target) — one per instance,
// never reused (the `ui-popover` `_nextPanelId` precedent, popover.ts:68).
let _nextListId = 0

const props = {
  collapse: { ...prop.enum(COLLAPSE_VALUES, 'menu'), reflect: true },
  collapseContainer: { ...prop.enum(COLLAPSE_CONTAINER_VALUES, 'self'), reflect: true, attribute: 'collapse-container' },
} satisfies PropsSchema

export interface UINavRailElement extends ReactiveProps<typeof props> {}
export class UINavRailElement extends UIElement {
  static props = props

  // The `collapse="menu"` DOM parts — created ONCE (persist across reconnect, the parts-created-once
  // precedent). NOT the guard for listener/effect (re)registration — see `connected()`'s own comment.
  #trigger: HTMLButtonElement | null = null
  #list: HTMLElement | null = null

  protected connected(): void {
    // Role derivation (SPEC-R3) — re-armed on subtree mutation (SPEC-R2 AC2: later-added children re-derive).
    this.effect(() => {
      const recompute = (): void => this.#deriveRole()
      recompute()
      const observer = new MutationObserver(recompute)
      observer.observe(this, { childList: true, subtree: true, attributes: true, attributeFilter: ['href'] })
      return () => observer.disconnect()
    })

    // Selection commit — delegated click, button-shaped (bare-href) items only.
    this.listen(this, 'click', (event) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const item = target.closest('ui-nav-rail-item') as UINavRailItemElement | null
      if (!item || !this.contains(item) || item.href !== '') return
      for (const sibling of this.querySelectorAll('ui-nav-rail-item')) {
        ;(sibling as UINavRailItemElement).selected = sibling === item
      }
      const value = item.id || item.textContent?.trim() || ''
      this.emit('select', value)
      this.emit('change', value)
    })

    // collapse="icon-popover" — at most one group menu open at a time (SPEC-R8 AC3).
    this.listen(this, 'toggle', (event) => {
      const target = event.target
      if (!(target instanceof HTMLElement) || target.tagName !== 'UI-MENU') return
      if (!(target as unknown as UIMenuElement).open) return
      for (const menu of this.querySelectorAll('ui-menu')) {
        if (menu !== target) (menu as unknown as UIMenuElement).open = false
      }
    })

    // collapse="menu" — the narrow flyout (LLD-C4, GH #368). The DOM structure (`#ensureMenuParts`) is
    // built ONCE and persists across reconnect; the overlay wiring + label-sync effect + band observer
    // (`#wireMenu`) are re-armed on EVERY connect via a closure-local `wired` flag — fresh per
    // `connected()` call, the `wired` idiom first established by the retired app-shell.ts's
    // ui-app-shell-region (ADR-0156) — because `this.listen`/`this.effect` (and `overlay()`, which rides
    // both) hang off the CURRENT connection's AbortController/scope (element.ts) and die at disconnect. A
    // single `#`-field guard covering BOTH construction and wiring would leave them dead forever after a
    // real disconnect+reconnect (any whole-subtree relocation — an `append` onto a new parent is an atomic
    // remove+insert) even though the parts (and their content) survive — the component-reviewer's Finding 1.
    let wired = false
    this.effect(() => {
      if (this.collapse !== 'menu') return
      const { trigger, list } = this.#ensureMenuParts()
      if (wired) return
      wired = true
      this.#wireMenu(trigger, list)
    })
  }

  #deriveRole(): void {
    const items = [...this.querySelectorAll('ui-nav-rail-item')] as UINavRailItemElement[]
    const allBare = items.length > 0 && items.every((item) => item.href === '')
    this.internals.role = allBare ? 'tablist' : 'navigation' // mixed/empty ⇒ navigation (SPEC §7 non-goal)
  }

  /** Idempotent DOM construction ONLY (persists across reconnect) — never re-run once the parts are set.
   *  Content-relocation (`list.append(...this.childNodes)`) happens exactly once, at first build.
   *
   *  A plain `<button>` trigger + a sibling panel, the `ui-popover` anatomy (popover.ts:19-21) — NOT a
   *  `<details>`/`<summary>` pair: the panel is a top-layer `popover`, so the UA disclosure's own
   *  show/hide is neither used nor wanted, and a `<button>` is what makes Enter AND Space both arrive as
   *  one `click` (SPEC-R5 AC2's keyboard-open half). `aria-controls` is stable and set here once; the
   *  initial `aria-expanded="false"` lands here too so the trigger is never ARIA-silent before wiring
   *  (`<summary>` used to get that free from the UA, and `overlay()` writes zero ARIA of its own). */
  #ensureMenuParts(): { trigger: HTMLButtonElement; list: HTMLElement } {
    if (this.#trigger && this.#list) return { trigger: this.#trigger, list: this.#list }
    const trigger = document.createElement('button')
    trigger.type = 'button'
    trigger.setAttribute('data-part', 'trigger')
    const list = document.createElement('div')
    list.setAttribute('data-part', 'list')
    list.id = `ui-nav-rail-list-${++_nextListId}`
    // tabindex=-1 is overlay()'s `moveFocusIn()` fallback target (overlay.ts:232) — the panel itself is
    // focusable when it holds no focusable descendant (an empty rail), the ui-popover precedent.
    list.tabIndex = -1
    list.append(...this.childNodes)
    trigger.setAttribute('aria-controls', list.id)
    trigger.setAttribute('aria-expanded', 'false')
    this.append(trigger, list)
    this.#trigger = trigger
    this.#list = list
    return { trigger, list }
  }

  /** Listener/effect/trait (re)registration ONLY — called once per `connected()` (via the closure-local
   *  `wired` flag in `connected()` itself), never gated behind a persistent field: `this.listen`/
   *  `this.effect` — and `overlay()`, which rides both — hang off THIS connection's AbortController/scope
   *  and must be re-armed every time the element reconnects. */
  #wireMenu(trigger: HTMLButtonElement, list: HTMLElement): void {
    this.effect(() => {
      trigger.textContent = this.#currentLabel()
    })

    // The fleet's ONE overlay mechanism (ADR-0043/0045), called directly on this control's own panel —
    // top layer, JS measure-and-place anchoring (flip + shift), platform light-dismiss, focus round-trip,
    // and the ADR-0101 announce contract, all inherited rather than re-derived.
    const handle = overlay(this, {
      popup: list,
      anchor: trigger,
      placement: 'bottom-start',
      auto: true, // popover=auto ⇒ Escape + outside-click are the PLATFORM's, never hand-rolled here
      focusOnOpen: true, // focus lands in the panel on open and returns to the trigger on close
    })

    // ── The threshold bridge: arm the overlay narrow, disarm it wide ─────────────────────────────────
    //
    // `overlay()` cannot do this itself: it sets the `popover` attribute ONCE at call time
    // (overlay.ts:165) with no un-set path, and `cleanup()` (overlay.ts:334-350) clears neither that
    // attribute nor the six inline styles `position()` writes (overlay.ts:189-194). So both halves are
    // owned here, and the wide arm is byte-clean by construction rather than by hope.
    let armed = false
    let expanded = false

    const setExpanded = (open: boolean): void => {
      expanded = open
      trigger.setAttribute('aria-expanded', String(open))
    }

    const arm = (): void => {
      if (!list.hasAttribute('popover')) list.setAttribute('popover', 'auto')
      armed = true
    }

    const disarm = (): void => {
      handle.close() // BEFORE the attribute goes — hidePopover() needs the element to still be a popover
      list.removeAttribute('popover')
      list.style.position = ''
      list.style.top = ''
      list.style.left = ''
      list.style.bottom = ''
      list.style.right = ''
      list.style.margin = ''
      list.removeAttribute('data-placement')
      armed = false
      setExpanded(false)
    }

    // Start disarmed: `overlay()` already stamped `popover=auto` above, and the wide band must not carry
    // it (a stranded `popover` makes the UA hide the in-flow list). The band observer arms it if narrow.
    disarm()

    // Trigger activation. A real `<button>` delivers pointer click, Enter AND Space through this one
    // listener. `expanded` is flipped SYNCHRONOUSLY and read before flipping: the platform's own
    // light-dismiss (a trigger re-click IS an outside click for a popover=auto panel) hides the panel
    // synchronously but QUEUES its ToggleEvent as a task, so a handler that re-derived state from the DOM
    // would read "closed" and reopen — the ui-popover flicker-reopen race, popover.browser.test.ts:256.
    this.listen(trigger, 'click', () => {
      if (!armed) return // wide: the trigger is inert chrome (display:none), and showPopover() would throw
      if (expanded) {
        setExpanded(false)
        handle.close()
      } else {
        setExpanded(true)
        handle.open()
      }
    })

    // The platform's OWN truth, and the reason `aria-expanded` is honest on every path: this fires for
    // light-dismiss (Escape, outside-click) and for a programmatic `showPopover()`/`hidePopover()` alike.
    // ToggleEvent does not bubble, so the host's `toggle` listener (icon-popover coordination) never sees
    // it, and `overlay()`'s own listener on the same element handles the announce half (ADR-0101).
    this.listen(list, 'toggle', (event) => {
      const newState = (event as Event & { newState?: string }).newState
      if (newState !== 'open' && newState !== 'closed') return
      setExpanded(newState === 'open')
    })

    // The band read. Watching the SAME box the `@container ui-nav-rail-collapse` query resolves against
    // is the whole correctness condition: an observer on `this` would be wrong for every
    // `collapse-container="ancestor"` rail (its own box is the narrow column, the query's box is not).
    this.effect(() => {
      const box = this.#resolveCollapseContainer(this.collapseContainer)
      if (box === null) {
        // Nothing in the chain establishes the named container (only reachable under
        // `collapse-container="ancestor"` with no consumer opt-in, or before the family stylesheet has
        // applied): the `@container` query can never match either, so the rail never collapses —
        // nav-rail.md's documented safe failure, mirrored here rather than contradicted.
        if (armed) disarm()
        return
      }
      const applyBand = (inlineSize: number): void => {
        // rem × the LIVE root font-size, never a raw px literal — the same derivation super-shell.ts's
        // `#belowBandLine` makes (GH #170 defect 4), so a non-16px root is handled. `> 0` keeps a
        // zero-width box (jsdom, a display:none ancestor) on the WIDE arm: the shipped unit-test model.
        const rootFontPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
        const narrow = inlineSize > 0 && inlineSize < SHELL_NARROW_BREAKPOINT_REM * rootFontPx
        if (narrow) arm()
        else if (armed) disarm()
      }
      if (typeof ResizeObserver === 'undefined') {
        applyBand(box.clientWidth) // jsdom / a pre-RO engine — one static read, the super-shell guard
        return
      }
      const observer = new ResizeObserver((entries) => {
        const entry = entries[0]
        if (entry === undefined) return
        // contentBoxSize IS the box a `container-type: inline-size` query measures; contentRect is the
        // documented fallback for an engine that omits the newer field.
        applyBand(entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width)
      })
      observer.observe(box, { box: 'content-box' })
      return () => observer.disconnect()
    })
  }

  /**
   * The box the `@container ui-nav-rail-collapse` query resolves against — walk self-then-ancestors and
   * take the FIRST element whose COMPUTED `container-type` is not `normal` AND whose computed
   * `container-name` includes the family's name (both readable and identical in Chromium and WebKit,
   * probe-verified for GH #368). Under `collapse-container="self"` the walk terminates on the rail itself
   * (nav-rail.css `:scope` establishes the container); under `"ancestor"` the rail's own `container-type`
   * is `normal` (nav-rail.css `:scope[collapse-container='ancestor']`) so the walk continues upward to
   * whichever ancestor the consumer opted in.
   *
   * @param seam the WHICH-BOX mode. Under `'self'` the rail is the container or there is none — never an
   *   unrelated ancestor that also happens to carry the name (a nested rail, or the window before the
   *   family stylesheet has applied, where the rail's own containment is not in effect yet).
   */
  #resolveCollapseContainer(seam: 'self' | 'ancestor'): HTMLElement | null {
    for (let node: HTMLElement | null = this; node !== null; node = node.parentElement) {
      const style = getComputedStyle(node)
      if (style.containerType !== 'normal' && style.containerName.includes(COLLAPSE_CONTAINER_NAME)) return node
      if (seam === 'self') return null // self mode: the rail's own box, or no container at all
    }
    return null
  }

  /** The menu trigger's label — the selected item's NAME, else the first item's, else a fallback. */
  #currentLabel(): string {
    const items = [...this.querySelectorAll('ui-nav-rail-item')] as UINavRailItemElement[]
    const active = items.find((item) => item.selected)
    return this.#itemName(active) || this.#itemName(items[0]) || 'Menu'
  }

  /**
   * ONE item's NAME cell, never its whole row (GH #376). The row is SPEC-R6's `name|tag` pair, so an
   * item carrying a `[slot=trailing][data-role=tag]` adornment made `textContent` read "Buttonnew" —
   * the label and the tag concatenated with nothing between them, since neither is a block box.
   *
   * TWO reads, because the item has two legitimate DOM shapes and the trigger's label effect can run
   * in either. After upgrade, `#ensureActivator` (nav-rail-item.ts) has partitioned the row into
   * leading / label / trailing and re-wrapped the label RUN in one synthetic `[data-part=label]` span —
   * that span is the name cell, exactly. Before upgrade there is no such span: a rail connects before
   * its children do (custom elements upgrade in tree order), so the first run of the label effect
   * genuinely sees raw light DOM. The fallback applies the SAME partition rule the activator will —
   * every direct child that is not slotted, plus the bare text nodes — rather than falling back to
   * `textContent`, which would simply reinstate the defect on that path.
   */
  #itemName(item: UINavRailItemElement | undefined): string {
    if (!item) return ''
    const label = item.querySelector('[data-part="label"]')
    if (label) return label.textContent?.trim() ?? ''
    let text = ''
    for (const node of item.childNodes) {
      if (node instanceof Element && node.hasAttribute('slot')) continue
      text += node.textContent ?? ''
    }
    return text.trim()
  }
}

if (!customElements.get('ui-nav-rail')) customElements.define('ui-nav-rail', UINavRailElement)
