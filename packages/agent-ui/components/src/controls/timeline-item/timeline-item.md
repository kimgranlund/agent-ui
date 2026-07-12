---
# timeline-item.md frontmatter — the attributes-as-API descriptor for ui-timeline-item (ADR-0004;
# timeline-family.lld.md §2 · SPEC-R1…R5 · ADR-0122 F1/F2/F3/F6). The machine-checkable public surface
# lives HERE (frontmatter); the prose below the fence is the /site doc. The `attributes[]` block MUST
# mirror timeline-item.ts `static props` (status/label/description/timestamp/icon/size) — the
# contract↔props trip-wire (timeline-item-descriptor.test.ts) and the frontmatter schema both target
# this fence.
tag: ui-timeline-item
description: One rail row in a timeline or status stream, showing a status marker, label, timestamp, and optional detail.
tier: pattern            # geometry.md's Pattern band does not literally fit (no interactive control-height
                         # row) — the marker-system novelty leg (ADR-0122 F2) generalizes it to a
                         # structural, non-interactive multi-row family, kin to accordion/menu
extends: UIElement       # NOT form-associated — an inert display row, no value/validity
# marginal: measured at the family barrel integration slice (npm run size, ADR-0040 §3)

attributes:               # attributes-as-API — mirrors timeline-item.ts static props
  - name: status
    type: enum
    values: ['', pending, active, done, error]
    default: ''
    reflect: true        # reflects → the CSS [status] marker-shape repoint (SPEC-R4)
  - name: label
    type: string
    default: ''
    reflect: false       # stamped into the label cell by a reactive effect; not an inspectable attribute
  - name: description
    type: string
    default: ''
    reflect: false
  - name: timestamp
    type: string
    default: ''
    reflect: false       # the consumer's string — NO value-codec (ADR-0122 F6)
  - name: icon
    type: string
    default: ''
    reflect: false       # a free marker-glyph name (adia icon-mode) — orthogonal to status (ADR-0122 F3)
  - name: size
    type: enum
    values: [sm, md, lg]
    default: md
    reflect: true        # reflects → the CSS [size] marker-system row repoint (ADR-0122 F2)

properties:               # IDL beyond attributes-as-API
  - name: toggleDetail
    description: Method — reveal/collapse the composed detail disclosure (open?boolean). Delegates to the composed ui-disclosure's `open` prop; a no-op if the item has no detail content.
  - name: markTruncated
    description: Method — mark/unmark the item TRUNCATED (truncated boolean), used by ui-status-stream's completion invariant (SPEC-R11). Toggles the `:state(truncated)` custom state; imperative/CSS-state, not a `static props` field.

events:
  - name: toggle
    detail: 'null'
    description: Surfaces via light-DOM bubbling from the composed ui-disclosure's own `toggle` when the item's optional detail expands/collapses (ADR-0122 F6 — the disclosure mechanism reused, never a bespoke event name; the item itself never emits this — it is the SAME event object bubbling through, not a re-dispatch). Absent entirely on an item with no detail content.

slots:
  - name: marker
    optional: true
    description: A pre-existing light-DOM child carrying `[data-role="marker"]`, adopted (moved) into the marker cell at connect — suppresses the default dot/status-glyph entirely (SPEC-R3 AC2).
  - name: label
    optional: true
    description: A pre-existing `[data-role="label"]` child is adopted in place and never re-stamped by the `label` prop (the wrapper-trap regression guard); otherwise a cell is created and stamped from `label`.
  - name: description
    optional: true
    description: Same adoption rule as label, backed by the `description` prop.
  - name: timestamp
    optional: true
    description: Same adoption rule as label, backed by the `timestamp` prop.
  - name: trailing
    optional: true
    description: Consumer-content-only — no prop stamps it. Adopted in place if present; otherwise an empty cell that collapses (no phantom gap).
  - name: detail
    optional: true
    description: A pre-existing `[data-role="detail"]` child is moved into a composed `<ui-disclosure data-part="detail">` (ADR-0122 F6) — one nesting level (flat + 1).
  - name: text
    optional: true
    description: NOT authored by a durable-timeline consumer — ui-status-stream's imperative `update(key,{text})` find-or-creates this `[data-role="text"]` cell and grows/replaces it in place (a residual imperative/CSS-only fact, never a `static props` field; timeline-family.lld.md §7).

parts:
  - name: marker
    description: The control-built `<span data-part="marker">` — paints the status dot/ring/pulse via `::before` and the row connector via `::after` when no consumer marker/icon/status-glyph is present; otherwise holds the adopted or injected glyph.
  - name: detail
    description: The control-built `<ui-disclosure data-part="detail">` wrapping the adopted `[data-role="detail"]` content, present only when detail content exists at connect.

