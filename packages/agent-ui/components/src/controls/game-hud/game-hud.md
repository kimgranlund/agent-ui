---
# game-hud.md frontmatter: the attributes-as-API descriptor for ui-game-hud (ADR-0004; ADR-0243 GameHud
# fork sheet). The machine-checkable public surface lives here; the prose below the fence is the /site doc.
# `attributes[]` is the generation source for game-hud.props.gen.ts (ADR-0173) and its order is pinned by
# the dogfood fleet row. The contract<->props trip-wire (game-hud-descriptor.test.ts) targets this fence.
tag: ui-game-hud
description: A game score and status strip with a title, a status badge, an optional progress bar and up to six stat tiles with signed deltas.
tier: pattern           # geometry size-class: container spacing, no control-height row (ADR-0243 GameHud Geometry row)
extends: UIElement      # a display primitive with data-props: not a container, not form-associated (no value)
uses:
  - ui-badge
  - ui-glyph
# marginal: not yet measured; measured at the fleet size gate (npm run size)

attributes:             # attributes-as-API, the generation source for game-hud.props.gen.ts
  - name: title
    type: string
    default: ''
    reflect: false      # NOT reflected; also the host's internals.ariaLabel (fallback "Game status")
    attribute: hud-title  # the global HTML `title` attribute is never observed or written, so a HUD never paints a native tooltip or gains a duplicate accessible description (the button.md iconOnly kebab override precedent)
    description: The HUD heading, shown in the header and used as the group's accessible name.
  - name: status
    type: string
    default: ''
    reflect: false      # NOT reflected; empty renders no status badge
    description: The status text, rendered as a composed ui-badge in the header.
  - name: statusIntent
    type: enum
    values: [neutral, info, success, warning, danger]
    default: neutral
    reflect: false      # NOT reflected; read at render and handed to the composed badge, out-of-set renders neutral
    attribute: status-intent  # kebab HTML attribute (the playing-card face-down precedent)
    description: The status badge intent; the badge adds its shape glyph so intent never rides color alone.
  - name: stats
    type: json          # {label, value, delta?, intent?}[], JSON-string attribute form
    default: ''         # the LIVE default is `[]`; `String([])===''` is the bijection form (the source-list sources row precedent)
    reflect: false      # NOT reflected; a JSON-string attribute round-trips through the codec, not setAttribute
    codec: { import: './game-hud-model.ts', name: 'statsProp' }  # ADR-0173 OF1: from(null)=[], malformed JSON also falls back to [], never throws; cleanStats keeps at most 6 entries and drops malformed ones
    description: Up to six stat tiles; each has a label, a value, an optional signed delta and an optional intent.
  - name: progress
    type: json          # {value, max, label?} | null, JSON-string attribute form
    default: null       # the LIVE default is null (no bar); String(null)='null' is the bijection form (the progress.md current row precedent)
    reflect: false      # NOT reflected; a JSON-string attribute round-trips through the codec
    codec: { import: './game-hud-model.ts', name: 'progressProp' }  # from(null)=null, malformed JSON also falls back to null, never throws; a max of zero or less renders no bar
    description: An optional progress readout drawn as a bar with its label, value and max.
  - name: inline
    type: boolean
    default: false
    reflect: true       # ADR-0223 R2: the one sizing opt-out; the host hugs its content under [inline]

properties: []          # no manual accessors beyond the six typed props

events: []              # a read-out: no activation, no events (ADR-0243 GameHud Events row)

slots: []               # no light-DOM content model; every part is control-built and patched in place, never author-slotted

parts:
  - name: header
    description: The control-built `<div data-part="header">` row holding the title then the status badge. Present only when `title` or `status` is non-empty.
  - name: title
    description: The control-built `<span data-part="title">` mirroring `title`. Present only when `title` is non-empty.
  - name: status
    description: A composed `<ui-badge data-part="status">` with `label` from `status` and `intent` from the hardened `statusIntent`. The badge supplies the ADR-0057 shape glyph. Present only when `status` is non-empty.
  - name: progress
    description: The control-built `<div data-part="progress">` carrying role progressbar with aria-valuemin, aria-valuemax, aria-valuenow and aria-label (the progress label, or "Progress"). Present only when `progress.max` is a finite number above zero.
  - name: progress-text
    description: The visible progress readout, `{label} {value} / {max}` (the label omitted when empty).
  - name: progress-track
    description: The fully rounded rail the fill sits in.
  - name: progress-fill
    description: The bar fill, whose inline size is the private `--_fill` ratio (value over max) the control writes. One color always; progress carries no intent.
  - name: stats
    description: The control-built `<div data-part="stats">` wrapping grid of stat tiles. Present only when at least one stat survives hardening.
  - name: stat
    description: One stat tile, reused by index across updates. Carries `data-intent` only when the stat has an intent; an intent never tints the tile.
  - name: glyph
    description: The intent shape inside a stat, a `<ui-glyph data-part="glyph">` whose mark comes from the badge's shared intent table (info `info`, success `check`, warning `warning`, danger `x`; T-0351, ADR-0245 cl.5). Decorative: ui-glyph hides itself through ElementInternals. Present only when the stat has an intent, sized to the glyph box 2n - 2c and n clear of its label (ADR-0245 Amendment 6).
  - name: label
    description: The stat label, small uppercase text.
  - name: value
    description: The stat value on the ui-stat value type step with tabular numerals. A finite number formats through Intl.NumberFormat; a string passes through verbatim.
  - name: delta
    description: The signed delta text (+60, -12, 0). Present only when the stat has a delta. Its ink follows the stat intent, never the sign.

