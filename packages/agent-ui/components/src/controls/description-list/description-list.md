---
# description-list.md frontmatter — the attributes-as-API descriptor for ui-description-list (ADR-0004;
# ADR-0201). The machine-checkable public surface lives HERE (frontmatter); the prose below the fence is
# the /site doc. The `attributes[]` block MUST mirror description-list.ts `static props` (rows) — the
# contract<->props trip-wire (description-list-descriptor.test.ts) targets this fence. `rows` classifies
# by BEHAVIOUR (component-descriptor.ts `kindOf`) as `json`: its codec's `from(null)` is `[]` (an array),
# the tableRowsProp shape verbatim.
tag: ui-description-list
tier: display          # geometry size-class (Display band — NO control frame/height/[size]/[scale]; the ui-stat/ui-table posture, ADR-0201 cl.1) — the levers are the type matrix + the space ladder
extends: UIElement     # a non-interactive, non-form-associated display LEAF (no events, no keyboard, no focus)
# marginal: ui-description-list adds 209 B gz to the self-defining ui-* family (measured 2026-08-17 via
# `npm run size`'s leave-one-out — one render effect + one hardened JSON codec, no interaction machinery)
# — well within the per-control ≤ ~2 kB tier budget (plan §10).

attributes:            # attributes-as-API — mirrors description-list.ts `static props` (rows)
  - name: rows
    type: json          # {label:string, value:string|number}[], JSON-string attribute form (ADR-0201 cl.2)
    default: ''         # the LIVE default is `[]` — `String([])===''` is the bijection form (the table.md columns/rows precedent)
    reflect: false      # NOT reflected — a JSON-string attribute round-trips through the codec, not setAttribute (the Table.rows posture)
    # THE EMPTY-VALUE OMISSION LAW (ADR-0201 cl.3), by construction: `cleanDescriptionRows` DROPS any
    # entry whose label is not a non-empty string or whose value is absent/null/empty/whitespace-only/
    # boolean/non-finite/object/array — at the codec AND again in the render effect, so a valueless row
    # never exists as property state. A surviving string renders VERBATIM (humanization is the
    # PRODUCER's job — "deluxe-king" → "Deluxe King" happens upstream, never here); a surviving finite
    # number prints via the shared default-locale Intl.NumberFormat.

properties: []         # no manual accessors beyond the one typed prop

events: []             # display-only — emits nothing (no events, no keyboard contract)

slots: []              # no light-DOM content model — every child is control-built (createElement +
                        # replaceChildren), never author-slotted. A receipt's heading is composed OUTSIDE
                        # (a Text/heading above it — the #1174 sentence-case law lives with the producer).

parts:                  # data-part nodes the render effect builds (selected by description-list.css)
  - name: row
    description: One `<div data-part="row">` per SURVIVING row — a flex row, value adjacent to label at a fixed pair gap, `align-items:baseline`; never opposite-edge flushing (no justify-content), never a two-column label/value grid (ADR-0201 cl.4).
  - name: label
    description: The `<span data-part="label">` — the field's label text on the secondary plane (`--ui-description-list-label-ink`), label-medium register, `flex-shrink:0` (a long value wraps; the label never crushes).
  - name: value
    description: The `<span data-part="value">` — the field's value text, body-medium register, VERBATIM for strings (humanization is the producer's job) / Intl-formatted for finite numbers; wraps under itself (`min-inline-size:0` + `overflow-wrap:anywhere`).

customStates: []       # NO interaction state and NO motion gate — a display leaf has neither

face:
  formAssociated: false  # a display leaf — extends UIElement, no value/validity participation

aria:
  role: none             # no internals ARIA is minted (ADR-0201 cl.5 — the ui-stat precedent; role=list
                          # REJECTED as wrong semantics for pairs, term/definition as draft-tier AT support)
  roleSource: none
  labelSource: real-text  # the receipt's WHOLE meaning is real, selectable DOM text in reading order —
                          # label → value, row by row (DOM order); nothing silent to name

keyboard: []           # NOT interactive and NOT focusable — no tabindex, no keyboard contract

geometry:
  sizeClass: display
  rowGap: var(--ui-description-list-row-gap)   # between rows — --md-sys-space-xs base, the one [density]-bearing quantity
  pairGap: var(--ui-description-list-pair-gap) # label → value — --md-sys-space-sm base
  # NO [size] attribute, NO [scale] geometry row, NO --md-sys-height-* consumption — the levers are the
  # type matrix (--md-sys-typescale-*) + the space ladder (the Display-band law).

forcedColors: No dedicated block — every part is real text (the stat lesson; only background-drawn shapes need a forced-colors repoint). The label's secondary ink is forced to CanvasText by the UA like any other text.
---

# ui-description-list

`ui-description-list` is the **key–value receipt primitive** (ADR-0201, GH #1185): a Display-class leaf
that renders a record — per row a **label on the secondary plane** with its **value adjacent** — the
confirm-step receipt the A2UI grammar previously composed by hand as a Column of Rows of Texts (GH
#1174, the composition pattern this primitive supersedes). It is **not** form-associated, emits no
events, and takes no focus; its whole meaning is real, selectable text in reading order.

```html
<ui-description-list
  rows='[{"label":"Room","value":"Deluxe King"},{"label":"Nights","value":3},{"label":"Breakfast","value":"Included"}]'
></ui-description-list>
```

> **An A2UI catalog type.** `ui-description-list` renders the catalog's `DescriptionList` type — the
> canonical confirm-step receipt. Reach for it whenever a flow presents a summary of gathered fields
> before a commit; reach for `Table` instead when the data is a homogeneous multi-column record SET, and
> `Stat` for a single headline metric.

## Rows are data

`rows` is a hardened JSON array prop — `{ label: string, value: string | number }[]` — the `Table.rows`
codec shape verbatim: an absent attribute or malformed JSON yields `[]`, never a throw. Rows are **data,
not children**: a receipt is a record rendered whole, so the component builds its own DOM (whole-swap per
change, the `ui-stat` shape) and imposes no child element.

### The empty-value omission law — by construction

A field with no value **never renders**: the hardening drops any entry whose `value` is absent, `null`,
an empty or whitespace-only string, a boolean, a non-finite number, an object, or an array — on the
attribute path (codec) *and* on the property path (the render effect re-hardens) — so an empty row is
unrepresentable, not merely discouraged. A dropped row is silent; the surviving rows keep their order.

### Humanization stays the producer's job

A surviving string renders **verbatim** — the component never title-cases an enum id or invents
"Yes"/"No" (a raw boolean `value` drops the row instead of being silently repaired). A surviving finite
number prints via the shared default-locale `Intl.NumberFormat`.

## The receipt rhythm

Each row is a flex row: label (label-medium register, `--ui-description-list-label-ink` — the secondary
plane) then value (body-medium register) **adjacent at a fixed pair gap**, sharing a baseline — never
`justify-content: space-between` (opposite-edge flushing), never two side-by-side label/value columns.
Rows stack at `--ui-description-list-row-gap` (space-`xs`, density-responsive). A long value wraps under
itself, not under the label. A consumer wanting aligned values sets
`--ui-description-list-label-min-inline-size` (e.g. `8em`) — an opt-in column effect with no grid.

## Accessibility

No ARIA role is minted (the `ui-stat` precedent): the receipt is real text in reading order — label →
value, row by row, DOM order. `role=list` was rejected (pairs, not items — "list, 6 items" for 6 pairs
misleads), and the ARIA `term`/`definition` family as unevenly supported (ADR-0201 cl.5). Because every
part is real text, forced-colors survival needs no dedicated block.
