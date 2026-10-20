---
# option-deck.md frontmatter: the attributes-as-API descriptor for ui-option-deck (ADR-0004; the T-0193 OptionDeck
# fork sheet in .sdlc/tickets/.0193-option-deck/handoff.md). The machine-checkable public surface lives here; the
# prose below the fence is the /site doc. `attributes[]` is the generation source for option-deck.props.gen.ts
# (ADR-0173). The contract<->props trip-wire (option-deck-descriptor.test.ts) targets this fence.
tag: ui-option-deck
description: A deck of option cards for picking one of a few things to start; the whole card is the choice.
tier: pattern           # geometry size-class: container spacing, no control-height row (the ResultCard tier precedent)
extends: UIElement      # an interactive pattern from hardened data props: not form-associated, no commit button
uses:
  - ui-icon
# marginal: not yet measured; measured at the fleet size gate (npm run size)

attributes:             # attributes-as-API, the generation source for option-deck.props.gen.ts
  - name: options
    type: json          # {value, title, description?, icon?, image?, imageAlt?, meta?, tone?, index?}[], JSON-string attribute form
    default: ''         # the LIVE default is `[]`; `String([])===''` is the bijection form (the result-card.md stats row precedent)
    reflect: false      # NOT reflected; a JSON-string attribute round-trips through the codec, not setAttribute
    codec: { import: './option-deck-model.ts', name: 'optionsProp' }  # ADR-0173 OF1: from(null)=[], malformed JSON also falls back to [], never throws; cleanOptions drops entries without value or title, cuts meta to 3 and keeps index as a string
    description: The option cards, in order. Each has a value and a title, and may add a description, an icon or image, up to three meta chips, a tone and a corner index.
  - name: value
    type: string
    default: ''
    reflect: false      # NOT reflected; bindable, the card whose key equals it is marked selected with the Your pick pill
    description: The picked option's value, or `random` for the Surprise me card. Empty means no pick.
  - name: actionName
    type: string
    default: ''
    reflect: false
    attribute: action-name  # the kebab attribute (the board-grid.md actionName precedent)
    description: The action name a pick emits. Empty means a pick fires `select` only.
  - name: allowRandom
    type: boolean
    default: false
    reflect: true
    attribute: allow-random  # kebab HTML attribute
    description: Adds a dashed Surprise me card as the last card; picking it commits `random`.
  - name: randomLabel
    type: string
    default: Surprise me
    reflect: false
    attribute: random-label  # kebab HTML attribute
    description: The Surprise me card title.
  - name: heading
    type: string
    default: ''
    reflect: false      # NOT reflected; empty renders no heading part, and the deck's accessible name falls back to "Options"
    description: An optional heading above the deck; it also names the listbox.
  - name: subheading
    type: string
    default: ''
    reflect: false      # NOT reflected; empty renders no subheading part
    description: An optional line under the heading.
  - name: disabled
    type: boolean
    default: false
    reflect: true       # reflected; a disabled deck commits nothing and has no tab stop
    description: Disables every card; no pick, no event.

properties: []          # no manual accessors beyond the typed props

events:
  - name: select
    detail: string
    description: Fired once per pick (click, Enter or Space) of a card on an enabled deck, after `value` is set. The detail is the picked key, `random` for the Surprise me card. Never on render and never while disabled.
  - name: action
    detail: '{action: string, context: {value: string}}'
    description: Fired once per pick right after `select`, only when `actionName` is set. `detail.action` is `actionName`; `detail.context.value` is the picked key. Never while disabled.

slots: []               # no light-DOM content model: every part is control-built from props and patched in place

