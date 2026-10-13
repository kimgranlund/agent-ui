---
# result-card.md frontmatter: the attributes-as-API descriptor for ui-result-card (ADR-0004; ADR-0244 ResultCard
# fork sheet). The machine-checkable public surface lives here; the prose below the fence is the /site doc.
# `attributes[]` is the generation source for result-card.props.gen.ts (ADR-0173) and its order is pinned by
# the dogfood fleet row. The contract<->props trip-wire (result-card-descriptor.test.ts) targets this fence.
tag: ui-result-card
description: A settled outcome card for a game end or a finished booking, with an outcome pill, a title, a summary, up to four stat tiles and the producer's own action buttons.
tier: pattern           # geometry size-class: container spacing, no control-height row (ADR-0244 ResultCard Geometry row)
extends: UIElement      # a display primitive with data-props: not form-associated (no value)
uses: []
# marginal: not yet measured; measured at the fleet size gate (npm run size)

attributes:             # attributes-as-API, the generation source for result-card.props.gen.ts
  - name: outcome
    type: enum
    values: [win, lose, draw, done]
    default: done
    reflect: true       # reflected so the [outcome] token repoints apply to JS-set values; out-of-set renders done
    description: The settled outcome, drawn as a word and a glyph on a tinted pill (Win, Loss, Draw, Done).
  - name: title
    type: string
    default: ''
    reflect: false      # NOT reflected; with the outcome word it names the host (internals.ariaLabel)
    attribute: result-title  # the global HTML `title` attribute is never observed or written, so a card never paints a native tooltip (the game-hud.md hud-title precedent)
    description: The card heading, shown beside the outcome pill.
  - name: summary
    type: string
    default: ''
    reflect: false      # NOT reflected; empty renders no summary part
    description: One or two lines that say what happened.
  - name: stats
    type: json          # {label, value, delta?, intent?}[], JSON-string attribute form
    default: ''         # the LIVE default is `[]`; `String([])===''` is the bijection form (the game-hud.md stats row precedent)
    reflect: false      # NOT reflected; a JSON-string attribute round-trips through the codec, not setAttribute
    codec: { import: './result-card-model.ts', name: 'statsProp' }  # ADR-0173 OF1: from(null)=[], malformed JSON also falls back to [], never throws; cleanStats keeps at most 4 entries and drops valueless ones
    description: Up to four final figures; each has a label, a value, an optional signed delta and an optional intent.
  - name: inline
    type: boolean
    default: false
    reflect: true       # ADR-0223 R2: the one sizing opt-out; the host hugs its content under [inline]

properties: []          # no manual accessors beyond the five typed props

events: []              # none of its own: each action is the producer's own ui-button child (ADR-0244 ResultCard Events row)

slots: []               # no named slots; the producer's direct children (its action buttons) follow the parts and form the actions row

parts:
  - name: header
    description: The control-built `<div data-part="header">` row holding the outcome pill then the title. Always present, and the one polite live region, so a changed outcome is announced once.
  - name: outcome
    description: The outcome pill, a tinted container with the glyph then the word. Its tint follows `outcome` (win success, lose danger, draw warning, done neutral) and is never the only signifier.
  - name: outcome-glyph
    description: The `aria-hidden` inline SVG glyph inside the pill (Win a check, Loss a cross, Draw an equals sign, Done a dot).
  - name: outcome-word
    description: The outcome word inside the pill (Win, Loss, Draw, Done).
  - name: title
    description: The control-built `<span data-part="title">` mirroring `title`. Present only when `title` is non-empty.
  - name: summary
    description: The control-built `<p data-part="summary">` mirroring `summary`. Present only when `summary` is non-empty (the empty-box law).
  - name: stats
    description: The control-built `<div data-part="stats">` wrapping grid of stat tiles. Present only when at least one stat survives hardening (the empty-box law).
  - name: stat
    description: One stat tile, reused by index across updates (the ui-game-hud stat look). Carries `data-intent` only when the stat has an intent; an intent never tints the tile.
  - name: glyph
    description: The `aria-hidden` intent shape inside a stat (the badge clip-paths). Present only when the stat has an intent.
  - name: label
    description: The stat label, small uppercase text.
  - name: value
    description: The stat value with tabular numerals. A finite number formats through Intl.NumberFormat; a string passes through verbatim.
  - name: delta
    description: The signed delta text (+50, -3, 0). Present only when the stat has a delta. Its ink follows the stat intent, never the sign.

