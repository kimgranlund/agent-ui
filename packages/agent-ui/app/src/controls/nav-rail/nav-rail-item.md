---
# nav-rail-item.md frontmatter — the attributes-as-API descriptor for ui-nav-rail-item (ADR-0004;
# ADR-0130 cl.4/cl.7; SPEC nav-rail-family.spec.md SPEC-R3/R6). The `attributes[]` block MUST mirror
# nav-rail-item.ts `static props` — the contract↔props trip-wire (nav-rail.test.ts) targets this fence.
# Nests in the `ui-nav-rail` family folder (naming.md §9).
tag: ui-nav-rail-item
tier: pattern           # geometry size-class — Pattern (the interactive row IS the control-height unit the family's Pattern tier describes)
extends: UIElement      # NOT form-associated (face below) — carries no value; href present renders a real <a>, absent a real <button> (SPEC-R3)

attributes:
  - name: href
    type: string
    default: ''
    reflect: true         # '' ⇒ renders a real <button type="button"> (an in-page selection commit); non-empty ⇒ a real <a href> (real navigation)
  - name: selected
    type: boolean
    default: false
    reflect: true          # the active/current item — drives the non-color-alone border-inline-start indicator + the activator's aria-current/aria-selected

properties: []           # no manual accessors beyond the attributes-as-API

events: []                # this element emits none of its own — a genuine activation is observed + acted on by the owning ui-nav-rail (delegated click listener), which is the SOLE emitter of select/change

slots:
  - name: leading
    optional: true
    description: Optional leading adornment — a light-DOM `[slot="leading"]` child (typically `data-role="icon"`), placed in the start cell of the created activator part (anatomy.md's position/role axes, one level down from `ui-button`'s own pattern).
  - name: label
    optional: true
    description: The label — the default/unnamed children; the accessible name. Re-expressed internally into one synthetic `[data-part="label"]` span (inside the activator) so `collapse="icon-popover"` can visually-hide JUST the label while it remains the accessible name.
  - name: trailing
    optional: true
    description: Optional trailing adornment — a light-DOM `[slot="trailing"]` child, commonly `data-role="tag"` (REALIZES anatomy.md's reserved `tag` role, SPEC-R6's wide name|tag row; truncates via ellipsis narrow, never wraps).

parts:
  - name: activator
    description: The control-created `<a href>` (href non-empty) or `<button type="button">` (href empty) wrapping the item's slotted content — the ONE interactive/AX-bearing node this element renders. Swapped (never left coexisting) when `href` flips empty↔non-empty shape post-connect.
  - name: label
    description: A control-created `<span data-part="label">` inside the activator, wrapping the item's default/unnamed (label) content — re-expressed so `collapse="icon-popover"` mode can visually-hide it independently of any leading/trailing adornment.

customStates: []          # no :state() hooks — `selected` is a plain reflected attribute (`ui-nav-rail-item[selected]`) already driving the CSS indicator; no ElementInternals custom state needed on top of it

face:
  formAssociated: false

aria:
  role: tab | none          # href empty ⇒ the activator's role is overridden to `tab` (SPEC-R3 AC2, mirroring ui-tabs); href non-empty ⇒ the activator is a real `<a>`, its native implicit "link" role stands, no override
  roleSource: 'the activator PART''s own attributes (setAttribute) — NOT ElementInternals: attachInternals() throws on a plain, non-custom <a>/<button>, so internals is mechanically unavailable to a created part. The HOST itself carries no ARIA of its own (a transparent display:contents wrapper).'
  selectionSource: "the activator's aria-selected (bare/button shape) or aria-current='page' (href/link shape) — never both on one item (SPEC-R3 AC1 vs AC2)"
  labelSource: the item's light-DOM children (re-expressed into the activator's [data-part=label] span)

keyboard:
  - note: The activator IS a real `<a>`/`<button>` — native Tab/Enter/Space/click all work natively, no bespoke trait needed.

geometry:
  sizeClass: pattern
  blockSize: var(--ui-nav-rail-height)   # the Pattern law — the row takes the control height
  paddingBlock: 0
  inlinePad: h/2 (slotless label) · presence-driven leading/trailing cells (anatomy.md, one level down from ui-button)

forcedColors: The active item's `border-inline-start` indicator repaints to `Highlight` under `forced-colors: active` (SPEC-R4, the ui-app-shell divider precedent), never vanishing.
---

# ui-nav-rail-item

`ui-nav-rail-item` is one row of `ui-nav-rail` — either a real link (`href` set) or an in-page selection
commit (`href` empty). It renders a control-created **activator** part — a real `<a href>` or `<button
type="button">` — wrapping its slotted content, so native navigation/activation/focus all work for free.

```html
<ui-nav-rail-item href="/components/button">Button</ui-nav-rail-item>
<ui-nav-rail-item selected>Overview</ui-nav-rail-item>  <!-- href empty ⇒ a real <button>, role="tab" -->
<ui-nav-rail-item href="/x">Name<span slot="trailing" data-role="tag">v2</span></ui-nav-rail-item>
```

## Shape (SPEC-R3)

`href` non-empty renders a real `<a href="…">` — genuine navigation, none of which ARIA alone can replicate
(status-bar preview, ctrl/cmd-click-new-tab, crawlability). `href` empty renders a real `<button
type="button">` with its role overridden to `tab` (a single well-formed node — `role` replaces the native
implicit role, it does not stack a second role on top of it). Toggling `href` post-connect reactively swaps
the activator's shape (never a one-shot).

## Accessibility

`aria-current="page"` (link shape) or `role="tab"` + `aria-selected` (button shape) rides the activator
part's own attributes, never `ElementInternals` (mechanically unavailable on a plain created `<a>`/
`<button>` — the same "a created part uses setAttribute" convention `ui-menu`'s panel and `ui-tabs`' tablist
strip already establish). The active item's `border-inline-start` indicator is non-color-alone and survives
`forced-colors`.
