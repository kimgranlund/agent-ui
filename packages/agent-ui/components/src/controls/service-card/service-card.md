---
# service-card.md frontmatter — the attributes-as-API descriptor for ui-service-card (ADR-0004; ADR-0224).
# The machine-checkable public surface lives HERE (frontmatter); the prose below the fence is the /site
# doc. The `attributes[]` block MUST mirror service-card.ts `static props` (name, path, description,
# available, actionLabel, inline) — the contract<->props trip-wire (service-card-descriptor.test.ts)
# targets this fence. `actionLabel`'s real HTML attribute is `action-label` (an explicit `attribute:`
# override in service-card.ts, the attachment.ts `mimeType`/`mime-type` kebab-discipline precedent) — the
# descriptor row name stays the JS prop name (`actionLabel`), matching every other descriptor's convention.
tag: ui-service-card
description: The availability-stated service/agent launch card — ONE bindable boolean (available) drives the accent edge, status dot, title mute, and the Open⟷Unavailable action swap together.
tier: pattern           # geometry size-class (container spacing + ONE control-height action row, ADR-0224 cl.1)
extends: UIElement      # a display primitive with data-props — NOT UIContainerElement (the interior is component-rendered from hardened props, not an agent-composed ChildList) and NOT form-associated (no value)
# marginal: not yet measured (S1 build, folder-local) — measured at the fleet size gate (npm run size) once wired into the shared barrel

attributes:             # attributes-as-API — mirrors service-card.ts static props
  - name: name
    type: string
    default: ''
    reflect: false      # NOT reflected — content prop; also the host's internals.ariaLabel and half of the action's accessible name
  - name: path
    type: string
    default: ''
    reflect: false      # NOT reflected — content prop; empty renders NO box (ADR-0201's valueless-row law, cl.2)
  - name: description
    type: string
    default: ''
    reflect: false      # NOT reflected — content prop; empty renders NO box (same law)
  - name: available
    type: boolean
    default: true       # the ONE reflected boolean whose default is true — a genuinely new shape in this fleet; see service-card.ts's file banner for the self-reflect-on-connect guard this needs
    reflect: true       # reflected (ADR-0224 cl.2, bindable); CSS keys directly on the reflected [available] attribute — a scope-owned self-assign at connect keeps it trustworthy even when a producer never explicitly writes the prop
  - name: actionLabel
    type: string
    default: 'Open'
    reflect: false      # NOT reflected — read live at render (#renderAction); the real HTML attribute is `action-label` (attribute: override in service-card.ts — see the banner above)
  - name: inline
    type: boolean
    default: false
    reflect: true       # ADR-0223 R2 — the ONE sizing opt-out; ordinary reflect-on-write timing holds fine (default false)

properties: []          # no manual accessors beyond the six typed props

events:
  - name: action
    detail: 'undefined'
    description: Fired when the user activates the action button WHILE available (ADR-0153's seventh member, no detail payload — the card's own identity is the target). Never fires when unavailable — a real disabled native <button> cannot dispatch click at all, so the guard is structural, not a JS check.

slots:
  - name: menu
    description: Optional light-DOM position, top-right, for a consumer-composed overflow affordance (typically `ui-button` + `ui-menu` — app chrome). The card never fabricates a menu it cannot populate; this slot stays fully interactive/live regardless of `available` (unavailable is a SERVICE state, not a control disablement — you can still inspect/configure a down service, ADR-0224 cl.3/cl.4).

parts:
  - name: body
    description: The control-built `<div data-part="body">` — a flex COLUMN holding the heading row then the optional path/description parts, in that fixed order. Presence-driven by direct DOM add/remove (service-card.ts), never a CSS `:has()` combinatorial template.
  - name: heading
    description: The control-built `<div data-part="heading">` — a flex ROW holding the status dot then the title, sharing one line.
  - name: status
    description: The control-built, `aria-hidden` `<span data-part="status">` — a solid circle tinted by the accent token (success when available, neutral when not). Status is never conveyed by this alone (ADR-0057) — see status-text.
  - name: status-text
    description: The control-built `<span data-part="status-text">` — visually-hidden but ANNOUNCED real text ("Available"/"Unavailable"), the ADR-0057 non-color signifier (the ui-stat delta-word technique verbatim).
  - name: title
    description: The control-built `<span data-part="title">` — the card's title (mirrors the `name` prop). Muted ink under `:not([available])`.
  - name: path
    description: The control-built `<span data-part="path">` — the monospace service path line (mirrors `path`, rendered VERBATIM). Present only when `path` is non-empty (ADR-0201's valueless-row law).
  - name: description
    description: The control-built `<span data-part="description">` — the one-line description (mirrors `description`, single-clamp with ellipsis). Present only when `description` is non-empty.
  - name: action
    description: The control-built, REAL native `<button type="button" data-part="action">` — deliberately NOT `ui-button` (a genuine native element gets tab-order removal, the inert activation contract, and forced-colors GrayText FOR FREE from the platform when `.disabled` flips, the ONE element identity across both states). Labelled `actionLabel` with a leading → glyph when available; the literal text "Unavailable" (and a real `disabled` attribute) when not.

customStates: []       # NO custom state — the whole availability repaint keys on the plain reflected [available] attribute (self-reflect-guarded at connect, service-card.ts's file banner); the fleet custom-state vocabulary (naming.md §6) is closed and stays untouched by this build

face:
  formAssociated: false  # a display primitive — extends UIElement, no value/validity participation

aria:
  role: group
  roleSource: internals   # set via ElementInternals in connected() — never a host role/aria-* attribute
  labelSource: prop       # internals.ariaLabel mirrors the `name` prop (kept live by a scope-owned effect)
  actionAccessibleName: "{visible label} {name}" — where visible label is `actionLabel` when available, the literal \"Unavailable\" when not — so a list of N cards has N DISTINGUISHABLE action buttons, in both states (ADR-0224 cl.6)
  nonColorSignifier: available renders the enabled → {actionLabel} button PLUS a visually-hidden \"Available\" status-text; unavailable renders the literal \"Unavailable\" chip text (ADR-0057 — status never travels by colour alone)

keyboard:
  - note: No keyboard model of the host's own — the card itself takes no focus and has no host tabindex. The real native action button is reachable via normal Tab order (native button focusability) while available; a real `disabled` attribute removes it from the tab order while not (native behaviour, zero traits needed). Any consumer-composed `[slot='menu']` affordance carries its own independent keyboard contract.

geometry:
  sizeClass: pattern
  paddingInline: var(--ui-service-card-pad-inline)     # = --md-sys-space-md
  paddingBlock: var(--ui-service-card-pad-block)       # = --md-sys-space-md
  rowGap: var(--ui-service-card-row-gap)               # = --md-sys-space-xs — heading → path → description → action
  actionHeight: var(--ui-service-card-action-height)   # = --md-sys-height-sm — the ONE control-height row a pattern-tier card owns (ADR-0224 cl.5)
  radius: var(--ui-service-card-radius)                # = --md-sys-shape-corner-base, the shared fleet radius (ui-card/ui-toast/ui-menu precedent)
  note: Block-level FILL by default, no intrinsic width (ADR-0223 cl.1, adopted at birth — ADR-0224 cl.5); the `inline` boolean (R2) flips to inline-grid with no hug-state floor — the card's own content already gives it a meaningful shrink-to-fit width, so a floor here would be an out-of-role min-width (sizing-gates.test.ts).

forcedColors: The accent edge survives as a border (`border-inline-start-color`); the status dot GAINS an explicit 1px border (a solid background-only circle would otherwise flatten to Canvas and vanish — the bar-chart fill lesson); the disabled chip's GrayText comes free from the platform on the real native `<button>` (no rule needed — ADR-0224 cl.6's own "free by clause 3's one-element identity"). The `[slot='menu']` affordance carries its own independent forced-colors treatment.
---

