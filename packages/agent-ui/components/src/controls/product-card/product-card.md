---
# product-card.md frontmatter: the GENERATION SOURCE for ui-product-card's `static props` block (ADR-0173;
# ADR-0243 ProductCard fork sheet). The machine-checkable public surface lives HERE (frontmatter); the prose
# below the fence is the /site doc. `product-card.props.gen.ts` is GENERATED from `attributes[]` below
# (`node scripts/generate-props.mjs product-card`); product-card.ts imports the generated module, never
# hand-edit it. The fleet drift gate (descriptor/props-gen-driftwire.test.ts) keeps the two byte-identical.
tag: ui-product-card
description: One product, room or offer to buy or book, with optional image or icon header, rating, badge, price and a single action.
tier: pattern           # geometry size-class: container spacing plus ONE control-height action row (the ADR-0224 cl.1 ServiceCard precedent, ADR-0243)
extends: UIElement      # a display primitive with data-props, not a container and not form-associated (no value)
uses:
  - ui-badge
  - ui-icon

attributes:             # attributes-as-API: the GENERATION SOURCE for UIProductCardElement.props (ADR-0173)
  - name: title
    type: string
    default: ''
    reflect: false
    description: The product title; also the host's internals.ariaLabel and half of the action's accessible name.
  - name: subtitle
    type: string
    default: ''
    reflect: false
    description: One supporting line under the title; empty renders no box.
  - name: image
    type: string
    default: ''
    reflect: false
    description: The image src; when set the media part holds a 16:10 image and wins over icon.
  - name: imageAlt
    type: string
    default: ''
    attribute: image-alt
    reflect: false
    description: The image alt text; empty marks the image decorative (alt="").
  - name: icon
    type: string
    default: ''
    reflect: false
    description: An icon glyph name for the image-free icon header (exhibit mode); ignored when image is set.
  - name: price
    type: string
    default: ''
    reflect: false
    description: The display price, rendered verbatim; empty renders no price.
  - name: priceNote
    type: string
    default: ''
    attribute: price-note
    reflect: false
    description: A muted qualifier beside the price (per night, was $120); empty renders no box.
  - name: rating
    type: number
    default: 0
    reflect: false
    description: A 0 to 5 rating, rendered as text plus a numeric label; 0 renders no rating part.
  - name: badge
    type: string
    default: ''
    reflect: false
    description: A short status label forwarded to an internal ui-badge; empty renders no badge.
  - name: badgeIntent
    type: enum
    values: [neutral, info, success, warning, danger]
    default: neutral
    attribute: badge-intent
    reflect: false
    description: The badge intent, forwarded to ui-badge (which hardens an out-of-enum runtime write to neutral).
  - name: actionLabel
    type: string
    default: 'Select'
    attribute: action-label
    reflect: false
    description: The visible action label; the accessible name adds the title.
  - name: action
    type: json
    tsType: '{ action: string; context?: Record<string, unknown>; wantResponse?: boolean; submit?: boolean } | null'
    default: null
    reflect: false
    description: The Button action shape; non-null renders the action button, whose click emits it as the action event detail.
  - name: inline
    type: boolean
    default: false
    reflect: true
    description: ADR-0223 R2, the one sizing opt-out (hug instead of fill).

properties: []          # no manual accessors beyond the thirteen typed props

events:
  - name: action
    detail: 'the current `action` prop value'
    description: Fired when the user activates the action button, with the bound `action` payload as detail. A click anywhere else in the card emits nothing; no change or input.

slots:
  - name: default
    description: Optional. One extra consumer block; any light-DOM child the control did not build stays a direct host child and renders after the body (the control prepends media and body on first connect).

parts:
  - name: media
    description: The control-built `<div data-part="media">`, present only when `image` or `icon` is non-empty. Holds the image, or the icon header when there is no image.
  - name: image
    description: The `<img data-part="image">` inside media (src `image`, alt `imageAlt`), in a reserved 16:10 aspect box so a late image does not shift layout.
  - name: icon
    description: The decorative `<ui-icon data-part="icon">` inside media when `icon` is set and `image` is empty (the icon header, exhibit mode).
  - name: body
    description: The control-built `<div data-part="body">`, a flex column holding title, subtitle, rating, badge and the price row in that order.
  - name: title
    description: The title text, clamped at two lines.
  - name: subtitle
    description: The supporting line, present only when `subtitle` is non-empty.
  - name: rating
    description: The rating line, present only when `rating > 0`. Text plus a numeric label, never stars alone.
  - name: rating-glyph
    description: The `aria-hidden` star glyph inside rating.
  - name: rating-value
    description: The visible number inside rating (`rating.toFixed(1)`).
  - name: rating-text
    description: The visually hidden " out of 5" inside rating, so the accessible text reads "4.8 out of 5".
  - name: badge
    description: The internal `<ui-badge data-part="badge">` (label `badge`, intent `badgeIntent`), present only when `badge` is non-empty. Overlays the image's top-start corner when the media holds an image, otherwise sits in flow.
  - name: price-row
    description: The bottom row, present only when `price` is non-empty or `action` is non-null. Holds price, price note and the action button. Absent on an exhibit tile.
  - name: price
    description: The price text, the strongest text in the card (tabular numerals). Present only when `price` is non-empty.
  - name: price-note
    description: The muted price qualifier, present only when `priceNote` is non-empty.
  - name: action
    description: The real native `<button type="button" data-part="action">`, present only when `action` is non-null. Visible text `actionLabel`; aria-label `{actionLabel} {title}`.