customStates: []        # no custom state; nothing transitions except the progress fill width

face:
  formAssociated: false  # a display primitive, no value/validity participation

aria:
  role: group
  roleSource: internals   # set via ElementInternals in connected(), never a host role/aria-* attribute
  labelSource: prop       # internals.ariaLabel is the trimmed `title`, or "Game status" when it is empty
  liveRegion: The whole HUD is one polite live region (internals.ariaLive = 'polite'). Parts are created once and patched in place, so a stats update announces only the readout that changed.
  progressbar: The progress part carries role progressbar with aria-valuemin 0, aria-valuemax, aria-valuenow and aria-label (its label, or "Progress").
  nonColorSignifier: The status badge carries its intent shape glyph, each stat with an intent carries its own shape glyph, and every delta is signed text. Color is the redundant channel (ADR-0057).

keyboard: []            # not interactive and not focusable: no tabindex, no keyboard model

geometry:
  sizeClass: pattern
  paddingBlock: calc(var(--ui-game-hud-inset) + var(--ui-game-hud-pad-block))    # = 6px box inset + 6px region block padding (ADR-0046 Amendment 7)
  paddingInline: calc(var(--ui-game-hud-inset) + var(--ui-game-hud-pad-inline))  # = 6px box inset + 12px region inline padding
  rowGap: var(--ui-game-hud-gap)                  # = --ui-box-gap (8px), between header, progress and stats
  radius: var(--ui-game-hud-radius)               # = --md-sys-shape-corner-base
  note: Container spacing only, no control-height row (no action part). The spacing is the ADR-0046 box model in fixed rem (no scale-axis scaling outside the derived foundations), the shared --ui-box-* tokens, so the ink sits 19px inline and 13px block from the outer edge like a stock card region. As a surface root the HUD fills the canvas width (applyRootStretch, ADR-0046 Amendment 7). Block-level fill by default (ADR-0223); the `inline` boolean flips the host to inline-grid. Stat tiles wrap in an auto-fit grid with an 84px tile floor, so the HUD never overflows its container.

forcedColors: The host keeps its outline as a CanvasText border; the progress track gains a CanvasText border and the progress fill paints in CanvasText (a background-painted shape would otherwise flatten to Canvas and vanish) and the stat glyphs stroke in CanvasText. The composed status badge carries its own forced-colors treatment.
---

# ui-game-hud

`ui-game-hud` is a game score and status strip.

It sits quietly beside primary game content, such as a card table, a quiz or a dungeon room, and reads
out where the game stands: a title, a status, an optional progress bar and up to six stat tiles. It is a
read-out. It takes no focus, has no keyboard model and emits no events.

```html
<ui-game-hud hud-title="Table 4" status="Your turn" status-intent="success"
  stats='[{"label":"Chips","value":1240,"delta":60,"intent":"success"},{"label":"Bet","value":50}]'></ui-game-hud>
```

## Anatomy

In DOM order: a header row (`title`, then `status` as a composed `ui-badge`), an optional progress bar,
then the stat tiles in a wrapping grid. A part is present only when it has something to show: an empty
`stats` renders the title and status only, and no header renders when both are empty.

## Stats

`stats` is an array of `{label, value, delta, intent}`, at most six. Extra entries are dropped silently,
and an entry that is not an object, or has neither a label nor a value, is dropped.

- `value`: a finite number formats through `Intl.NumberFormat` (1240 reads 1,240); a string passes through
  verbatim (`3.1`, `4/6`). A non-finite value renders nothing, never a placeholder glyph.
- `delta`: a number, or a string holding one, prints signed (`+60`, `-12`, `0`). Other text passes through
  verbatim. The sign is text, so a change never travels by color alone.
- `intent`: one of `info`, `success`, `warning`, `danger` adds a shape glyph and tints the glyph and delta
  ink. `neutral`, a missing intent or anything else adds neither. An intent never tints the tile.

## Progress

`progress` is `{value, max, label}`. `max` must be a finite number above zero, otherwise no bar renders
rather than a broken one. `value` clamps into `[0, max]`. The bar is one color always.

## Title attribute

The `title` prop is observed as `hud-title`. The global `title` attribute is never read or written, so a
HUD never shows a native tooltip.

## Accessibility

The host is `role="group"`, named by `title` or "Game status", and is one polite live region, all through
`ElementInternals`. Parts are built once and patched in place, so a score change announces only the
readout that changed. The progress part is a `progressbar` with its label, value and max.