parts:
  - name: heading
    description: The control-built heading line. Present only when `heading` is non-empty.
  - name: subheading
    description: The control-built line under the heading. Present only when `subheading` is non-empty.
  - name: grid
    description: The responsive card grid, auto-fit tracks with a 40n floor, one column at the 400px column.
  - name: option
    description: One card per option, plus the Surprise me card when `allowRandom` is set. The whole card is the target, carrying `role="option"`, `aria-selected`, the roving `tabindex`, `data-tone` and, on the Surprise me card, `data-random`. Its accessible name is the title; the description and meta are its description.
  - name: hero
    description: The card's tone header band, drawn as a token cross-hatch over the tone container color. At one column it turns into the card's leading column.
  - name: index
    description: The optional corner index, shown at the band's top-start corner and repeated upside down at its bottom-end corner. `aria-hidden`; present only when the option has an `index`.
  - name: disc
    description: The round surface disc centered in the band that holds the icon, or the shuffle glyph on the Surprise me card.
  - name: icon
    description: The `<ui-icon>` inside the disc, showing the option's `icon` from the active pack. Present only when the option has an icon.
  - name: shuffle
    description: The `aria-hidden` inline SVG shuffle glyph inside the Surprise me card's disc.
  - name: image
    description: The option's image covering the band, in place of the disc. Present only when the option has an `image`; `imageAlt` is its alt text.
  - name: body
    description: The text column under the band, holding the title, the description and the meta chips.
  - name: title
    description: The option title, the card's accessible name.
  - name: description
    description: One line of description. Present only when the option has one.
  - name: meta
    description: The row of up to three meta chips. Present only when the option has meta.
  - name: chip
    description: One meta chip, tinted with the card tone.
  - name: pick
    description: The `aria-hidden` "Your pick" pill at the card's top-end corner, shown only on the selected card. `aria-selected` carries the state to assistive tech.

customStates: []        # no custom state: the pick rides aria-selected on the option part

face:
  formAssociated: false  # outside any form: a pick fires an event, it is not a form value

aria:
  role: listbox
  roleSource: internals   # set via ElementInternals in connected(), never a host role attribute
  labelSource: prop       # internals.ariaLabel mirrors `heading`, or "Options" when it is empty
  optionRole: Each card part carries `role="option"`, `aria-selected`, `aria-labelledby` (its title) and `aria-describedby` (its description and meta) as attributes on the part; a part has no ElementInternals, and the host carries only internals.
  disabledState: internals.ariaDisabled mirrors `disabled`, and every card part carries `aria-disabled="true"` while disabled.

keyboard:
  - keys: ArrowDown / ArrowRight
    action: Moves roving focus to the next card in tree order, looping.
  - keys: ArrowUp / ArrowLeft
    action: Moves roving focus to the previous card in tree order, looping.
  - keys: Home / End
    action: Moves roving focus to the first or last card.
  - keys: Enter / Space
    action: Picks the focused card, firing one `select` and, with `actionName` set, one `action`.

geometry:
  sizeClass: pattern
  gap: var(--ui-option-deck-gap)               # = --md-sys-widget-margin, between cards
  cardRadius: var(--ui-option-deck-radius)     # = --md-sys-card-radius
  cardPadding: var(--ui-option-deck-pad)       # = --md-sys-widget-margin, the body inset
  cardMin: var(--ui-option-deck-card-min)      # = 40n, the auto-fit track floor
  note: Container spacing only, no control-height row of its own. The grid is `repeat(auto-fit, minmax(min(100%, 40n), 1fr))`, so a 400px column falls to one track and a card turns into a horizontal row (band leading, text trailing) under a 30rem container, the 400px column at every register. Block-level fill by default (ADR-0223); never horizontal scroll.

forcedColors: Every card keeps a CanvasText border, the selected card gains a Highlight outline, the band pattern and chip tint drop to Canvas, and the pick pill gains a CanvasText border so it reads without its fill.
---

# ui-option-deck

`ui-option-deck` is a deck of option cards for picking one of a few things to start, where the whole card is the choice.

```html
<ui-option-deck heading="Pick your table" allow-random action-name="pick_game"
  options='[{"value":"blackjack","title":"Blackjack","description":"Beat the dealer to 21.","icon":"star","tone":"primary","index":"A","meta":["1 to 6 players","5 min"]}]'>
</ui-option-deck>
```

## Anatomy

An optional heading and subheading, then a grid of cards. Each card has a tone header band with an optional
corner index and an icon disc (or an image), a title, one line of description and up to three meta chips. The
picked card shows a "Your pick" pill. With `allowRandom` set, a dashed Surprise me card comes last.

## Picking

A click, Enter or Space on a card sets `value` to the card's key and fires `select` with that key. When
`actionName` is set, an `action` event follows with `{action, context: {value}}`. The Surprise me card's key is
`random`. The deck stays with the picked card marked, and every card stays pressable, so a second pick changes
the choice. Setting `value` from outside marks that card the same way. There are no buttons inside a card.

## Tones

`tone` is one of `neutral`, `primary`, `secondary`, `accent`, `info` or `success`, each the matching color
role's container. The title is the identity; the tone only tells the cards apart.

## Accessibility

The host is a `listbox` through `ElementInternals`, named by `heading`. Each card is an `option` with its title
as the name and its description and meta as the description. One card holds the tab stop; the arrow keys,
Home and End move between cards.
