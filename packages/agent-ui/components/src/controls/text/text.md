---
# text.md frontmatter — the attributes-as-API descriptor for ui-text (ADR-0004 / ADR-0025). The machine-checkable
# public surface lives HERE (frontmatter); the prose below the fence is the /site doc (a FOLLOW-UP wave — this wave
# is the demo switch + the control only, NOT a /site page, per ADR-0025 Consequences). The `attributes[]` block MUST
# mirror text.ts `static props` (just `variant`) — the contract↔props trip-wire (text-descriptor.test.ts) targets
# this fence. Field set per docs/plan.md §10 / ADR-0004.
tag: ui-text
tier: display          # geometry size-class (Display band — NO control frame/height; geometry.md "size-classes" + ADR-0025 cl.1: the typographic ramp is the lever, not --ui-height-*)
extends: UIElement     # a non-interactive display LEAF — NOT form-associated (face below), NOT a UIContainerElement surface
# marginal: ui-text adds 118 B gz (461 B min) to the self-defining ui-* family (the delta of `npm run size`'s components barrel with vs. without this control's export, tree-shaken — it + UIElement + the heading effect) — a Display leaf is tiny; the family total stays gated each run by `npm run size` (scripts/measure-size.mjs)

attributes:            # attributes-as-API — mirrors text.ts `static props` (just variant)
  - name: variant
    type: enum
    values: [h1, h2, h3, h4, h5, caption, body]   # the A2UI v1.0 Text hierarchy — one unified type, no separate Heading/Label
    default: body
    reflect: true      # reflects so the [variant] typographic repoint in text.css applies to JS-set values (the button `size` precedent)

properties: []         # no manual accessors — the displayed text is light-DOM children (textContent), NOT a prop (ADR-0025 cl.2 / Fork 1, the Button.label precedent)

events: []             # display-only — emits nothing (not interactive)

slots:                 # light-DOM, host-as-content (ADR-0006) — the default/unnamed children ARE the displayed text + the accessible name
  - name: text
    optional: false
    description: The displayed text — the default/unnamed children (textContent); the accessible name, and for a heading variant the heading's label. Slotted, not a prop (ADR-0025 cl.2 / Fork 1). render() stays void so the children flow through untouched.

parts: []              # light-DOM, host-as-content — no shadow parts exposed

customStates: []       # NO interaction state and NO motion gate — a display leaf has neither (no :state(ready); there is nothing to transition)

face:
  formAssociated: false  # a display leaf — extends UIElement, no value/validity participation

aria:
  # Heading semantics (ADR-0025 cl.4 / Fork 3, resolved 2026-06-28 — the user chose REAL HEADINGS). h1-h5 carry
  # role=heading + aria-level via internals; body/caption stay generic (no role). A reactive connected() effect
  # off the `variant` signal — the ONLY behavioural code ui-text carries.
  role: heading        # variant ∈ h1..h5 → role=heading; body/caption → no role (generic styled text, like <p>/<span>)
  roleSource: internals  # a reactive connected() effect off `variant` sets internals.role + internals.ariaLevel — NEVER a host role/aria-* attribute (the FACE pattern, button.ts precedent)
  level: 'h1→1 · h2→2 · h3→3 · h4→4 · h5→5 (internals.ariaLevel); body/caption → no role/level'
  labelSource: textContent  # the light-DOM text is the accessible name (cl.2 gives this for free)

keyboard: []           # NOT interactive and NOT focusable — no tabindex, no `tabbable` trait, no keyboard contract. user-select stays ENABLED (display text is selectable — the deliberate inverse of ui-button, which disables it)

geometry:
  sizeClass: display
  blockSize: content   # NO control height (geometry.md Display class) — block-size is content-driven; no padding-block law, no frame
  fontSize: var(--ui-text-size)     # the typographic ramp, repointed per [variant] from the fleet --ui-type-{level}-size (ADR-0025 cl.3) — × var(--ui-scale), density-invariant
  fontWeight: var(--ui-text-weight) # from --ui-type-{level}-weight (a :root constant)
  lineHeight: var(--ui-text-leading)  # from --ui-type-{level}-leading (a :root unitless constant)

forcedColors: A `@media (forced-colors: active)` block keeps the text visible (CanvasText) so display text never vanishes in high-contrast.
---

# ui-text

`ui-text` is the **Display**-class text primitive — a light-DOM custom element that renders display text at one
of seven typographic levels. It is **not** interactive and **not** form-associated: it carries no value, no
focus, and no keyboard contract; it styles its host and lets the user's light-DOM text flow through (host-as-content,
ADR-0006). It is the A2UI v1.0 `Text` component's live control.

```html
<ui-text variant="h1">Page title</ui-text>
<ui-text variant="h3">Section</ui-text>
<ui-text>Body copy is the default.</ui-text>
<ui-text variant="caption">Secondary / meta text</ui-text>
```

## Variants

`variant` selects a level on the typographic scale (`--ui-type-*`, ADR-0025): `h1`·`h2`·`h3`·`h4`·`h5` (the
heading hierarchy, descending), `body` (default — the reading baseline), and `caption` (smaller, secondary
text). Each level sets a font-size, weight, and line-height. There is **one unified component** — A2UI defines
no separate `Heading` or `Label`; the hierarchy is the `variant`. An ancestor `[scale]` multiplies the type
size (it rides `var(--ui-scale)`); `[density]` does **not** touch type (glyph size is density-invariant — a
frame-family quantity, not rhythm).

## Content

The displayed text is the element's **light-DOM children**, not a property — `<ui-text>Hello</ui-text>` (the
`button` label precedent). `render()` stays void, so the children flow through untouched; the host *is* the
styled text node. The text is the element's accessible name. From the A2UI catalog, the `Text.text` property
(a string literal or a `{path}` binding) maps to the host's `textContent`.

## Typography & geometry

`ui-text` is the **Display** size-class (`geometry.md`): it has **no** control height, no `padding-block` law,
and no frame — its lever is the type scale, not `--ui-height-*`. It consumes only its component tokens
(`--ui-text-size`/`-weight`/`-leading`), which the `[variant]` selectors repoint from the fleet
`--ui-type-{level}-*` ramp — the role-pure two-block pattern every control uses; `ui-text` holds zero scale
opinion. Text is **selectable** (`user-select` is enabled — the deliberate inverse of `ui-button`). A
`forced-colors` block keeps the text visible (`CanvasText`).

## Accessibility

`h1`–`h5` are **real headings** (ADR-0025 cl.4): they carry `role="heading"` + `aria-level` so assistive
technology sees the document hierarchy. `body`/`caption` stay generic text.

- For `variant ∈ h1…h5`, `role="heading"` and `aria-level="1…5"` are set via
  `ElementInternals` (never a host `role`/`aria-*` attribute) — a reactive effect off the `variant` prop, the
  `ui-button` `internals.role` precedent. `body`/`caption` set no role (generic text, like `<p>`/`<span>`).
- The accessible name comes from the light-DOM text.
- `ui-text` is **not focusable** and has no keyboard contract (it is not interactive).
- A `forced-colors` block preserves the text colour so display text survives high-contrast modes.
