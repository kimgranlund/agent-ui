// breadcrumb.ts — UIBreadcrumbElement, `ui-breadcrumb` S1 CORE ANATOMY (GH #1515; the frozen design intake,
// `.claude/docs/spec/breadcrumb.intake.md` §4/§7 slice S1). BEHAVIOUR + props + the imperative separator-
// injection rebuild + self-define ONLY; geometry/token CSS lives in breadcrumb.css, the public contract in
// breadcrumb.md.
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
// `collapse`/`collapseKeepTrailing` (the composed-`ui-menu` overflow fold) is A LATER SLICE (S2, GH #1515)
// — deliberately not built here; this slice ships gate-green and complete on its own (core anatomy +
// separator + a11y + geometry only).
//
// No events of its own: crumb activation is native anchor navigation (S1 has no collapse/relay to wire).
//
// `controls → dom` only — no traits (no overlay, no roving focus: N independent links in normal tab order,
// the ADR-0163 cl.3 "no composite widget" posture, per the intake's Keyboard/focus row).

import { UIElement, prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'

const props = {
  // The accessible NAVIGATION-LANDMARK name → internals.ariaLabel. Unlike ui-pagination's null-default
  // posture, Breadcrumb HAS a canonical APG landmark name — an empty label falls back to 'Breadcrumb'
  // (never null), the intake's deliberate deviation from the pagination precedent (§4 A11y row).
  label: { ...prop.string(''), reflect: true },
  // ADR-0223 (Fill by Default) — the ONE sizing opt-out, fleet-shared name: reflects so the `:scope[inline]`
  // CSS leg (inline-level display + hug posture) applies to JS-set values. Default (absent) = block-level fill.
  inline: { ...prop.boolean(false), reflect: true },
} satisfies PropsSchema

const SEPARATOR_SLOT = 'separator'
const SEPARATOR_PART = 'separator'

/** Is `el` the (or an inert extra) separator template — a light-DOM child marked `slot="separator"`
 *  (the disclosure `slot="summary"` position-slot grammar, ADR-0158, reused verbatim for one gap-filler
 *  template rather than a per-item slot). */
const isSeparatorSlotted = (el: Element): boolean => el.getAttribute('slot') === SEPARATOR_SLOT

/** Is `el` control-created furniture (a previously-injected separator clone, or a future composed part) —
 *  never a crumb. Any `[data-part]` is furniture, forward-compatible with S2's `[data-part="overflow"]`. */
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

  protected connected(): void {
    this.internals.role = 'navigation' // ARIA via internals ONLY — never a host attribute (the pagination/toolbar precedent)

    this.effect(() => {
      // The APG-named-pattern default (intake §4 A11y row) — deliberately NOT pagination's null-default:
      // Breadcrumb has one canonical landmark name; multiple unnamed navs are an AT defect.
      this.internals.ariaLabel = this.label === '' ? 'Breadcrumb' : this.label
    })

    this.#rebuild()

    this.#observer = new MutationObserver(() => this.#rebuild())
    this.#observer.observe(this, { childList: true })
  }

  protected disconnected(): void {
    this.#observer?.disconnect()
    this.#observer = null
  }

  /**
   * The whole-anatomy rebuild (the pagination.ts full-discard-and-recreate precedent, applied to
   * separators rather than stops): drop every previously-injected separator clone, re-find the (possibly
   * still-absent) template, re-partition the crumbs, inject one fresh separator before every crumb but the
   * first, and re-stamp `aria-current`. Disconnects/reconnects the observer around its own DOM surgery — the
   * mutations this method makes on `this` would otherwise retrigger it immediately (unlike disclosure's
   * heal(), this rebuild recreates furniture every pass rather than merely adopting already-settled
   * children, so it cannot rely on a second self-triggered pass finding a no-op).
   */
  #rebuild(): void {
    this.#observer?.disconnect()

    for (const stale of [...this.children]) {
      if (stale.getAttribute('data-part') === SEPARATOR_PART) stale.remove()
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

    for (let i = 1; i < crumbs.length; i++) {
      this.insertBefore(template ? this.#cloneSeparator(template) : this.#defaultSeparator(), crumbs[i])
    }

    this.#stampCurrent(crumbs)

    this.#observer?.observe(this, { childList: true })
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