customStates:
  - truncated             # set/cleared via markTruncated() — ui-status-stream's completion invariant (SPEC-R11); overrides the status marker with a dashed, non-color-only interrupted ring

face:
  formAssociated: false   # NOT a FACE form control — an inert display row, no value/validity

aria:
  role: listitem            # set via ElementInternals in the CONSTRUCTOR (semantics before insertion — the toast role precedent)
  roleSource: internals
  labelSource: none         # no built-in accessible name beyond its rendered text content

keyboard:
  - note: No keyboard model of its own. When a detail is present, the composed ui-disclosure's native summary supplies its own Tab/Enter/Space activation (disclosure.md's keyboard map) — the item adds nothing.

geometry:
  sizeClass: pattern
  markerBox: var(--ui-timeline-item-marker-box)      # the explicit per-(scale×size) integer table (ADR-0122 F2, timeline-family.lld.md §5)
  dotSize: var(--ui-timeline-item-dot-size)
  connectorWidth: var(--ui-timeline-item-connector-width)
  gutter: var(--ui-timeline-item-gutter)
  rowGap: var(--ui-timeline-item-row-gap)            # the ONE density-riding quantity; realized as the item's own margin-block-end
  note: A NEW bespoke marker-system table (the second per-(scale×size) explicit lookup after the calendar's date-grid, ADR-0048) — connector-width is deliberately 2px across every size AND scale tier (the ADR-0038 stepping lesson a probe must not assume away).

forcedColors: A `@media (forced-colors: active)` block repaints the marker dot/ring/connector and the muted content ink to CanvasText, keeping every status SHAPE (not colour) legible (SPEC-R4 AC2) — belt-and-suspenders over the token layer's own WHCM-mapped roles.
---

# ui-timeline-item

`ui-timeline-item` is the timeline family's **shared, inert visual atom** (ADR-0122 F1) — one rail row:
a marker (dot/ring/pulse, a built-in glyph, or a consumer icon) + content (`label`/`description`/
`timestamp`/`trailing`) + an optional collapsible `detail`. It extends `UIElement`, is **not**
form-associated, and is hosted by BOTH `ui-timeline` (durable, authored) and `ui-status-stream` (live,
imperatively appended) — authored once, shared everywhere.

```html
<ui-timeline-item status="done" label="Order placed" timestamp="Apr 15, 2:30 PM"></ui-timeline-item>
<ui-timeline-item status="active" label="Shipped" timestamp="Apr 17, 11:45 AM">
  <span data-role="detail">Carrier: UPS · Tracking 1Z999AA10123456784</span>
</ui-timeline-item>
```

## Props

- **`status`** (`''`/`pending`/`active`/`done`/`error`, default `''`) — the item's lifecycle state. Each
  non-empty value renders a marker distinguished by **SHAPE**, never hue alone (ADR-0057): `pending` a
  hollow ring, `active` a filled dot (with an optional pulse, static under reduced-motion), `done` a
  built-in check glyph, `error` a built-in cross glyph. The colour channel is redundant.
- **`label`** / **`description`** / **`timestamp`** (string, default `''`) — stamped into their content
  cells; `timestamp` is the consumer's own string, carrying no value-codec.
- **`icon`** (string, default `''`) — a free marker glyph name (`@agent-ui/icons`) that replaces the dot
  entirely, orthogonal to `status` — the neutral/`''` path with a richer glyph.
- **`size`** (`sm`/`md`/`lg`, default `md`) — first-class marker-system geometry (ADR-0122 F2): picks the
  row within the ambient `[scale]` register for the marker box, dot, connector, gutter, and row-gap.

## Anatomy

The marker cell paints its own dot/ring/pulse and connector via CSS **unless** a consumer supplies a
`[data-role="marker"]` child, sets `icon`, or the item resolves to `status="done"`/`"error"` (a built-in
check/cross glyph) — any of these suppresses the default dot uniformly. Content cells
(`label`/`description`/`timestamp`/`trailing`) adopt a matching pre-existing `[data-role]` child in place
(never re-stamped by the matching prop — the wrapper-trap guard) or are created fresh and prop-stamped.
Empty cells collapse (no phantom gutter). A `[data-role="detail"]` child is moved into a composed
`ui-disclosure` — the collapse mechanism is **reused**, never reimplemented; its `toggle` surfaces on the
item host via light-DOM bubbling (the item never emits it itself).

## Accessibility

`internals.role = 'listitem'` is set in the constructor (semantics before insertion). No built-in
accessible name beyond rendered text content. A `forced-colors` block keeps every status marker legible
by shape.