customStates: []        # no custom state; presence is DOM add/remove, never a state flag

face:
  formAssociated: false  # a display primitive: extends UIElement, no value/validity participation

aria:
  role: group
  roleSource: internals   # set via ElementInternals in connected(), never a host role/aria-* attribute
  labelSource: prop       # internals.ariaLabel mirrors the `title` prop (kept live by an effect)
  actionAccessibleName: "{actionLabel} {title}", just actionLabel when title is empty, so a grid of N cards has N distinguishable buttons

keyboard:
  - note: No keyboard model of the host's own; the card takes no focus. The native action button is reachable in normal Tab order and activates on Enter and Space.

geometry:
  sizeClass: pattern
  paddingInline: var(--ui-product-card-pad-inline)     # = --md-sys-space-md
  paddingBlock: var(--ui-product-card-pad-block)       # = --md-sys-space-md
  rowGap: var(--ui-product-card-row-gap)               # = --md-sys-space-xs
  actionHeight: var(--ui-product-card-action-height)   # = --md-sys-height-sm, the one control-height row a pattern-tier card owns
  radius: var(--ui-product-card-radius)                # = --md-sys-shape-corner-base
  mediaAspect: 16 / 10
  note: Block-level fill by default, no intrinsic width (ADR-0223); `inline` flips to inline-flex and hugs.

forcedColors: The card outline and the action button keep a CanvasText border; the image and icon carry no status. Intent is never color alone (the badge carries its own glyph and label).
---

# ui-product-card

`ui-product-card` shows one product, room or offer to buy or book (ADR-0243). It extends `UIElement`
(a display primitive, not a container, not form-associated) and is `pattern`-tier: container spacing
plus one control-height action row.

```html
<ui-product-card
  title="Harbour View Suite, king bed"
  subtitle="Sleeps 2, 42 m², free cancellation"
  image="/rooms/harbour.jpg"
  image-alt="Suite with a harbour view"
  rating="4.8"
  badge="Best rate"
  badge-intent="success"
  price="$312"
  price-note="/ night"
  action-label="Book"
  action='{"action":"book","context":{"room":"harbour"}}'
></ui-product-card>
```

## Modes

- **Offer.** An image (16:10, reserved so a late load does not shift layout), the badge over its
  top-start corner, rating, price and one action.
- **Icon header.** No `image` but an `icon`: a glyph header in the primary color, no aspect box.
- **Exhibit tile.** No `price` and no `action`: there is no price row at all, so no empty price, badge
  or button renders (the `product-presentation` rule).

## Props

- **`title`**, **`subtitle`** (string): the heading and one supporting line. The title clamps at two lines.
- **`image`** (string, src), **`imageAlt`** (string, attribute `image-alt`): empty alt is decorative.
- **`icon`** (string): an icon glyph for the image-free header. `image` wins when both are set.
- **`price`**, **`priceNote`** (string, attribute `price-note`): the price is rendered verbatim.
- **`rating`** (number): 0 renders nothing; otherwise "4.8" with a star and a hidden "out of 5".
- **`badge`**, **`badgeIntent`** (string; enum `neutral|info|success|warning|danger`, attribute
  `badge-intent`): forwarded to an internal `ui-badge`.
- **`actionLabel`** (string, default `Select`, attribute `action-label`).
- **`action`** (the Button action shape, or `null`): non-null renders the action button.
- **`inline`** (boolean, reflected): the ADR-0223 sizing opt-out.

## Events

- **`action`**: fired when the action button is activated, with the `action` prop value as detail.

## Accessibility

- `role="group"` via `ElementInternals`, `internals.ariaLabel` mirroring `title`.
- The action is a real button named "{actionLabel} {title}".
- The rating reads as text, "4.8 out of 5", never stars alone.