# ui-service-card

`ui-service-card` is the **availability-stated service/agent launch card** (ADR-0224, GH #1429): a
display primitive whose whole availability posture — the status-tinted **left accent edge**, the status
**dot**, the **title** mute, and the trailing action's **Open ⟷ Unavailable** swap — is driven by ONE
bindable boolean, `available`. It extends `UIElement` (not a container, not form-associated) and is
`pattern`-tier: container spacing plus one control-height action row.

```html
<ui-service-card
  name="Claims Agent"
  path="/claims-agent-service"
  description="Handles first-notice-of-loss intake and triage."
  available
  action-label="Open"
>
  <ui-button slot="menu" icon-only variant="ghost" aria-label="More actions">
    <ui-icon glyph="dots-three"></ui-icon>
  </ui-button>
</ui-service-card>
```

## The availability law — by construction

`available=false` flips FOUR things simultaneously, from ONE write:

1. The accent edge + status dot repoint to the muted/neutral roles.
2. The title mutes to the secondary ink.
3. The trailing action swaps from an enabled `→ {actionLabel}` button to the disabled, literal
   `Unavailable` chip — the **same native `<button>` element** across both states (never two different
   nodes), so tab-order removal, the inert activation contract, and forced-colors `GrayText` all come free
   from the platform.
4. The optional `menu` slot — and the host itself — stay **fully live**. Unavailable is a *service* state,
   never a *control* disablement: you can still inspect or configure a down service. The host never gains
   `aria-disabled`.

No producer ever coordinates these four independently — the split-state defect class (a green edge next
to a disabled chip, or a muted title next to a live Open button) is unrepresentable.

## Props

- **`name`** (string) — the title.
- **`path`** (string) — the monospace service path line, rendered **verbatim** (never parsed). Empty
  renders no box.
- **`description`** (string) — one line, single-clamp with ellipsis. Empty renders no box.
- **`available`** (boolean, default `true`, reflected, **bindable**) — the one law-carrying axis.
- **`actionLabel`** (string, default `'Open'`, HTML attribute `action-label`) — the label of the
  available-state action; the unavailable state always reads the literal `"Unavailable"` regardless of
  this prop.
- **`inline`** (boolean, default `false`, reflected) — the ADR-0223 sizing opt-out: flips the host from
  block-level fill to its inline-level, shrink-to-fit counterpart.

## Anatomy

A component-owned `border-inline-start` accent band on the host itself (no separate DOM node) · a status
dot + the title, side by side · the optional path line · the optional description · a real native
`<button type="button">` action · one optional `[slot="menu"]` position, top-right, for a
consumer-composed overflow affordance (`ui-button` + `ui-menu` — app chrome; the card never fabricates a
menu it cannot populate). The whole card is **not** a hit target — with two potential interactive
descendants (the action and the menu), activation is button-only.

## Events

- **`action`** — fired when the user activates the action button while `available`. Never fires while
  unavailable (a real disabled native button cannot dispatch `click` at all).

## Accessibility

- `role="group"` via `ElementInternals`, `internals.ariaLabel` mirroring `name` — never a host attribute.
- Status is never colour-alone (ADR-0057): available pairs the enabled button with a visually-hidden
  "Available" status text; unavailable renders the literal "Unavailable" chip text.
- The action's accessible name is `"{visible label} {name}"` in both states, so a list of N cards has N
  distinguishable action buttons.
- Forced-colors: the accent edge survives as a border; the status dot gains an explicit border (a
  background-only fill would otherwise vanish); the disabled chip's `GrayText` comes free from the
  platform.
