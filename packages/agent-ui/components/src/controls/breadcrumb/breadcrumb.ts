// breadcrumb.ts — UIBreadcrumbElement, `ui-breadcrumb` S1 core anatomy + S2 `collapse="menu"` (GH #1515; the
// frozen design intake, `.claude/docs/spec/breadcrumb.intake.md` §4/§7 slices S1+S2). BEHAVIOUR + props + the
// imperative separator-injection rebuild + the composed-`ui-menu` overflow fold + self-define ONLY;
// geometry/token CSS lives in breadcrumb.css, the public contract in breadcrumb.md.
//
// Anatomy (flat light-DOM — the pagination/ADR-0163 cl.6 precedent, tier `pattern`, NO new geometry row):
// every element child that is neither `[slot="separator"]` nor carries `[data-part]` (control furniture) is
// a CRUMB, tag-agnostic (`<a>`, `<ui-router-link>`, a plain `<span>` for the leaf — the control never
// imports or sniffs `@agent-ui/router`; ADR-0115-blind by construction, `layering.test.ts` forbids the edge
// anyway). A `[slot="separator"]` child (the FIRST one, if several — the rest are inert furniture, never
// crumbs) is the per-INSTANCE separator template: hidden (`hidden` + `aria-hidden`) and `cloneNode(true)`d
// into a fresh `[data-part="separator"]` node inserted before every crumb but the first. Clone semantics are
// SNAPSHOT, not live (the intake's pinned clause): the template is cloned once per gap at REBUILD time,
// driven only by a host-childList MutationObserver (never `subtree: true`) — a mutation made inside an
// already-slotted template's own subtree after mount does not retroactively touch existing clones, only a
// later host childList change re-clones from the template's THEN-current shape. No template ⇒ a control-
// created `/` glyph span, same data-part/aria-hidden shape. Every clone (and every id-bearing descendant of
// it) has its `id` stripped — clone hygiene, preventing N duplicate ids across N gaps.
//
// The last crumb (post-rebuild DOM order) is auto-stamped `aria-current="page"` UNLESS it, or a descendant
// of it, already carries `[aria-current]` (a router-exact-active `ui-router-link` marks its own stamped
// `<a>` — defer, never double-mark). The auto-stamp is tracked (not DOM-sniffed) so a rebuild that changes
// which crumb is last cleanly un-stamps the PREVIOUS one — never two crumbs marked current at once.
//
// `collapse="menu"` (GH #1515 S2, this slice) — the composed-`ui-menu` overflow fold: the tabs
// `#ensureOverflowMenu`/`#wireOverflow` mechanism (GH #586) applied to a COUNT-DRIVEN fold rather than a
// fit-measured one (no ResizeObserver — breadcrumb's collapse is author-driven, viewport-independent per the
// intake). The FIRST crumb is always pinned; the LAST `collapseKeepTrailing` crumbs are pinned (inclusive of
// the auto-stamped current/last crumb); the non-empty MIDDLE range folds: each folded crumb is stamped
// `data-collapsed` (breadcrumb.css: `display:none`, stays in the DOM — never removed, so the relay below can
// still reach it), and a composed `<ui-menu data-part="overflow">` (a `dots-three` trigger, GH #168's one
// horizontal overflow glyph) is inserted in its place — "the first gap": right after the separator that used
// to precede the first folded crumb (that ONE separator stays visible, becoming the gap the menu itself
// occupies; every separator BETWEEN two folded crumbs is also stamped `data-collapsed`, so no stray glyph
// renders beside an invisible crumb). Selecting a proxy `[role=menuitem]` row RELAYS to the real hidden
// crumb's own activation surface (`crumb.matches('a') ? crumb : (crumb.querySelector('a') ?? crumb)`, then
// `.click()` — `HTMLElement.click()` dispatches even on a `display:none` node) rather than reparenting it (a
// crumb never leaves the DOM position `#stampCurrent`/a later rebuild depends on). `select`/`toggle`/`close`
// are `stopPropagation`-contained at the `[data-part=overflow]` boundary (the tabs `#wireOverflow`/GH #586
// critic-fold C8 precedent) — otherwise `ui-menu`'s own bubbling+composed events would surface on
// `ui-breadcrumb`, which emits NONE of its own. The relay's anchor lookup runs lazily, only at the moment of
// a real user commit (never at rebuild time) — by then every custom-element crumb (e.g. a `ui-router-link`,
// ADR-0115-blind by construction — this file never imports or sniffs `@agent-ui/router`) has long since
// upgraded and stamped its own inner `<a>`, the intake's pinned "fold computation must run post-connect,
// never pre-upgrade" ordering assumption.
//
// The WHOLE overflow-menu element is discarded and rebuilt fresh on every `#rebuild()` pass (never persisted
// across passes) — consistent with this file's own established full-discard-and-recreate philosophy (the
// separators get the identical treatment already); `collapse="none"` (the default) never creates it at all,
// so the default anatomy stays byte-identical to what S1 shipped. ACCEPTED RESIDUAL (the tabs.ts
// `#rebuildProxies` KNOWN EDGE precedent, not fixed there either): an unrelated childList mutation while the
// overflow menu is OPEN discards and recreates it, closing the panel — a narrow window, no correctness break.
//
// `collapseKeepTrailing` (TKT-0035 compound-template naming — the HTML attribute is `collapse-keep-trailing`)
// clamps like `ui-pagination`'s `#clampedPage` (never trusts the raw bindable prop): non-finite/`null` → the
// documented default (2); otherwise truncated and floored at 1 (the current/last crumb is always visible).
//
// Still no events of its own: crumb activation is native anchor navigation; the composed `ui-menu`'s own
// vocabulary is contained at the boundary, never re-emitted.
//
// `controls → dom` — plus ONE sanctioned sibling-control import, `ui-menu` (the tabs→ui-menu / command-modal
// →combo-box precedent: controls→controls, same layer). Still no traits of ui-breadcrumb's own (no overlay,
// no roving focus over the crumbs themselves: N independent links in normal tab order, the ADR-0163 cl.3
// "no composite widget" posture, per the intake's Keyboard/focus row) — the composed `ui-menu` brings its
// OWN roving/overlay machinery, scoped to its own panel.

