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
// `collapse="menu"` narrow disclosure (SPEC-R5, LLD-C4) — ported from the docs site's own zero-JS
// `<details>/<summary>` mechanism (`_page.css`), now owned by the component + a small real ESCAPE/outside-
// click JS ENHANCEMENT (SPEC-R5 AC2 gates dismissal the site's CURRENT markup does not yet implement — a
// deliberate upgrade the componentization earns, not a silent behavior change to the site itself, which
// this phase does not touch).
//
// `controls → @agent-ui/components` (incl. `ui-menu`, transitively via nav-rail-group.ts) only — NEVER
// `ui-master-detail`/`@agent-ui/router` (SPEC §5 layering gate; `collapse="drill-in"` contributes anatomy
// ONLY, the consumer composes `ui-master-detail`, ADR-0130 cl.5).

import { UIElement, prop, type PropsSchema, type ReactiveProps } from '@agent-ui/components'
import type { UIMenuElement } from '@agent-ui/components/controls/menu'
import './nav-rail-group.ts'
import { UINavRailItemElement } from './nav-rail-item.ts'

const COLLAPSE_VALUES = ['menu', 'drill-in', 'icon-popover'] as const // 'menu' leads = the enum-fallback default (ADR-0130 cl.2)

const props = {
  collapse: { ...prop.enum(COLLAPSE_VALUES, 'menu'), reflect: true },
} satisfies PropsSchema

export interface UINavRailElement extends ReactiveProps<typeof props> {}
export class UINavRailElement extends UIElement {
  static props = props

  // The disclosure DOM parts — created ONCE (persist across reconnect, the parts-created-once precedent).
  // NOT the guard for listener/effect (re)registration — see `connected()`'s own comment for why.
  #disclosure: HTMLDetailsElement | null = null
  #summary: HTMLElement | null = null

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

    // collapse="menu" — the narrow disclosure (LLD-C4). The DOM structure (`#ensureDisclosure`) is built
    // ONCE and persists across reconnect; the dismissal listeners + label-sync effect (`#wireDisclosure`)
    // are re-armed on EVERY connect via a closure-local `wired` flag — fresh per `connected()` call, the
    // `ui-app-shell-region` `wired` precedent (app-shell.ts) — because `this.listen`/`this.effect` ride the
    // CURRENT connection's AbortController/scope (element.ts) and die at disconnect. A single `#`-field
    // guard covering BOTH construction and wiring would leave the listeners/effect dead forever after a
    // real disconnect+reconnect (e.g. an ancestor `ui-app-shell` opting into `isolated`, ADR-0082) even
    // though the disclosure DOM (and its content) survives — the component-reviewer's Finding 1.
    let wired = false
    this.effect(() => {
      if (this.collapse !== 'menu') return
      const { disclosure, summary } = this.#ensureDisclosure()
      if (wired) return
      wired = true
      this.#wireDisclosure(disclosure, summary)
    })
  }

  #deriveRole(): void {
    const items = [...this.querySelectorAll('ui-nav-rail-item')] as UINavRailItemElement[]
    const allBare = items.length > 0 && items.every((item) => item.href === '')
    this.internals.role = allBare ? 'tablist' : 'navigation' // mixed/empty ⇒ navigation (SPEC §7 non-goal)
  }

  /** Idempotent DOM construction ONLY (persists across reconnect) — never re-run once `#disclosure` is
   *  set. Content-relocation (`list.append(...this.childNodes)`) happens exactly once, at first build. */
  #ensureDisclosure(): { disclosure: HTMLDetailsElement; summary: HTMLElement } {
    if (this.#disclosure && this.#summary) return { disclosure: this.#disclosure, summary: this.#summary }
    const disclosure = document.createElement('details')
    disclosure.setAttribute('data-part', 'disclosure')
    const summary = document.createElement('summary')
    summary.setAttribute('data-part', 'trigger')
    const list = document.createElement('div')
    list.setAttribute('data-part', 'list')
    list.append(...this.childNodes)
    disclosure.append(summary, list)
    this.append(disclosure)
    this.#disclosure = disclosure
    this.#summary = summary
    return { disclosure, summary }
  }

  /** Listener/effect (re)registration ONLY — called once per `connected()` (via the closure-local `wired`
   *  flag in `connected()` itself), never gated behind a persistent field: `this.listen`/`this.effect` ride
   *  THIS connection's AbortController/scope and must be re-armed every time the element reconnects. */
  #wireDisclosure(disclosure: HTMLDetailsElement, summary: HTMLElement): void {
    this.effect(() => {
      summary.textContent = this.#currentLabel()
    })

    // Escape / outside-click dismissal (SPEC-R5 AC2) — a small, deliberate JS enhancement: native
    // `<details>` has no built-in outside-click/Escape close.
    this.listen(document, 'click', (event) => {
      if (!disclosure.open) return
      if (event.composedPath().includes(disclosure)) return
      disclosure.open = false
    })
    this.listen(disclosure, 'keydown', (event) => {
      const key = (event as KeyboardEvent).key
      if (key === 'Escape' && disclosure.open) {
        disclosure.open = false
        summary.focus()
      }
    })
  }

  /** The disclosure trigger's label — the selected item's text, else the first item's, else a fallback. */
  #currentLabel(): string {
    const items = [...this.querySelectorAll('ui-nav-rail-item')] as UINavRailItemElement[]
    const active = items.find((item) => item.selected)
    return active?.textContent?.trim() || items[0]?.textContent?.trim() || 'Menu'
  }
}

if (!customElements.get('ui-nav-rail')) customElements.define('ui-nav-rail', UINavRailElement)
