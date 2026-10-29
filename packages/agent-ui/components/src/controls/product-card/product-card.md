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
  - ui-rating

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
    description: The image src; when set the media part holds a 16:10 image and wins over icon. The source passes the fleet media gate first (`controls/text/media-src.ts`, T-0553): only an http(s), data: or blob: URL renders, and a denied one counts as empty (the icon header shows when icon is set).
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
  - name: priceOld
    type: string
    default: ''
    attribute: price-old
    reflect: false
    description: The previous price, rendered verbatim and struck through after the price (ADR-0243 Amendment 2); empty renders no box.
  - name: priceNote
    type: string
    default: ''
    attribute: price-note
    reflect: false
    description: A muted qualifier beside the price (per night); empty renders no box.
  - name: rating
    type: number
    default: 0
    reflect: false
    description: A 0 to 5 rating, rendered as a readonly ui-rating (five stars filled to the exact fraction) plus the number; 0 renders no rating part.
  - name: ratingCount
    type: number
    default: 0
    attribute: rating-count
    reflect: false
    description: How many ratings the score rests on, shown in parentheses after the number (ADR-0243 Amendment 2); 0 renders no count.
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
  - name: selected
    type: boolean
    default: false
    reflect: true
    description: The chosen offer (ADR-0243 Amendment 2). A primary outline around the card and the action drawn as a ghost; the action keeps actionLabel, which carries the state in words.
  - name: disabled
    type: boolean
    default: false
    reflect: true
    description: An offer that cannot be taken (ADR-0243 Amendment 2). The media desaturates and the action button is disabled, so neither it nor a host click emits.
  - name: inline
    type: boolean
    default: false
    reflect: true
    description: ADR-0223 R2, the one sizing opt-out (hug instead of fill).

properties: []          # no manual accessors beyond the seventeen typed props