import { UIElement, prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import { setIcon } from '@agent-ui/icons'
import { UIMenuElement } from '../menu/menu.ts' // sanctioned sibling-control import — self-defines ui-menu

const COLLAPSE_VALUES = ['none', 'menu'] as const

const props = {
  // The accessible NAVIGATION-LANDMARK name → internals.ariaLabel. Unlike ui-pagination's null-default
  // posture, Breadcrumb HAS a canonical APG landmark name — an empty label falls back to 'Breadcrumb'
  // (never null), the intake's deliberate deviation from the pagination precedent (§4 A11y row).
  label: { ...prop.string(''), reflect: true },
  // ADR-0223 (Fill by Default) — the ONE sizing opt-out, fleet-shared name: reflects so the `:scope[inline]`
  // CSS leg (inline-level display + hug posture) applies to JS-set values. Default (absent) = block-level fill.
  inline: { ...prop.boolean(false), reflect: true },
  // `collapse` — GH #1515 S2: the author-chosen fold STRATEGY (never a verb boolean — naming.md §3, the
  // `truncate` §12 lesson; nav-rail.ts's `collapse` enum canon reused verbatim). 'none' (default) renders
  // bare, byte-identical to S1. 'menu' folds a non-empty middle behind a composed ui-menu (see the file
  // banner above).
  collapse: { ...prop.enum(COLLAPSE_VALUES, 'none'), reflect: true },
  // `collapseKeepTrailing` — how many TRAILING crumbs stay pinned (inclusive of the current/last crumb) when
  // `collapse="menu"` folds. TKT-0035's compound-template naming: the dependent-axis attribute is
  // kebab-cased explicitly (`collapse-keep-trailing`), the nav-rail.ts `collapseContainer`/`collapse-container`
  // shape reused verbatim. Default 2; clamped ≥1 at read time (`#clampedKeepTrailing`, never trusted raw —
  // the pagination.ts `#clampedPage` precedent).
  collapseKeepTrailing: { ...prop.number(2), reflect: true, attribute: 'collapse-keep-trailing' },
} satisfies PropsSchema

const SEPARATOR_SLOT = 'separator'
const SEPARATOR_PART = 'separator'
const OVERFLOW_PART = 'overflow'

/** Is `el` the (or an inert extra) separator template — a light-DOM child marked `slot="separator"`
 *  (the disclosure `slot="summary"` position-slot grammar, ADR-0158, reused verbatim for one gap-filler
 *  template rather than a per-item slot). */
const isSeparatorSlotted = (el: Element): boolean => el.getAttribute('slot') === SEPARATOR_SLOT

/** Is `el` control-created furniture (a previously-injected separator clone, or the composed
 *  `[data-part="overflow"]` menu, GH #1515 S2) — never a crumb. Any `[data-part]` is furniture. */
const isFurniture = (el: Element): boolean => el.hasAttribute('data-part')

export interface UIBreadcrumbElement extends ReactiveProps<typeof props> {}
export class UIBreadcrumbElement extends UIElement {
  static props = props

  // The host-childList observer driving the rebuild (SNAPSHOT semantics — never `subtree: true`, so a
  // mutation INSIDE an already-slotted template's own subtree never triggers a re-clone on its own).
  // Disconnected around every #rebuild() pass (this method's own DOM surgery would otherwise retrigger
  // itself) — the standard disconnect/mutate/observe idiom, simpler than disclosure's self-convergence
  // shape because this rebuild recreates (not merely adopts) its furniture on every pass.
  #observer: MutationObserver | null = null

  // The crumb this control itself last auto-stamped `aria-current="page"` onto (or null) — tracked, not
  // DOM-sniffed, so a rebuild that changes which crumb is last can cleanly remove ONLY its own prior mark
  // (never touching an author-authored `[aria-current]` it deferred to).
  #autoStamped: Element | null = null

  // GH #1515 S2 — the CURRENTLY-folded crumbs, in the SAME order the overflow menu's proxy rows were built
  // (`#applyCollapse`/`#buildOverflowMenu`) — a real user `select` commit (which fires asynchronously, well
  // after the rebuild pass that populated this) reads `detail.index` straight back into this array to find
  // the real crumb to relay the click to. Reset to `[]` whenever nothing is folded.
  #currentFolded: Element[] = []

  protected connected(): void {
    this.internals.role = 'navigation' // ARIA via internals ONLY — never a host attribute (the pagination/toolbar precedent)

    this.effect(() => {
      // The APG-named-pattern default (intake §4 A11y row) — deliberately NOT pagination's null-default:
      // Breadcrumb has one canonical landmark name; multiple unnamed navs are an AT defect.
      this.internals.ariaLabel = this.label === '' ? 'Breadcrumb' : this.label
    })

    // GH #1515 S2 — a scope-owned effect (not a second observer) drives the SAME whole-anatomy #rebuild()
    // whenever `collapse`/`collapseKeepTrailing` change: both are read (transitively, via #applyCollapse)
    // during this effect's synchronous run, so a live prop change re-triggers it — the tabs.ts selection-
    // effect precedent (`this.#resolveIndex()` reads `this.selected` the same indirect way). Runs NOW (this
    // effect's own contract) — this performs the INITIAL build; the old direct `this.#rebuild()` call is
    // folded into it.
    this.effect(() => {
      this.#rebuild()
    })

    // GH #1515 S2 — ONE delegated listener set per event, on the HOST, registered ONCE (the pagination.ts
    // "component-checker retained-listener finding" precedent: a PER-MENU `this.listen(menu, …)` would
    // strand a fresh closure+listener — riding this connection's AbortSignal, never released until
    // disconnect — on every DISCARDED overflow menu, since `#buildOverflowMenu` creates a fresh `<ui-menu>`
    // on every fold-relevant rebuild pass). `ui-menu`'s `select`/`toggle`/`close` bubble+composed
    // (dom/element.ts `emit()`) up through `this` regardless of which menu instance is currently live, so a
    // delegated check against `event.target`'s own `[data-part="overflow"]` (menu.ts sets the event target
    // to the `<ui-menu>` host itself) is exactly as precise as a per-menu listener, without the retention.
    //
    // `stopImmediatePropagation()`, not merely `stopPropagation()` (the radio-group.ts precedent) — this
    // listener sits on the SAME node (`this`) a real consumer's own `el.addEventListener('select', …)` would
    // also sit on; `stopPropagation()` alone only blocks ANCESTORS, not a same-node sibling listener, so it
    // would NOT keep the raw menu payload from also reaching a consumer's own listener on `this`. Ordering
    // is safe: this listener is registered at connect time, before any consumer script gets a chance to
    // attach its own afterward.
    this.listen(this, 'select', (event) => {
      if (!this.#isOverflowTarget(event.target)) return
      event.stopImmediatePropagation() // C8 containment — ui-breadcrumb emits none of its own
      const detail = (event as CustomEvent<{ value: string; index: number }>).detail
      const target = this.#currentFolded[detail.index]
      if (!target) return
      const activator = target.matches('a') ? target : (target.querySelector('a') ?? target)
      ;(activator as HTMLElement).click() // dispatches even on a display:none node — the hidden crumb navigates
    })
    this.listen(this, 'toggle', (event) => {
      if (this.#isOverflowTarget(event.target)) event.stopImmediatePropagation()
    })
    this.listen(this, 'close', (event) => {
      if (this.#isOverflowTarget(event.target)) event.stopImmediatePropagation()
    })

    this.#observer = new MutationObserver(() => this.#rebuild())
    this.#observer.observe(this, { childList: true })
  }

  /** Is `target` the composed overflow-menu part (never a foreign bubbled event) — `ui-menu`'s own `emit()`
   *  sets the event target to the `<ui-menu>` host itself, which this control marks `data-part="overflow"`. */
  #isOverflowTarget(target: EventTarget | null): boolean {
    return target instanceof Element && target.getAttribute('data-part') === OVERFLOW_PART
  }

  protected disconnected(): void {
    this.#observer?.disconnect()
    this.#observer = null
  }

  /**
   * The whole-anatomy rebuild (the pagination.ts full-discard-and-recreate precedent, applied to
   * separators rather than stops): drop every previously-injected separator clone AND overflow-menu part,
   * re-find the (possibly still-absent) template, re-partition the crumbs, inject one fresh separator
   * before every crumb but the first, re-stamp `aria-current`, then (GH #1515 S2) fold the middle behind a
   * composed `ui-menu` if `collapse="menu"` calls for it. Disconnects/reconnects the observer around its
   * own DOM surgery — the mutations this method makes on `this` would otherwise retrigger it immediately
   * (unlike disclosure's heal(), this rebuild recreates furniture every pass rather than merely adopting
   * already-settled children, so it cannot rely on a second self-triggered pass finding a no-op).
   */
  #rebuild(): void {
    this.#observer?.disconnect()

    for (const stale of [...this.children]) {
      const part = stale.getAttribute('data-part')
      if (part === SEPARATOR_PART || part === OVERFLOW_PART) stale.remove()
    }

    const slotted = [...this.children].filter(isSeparatorSlotted)
    const template = slotted[0] ?? null
    for (const el of slotted) {
      // Inert furniture, never rendered — the FIRST one is also the clone source; every extra one is
      // simply hidden and otherwise ignored (deterministic "first wins" per the intake).
      el.setAttribute('hidden', '')
      el.setAttribute('aria-hidden', 'true')
    }

    const crumbs = [...this.children].filter((el) => !isSeparatorSlotted(el) && !isFurniture(el))
    // Clear a PRIOR pass's fold marks before recomputing — a crumb persists across rebuilds (unlike the
    // separators/overflow menu, just discarded above), so its `data-collapsed` residue would otherwise
    // survive into a pass where it no longer folds.
    for (const crumb of crumbs) crumb.removeAttribute('data-collapsed')

    for (let i = 1; i < crumbs.length; i++) {
      this.insertBefore(template ? this.#cloneSeparator(template) : this.#defaultSeparator(), crumbs[i])
    }

    this.#stampCurrent(crumbs)
    this.#applyCollapse(crumbs)

    this.#observer?.observe(this, { childList: true })
  }

  /**
   * GH #1515 S2 — `collapse="menu"` (the intake's Collapse mechanics row): pin the FIRST crumb and the LAST
   * `collapseKeepTrailing` crumbs (inclusive of the auto-stamped current/last one); when the non-empty
   * MIDDLE range folds, stamp `data-collapsed` on each folded crumb (breadcrumb.css: `display:none`, stays
   * in the DOM) and on every separator sitting BETWEEN two folded crumbs — except the ONE separator
   * immediately before the FIRST folded crumb, which stays visible as "the first gap" the composed
   * `ui-menu` occupies. `collapse="none"` (default) is a no-op — the anatomy stays byte-identical to S1.
   */
  #applyCollapse(crumbs: Element[]): void {
    this.#currentFolded = [] // stale unless a fresh #buildOverflowMenu below repopulates it
    if (this.collapse !== 'menu') return

    const keepTrailing = this.#clampedKeepTrailing()
    const n = crumbs.length
    const trailingStart = n - keepTrailing // the first PINNED-TRAILING index
    const foldEnd = Math.max(1, trailingStart) // fold range is crumbs[1, foldEnd) — exclusive
    const folded = foldEnd > 1 ? crumbs.slice(1, foldEnd) : []
    if (folded.length === 0) return // not enough crumbs to fold — renders bare, like collapse="none"

    for (const crumb of folded) crumb.setAttribute('data-collapsed', '')
    for (const crumb of folded.slice(1)) {
      const sep = crumb.previousElementSibling
      if (sep?.getAttribute('data-part') === SEPARATOR_PART) sep.setAttribute('data-collapsed', '')
    }

    const menu = this.#buildOverflowMenu(folded)
    this.insertBefore(menu, folded[0])
  }

  /** Clamp `collapseKeepTrailing` into a valid ≥1 integer — never trusts the raw bindable prop (the
   *  pagination.ts `#clampedPage` precedent): non-finite/`null` → the documented default (2); otherwise
   *  truncated and floored at 1 (the current/last crumb is always visible). */
  #clampedKeepTrailing(): number {
    const raw = this.collapseKeepTrailing
    const truncated = raw !== null && Number.isFinite(raw) ? Math.trunc(raw) : 2
    return Math.max(1, truncated)
  }

  /**
   * Build a fresh composed `<ui-menu data-part="overflow">` (GH #586 tabs precedent, minus fit-measurement):
   * a control-created `<button aria-label="Show hidden breadcrumbs">` trigger with the `dots-three` glyph
   * (GH #168, the fleet's one horizontal overflow icon) as the menu's first child, plus one proxy
   * `[role=menuitem]` row per folded crumb — built fully OFFLINE (so `ui-menu`'s own `connected()` sees its
   * trigger as `firstElementChild` already in place, `menu.ts` `#ensureParts`) and returned; the CALLER
   * (`#applyCollapse`) inserts it into the connected tree. `#currentFolded` is updated so the ONE delegated
   * `select` listener (`connected()`, above — never a per-menu listener, the pagination.ts retained-listener
   * precedent) can find the real crumb later, at actual commit time (never at build time — see the file
   * banner's "post-connect, never pre-upgrade" ordering note).
   */
  #buildOverflowMenu(folded: Element[]): UIMenuElement {
    const menu = document.createElement('ui-menu') as UIMenuElement
    menu.setAttribute('data-part', OVERFLOW_PART)

    const trigger = document.createElement('button')
    trigger.type = 'button'
    trigger.setAttribute('aria-label', 'Show hidden breadcrumbs') // literal English label — control-created, the tabs "More tabs" sanction
    setIcon(trigger, 'dots-three')
    menu.append(trigger)

    for (const [i, crumb] of folded.entries()) {
      const row = document.createElement('div')
      row.setAttribute('role', 'menuitem')
      row.tabIndex = -1
      row.dataset['value'] = String(i)
      row.textContent = crumb.getAttribute('aria-label') ?? crumb.textContent ?? ''
      menu.append(row)
    }

    this.#currentFolded = folded
    return menu
  }

  /** SNAPSHOT clone (never live) of the author's separator template — hygiene-stripped `id`s, `slot`/
   *  `hidden` removed (this is a rendered gap-filler now, not the template), re-marked as furniture. */
  #cloneSeparator(template: Element): HTMLElement {
    const clone = template.cloneNode(true) as HTMLElement
    clone.removeAttribute('id')
    for (const withId of clone.querySelectorAll('[id]')) withId.removeAttribute('id')
    clone.removeAttribute('slot')
    clone.removeAttribute('hidden')
    clone.setAttribute('data-part', SEPARATOR_PART)
    clone.setAttribute('aria-hidden', 'true')
    return clone
  }

  /** The unslotted default — a control-created `/` glyph, same furniture shape as a real clone. */
  #defaultSeparator(): HTMLElement {
    const span = document.createElement('span')
    span.setAttribute('data-part', SEPARATOR_PART)
    span.setAttribute('aria-hidden', 'true')
    span.textContent = '/'
    return span
  }

  /**
   * Auto-stamp `aria-current="page"` onto the LAST crumb, deferring if it (or a descendant) already
   * carries `[aria-current]` (a router-exact-active `ui-router-link`'s own stamped `<a>` — never double-
   * mark). First un-stamps a STALE prior auto-mark (a rebuild that changed which crumb is last) — tracked
   * via `#autoStamped`, never by sniffing the DOM for "the" current mark (which could misidentify an
   * author-authored one).
   */
  #stampCurrent(crumbs: Element[]): void {
    const last = crumbs.length > 0 ? crumbs[crumbs.length - 1] : undefined
    if (this.#autoStamped && this.#autoStamped !== last) {
      this.#autoStamped.removeAttribute('aria-current')
      this.#autoStamped = null
    }
    if (!last) return
    // component-checker fix: `last` already carrying `aria-current` is ONLY an author mark when it isn't
    // the control's OWN prior stamp — an unchanged-last rebuild sees its own mark here and must not read
    // that as "already marked, defer" (which abandoned #autoStamped tracking and could double-mark on a
    // LATER rebuild that changes which crumb is last, since nothing was left to un-stamp).
    const isOwnStamp = last === this.#autoStamped && last.getAttribute('aria-current') === 'page'
    if (!isOwnStamp && (last.hasAttribute('aria-current') || last.querySelector('[aria-current]'))) {
      this.#autoStamped = null
      return
    }
    if (isOwnStamp) return // already correctly stamped, nothing to do
    last.setAttribute('aria-current', 'page')
    this.#autoStamped = last
  }
}

if (!customElements.get('ui-breadcrumb')) customElements.define('ui-breadcrumb', UIBreadcrumbElement)
