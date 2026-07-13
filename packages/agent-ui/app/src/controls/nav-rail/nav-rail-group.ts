// nav-rail-group.ts — UINavRailGroupElement, an optional cluster inside `ui-nav-rail` (ADR-0130 cl.3/cl.6;
// SPEC nav-rail-family.spec.md SPEC-R2/R6/R8; LLD nav-rail-family.lld.md LLD-C2).
//
// Anatomy: `label` non-empty renders a `<span data-part="context-label">` heading above the group's items
// (SPEC-R6, the mode-1 context-label requirement) — reactive to `label` changing at any time. Children
// (`ui-nav-rail-item`) are composed ONE of two ways, decided ONCE at connect (LLD-C2 "switching a live
// rail's collapse post-connect is NOT a supported reactive transition at v1 — takes effect on next
// reconnect"): a plain `<div data-part="items">` wrapper (menu/drill-in modes, or icon-popover with < 2
// items — a lone item needs no popover, SPEC §7 non-goal avoided) OR an internally-composed `ui-menu`
// (icon-popover mode, 2+ items, ADR-0130 cl.6).
//
// The `collapse`-mode read (`this.closest('ui-nav-rail')?.collapse`) is a DIRECT cross-element signal read
// — the fleet's first sub-element-reads-ancestor-prop-directly consumer (LLD §8); it is wrapped in
// `this.effect` so the READ is tracked (proving the mechanism), while the actual DOM-building code it
// gates is idempotent (`#composed` guard) — a later live `collapse` change does not rebuild (documented
// v1 limitation, matches the LLD's own ruling).
//
// Icon-popover composition (LLD-C2 detail; LLD-C5's cross-group half lives on `ui-nav-rail` itself): each
// original `ui-nav-rail-item` child's STATE (href / selected / textContent / leading+trailing adornments)
// is read ONCE — before any child has had a chance to build its OWN activator (tree-order connectedCallback
// runs ANCESTOR before DESCENDANT, so this group's `connected()` always runs before an `ui-nav-rail-item`
// child's; reading raw light-DOM props/children here, never `#activator`, sidesteps that ordering
// entirely) — and re-expressed as a fresh `<a>`/`<button>` appended DIRECTLY into a composed `ui-menu`
// (letting `ui-menu`'s own `#ensureParts` auto-assign `role=menuitem` — correct uniformly for both link-
// and button-shaped source items once relocated into a menu, APG "a menu's children are menuitems"). Every
// authored node the original item carried (its leading/trailing slot elements) is MOVED, never cloned, into
// the synthetic child — a moved node cannot leave an orphan duplicate behind (the component-reviewer's
// Finding 2, which a bare `cloneNode` on the GROUP's own leading icon had left as a visible, unstyled
// second copy). `selected` carries over as a plain `data-selected` marker (the `ui-settings`
// `[data-active]` precedent — a JS-owned presentation marker, not an ARIA/`data-role`/custom-state
// concept `ui-menu`'s own menuitem semantics would conflict with). The ORIGINAL `ui-nav-rail-item`
// elements are removed (their content already fully re-expressed) — mirrors `ui-tabs`/`ui-menu`'s own
// "move/remove a child before it independently connects" pattern, already proven safe fleet-wide.
//
// A button-shaped synthetic item's commit (`ui-menu`'s own `select` event) is forwarded as the SAME
// `select`/`change` pair `ui-nav-rail` emits for a top-level item — the observable-behavior equivalent of
// LLD-C2's "dispatches the equivalent activation" (never re-deriving `ui-menu`'s own roving-focus/commit-
// and-close/dismissal contract, inherited wholesale per ADR-0130 cl.6). The forwarding LISTENER is wired on
// EVERY `connected()` (a closure-local `wired` flag, fresh per call — the `ui-app-shell-region` `wired`
// precedent, app-shell.ts), never gated behind the persistent `#composed` DOM-construction guard: `this.
// listen` rides the CURRENT connection's AbortController and dies at disconnect, so a single guard covering
// BOTH construction and wiring would leave the forwarding dead forever after a reconnect even though the
// composed `ui-menu` itself survives (the component-reviewer's Finding 1).
//
// `controls → @agent-ui/components` (incl. `ui-menu`) only (SPEC §5 layering gate).

import { UIElement, prop, type PropsSchema, type ReactiveProps } from '@agent-ui/components'
import '@agent-ui/components/controls/menu'
import type { UIMenuElement } from '@agent-ui/components/controls/menu'
import { UINavRailItemElement } from './nav-rail-item.ts'

const props = {
  label: { ...prop.string(''), reflect: false },
} satisfies PropsSchema

export interface UINavRailGroupElement extends ReactiveProps<typeof props> {}
export class UINavRailGroupElement extends UIElement {
  static props = props

  #contextLabel: HTMLElement | null = null
  // DOM-construction guards (persist across reconnect — parts/composition are built exactly once).
  #composed = false
  #menu: UIMenuElement | null = null
  #sources: UINavRailItemElement[] = []

