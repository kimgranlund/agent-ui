// tabs.ts — UITabsElement, the tabs compound's coordinator (goals.md §G9 / decomp g9-containers s8 / ADR-0015
// surface · ADR-0019 the bindable `selected` two-way). BEHAVIOUR + props + the tablist part + roving/keyboard +
// the tab↔panel wiring + self-define ONLY; geometry/colour live in tabs.css, the contract in tabs.md.
//
// The container (the FIRST non-form family — extends UIContainerElement for the surface axes + the reused
// protected `internals`; NOT form-associated). It owns a control-created `[data-part=tablist]` strip
// (`role=tablist` on the PART div — allowed, like the text-field editor part; the HOST carries no role) into
// which it REPARENTS its `ui-tab` children (the panels stay as siblings of the strip — a tablist must wrap only
// the tabs). It then drives the whole widget from ONE place (a sibling cannot set another element's protected
// internals): each tab↔panel pair is wired once (`aria-controls`/`aria-labelledby` via internals element-
// reflection), and a single scope-owned effect re-applies selection — `aria-selected` + the roving tabindex
// (exactly the selected tab is tabindex=0) + `:state(selected)` on the tabs, and the `hidden` attribute on the
// panels (only the selected panel shows; the rest stay in the DOM). ArrowLeft/Right + Home/End move selection
// AND focus together (selection-follows-focus), committing through the same path as a click. The keyboard
// navigation is handled by the shared `rovingFocus` trait (listbox-roving LLD-C1).
//
// GH #581 — `orientation` (default `'horizontal'`) flips the strip to a vertical column beside the panel:
// `aria-orientation` on the tablist part, the roving axis (Up/Down replacing Left/Right per APG), the divider
// + selected-tab indicator edge, and the shell/strip/panel flex geometry (tabs.css) all follow. See
// `.claude/docs/lld/tabs-vertical-overflow.lld.md` §3 for the frozen ruling.
//
// GH #586 — `overflow` (default `'scroll'`) collects the tabs that don't fit behind a tab-height 3-dot
// (`dots-three`) icon-button trigger that opens a composed `ui-menu` of PROXY items (never a reparented
// `ui-tab` — role=tab must stay inside role=tablist). The visible set is a PURE FUNCTION of the cached
// full-set tab sizes, the observed strip main-size, and the pinned selected identity — never of the
// currently-rendered subset (hiding a tab must never feed the observer, the hysteresis ruling). The selected
// tab is ALWAYS pinned visible (never overflowed); a menu commit promotes purely by running the ONE existing
// `#commit` path in the TAB index space. The inner `ui-menu`'s own event vocabulary (`select`/`toggle`/`close`)
// is CONTAINED at the boundary (`stopPropagation`) so `ui-tabs`' own surface stays exactly `{select}`. See
// `.claude/docs/lld/tabs-vertical-overflow.lld.md` §4/§5 for the frozen ruling.
//
// `selected` is a plain reflected string the renderer two-way-binds via LLD-C8 (ADR-0019): the agent SETS it
// (programmatic → the effect applies it, NO event echoed), a user gesture COMMITS it (the ONE `select` event
// emitted, the renderer reads the new tab back). The control stays renderer-agnostic — it knows nothing of A2UI.
// `controls → dom` is the allowed import direction; importing this module registers all three tags (it imports
// tab.ts/tab-panel.ts), so the s12 barrel needs only `export * from './tabs/tabs.ts'`. The `ui-menu` import
// below is a SANCTIONED sibling-control import (the `command-modal → modal` / `avatar → icon` precedent) —
// same layer, controls → controls.