customStates: []        # no custom state; the outcome rides the reflected [outcome] attribute

face:
  formAssociated: false  # a display primitive, no value/validity participation

aria:
  role: group
  roleSource: internals   # set via ElementInternals in connected(), never a host role/aria-* attribute
  labelSource: prop       # internals.ariaLabel is the outcome word and the trimmed `title` ("Win: Blackjack, hand 12"), or the word alone
  liveRegion: The header part is a polite live region (aria-live on the control-built header, the ui-game-hud status precedent), so a changed outcome or title is announced once. The pill is patched in place, so an unchanged outcome announces nothing.
  nonColorSignifier: The outcome always shows its word and its glyph, each stat with an intent carries its own shape glyph, and every delta is signed text. Color is the redundant channel (ADR-0057).

keyboard: []            # not focusable itself: the producer's buttons carry their own keyboard model

geometry:
  sizeClass: pattern
  paddingBlock: calc(var(--ui-result-card-inset) + var(--ui-result-card-pad-block))    # = 6px box inset + 6px region block padding (ADR-0046 Amendment 7)
  paddingInline: calc(var(--ui-result-card-inset) + var(--ui-result-card-pad-inline))  # = 6px box inset + 12px region inline padding
  rowGap: var(--ui-result-card-gap)                  # = --ui-box-gap (8px), between header, summary, stats and the actions row
  radius: var(--ui-result-card-radius)               # = --md-sys-shape-corner-base
  note: Container spacing only, no control-height row of its own. The spacing is the ADR-0046 box model in fixed rem (the shared --ui-box-* tokens), so the ink sits 19px inline and 13px block from the outer edge like a stock card region. The control stamps size="lg" on every direct ui-button child (36px at the default scale, the button's own ramp, the personas/action-row.ts behaviour re-homed), so action buttons never take a custom height. Block-level fill by default (ADR-0223); the `inline` boolean flips the host to inline-flex. Stat tiles wrap in an auto-fit grid with an 84px tile floor, and the actions row wraps, so the card never overflows its container.

forcedColors: The host keeps its outline as a CanvasText border, the outcome pill gains a CanvasText border (a tinted fill would otherwise flatten to Canvas), and the stat glyphs paint in CanvasText. The outcome glyph strokes in currentColor and needs no adjustment.
---

# ui-result-card

`ui-result-card` is a settled outcome card for a game end or a finished booking.

It states the outcome in words, shows the final figures and holds the producer's next action, so a game
never dead-ends on a bare status and the end state is visible on the wire. It emits no events of its own:
each action is a `ui-button` the producer places inside it.

```html
<ui-result-card outcome="win" result-title="Blackjack, hand 12"
  summary="You beat the dealer 20 to 18."
  stats='[{"label":"Chips","value":1290,"delta":50,"intent":"success"},{"label":"Hands","value":12}]'>
  <ui-button variant="primary">Play again</ui-button>
</ui-result-card>
```

## Anatomy

In DOM order: a header (the outcome pill, then `title`), the `summary`, the stat tiles, then the producer's
own children as the actions row. A part is present only when it has something to show: an empty `summary`
or `stats` renders no box, and a card with no children renders no actions row.

## Outcome

`outcome` is one of `win`, `lose`, `draw` or `done` (the default). Each always shows a word and a glyph, never
color alone: Win with a check, Loss with a cross, Draw with an equals sign, Done with a dot. The pill's tint
follows the outcome: success, danger, warning and neutral. Use `done` for a settled summary that is not a
game, such as a booked trip.

## Stats

`stats` is an array of `{label, value, delta, intent}`, at most four. Extra entries are dropped, and an entry
that is not an object or has no value is dropped. Values and deltas format as in `ui-game-hud`: a finite
number through `Intl.NumberFormat`, a delta signed (`+50`, `-3`).

## Actions

The card mints no button. Each direct `ui-button` child is stamped `size="lg"`, so action buttons sit at the
36px step of the library ramp. A click on the summary or a stat never fires an action.

## Accessibility

The host is `role="group"`, named by the outcome word and `title`, through `ElementInternals`. The header is a
polite live region, so a changed outcome is announced once.