events:
  - name: action
    detail: 'the current `action` prop value'
    description: Fired when the user activates the action button, with the bound `action` payload as detail. A click anywhere else in the card emits nothing; a disabled card's button emits nothing; no change or input.

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
    description: The rating line, present only when `rating > 0`. Stars plus a numeric label, never stars alone.
  - name: rating-stars
    description: The `aria-hidden`, `inert` wrapper inside rating holding a readonly `<ui-rating size="sm">` (T-0146), the fleet's star display, filled to the exact fraction of the rating. Inert, so the composed slider is neither announced nor a tab stop; the text beside it carries the value.
  - name: rating-value
    description: The visible number inside rating (`rating.toFixed(1)`).
  - name: rating-text
    description: The visually hidden " out of 5" inside rating, so the accessible text reads "4.8 out of 5".
  - name: rating-count
    description: The count in parentheses after the number, present only when `ratingCount > 0`.
  - name: badge
    description: The internal `<ui-badge data-part="badge">` (label `badge`, intent `badgeIntent`), present only when `badge` is non-empty. Overlays the image's top-start corner on an opaque surface fill when the media holds an image (T-0142), otherwise sits in flow.
  - name: price-row
    description: The bottom row, present only when `price` is non-empty or `action` is non-null. Holds price, price note and the action button. Absent on an exhibit tile.
  - name: price
    description: The price text, the strongest text in the card (tabular numerals). Present only when `price` is non-empty.
  - name: price-old
    description: The `<s data-part="price-old">` after the price, muted and struck through, present only when `priceOld` is non-empty.
  - name: price-old-text
    description: The visually hidden "was " inside price-old, so the old price is announced as such and not by its strike alone.
  - name: price-note
    description: The muted price qualifier, present only when `priceNote` is non-empty.
  - name: action
    description: The real native `<button type="button" data-part="action">`, present only when `action` is non-null. Visible text `actionLabel`; aria-label `{actionLabel} {title}`. At the derived control height of its own md step (`data-size="md"` on the part, resolved on the part whatever the card's own size, T-0352; `--md-sys-height`, 4n: 32px at the root, ADR-0245 Amendment 8, and 24px on an A2UI canvas, Amendment 3; the old large step, 36px, under the legacy opt-out); a ghost when `selected`, natively disabled when `disabled`.

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
  paddingInline: calc(var(--ui-product-card-inset) + var(--ui-product-card-pad-inline))  # the body: 6px box inset + 12px region inline padding (ADR-0046 Amendment 7)
  paddingBlock: calc(var(--ui-product-card-inset) + var(--ui-product-card-pad-block))    # the body: 6px box inset + 6px region block padding
  rowGap: var(--ui-product-card-row-gap)               # = --ui-box-gap (8px) between the body's rows
  actionHeight: var(--ui-product-card-action-height)   # unset by default (a host or ancestor override wins); the fallback is --md-sys-height (4n) at the action part's own md step (resolved on the part, T-0352), else --md-sys-height-lg (ADR-0243 Amendment 2, ADR-0245 cl.10a), the one control-height row a pattern-tier card owns
  radius: var(--ui-product-card-radius)                # = --md-sys-shape-corner-base
  mediaAspect: 16 / 10
  note: Block-level fill by default, no intrinsic width (ADR-0223); `inline` flips to inline-flex and hugs. The body spacing is the ADR-0046 box model in fixed rem (no scale-axis scaling outside the derived foundations), the shared --ui-box-* tokens, so the body ink sits 19px inline from the outer edge like a stock card region; the icon header aligns to it. As a surface root the card fills the canvas width (applyRootStretch, ADR-0046 Amendment 7).

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
- **Icon header.** No `image` but an `icon`: the icon is the card's media, a 4n glyph in the primary color on a tinted widget-radius tile (T-0142), no aspect box. It is pictorial media standing in for the image, not an inline icon, so it keeps its 48px size outside the 2n icon box (Kim 2026-10-17, T-0338; the dogfood `icon-box` finding is allowlisted as a ruled exemption).
- **Exhibit tile.** No `price` and no `action`: there is no price row at all, so no empty price, badge
  or button renders (the `product-presentation` rule).

## Props

- **`title`**, **`subtitle`** (string): the heading and one supporting line. The title clamps at two lines.
- **`image`** (string, src), **`imageAlt`** (string, attribute `image-alt`): empty alt is decorative.
- **`icon`** (string): an icon glyph for the image-free header. `image` wins when both are set.
- **`price`**, **`priceOld`** (string, attribute `price-old`), **`priceNote`** (string, attribute
  `price-note`): the price is rendered verbatim; the old price follows it, struck through.
- **`rating`** (number): 0 renders nothing; otherwise a readonly `ui-rating` (the exact fraction), "4.8" and a hidden
  "out of 5". **`ratingCount`** (number, attribute `rating-count`): a count such as "(318)" after it.
- **`badge`**, **`badgeIntent`** (string; enum `neutral|info|success|warning|danger`, attribute
  `badge-intent`): forwarded to an internal `ui-badge`.
- **`actionLabel`** (string, default `Select`, attribute `action-label`).
- **`action`** (the Button action shape, or `null`): non-null renders the action button.
- **`selected`** (boolean, reflected): a primary outline and a ghost action; write the state into
  `actionLabel` (for example "Selected").
- **`disabled`** (boolean, reflected): the media desaturates and the action button is disabled.
- **`inline`** (boolean, reflected): the ADR-0223 sizing opt-out.

## Events

- **`action`**: fired when the action button is activated, with the `action` prop value as detail.

## Accessibility

- `role="group"` via `ElementInternals`, `internals.ariaLabel` mirroring `title`.
- The action is a real button named "{actionLabel} {title}".
- The rating reads as text, "4.8 out of 5", never stars alone; the old price reads "was $120".
- Selected is never the outline alone: the action's label says it. Disabled is the native button state.