import { UIContainerElement } from '../../dom/container.ts'
import { prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import { rovingFocus } from '../../traits/roving-focus.ts'
import { setIcon } from '@agent-ui/icons'
import { UITabElement } from './tab.ts'
import { UITabPanelElement } from './tab-panel.ts'
import { UIMenuElement } from '../menu/menu.ts' // sanctioned sibling-control import — self-defines ui-menu

// GH #221 — TYPE-only re-exports of the sub-elements: a composing consumer (ui-super-shell's panel-less
// strips) needs the PUBLIC coordination API's type (`link`, `key`) to drive tabs it creates itself.
// `export type` is erasable (verbatimModuleSyntax), so the runtime barrel surface is unchanged — the
// sub-element CLASSES stay registered-only, never surfaced (the barrels.test.ts law).
export type { UITabElement } from './tab.ts'
export type { UITabPanelElement } from './tab-panel.ts'

// A per-instance id seed so each tabs' tab/panel pair gets unique IDREFs (the reverse aria-labelledby anchor).
let tabsSeq = 0

// GH #581 — the strip axis (radio-group.ts / toolbar.ts precedent — the canon `orientation` name, naming.md
// §12). Reflected so tabs.css keys off `[orientation=vertical]`; the KEYBOARD axis fed to the shared
// rovingFocus trait is a SEPARATE, connect-resolved concern (see connected() below).
const ORIENTATIONS = ['horizontal', 'vertical'] as const

// GH #586 — the strip's not-enough-room strategy (toolbar.ts:20's fenced vocabulary — `wrap` inapplicable, a
// wrapping tablist breaks the strip metaphor). 'scroll' is today's `overflow-x/y auto`, byte-identical.
// Reflected so tabs.css keys off `[overflow=menu]`; the overflow-part CREATION is a SEPARATE, connect-resolved
// concern (see connected() below — the orientation/roving-axis precedent).
const OVERFLOWS = ['scroll', 'menu'] as const

const props = {
  // The surface axes (ADR-0015) — elevation/brightness, spread from the base (no prototype merge; the ADR-0013
  // formProps precedent). ui-tabs sets its OWN default --ui-container-bg in tabs.css (the base default is
  // transparent), so a bare tabs still has a surface.
  ...UIContainerElement.surfaceProps,
  // `selected` — the active tab's identity (its `key`, or its DOM index as a string; '' ⇒ the first tab).
  // OBSERVED + REFLECTED so the attribute mirrors the live selection, and BINDABLE: the renderer two-way-binds it
  // via LLD-C8 (value:{prop:'selected',event:'select'}, ADR-0019). Typed `string` — the value crosses the
  // attribute boundary as a string regardless (a numeric index is its string form); the descriptor records it so.
  selected: { ...prop.string(), reflect: true },
  // `fill` — ADR-0144 Q1 cl.1: ONE opt-in reflected boolean (the `ui-split-pane` `collapsible` shape), realized
  // CSS-ONLY in tabs.css (`:scope[fill]`). Fills a height-bounded parent with a pinned tablist strip + an
  // internally scrolling active panel — the exact composition `agent-admin.css` (TKT-0085) hand-rolled per
  // consumer for lack of a shipped variant. Absent (the default), tabs stays byte-identical document-flow.
  fill: { ...prop.boolean(false), reflect: true },
  // `orientation` — GH #581: vertical renders the strip as a column beside the panel (shell flex-direction,
  // `aria-orientation` on the tablist part, divider/indicator edge, and the Up/Down arrow axis all follow —
  // tabs.css + connected() below). Default `'horizontal'` keeps every existing consumer byte-identical
  // (negative controls in tabs.test.ts / tabs.browser.test.ts).
  orientation: { ...prop.enum(ORIENTATIONS, 'horizontal'), reflect: true },
  // `overflow` — GH #586: 'menu' collects the tabs that don't fit behind a dots-three trigger opening a
  // composed `ui-menu` of proxy items (§4/§5 below). Default `'scroll'` is today's `overflow-x/y auto`,
  // byte-identical (negative controls in tabs.test.ts / tabs.browser.test.ts).
  overflow: { ...prop.enum(OVERFLOWS, 'scroll'), reflect: true },
} satisfies PropsSchema

export interface UITabsElement extends ReactiveProps<typeof props> {}
export class UITabsElement extends UIContainerElement {
  static props = props

  // The control-created tablist strip + the captured tab/panel lists (light-DOM, persist across reconnect).
  #tablist: HTMLElement | null = null
  #tabs: UITabElement[] = []
  #panels: UITabPanelElement[] = []
  #baseId = ''
  // The resolved active index — the single source of truth for the keyboard delta; kept in sync by the effect
  // and eagerly on commit (so a rapid second keypress before the effect flush still steps from the right place).
  #activeIndex = -1

  // GH #586 — overflow="menu" state. `#menuMode`/`#fitVertical` are CONNECT-RESOLVED (the orientation/roving-
  // axis precedent: a live `overflow`/`orientation` flip re-resolves only on the next reconnect). `#overflowMenu`
  // persists across reconnect like `#tablist` (the ResizeObserver itself is a `#wireOverflow`-local — released
  // via a scope-owned `this.effect` cleanup, the roving-focus.ts idiom). `#tabSizeCache` is the cached full-set
  // tab inline-sizes measured pre-hide (horizontal only — vertical needs none, uniform row height);
  // `#lastAvailable` feeds the cache-validity guard's 0→nonzero reveal check (doc-review repair 1).
  #menuMode = false
  #fitVertical = false
  #overflowMenu: UIMenuElement | null = null
  #tabSizeCache: number[] = []
  #lastAvailable = 0

  protected connected(): void {
    if (!this.#baseId) this.#baseId = `ui-tabs-${++tabsSeq}`

    const strip = this.#ensureTablist()
    // GH #581 — aria-orientation rides the STRIP PART (never a host attribute — the family discipline), the
    // same way `role=tablist` already does. The tablist role's IMPLICIT default is horizontal, so the
    // horizontal case simply OMITS the attribute (byte-identical default DOM, probed in tabs.test.ts) rather
    // than writing `aria-orientation="horizontal"`. Connect-time only — re-resolves on reconnect, exactly
    // like the roving axis below (tabs.md documents both as connect-resolved).
    if (this.orientation === 'vertical') strip.setAttribute('aria-orientation', 'vertical')
    else strip.removeAttribute('aria-orientation')

    // Reparent the tab children INTO the strip (idempotent — a tab already inside is skipped, so reconnect is a
    // no-op). Recognised by instanceof so a probe subclass nests; the panels are left as strip siblings.
    for (const child of [...this.children]) {
      if (child instanceof UITabElement && child.parentNode !== strip) strip.append(child)
    }
    this.#tabs = [...strip.children].filter((c): c is UITabElement => c instanceof UITabElement)
    this.#panels = [...this.children].filter((c): c is UITabPanelElement => c instanceof UITabPanelElement)

    // Wire each tab↔panel pair ONCE (ids + the aria-controls/labelledby element-reflection). Pairs by DOM order.
    this.#tabs.forEach((tab, i) => {
      const panel = this.#panels[i]
      if (!panel) return
      const tabId = `${this.#baseId}-tab-${i}`
      const panelId = `${this.#baseId}-panel-${i}`
      tab.link(panel, tabId)
      panel.link(tab, panelId)
    })

    // Click commit listener — delegated to the tablist strip (rides the connection AbortSignal).
    // Keydown is handled by the rovingFocus trait below.
    this.listen(strip, 'click', this.#onClick)

    // GH #586 — connect-resolved overflow mode (the orientation/roving-axis precedent: a live `overflow`
    // flip re-resolves only on the next reconnect, tabs.md documents this for both props). The overflow
    // part (LLD-C7) is created lazily, once, iff menu mode — and persists across reconnect like #tablist.
    this.#menuMode = this.overflow === 'menu'
    this.#fitVertical = this.orientation === 'vertical'
    if (this.#menuMode) {
      this.#ensureOverflowMenu()
      if (this.#overflowMenu) this.#wireOverflow(this.#overflowMenu, strip)
    }

    // The selection effect — re-applies on every `selected` change (and re-arms on reconnect). Runs once now
    // (synchronously) so the initial roving tabindex + panel visibility are correct before first paint.
    // GH #586 — also re-runs the fit whenever selection changes: the visible set is a pure fn of (cached
    // sizes, available size, SELECTED IDENTITY), so a newly-selected tab must be re-pinned immediately
    // (promotion) and the previously-pinned one may fall back to the menu.
    this.effect(() => {
      const index = this.#resolveIndex() // reads this.selected (tracked) + this.#tabs
      this.#tabs.forEach((tab, i) => tab.setSelected(i === index))
      this.#panels.forEach((panel, i) => {
        panel.hidden = i !== index // standard `hidden` (NOT ARIA) — only the selected panel shows; the rest stay in DOM
      })
      this.#activeIndex = index
      if (this.#menuMode) this.#applyFit()
    })

    // Roving keyboard focus — the shared trait (listbox-roving LLD-C1) replaces the former inline #onKeydown.
    // The effect above runs synchronously and sets #activeIndex before we get here, so initialIndex reads
    // the correct position even after reconnect with a non-first tab selected. syncIndex reconciles on each
    // keydown after a click or programmatic selection change that bypassed the trait's onMove.
    // GH #581 — the trait's `orientation` option is read ONCE at invoke — captured by the destructure at the
    // top of `rovingFocus()` (roving-focus.ts), never a live accessor (an accessor is a type error AND would
    // leave the axis comparison permanently false); the fleet's settled shape for a reactive `orientation`
    // prop feeding this trait is radio-group.ts / toolbar.ts: CONNECT-RESOLVE the axis to a plain value, pass
    // the VALUE. A live flip of `orientation` therefore re-resolves only on the next reconnect (tabs.md
    // documents this).
    // GH #586 — `items`/`initialIndex`/`syncIndex` now read the VISIBLE-tab index space (LLD-C5): the roving
    // ring skips overflowed tabs entirely; `onMove` maps a visible-list index back to the full `#tabs` index
    // before calling the existing `#commit` (the ONE commit path, unchanged index-space contract).
    const rovingOrientation = this.orientation === 'vertical' ? 'vertical' : 'horizontal'
    const visibleIndexOfActive = (): number => this.#visibleTabs().indexOf(this.#tabs[this.#activeIndex])
    rovingFocus(this, {
      container: strip,
      items: () => this.#visibleTabs(),
      orientation: rovingOrientation,
      loop: true,
      typeAhead: false,
      initialIndex: visibleIndexOfActive,
      syncIndex: visibleIndexOfActive,
      onMove: (visibleIndex) => this.#commit(this.#tabs.indexOf(this.#visibleTabs()[visibleIndex]), false), // trait already moved focus; commit without re-focusing
    })

    // Motion gate (interaction-states standard) — arm `ready` ONE FRAME past first paint so the synchronous
    // initial selection SNAPS and only later changes animate (tabs.css gates the transition behind
    // :state(ready)). states optional-chained — jsdom has no CustomStateSet (the real motion is the browser smoke).
    requestAnimationFrame(() => this.internals.states?.add('ready'))
  }

  /** Create the `[data-part=tablist]` strip ONCE (idempotent across reconnect — it is a persistent light-DOM
   *  child) and keep it as the first child. `role=tablist` rides the PART div (text-field editor-part precedent),
   *  so the HOST stays free of a role attribute. */
  #ensureTablist(): HTMLElement {
    let strip = this.#tablist
    if (!strip) {
      strip = document.createElement('div')
      strip.setAttribute('data-part', 'tablist')
      strip.setAttribute('role', 'tablist')
      this.#tablist = strip
    }
    if (strip.parentNode !== this) this.insertBefore(strip, this.firstChild)
    return strip
  }

  /** Resolve `selected` → a tab index: '' ⇒ the first tab; a `key` match wins; else a numeric index in range;
   *  else fall back to the first tab. Reads `this.selected` so the selection effect tracks it. */
  #resolveIndex(): number {
    const tabs = this.#tabs
    if (tabs.length === 0) return -1
    const sel = this.selected
    if (sel === '') return 0
    const byKey = tabs.findIndex((t) => t.key !== '' && t.key === sel)
    if (byKey !== -1) return byKey
    if (/^\d+$/.test(sel)) {
      const n = Number(sel)
      if (n >= 0 && n < tabs.length) return n
    }
    return 0
  }

  // ── click commit — delegated: find the clicked tab among ours (instanceof-safe across subclasses) ──
  #onClick = (event: Event): void => {
    const target = event.target as Node
    const index = this.#tabs.findIndex((t) => t === target || t.contains(target))
    if (index === -1) return
    this.#commit(index, true)
  }

  /**
   * Commit a user-driven selection: write `selected` (→ the effect re-applies aria/roving/panels), move focus to
   * the tab (roving), and emit `select` ONLY when the selection actually changed — so a programmatic `selected`
   * set by the agent (the renderer's two-way write) never echoes an event back (binding hygiene). The commit
   * value is the tab's `key` when it has one, else its index as a string (the addressable identity).
   */
  #commit(index: number, moveFocus: boolean): void {
    const tab = this.#tabs[index]
    if (!tab) return
    const changed = index !== this.#activeIndex
    const identity = this.#identityOf(tab, index)
    this.#activeIndex = index // eager — keep the keyboard delta correct before the effect flush
    this.selected = identity // → reflects + wakes the selection effect (MICROTASK-BATCHED)
    // GH #586 critic fold MAJOR-2 finding (found while pinning "the promoted tab keeps focus"): a
    // menu-relay commit can target a tab CURRENTLY `[data-overflowed]` (`display:none`) — the
    // reactive effect above that would unhide it (via `#applyFit`) has not run yet (microtask-
    // batched), so a `tab.focus()` called before this point is a silent no-op on a display:none
    // element. Run the fit SYNCHRONOUSLY here, eagerly, using the already-updated `#activeIndex` —
    // pure/idempotent (the deferred effect recomputes the identical result moments later) — so the
    // promoted tab is genuinely focusable by the time `moveFocus` asks for it below.
    if (this.#menuMode) this.#applyFit()
    if (moveFocus) tab.focus()
    if (changed) {
      // `select` is the ONE commit event (the event-vocab's selection event). The s11 catalog binds
      // value:{prop:'selected',event:'select'} and the renderer's LLD-C8 controller listens to exactly it to
      // write `selected` back into the A2UI data model — NOT `change` (which is value-commit-flavored).
      this.emit('select', { value: identity, index })
    }
  }

  /** A tab's addressable commit identity — its `key` when it has one, else its DOM index as a string. Shared
   *  by `#commit` (above) and the overflow proxy rows / relay below (LLD §4 "menu contents"). */
  #identityOf(tab: UITabElement, index: number): string {
    return tab.key !== '' ? tab.key : String(index)
  }

  // ════════════════════════════════════════════════════════════════════════════════════════════════
  // GH #586 — overflow="menu" (LLD-C5..C9, `.claude/docs/lld/tabs-vertical-overflow.lld.md` §4/§5)
  // ════════════════════════════════════════════════════════════════════════════════════════════════

  /** The roving/keyboard candidate set (LLD-C5): identity (`#tabs`) outside menu mode; `#tabs` minus every
   *  `[data-overflowed]` tab in menu mode (`#applyFit` stamps/clears the attribute — DOM order preserved,
   *  display swap only). Read live — never cached — so a keydown always sees the current fit result. */
  #visibleTabs(): UITabElement[] {
    if (!this.#menuMode) return this.#tabs
    return this.#tabs.filter((t) => !t.hasAttribute('data-overflowed'))
  }

  /** Resolve a menu proxy's `data-value` back to a `#tabs` index — the `#resolveIndex` key/positional-index
   *  logic, minus the `''`-selects-first-tab default (a proxy never carries an empty value). -1 = unresolved
   *  (a stale/foreign event — the relay below no-ops rather than commit garbage). */
  #indexOfIdentity(value: string): number {
    const byKey = this.#tabs.findIndex((t) => t.key !== '' && t.key === value)
    if (byKey !== -1) return byKey
    if (/^\d+$/.test(value)) {
      const n = Number(value)
      if (n >= 0 && n < this.#tabs.length) return n
    }
    return -1
  }

  /**
   * Create the `[data-part=overflow]` part ONCE (idempotent across reconnect — persists like `#tablist`):
   * a composed `<ui-menu>` wrapping a square `<button aria-label="More tabs">` icon trigger (LLD §4 "trigger
   * anatomy" — `setIcon` from `@agent-ui/icons`, the swiper-paddles.ts precedent for a literal English label
   * on a control-created icon button). Built fully OFFLINE then appended in one shot, so `ui-menu`'s own
   * `connected()` sees its trigger as `firstElementChild` already in place (menu.ts `#ensureParts`).
   * Appended AFTER the strip as a shell child — never inside the tablist (a non-tab tablist child is an ARIA
   * required-owned-children violation).
   */
  #ensureOverflowMenu(): void {
    let menu = this.#overflowMenu
    if (!menu) {
      menu = document.createElement('ui-menu') as UIMenuElement
      menu.setAttribute('data-part', 'overflow')
      // Click parity (component-checker MAJOR-2, Kim ruling 2026-08-08): the relay below (`#wireOverflow`)
      // moves focus to the promoted tab itself during the commit's `select` emit; opt OUT of ui-menu's
      // default "restore focus to the trigger" so that move survives (menu.ts's own `keepFocusOnCommit`
      // knob — documented there).
      menu.keepFocusOnCommit = true
      const trigger = document.createElement('button')
      trigger.type = 'button'
      trigger.setAttribute('aria-label', 'More tabs') // literal English label — control-created, sanctioned
      setIcon(trigger, 'dots-three') // GH #168 — the fleet's one horizontal overflow glyph
      menu.append(trigger)
      this.#overflowMenu = menu
    }
    if (menu.parentNode !== this) this.append(menu)
  }

  /**
   * Wire the overflow part (LLD-C7/C8/C9): the containment + proxy-commit relay, the fit-driving
   * `ResizeObserver` on the strip (typeof-guarded — jsdom has none; fit is browser-suite territory), and one
   * `document.fonts.ready` remeasure (a late web-font swap can shift the cached tab widths).
   */
  #wireOverflow(menuEl: UIMenuElement, strip: HTMLElement): void {
    // C8 — event containment + the proxy-commit relay. `emit()` bubbles+composed (dom/element.ts) — the inner
    // menu's `select`/`toggle`/`close` would otherwise ALSO surface on `ui-tabs` (a leaked PROXY-index-space
    // `select`, plus `toggle`/`close` outside the `{select}` contract). `stopPropagation` at the boundary
    // keeps `ui-tabs`' own event surface exactly `{select}`; a real commit is RELAYED through the existing
    // `#commit` path, in the TAB index space, never the proxy's own list position.
    this.listen(menuEl, 'select', (event) => {
      event.stopPropagation()
      const detail = (event as CustomEvent<{ value: string; index: number }>).detail
      const index = this.#indexOfIdentity(detail.value)
      if (index !== -1) this.#commit(index, true)
    })
    this.listen(menuEl, 'toggle', (event) => event.stopPropagation())
    this.listen(menuEl, 'close', (event) => event.stopPropagation())

    // C9 — the fit-driving observer. One RO on the strip; every real size change recomputes the visible set.
    // DEFERRED one rAF (component-checker MAJOR-1): `#applyFit`'s own writes (menuEl.hidden, the
    // data-overflowed swap — collapsing/expanding the grid's auto trigger column) resize the SAME
    // observed strip; running them synchronously INSIDE the RO callback re-triggers the observer within
    // the same delivery cycle, which the platform reports as "ResizeObserver loop completed with
    // undelivered notifications" (reproduced 3× in 5s pre-fix). The standard remedy: do the work one
    // frame later, past this delivery cycle, and COALESCE repeated fires — several RO callbacks before
    // the rAF runs collapse into the ONE pending frame, which reads live geometry when it finally runs
    // (never stale data from whichever fire scheduled it).
    if (typeof ResizeObserver !== 'undefined') {
      let pendingFrame: number | null = null
      const ro = new ResizeObserver(() => {
        if (pendingFrame !== null) return // already scheduled — coalesce
        pendingFrame = requestAnimationFrame(() => {
          pendingFrame = null
          this.#applyFit()
        })
      })
      ro.observe(strip)
      // Auto-release on disconnect — the roving-focus.ts idiom: a no-op-dependency `this.effect` whose
      // RETURNED cleanup fires when the connection scope disposes at disconnect.
      this.effect(() => () => {
        if (pendingFrame !== null) cancelAnimationFrame(pendingFrame)
        ro.disconnect()
      })
    }

    // A late web-font swap can shift the cached tab widths after connect's initial measurement; one
    // remeasure once fonts finish loading closes that gap (§4 "width-cache staleness", §9 accepted residual
    // beyond this one deliberate re-check). Guarded — jsdom's `document.fonts` stub carries no `ready`.
    if (typeof document.fonts?.ready?.then === 'function') {
      document.fonts.ready.then(() => {
        if (!this.isConnected) return
        this.#remeasureCache()
        this.#applyFit()
      })
    }
  }

  /**
   * Measure every tab's current inline-size into the cache — ALWAYS with every tab temporarily unhidden
   * first (a currently-`[data-overflowed]` tab reports a false zero width otherwise, corrupting the very
   * cache the fit computation depends on — LLD §4: "the guard's remeasure inputs are still render-
   * independent"). `#applyFit` (the only caller) recomputes and reapplies the hide list immediately after.
   */
  #remeasureCache(): void {
    const hiddenNow = this.#tabs.filter((t) => t.hasAttribute('data-overflowed'))
    for (const t of hiddenNow) t.removeAttribute('data-overflowed')
    this.#tabSizeCache = this.#tabs.map((t) => t.getBoundingClientRect().width)
    for (const t of hiddenNow) t.setAttribute('data-overflowed', '')
  }

  /**
   * Recompute the visible-tab set (LLD-C9 `#applyFit`) — a PURE FUNCTION of the cached full-set sizes, the
   * observed strip main-size, and the pinned selected identity; NEVER of the currently-rendered subset (so
   * hiding a tab cannot feed back into the observer — the hysteresis ruling). Stamps/clears `data-overflowed`
   * (DOM order preserved, display swap only — a promoted selected tab therefore renders as the LAST visible
   * slot, exactly the GH #586 ask), toggles the overflow part's `hidden` (K===N ⇒ hidden), and rebuilds its
   * proxy rows to exactly the overflowed tabs.
   */
  #applyFit(): void {
    const menuEl = this.#overflowMenu
    const strip = this.#tablist
    const tabs = this.#tabs
    const n = tabs.length
    if (!menuEl || !strip || n === 0) return

    const vertical = this.#fitVertical
    const rect = strip.getBoundingClientRect()
    const available = vertical ? rect.height : rect.width
    const cs = getComputedStyle(strip)
    const gap = Number.parseFloat(vertical ? cs.rowGap : cs.columnGap) || 0
    // Reserve — the trigger's token-derived footprint (never measured from the trigger element itself, so
    // the budget never depends on the trigger's OWN current display state — the LLD's anti-feedback ruling).
    const tabHeight = Number.parseFloat(getComputedStyle(this).getPropertyValue('--ui-tabs-tab-height')) || 0
    const reserve = tabHeight + gap

    // CACHE-VALIDITY GUARD (doc-review repair 1) — horizontal only; vertical has no cache to go stale (pure
    // arithmetic off the uniform row-height token). Remeasure before computing when the cache is all-zero OR
    // the strip's observed main-size just transitioned 0→nonzero (a menu-mode tabs connected inside a
    // display:none ancestor — a non-selected panel via tabs.ts's own `panel.hidden`, or an unopened modal —
    // otherwise caches zeros and overflow never engages; the reveal-time RO tick would re-run over the same
    // dead cache without this).
    if (!vertical) {
      const cacheAllZero = this.#tabSizeCache.length === 0 || this.#tabSizeCache.every((w) => w === 0)
      const revealed = available > 0 && this.#lastAvailable === 0
      if (cacheAllZero || revealed) this.#remeasureCache()
    }
    this.#lastAvailable = available

    const sizeOf = (i: number): number => (vertical ? tabHeight : (this.#tabSizeCache[i] ?? 0))
    let total = 0
    for (let i = 0; i < n; i++) total += sizeOf(i)
    total += Math.max(0, n - 1) * gap

    let visible: Set<number>
    if (total <= available) {
      visible = new Set(tabs.map((_, i) => i)) // K=N — everything fits, no reserve needed
    } else {
      const budget = Math.max(0, available - reserve)
      const selIndex = this.#activeIndex >= 0 && this.#activeIndex < n ? this.#activeIndex : 0
      visible = new Set([selIndex]) // the K=1 floor — a strip narrower than selected+trigger clips (recorded edge)
      for (let k = n; k >= 1; k--) {
        const candidate = new Set<number>()
        for (let i = 0; i < k; i++) candidate.add(i)
        candidate.add(selIndex) // the selected tab is ALWAYS pinned — never overflowed
        let sum = 0
        for (const i of candidate) sum += sizeOf(i)
        sum += Math.max(0, candidate.size - 1) * gap
        if (sum <= budget) {
          visible = candidate
          break
        }
      }
    }

    for (let i = 0; i < n; i++) {
      if (visible.has(i)) tabs[i].removeAttribute('data-overflowed')
      else tabs[i].setAttribute('data-overflowed', '')
    }
    const allFit = visible.size === n
    menuEl.hidden = allFit
    this.#rebuildProxies(menuEl, tabs.filter((_, i) => !visible.has(i)))
  }

  /**
   * Rebuild the overflow menu's proxy rows to exactly the overflowed tabs (LLD §4 "menu contents") — PROXY
   * items only, never a reparented `ui-tab` (role=tab must stay inside role=tablist). `data-value` mirrors a
   * tab's commit identity (`#identityOf`); `disabled`/`aria-disabled` mirror onto the proxy so the menu's own
   * commit guards (PR #566) block it. Rebuilt on every fit change so the panel's contents and the strip's
   * visibility can never disagree.
   *
   * KNOWN EDGE (component-checker MINOR-2, recorded not fixed): `#applyFit` calls this unconditionally,
   * including while the overflow menu is CURRENTLY OPEN (a resize or a `selected` change firing mid-browse).
   * `panel.replaceChildren()` then discards and recreates whatever row the user's roving focus was on,
   * dropping keyboard focus out of the open panel (to the panel's own tabindex=-1 fallback — no throw, no
   * lost commit path, just a jumped focus target). Narrow window (needs a real resize or a selected-tab
   * write while the menu is actively open) and no correctness break, so left as an accepted residual rather
   * than added scope this build — a future pass could skip the rebuild while `menuEl.open` is true and defer
   * it to the next open instead.
   */
  #rebuildProxies(menuEl: UIMenuElement, overflowed: UITabElement[]): void {
    const panel = menuEl.querySelector('[data-part="panel"]')
    if (!panel) return // ui-menu creates its panel lazily on its own first connect (menu.ts #ensureParts)
    panel.replaceChildren()
    for (const tab of overflowed) {
      const index = this.#tabs.indexOf(tab)
      const row = document.createElement('div')
      row.setAttribute('role', 'menuitem')
      row.tabIndex = -1
      row.dataset['value'] = this.#identityOf(tab, index)
      row.textContent = tab.textContent ?? ''
      if (tab.hasAttribute('disabled')) row.setAttribute('disabled', '')
      if (tab.getAttribute('aria-disabled') === 'true') row.setAttribute('aria-disabled', 'true')
      panel.append(row)
    }
  }
}

if (!customElements.get('ui-tabs')) customElements.define('ui-tabs', UITabsElement)
