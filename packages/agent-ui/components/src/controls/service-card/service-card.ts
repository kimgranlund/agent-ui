// service-card.ts — UIServiceCardElement, the availability-stated service/agent launch card (ADR-0224,
// GH #1429). A display primitive: extends UIElement — NOT UIContainerElement (the interior is a fixed,
// component-rendered anatomy from hardened data props, not an agent-composed ChildList) and NOT
// form-associated (the card carries no value). Tier: pattern (container spacing + one control-height
// action row, ADR-0224 cl.1).
//
// THE AVAILABILITY LAW, BY CONSTRUCTION (cl.4): `available` is the one bindable boolean that drives FOUR
// coordinated visual consequences from ONE write — the accent edge + status dot repoint, the title mute,
// and the action's Open⟷Unavailable swap — while the `menu` slot and the host stay fully live (never
// `aria-disabled` on the host; unavailable is DATA, not disablement). No producer ever re-derives these
// four independently; the split-state defect class is unrepresentable.
//
// THE SELF-REFLECT-ON-CONNECT GUARD: `available` reflects (ADR-0224 cl.2, an external/bindable contract),
// but the fleet's reflect boundary (dom/props.ts) only writes the attribute on a SETTER call — a prop's
// DECLARED DEFAULT is never auto-reflected at upgrade. Since `available` defaults to `true` (a shape with
// zero fleet precedent — every other reflected boolean defaults `false`, where "never set" and
// "explicitly false" both correctly read as attribute-absent), a freshly-created `<ui-service-card>` that
// never has `.available` assigned would sit at attribute-ABSENT while the LIVE value is `true` —
// indistinguishable, by attribute alone, from an explicit `available="false"` write (also
// attribute-absent, `booleanType.to(false) === null`). CSS keyed on `[available]`/`:not([available])`
// would therefore mis-style the common unadorned-default case UNTIL a producer happens to write the prop.
// The fix stays entirely inside the ALREADY-declared public prop surface (no new custom state — the fleet
// custom-state vocabulary, naming.md §6, is closed; minting a member is an ADR-level decision, not this
// build's to make): the FIRST line of `connected()` re-assigns `this.available = this.available` — a
// normal write through the PUBLIC setter, which unconditionally reflects (the same path any producer's
// own explicit write takes) — so the attribute is forced to mirror the live value at every single connect,
// closing the gap before the first paint. CSS can then key on the plain `[available]`/`:not([available])`
// attribute, the fleet's ordinary idiom (button.css's own `[disabled]` shape) with zero new mechanism.
//
// Anatomy (cl.3): a component-owned `border-inline-start` accent band (pure CSS, host-level — no DOM node
// of its own) · a component-built `[data-part="body"]` (title/path/description, presence-driven for the
// two optional parts) · a component-built `[data-part="heading"]` (the status dot + title, side by side)
// · a visually-hidden-but-announced `[data-part="status-text"]` (the ADR-0057 non-color signifier, the
// stat.ts delta-word shape) · a REAL native `<button type="button" data-part="action">` — deliberately
// NOT `ui-button`: only a genuine native button gets tab-order removal, the inert activation contract,
// and forced-colors GrayText FOR FREE from the platform when `.disabled` flips, the ONE element identity
// across both states cl.3/cl.6 name explicitly (interaction-states.md §3 is written for a CUSTOM ELEMENT
// simulating disabled — a real native button needs none of that machinery) · ONE optional light-DOM
// `[slot="menu"]` position (app chrome — the consumer composes `ui-button`+`ui-menu`; this card never
// fabricates a menu it cannot populate).
//
// Parts are built ONCE (idempotent `#ensureParts`, the drill.ts/tabs.ts precedent) and kept live by small,
// targeted effects — NOT a description-list-style whole-swap (that primitive's `rows` is a variable-length
// array; this card's anatomy is FIXED-shape, so per-part effects avoid destroying the action button's
// focus/hover state on an unrelated prop change, e.g. a `description` edit while `available` is unchanged).
//
// `path`/`description` render NO box when empty — the ADR-0201 valueless-row law, applied per part (cl.2).
//
// Layer: controls/ — imports dom only (inward-only ✓). erasableSyntaxOnly ✓. verbatimModuleSyntax ✓.

