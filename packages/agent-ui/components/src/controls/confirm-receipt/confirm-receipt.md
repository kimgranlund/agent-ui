---
# confirm-receipt.md frontmatter: the attributes-as-API descriptor for ui-confirm-receipt (T-0195, Direction A
# approved by Kim 2026-10-20). The machine-checkable public surface lives here; the prose below the fence is the
# /site doc. `attributes[]` is the generation source for confirm-receipt.props.gen.ts (ADR-0173) and its order is
# pinned by the dogfood fleet row. The contract<->props trip-wire (confirm-receipt-descriptor.test.ts) targets this fence.
tag: ui-confirm-receipt
description: A read-back record of a booking or an order with Back and Confirm actions, which settles into a receipt with a Confirmed mark once the user confirms.
tier: pattern           # geometry size-class: container spacing plus one control-height action row (the ResultCard and ProductCard size-class)
extends: UIElement      # a display primitive with data-props: not form-associated; the settle rides the bindable `status` prop
uses:
  - ui-glyph
# marginal: not yet measured; measured at the fleet size gate (npm run size)

attributes:             # attributes-as-API, the generation source for confirm-receipt.props.gen.ts
  - name: title
    type: string
    default: ''
    reflect: false      # NOT reflected; names the host (internals.ariaLabel)
    attribute: receipt-title  # the global HTML `title` attribute is never observed or written, so a receipt never paints a native tooltip (the result-card.md result-title precedent)
    description: The record heading, shown at the start of the header.
  - name: rows
    type: json
    tsType: '{ label: string; path: string; options?: { value: string; label: string }[] }[] | null'
    default: null
    reflect: false      # NOT reflected; a JSON-string attribute round-trips through the codec, not setAttribute
    description: The label and value rows; each value is read from `data` by the row's path key, and `options` maps a coded value to its label.
  - name: data
    type: json
    tsType: 'Record<string, unknown> | null'
    default: null
    reflect: false
    description: The bound record every displayed value is read from, keyed by each row, total and ref path (a relative key, not a JSON pointer).
  - name: items
    type: json
    tsType: '{ label: string; quantity?: number | string; amount: string }[] | null'
    default: null
    reflect: false
    description: The order's line items, each a label, an optional quantity and an amount; empty renders no items part.
  - name: total
    type: json
    tsType: '{ label: string; path: string } | null'
    default: null
    reflect: false
    description: The one total row under a strong rule, its value read from `data` by path; null renders no total part.
  - name: status
    type: enum
    values: [pending, confirmed]
    default: pending
    reflect: true       # reflected so the [status] attribute styles JS-set values; out-of-set reads pending
    description: The settle. A Confirm press writes confirmed and emits change, so the data model records it and a re-render cannot ask again.
  - name: refPath
    type: string
    default: ''
    reflect: false
    attribute: ref-path
    description: The `data` key of the reference line (a booking or order number), shown only once confirmed and only when it resolves.
  - name: confirmAction
    type: json
    tsType: '{ action: string; context?: Record<string, unknown> } | null'
    default: null
    reflect: false
    attribute: confirm-action
    description: The action a Confirm press emits as the action event detail, after status turns confirmed.
  - name: backAction
    type: json
    tsType: '{ action: string; context?: Record<string, unknown> } | null'
    default: null
    reflect: false
    attribute: back-action
    description: The action a Back press emits as the action event detail; non-null renders the Back button, and its press leaves status as it is.
  - name: inline
    type: boolean
    default: false
    reflect: true       # ADR-0223 R2: the one sizing opt-out; the host hugs its content under [inline]

properties: []          # no manual accessors beyond the ten typed props

events:
  - name: change
    detail: "'confirmed'"
    description: Fired once when a Confirm press settles the record, after `status` is already `confirmed`, so a listener reading `el.status` sees the new value.
  - name: action
    detail: 'the `confirmAction` or `backAction` value, `{action, context}`'
    description: Fired on a Confirm press (after change) with `confirmAction`, or on a Back press with `backAction`. A click anywhere else emits nothing; a press with no action set emits no action event.

slots: []               # no slots; every part is control-built