  protected connected(): void {
    // The context-label heading — reactive to `label` for as long as this element lives (independent of
    // the one-time items/menu composition below).
    this.effect(() => {
      const label = this.label
      if (label === '') {
        this.#contextLabel?.remove()
        this.#contextLabel = null
        return
      }
      if (!this.#contextLabel) {
        const span = document.createElement('span')
        span.setAttribute('data-part', 'context-label')
        this.insertBefore(span, this.firstChild)
        this.#contextLabel = span
      }
      this.#contextLabel.textContent = label
    })

    // The one-time items/menu DOM composition (LLD-C2, `#composed`) vs. the PER-CONNECTION forwarding-
    // listener wiring (`wired`, closure-local — the component-reviewer's Finding 1): composition builds
    // the `ui-menu` (or the plain wrapper) exactly once and persists it across reconnect; the listener that
    // turns a synthetic item's commit into the rail's own select/change must be re-armed on EVERY connect,
    // since `this.listen` rides the current connection and dies at disconnect.
    let wired = false
    this.effect(() => {
      const collapse = (this.closest('ui-nav-rail') as (UIElement & { collapse?: string }) | null)?.collapse ?? 'menu'
      if (!this.#composed) {
        this.#composed = true
        const items = this.#itemChildren()
        if (collapse === 'icon-popover' && items.length >= 2) {
          const { menu, sources } = this.#composeIconPopover(items)
          this.#menu = menu
          this.#sources = sources
        } else {
          this.#composeItemsWrapper(items)
        }
      }
      if (this.#menu && !wired) {
        wired = true
        this.#wireMenuForwarding(this.#menu, this.#sources)
      }
    })
  }

  /** The group's direct `ui-nav-rail-item` children, in DOM order (excludes the context-label span). */
  #itemChildren(): UINavRailItemElement[] {
    return [...this.children].filter((c): c is UINavRailItemElement => c instanceof UINavRailItemElement)
  }

  /** menu/drill-in modes (or a degenerate < 2-item icon-popover group): a plain wrapper — items render
   *  inline, unchanged. Never throws on 0 items (SPEC-R2 AC1 generalized to the group level). */
  #composeItemsWrapper(items: UINavRailItemElement[]): void {
    const wrapper = document.createElement('div')
    wrapper.setAttribute('data-part', 'items')
    wrapper.append(...items)
    this.append(wrapper)
  }

  /** icon-popover mode, 2+ items (ADR-0130 cl.6): one internal `ui-menu`, trigger = the group's own icon/
   *  label, panel items = each original item's state (href/selected/text/leading/trailing) re-expressed as
   *  a fresh `<a>`/`<button>`. Pure DOM construction — no listener wiring (see `#wireMenuForwarding`, called
   *  separately on every connect, the component-reviewer's Finding 1). */
  #composeIconPopover(items: UINavRailItemElement[]): { menu: UIMenuElement; sources: UINavRailItemElement[] } {
    const trigger = document.createElement('button')
    trigger.type = 'button'
    trigger.setAttribute('aria-label', this.label || 'More')
    // MOVE (never clone) the group's own leading icon into the trigger — a `cloneNode` here would leave
    // the ORIGINAL as a second, unstyled, visible orphan child (the component-reviewer's Finding 2).
    const leadingIcon = this.querySelector(':scope > [slot="leading"]')
    if (leadingIcon) trigger.append(leadingIcon)

    const menu = document.createElement('ui-menu') as UIMenuElement
    menu.append(trigger)

    const sources: UINavRailItemElement[] = []
    for (const item of items) {
      const href = item.href
      const child = href !== '' ? document.createElement('a') : document.createElement('button')
      if (child instanceof HTMLAnchorElement) child.href = href
      else (child as HTMLButtonElement).type = 'button'
      // Carry the FULL state the descriptor promises (nav-rail-group.md "selected/leading icon ...
      // re-expressed") — never silently drop it (the component-reviewer's Finding 3). `selected` rides a
      // plain `data-selected` marker (the `ui-settings` `[data-active]` precedent — JS-owned presentation
      // state, not an ARIA concept `ui-menu`'s own `role=menuitem` semantics would conflict with).
      child.toggleAttribute('data-selected', item.selected)
      const leading = item.querySelector(':scope > [slot="leading"]')
      const trailing = item.querySelector(':scope > [slot="trailing"]')
      if (leading) child.append(leading) // moved — the source item is spent (removed below)
      child.append(document.createTextNode(item.textContent ?? ''))
      if (trailing) child.append(trailing)
      menu.append(child)
      sources.push(item)
      item.remove() // content fully re-expressed above — the original is spent (the ui-tabs/ui-menu "move
      // a child before it independently connects" precedent)
    }

    this.append(menu)
    return { menu, sources }
  }

  /** Forward a bare (selection-commit) item's activation to the rail's own select/change pair — never a
   *  link-shaped item's (real navigation already happened natively; `ui-menu` never intercepts it either).
   *  Called on EVERY `connected()` (never gated behind the persistent `#composed`/`#menu` construction
   *  guard — `this.listen` rides the CURRENT connection and dies at disconnect, the component-reviewer's
   *  Finding 1). `event.stopPropagation()` first — an event-boundary guard (the `ui-settings`/composed-
   *  `ui-master-detail` precedent, settings.ts): `ui-menu`'s own `select` ALSO bubbles (every `emit()` is
   *  `bubbles:true composed:true`), which would otherwise ALSO reach the rail's own listener with a
   *  DIFFERENT detail shape (`{value,index}` vs. the rail's plain string) — a doubled, mis-shaped emission
   *  for one user action. This element remains the sole re-emitter, normalizing the shape. */
  #wireMenuForwarding(menu: UIMenuElement, sources: UINavRailItemElement[]): void {
    this.listen(menu, 'select', (event) => {
      event.stopPropagation()
      const detail = (event as CustomEvent<{ value: string; index: number }>).detail
      const source = sources[detail.index]
      if (!source || source.href !== '') return
      const rail = this.closest('ui-nav-rail') as UIElement | null
      rail?.emit('select', detail.value)
      rail?.emit('change', detail.value)
    })
  }
}

if (!customElements.get('ui-nav-rail-group')) customElements.define('ui-nav-rail-group', UINavRailGroupElement)
