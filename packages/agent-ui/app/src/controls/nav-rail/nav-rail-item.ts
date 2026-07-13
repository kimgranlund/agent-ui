// nav-rail-item.ts — UINavRailItemElement, one `ui-nav-rail` row (ADR-0130 cl.4/cl.7; SPEC nav-rail-
// family.spec.md SPEC-R3/R6; LLD nav-rail-family.lld.md LLD-C3).
//
// Shape (SPEC-R3): `href` non-empty renders a REAL `<a href>` — genuine navigation (status-bar preview,
// ctrl/cmd-click-new-tab, crawlability), none of which ARIA alone can replicate. `href` empty renders a
// REAL `<button type="button">` — native Enter/Space + click, no bespoke trait needed — with its role
// overridden to `tab` (a `<button role="tab">` is a single well-formed node: `role` REPLACES a native
// element's implicit role, it does not stack a second node's role on top of it — no nested-interactive
// antipattern). Both shapes are ONE created "activator" part (`[data-part=activator]`), created lazily and
// SWAPPED (never left as two coexisting nodes) only when the SHAPE itself changes — `href` toggling
// empty↔non-empty post-connect (LLD-C3 failure/edge handling: "reactively re-renders the <a>/<button>
// swap"). A same-shape `href` VALUE change (e.g. one URL to another) just updates `.href` in place.
//
// ARIA rides the created activator PART via plain attributes (never `ElementInternals` — `attachInternals()`
// throws on a plain, non-custom `<a>`/`<button>`, so ElementInternals is mechanically UNAVAILABLE here; the
// convention this follows is the fleet's OWN "a created light-DOM part uses setAttribute, only the HOST's
// own internals are reserved for the FACE law" precedent — `ui-menu`'s panel (`role=menu`) and `ui-tabs`'
// tablist strip (`role=tablist`) both set their role via `setAttribute` on a created part, never touching
// their host's internals for it. The host itself (`ui-nav-rail-item`) carries no ARIA of its own — it is a
// transparent structural wrapper, `display:contents` (nav-rail.css), never a semantic node in its own
// right here (unlike `ui-tab`, which IS its own single interactive node with no created part).
//
// Anatomy (anatomy.md slot/role axes): an OPTIONAL `[slot=leading][data-role=icon]` adornment, the default/
// unnamed children (the item's accessible name — re-expressed into a synthetic `[data-part=label]` span so
// `collapse="icon-popover"` can visually-hide JUST the label, anatomy.md's slot vocabulary applied one
// level down), and an OPTIONAL `[slot=trailing][data-role=tag]` adornment (REALIZES anatomy.md's reserved
// `tag` role, SPEC-R6). All three cells live inside the activator part; nav-rail.css lays them out with the
// SAME presence-driven `:has()` host-as-grid pattern `button.css` establishes.
//
// `controls → @agent-ui/components` only (SPEC §5 layering gate).

import { UIElement, prop, type PropsSchema, type ReactiveProps } from '@agent-ui/components'

const props = {
  href: { ...prop.string(''), reflect: true },
  selected: { ...prop.boolean(false), reflect: true },
} satisfies PropsSchema

export interface UINavRailItemElement extends ReactiveProps<typeof props> {}
export class UINavRailItemElement extends UIElement {
  static props = props

  // The created activator part — persists across reconnect (parts-created-once precedent); swapped (not
  // merely updated) only when `href` flips empty↔non-empty shape.
  #activator: HTMLAnchorElement | HTMLButtonElement | null = null

  protected connected(): void {
    // Shape (href empty ↔ non-empty) + the href VALUE itself.
    this.effect(() => {
      const href = this.href
      const wantAnchor = href !== ''
      const activator = this.#ensureActivator(wantAnchor)
      if (activator instanceof HTMLAnchorElement) activator.href = href
    })

    // ARIA state tracking `selected` — aria-current (link shape, SPEC-R3 AC1) or aria-selected (button
    // shape, SPEC-R3 AC2), on the activator part, never a one-shot (re-applies on every `selected` change,
    // and again whenever the activator itself is swapped by the effect above — both effects re-run off
    // the SAME underlying activator field, ordered so the shape settles first on any given flush).
    this.effect(() => {
      const selected = this.selected
      const activator = this.#activator
      if (!activator) return
      if (activator instanceof HTMLAnchorElement) {
        if (selected) activator.setAttribute('aria-current', 'page')
        else activator.removeAttribute('aria-current')
      } else {
        activator.setAttribute('aria-selected', String(selected))
      }
    })
  }

  /**
   * Idempotent activator creation/swap (parts-created-once, `button.ts`/`app-shell.ts` precedent, here
   * extended with a SHAPE swap): returns the current activator unchanged when the wanted shape already
   * matches; otherwise builds a fresh `<a>`/`<button>`, partitions the SOURCE's children into leading /
   * label / trailing (the anatomy.md axes), re-wraps the label run in one synthetic `[data-part=label]`
   * span (so `collapse="icon-popover"` can visually-hide JUST the label — a bare text-node label has no
   * element a CSS selector could otherwise reach), and retires the old activator (if any).
   */
  #ensureActivator(wantAnchor: boolean): HTMLAnchorElement | HTMLButtonElement {
    const current = this.#activator
    const isAnchor = current instanceof HTMLAnchorElement
    if (current && isAnchor === wantAnchor) return current

    const next = wantAnchor ? document.createElement('a') : document.createElement('button')
    next.setAttribute('data-part', 'activator')
    if (next instanceof HTMLButtonElement) {
      next.type = 'button'
      next.setAttribute('role', 'tab') // overrides the native implicit "button" role — ONE node, ONE role
      next.setAttribute('aria-selected', String(this.selected))
    }

    // First build reads the HOST's own raw light-DOM children; a later shape-swap reads the OLD
    // activator's (already leading/label/trailing-partitioned) children instead.
    const source: Element = current ?? this
    const leading = source.querySelector(':scope > [slot="leading"]')
    const trailing = source.querySelector(':scope > [slot="trailing"]')
    const label = document.createElement('span')
    label.setAttribute('data-part', 'label')
    for (const node of [...source.childNodes]) {
      if (node === leading || node === trailing) continue
      label.append(node)
    }
    if (leading) next.append(leading)
    next.append(label)
    if (trailing) next.append(trailing)

    current?.remove()
    this.appendChild(next)
    this.#activator = next
    return next
  }
}

if (!customElements.get('ui-nav-rail-item')) customElements.define('ui-nav-rail-item', UINavRailItemElement)
