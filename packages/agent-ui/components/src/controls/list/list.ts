// list.ts — UIListElement, the semantic vertical-stack layout primitive (goals.md §G9 / ADR-0016 cl.3;
// decomp g9-containers slice s5). BEHAVIOUR + props + the list role + self-define ONLY; the flex layout +
// surface seam live in list.css.
//
// `ui-list` is a `ui-column` SPECIALIZATION that adds LIST SEMANTICS: it is a `display:flex` vertical stack
// (the surface base `UIContainerElement`, ADR-0015 — NOT form-associated) whose host carries the ARIA
// `role="list"`. The role is set THROUGH the protected `internals` (the family discipline, ADR-0010 /
// element.ts), NEVER a host `role` attribute, so the host stays free of `role`/`aria-*`. Its children are
// the list items, composed by the agent as a ChildList (the A2UI child model), and stay untouched light DOM
// (`render()` stays the inherited VOID). The listitem role (T-0519) rides a list-owned part: a manual-slot
// shadow root holds one `<div part="item" role="listitem">` per child, each slotting exactly that child, so
// ARIA's required owned listitems exist without a `role` attribute on a child (which would override a ui-*
// child's own internals role, ui-card's `group` say). list.css sets the part to `display: contents`, so the
// flex layout still sees the children as its items.
//
// It consumes the two shared spreadable prop sets the container family declares (no static-props prototype
// merge — the ADR-0013 `formProps` precedent): `surfaceProps` (elevation/brightness, the surface axes) and
// `flexProps` (align/justify/gap/wrap, the A2UI-faithful layout grammar). The literal-union → CSS-keyword
// mapping is a role-pure repoint in list.css's `@scope` block; the base owns no flex/surface CSS.
//
// IS an A2UI catalog type — `List` (ADR-0087 Fork A, Wave C; supersedes ADR-0016's earlier non-catalog
// exclusion) renders to `ui-list`. Reach for `List` over `Column` for a homogeneous, itemized collection where
// list semantics matter to assistive tech; reach for `Row`/`Column` for a heterogeneous arrangement, and
// `Grid` when the layout should reflow its column count responsively (a2ui-catalog.spec.md §5.2).
//
// Imports the surface base from the same-layer dom `../../dom/container.ts` (not re-exported from the dom
// barrel until s12) + the typed-prop authoring types from the dom barrel. `controls → dom` is the allowed
// import direction (the layering law: reactive ← dom ← controls).

import type { PropsSchema, ReactiveProps } from '../../dom/index.ts'
import { UIContainerElement } from '../../dom/container.ts'

// The full prop surface = the two shared spreadable sets folded into this control's own `static props` (each
// already carries `reflect: true` from the base, so the `[elevation]`/`[align]`/etc. attribute selectors in
// list.css apply to JS-set values too). No re-declaration of the surface/flex grammar — one home, ADR-0016.
// ADR-0030: `align` default overridden from `start` to `stretch` (parity with ui-column — a ui-list IS a
// ui-column specialization; its cross axis is inline/width; children should fill the width by default).
const props = {
  ...UIContainerElement.surfaceProps, // elevation / brightness (ADR-0015)
  ...UIContainerElement.flexProps, // align / justify / gap / wrap (ADR-0016) — a vertical stack
  align: { ...UIContainerElement.flexProps.align, default: 'stretch' as const }, // ADR-0030: override default ONLY; `as const` preserves the literal-union type (prevents string widening)
} satisfies PropsSchema

export interface UIListElement extends ReactiveProps<typeof props> {}
export class UIListElement extends UIContainerElement {
  static props = props

  #items = new Map<Node, HTMLElement>() // light child -> its listitem part in the shadow root
  #observer: MutationObserver | null = null

  constructor() {
    super()
    // Manual assignment: each item part's slot takes exactly one child, with no `slot` attribute on it.
    this.attachShadow({ mode: 'open', slotAssignment: 'manual' })
  }

  protected connected(): void {
    // LIST SEMANTICS — `role=list` rides the host's ElementInternals, never a host `role` attribute (the
    // family discipline). A constant semantic role, so it is set DIRECTLY (not in an effect); re-set on each
    // connect (idempotent). `render()` stays void so the ChildList children flow through untouched.
    this.internals.role = 'list'
    this.#sync()
    this.#observer = new MutationObserver(() => this.#sync())
    this.#observer.observe(this, { childList: true })
  }

  protected disconnected(): void {
    this.#observer?.disconnect()
    this.#observer = null
  }

  /** One listitem part per element or non-blank text child, in child order; parts of removed children go.
   *  Incremental: a part already in place is never detached, so a focused child keeps focus across a sync. */
  #sync(): void {
    const root = this.shadowRoot
    if (!root) return
    const next = new Map<Node, HTMLElement>()
    let at = 0
    for (const child of this.childNodes) {
      const isItem = child.nodeType === Node.ELEMENT_NODE || (child.nodeType === Node.TEXT_NODE && child.textContent?.trim())
      if (!isItem) continue
      let item = this.#items.get(child)
      if (!item) {
        item = document.createElement('div')
        item.setAttribute('part', 'item')
        item.setAttribute('role', 'listitem') // a real attribute on this list-owned part; internals is host-only
        item.append(document.createElement('slot'))
      }
      const slot = item.firstElementChild as HTMLSlotElement
      if (typeof slot.assign === 'function') slot.assign(child as Element | Text) // jsdom has no manual slots
      next.set(child, item)
      const here = root.children[at] ?? null
      if (here !== item) root.insertBefore(item, here)
      at++
    }
    for (const [child, item] of this.#items) if (!next.has(child)) item.remove()
    this.#items = next
  }
}

if (!customElements.get('ui-list')) customElements.define('ui-list', UIListElement)