import { UIElement, prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'

const props = {
  name: prop.string(''), // the title (also the host's internals.ariaLabel, and half of the action's accessible name)
  path: prop.string(''), // the monospace service path line — rendered VERBATIM, never parsed
  description: prop.string(''), // one line; single-clamp with ellipsis (CSS)
  available: { ...prop.boolean(true), reflect: true }, // THE law-carrying axis — bindable (cl.2); styled via the reflected [available] attribute, self-reflect-guarded at every connect (see the file banner)
  actionLabel: { ...prop.string('Open'), attribute: 'action-label' }, // multi-word prop — explicit kebab attribute (the attachment.ts `mimeType`/`mime-type` precedent: a camelCase attribute name never matches the always-lowercase real attribute, so attributeChangedCallback would silently never fire)
  inline: { ...prop.boolean(false), reflect: true }, // ADR-0223 R2 — the ONE sizing opt-out (default false — the ordinary reflect-on-write timing holds fine here)
} satisfies PropsSchema

export interface UIServiceCardElement extends ReactiveProps<typeof props> {}
export class UIServiceCardElement extends UIElement {
  static props = props

  #heading: HTMLElement | null = null
  #body: HTMLElement | null = null
  #title: HTMLElement | null = null
  #path: HTMLElement | null = null
  #description: HTMLElement | null = null
  #statusText: HTMLElement | null = null
  #action: HTMLButtonElement | null = null

  protected connected(): void {
    // The self-reflect-on-connect guard (see the file banner) — FIRST, before anything reads the
    // attribute: forces `[available]` to mirror the live `available` signal at every connect, through
    // the ordinary public setter (the same path any producer's own explicit write already takes).
    this.available = this.available

    // ARIA via internals — never a host role/aria-* attribute (FACE, the fleet law). role=group (cl.6);
    // the accessible NAME mirrors `name` (the effect below keeps it live) — the card's own identity, not
    // its interior action's (that gets its OWN accessible name, #renderAction).
    this.internals.role = 'group'
    this.#ensureParts()
    // Re-armed EVERY connect (not guarded by #ensureParts's idempotency — the drill.ts back-button
    // precedent): `this.listen` rides the CURRENT connection's AbortSignal, so a reconnect needs a fresh
    // listener even though the button DOM node itself is reused. Only the node creation is idempotent.
    this.listen(this.#action!, 'click', () => this.emit('action'))

    this.effect(() => {
      const name = this.name
      this.internals.ariaLabel = name
      this.#title!.textContent = name
    })

    this.effect(() => {
      const path = this.path
      if (path === '') {
        this.#path?.remove()
        this.#path = null
      } else {
        if (!this.#path) {
          this.#path = document.createElement('span')
          this.#path.setAttribute('data-part', 'path')
          this.#heading!.after(this.#path) // always right after the heading row, before any description
        }
        this.#path.textContent = path
      }
    })

    this.effect(() => {
      const description = this.description
      if (description === '') {
        this.#description?.remove()
        this.#description = null
      } else {
        if (!this.#description) {
          this.#description = document.createElement('span')
          this.#description.setAttribute('data-part', 'description')
          this.#body!.append(this.#description) // always last in body — after heading and any path
        }
        this.#description.textContent = description
      }
    })

    // The availability law (cl.4) — ONE effect, reading the LIVE `available` signal: the status text and
    // the action's whole render move together, atomically. The CSS repaint (accent edge/dot/title-ink,
    // service-card.css) rides the reflected `[available]` attribute directly (self-reflect-on-connect
    // above keeps it accurate) — no JS-driven state toggle needed for the colour cascade at all.
    this.effect(() => {
      const available = this.available
      this.#statusText!.textContent = available ? 'Available' : 'Unavailable'
      this.#renderAction(available, this.actionLabel, this.name)
    })
  }

  #ensureParts(): void {
    if (this.#heading) return // idempotent — the drill.ts/tabs.ts precedent

    const dot = document.createElement('span')
    dot.setAttribute('data-part', 'status')
    dot.setAttribute('aria-hidden', 'true')

    const title = document.createElement('span')
    title.setAttribute('data-part', 'title')

    const heading = document.createElement('div')
    heading.setAttribute('data-part', 'heading')
    heading.append(dot, title)

    const body = document.createElement('div')
    body.setAttribute('data-part', 'body')
    body.append(heading)

    // Visually-hidden but announced (ADR-0057 non-color signifier — the stat.ts delta-word precedent):
    // real DOM text, clipped from the visual box, never `aria-hidden`. Sits first in reading order —
    // the qualifier precedes what it qualifies, before the title.
    const statusText = document.createElement('span')
    statusText.setAttribute('data-part', 'status-text')

    const action = document.createElement('button')
    action.type = 'button'
    action.setAttribute('data-part', 'action')

    this.append(statusText, body, action)

    this.#heading = heading
    this.#body = body
    this.#title = title
    this.#statusText = statusText
    this.#action = action
  }

  /**
   * available=false ⇒ the disabled `Unavailable` chip; available=true ⇒ the enabled `→ {actionLabel}`
   * affordance. ONE element identity across both states (cl.3) — a real `.disabled` write is all this
   * needs: tab-order removal, the inert activation contract, and forced-colors GrayText all come free
   * from the platform (interaction-states.md §3's tabbable/ariaDisabled contract is for a CUSTOM ELEMENT
   * simulating disabled; a genuine native <button> needs none of it).
   */
  #renderAction(available: boolean, actionLabel: string, name: string): void {
    const action = this.#action!
    action.disabled = !available
    action.replaceChildren()
    const visibleLabel = available ? actionLabel : 'Unavailable'
    if (available) {
      const glyph = document.createElement('span')
      glyph.setAttribute('aria-hidden', 'true')
      glyph.setAttribute('data-part', 'action-glyph')
      glyph.textContent = '→'
      action.append(glyph, document.createTextNode(actionLabel))
    } else {
      action.append(document.createTextNode('Unavailable'))
    }
    // The accessible name distinguishes each card in a list (cl.6: "N cards, N 'Open' buttons must be
    // distinguishable") in BOTH states — content-derived naming alone would just read "Open"/"Unavailable".
    action.setAttribute('aria-label', name === '' ? visibleLabel : `${visibleLabel} ${name}`)
  }
}

if (!customElements.get('ui-service-card')) customElements.define('ui-service-card', UIServiceCardElement)