parts:
  - name: record
    description: The control-built `<section data-part="record">`, the card surface holding the header, items, rows, total and ref. The actions row sits outside it, so no button is ever inside the card.
  - name: header
    description: The `<div data-part="header">` row holding the title at the start and the mark at the end. The one polite live region, so the settle is announced once.
  - name: title
    description: The `<span data-part="title">` mirroring `title`. Present only when `title` is non-empty.
  - name: mark
    description: The Confirmed mark, a success-tinted pill holding a check glyph and the word Confirmed, never color alone. Present only when `status` is confirmed. Programmatically focusable (tabindex -1); a Confirm press focuses it.
  - name: glyph
    description: A decorative `<ui-glyph data-part="glyph">`, the check in the mark and the caret in Back. ui-glyph hides itself through ElementInternals; the word beside it carries the meaning.
  - name: rows
    description: The `<div data-part="rows">` list of label and value rows. Present only when `rows` has at least one entry (the empty-box law).
  - name: row
    description: One `<div data-part="row">`, the label muted at the start and the value at the end, a hairline between rows.
  - name: label
    description: The row, item or total label.
  - name: value
    description: The row, item or total value with tabular numerals. A row or total value is `data[path]` (an ISO date in the reader's locale, a boolean as Yes or No, a coded value through `options`); an item value is its `amount` verbatim.
  - name: items
    description: The `<div data-part="items">` list of line items, above the rows. Present only when `items` has at least one entry.
  - name: item
    description: One `<div data-part="item">`, the quantity, the label and the amount.
  - name: quantity
    description: The muted `2 ×` quantity at the start of an item. Present only when the item has a quantity.
  - name: total
    description: The `<div data-part="total">` row under a strong rule, label and value in title weight. Present only when `total` is set.
  - name: ref
    description: The `<p data-part="ref">` reference line, `data[refPath]` verbatim. Present only when `status` is confirmed and the path resolves to a non-empty value.
  - name: actions
    description: The `<div data-part="actions">` row under the record and outside it, Back at the start and Confirm at the end. Removed from the DOM, not hidden, once `status` is confirmed.
  - name: back
    description: The native `<button type="button" data-part="back" data-size="lg">` with a caret glyph and the word Back. Present only when `backAction` is set.
  - name: confirm
    description: The native `<button type="button" data-part="confirm" data-size="lg">`, the primary fill with the word Confirm.

customStates: []        # no custom state; the settle rides the reflected [status] attribute

face:
  formAssociated: false  # a display primitive, no value/validity participation

aria:
  role: group
  roleSource: internals   # set via ElementInternals in connected(), never a host role/aria-* attribute
  labelSource: prop       # internals.ariaLabel is the trimmed `title`, with ": Confirmed" once settled ("Your stay: Confirmed")
  liveRegion: The header part is a polite live region (aria-live on the control-built header, the ui-result-card precedent), so the Confirmed mark is announced once when the record settles.
  nonColorSignifier: The settle always shows the word Confirmed beside its check glyph, and the actions row is removed. Color is the redundant channel (ADR-0057).

keyboard:
  - note: No keyboard model of the host's own; the host takes no focus. The native Back and Confirm buttons are reachable in normal Tab order and activate on Enter and Space. A Confirm press moves focus to the Confirmed mark (tabindex -1, never a Tab stop), so focus does not drop to the body when the actions row is removed.

geometry:
  sizeClass: pattern
  gap: var(--ui-confirm-receipt-gap)                      # = --md-sys-widget-gutter, between the record and the actions row
  paddingBlock: var(--ui-confirm-receipt-pad)             # the record: = 2 x --md-sys-inset
  paddingInline: var(--ui-confirm-receipt-pad)            # the record: = 2 x --md-sys-inset
  radius: var(--ui-confirm-receipt-radius)                # the record: = --md-sys-card-radius
  actionHeight: var(--md-sys-height)                      # Back and Confirm resolve on their own lg step (`data-size="lg"`): 28px on an A2UI canvas (ADR-0245 Amendment 2), 40px at the root
  note: Block-level fill by default (ADR-0223); `inline` flips the host to inline-flex and hugs. The host is a column, the record card above the actions row; the record's spacing reads the derived foundations (the approved Direction A mockup), and the action buttons take the control radius of their own step.

forcedColors: The record keeps a CanvasText border, the mark gains a CanvasText border (a tinted fill would otherwise flatten to Canvas), and Back and Confirm keep a ButtonText border. The glyphs stroke in currentColor and need no adjustment.
---

# ui-confirm-receipt

`ui-confirm-receipt` reads a booking or an order back for the user to confirm, then settles into its receipt.

Every value it shows is read from the bound `data` record by path, so a value is never a producer literal, and it
does no arithmetic: every amount and the total are bound strings. Back and Confirm are its own buttons, in a row
under the record card and outside it.

```html
<ui-confirm-receipt receipt-title="Your stay" ref-path="ref"
  rows='[{"label":"Arrival","path":"checkIn"},{"label":"Guests","path":"guests"}]'
  total='{"label":"Total, 3 nights","path":"total"}'
  data='{"checkIn":"2026-10-12","guests":"2","total":"$1,140.00","ref":"Booking HX-2214"}'
  confirm-action='{"action":"confirm_booking"}'
  back-action='{"action":"edit_booking"}'>
</ui-confirm-receipt>
```

## Anatomy

In DOM order: the record card (a header with the title and, once settled, the Confirmed mark; the line items; the
rows; the total; the reference line), then the actions row with Back and Confirm. A part is present only when it
has something to show: no rows, no items, no total or no reference renders no box for it.

## Rows, items and total

`rows` is an array of `{label, path, options}`. Each value is `data[path]`: an ISO date prints in the reader's
locale, a boolean as Yes or No, and a value that matches an `options` entry prints that entry's label. `items` is
an array of `{label, quantity, amount}`, drawn as `2 × Linen tea towel ... $24.00` above the rows, so an order's
subtotal-style rows sit between its line items and the total. `total` is one `{label, path}` row under a strong rule.

## Confirm and settle

A Confirm press sets `status` to `confirmed`, emits `change`, then emits `action` with `confirmAction`. Once
confirmed the actions row is removed from the DOM, the Confirmed mark (a check and the word) takes the header, and
the reference line `data[refPath]` appears. A Confirm press moves focus to the mark, so focus never drops to the page. Back renders only when `backAction` is set; its press emits `action`
with `backAction` and leaves `status` as it is. A receipt rendered with `status="confirmed"` never asks again.

## Accessibility

The host is `role="group"`, named by `title`, through `ElementInternals`. The header is a polite live region, so
the settle is announced once. Back and Confirm are native buttons in Tab order.
