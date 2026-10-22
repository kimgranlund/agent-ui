---
# option-compare.md frontmatter: the attributes-as-API descriptor for ui-option-compare (ADR-0004; T-0393, the
# Option compare forks 10 to 16 and Direction A approved by Kim 2026-10-21 in .sdlc/tickets/.0199-itinerary-compare/).
# The machine-checkable public surface lives here; the prose below the fence is the /site doc. `attributes[]` is the
# generation source for option-compare.props.gen.ts (ADR-0173). The contract<->props trip-wire
# (option-compare-descriptor.test.ts) targets this fence.
tag: ui-option-compare
description: Two to four options as columns over aligned attribute rows, with a best mark; the whole column is the pick.
tier: pattern           # geometry size-class: container spacing, no control-height row (the OptionDeck tier precedent)
extends: UIElement      # an interactive pattern from hardened data props: not form-associated, no commit button
uses: []
# marginal: not yet measured; measured at the fleet size gate (npm run size)

attributes:             # attributes-as-API, the generation source for option-compare.props.gen.ts
  - name: options
    type: json          # {value, title, subtitle?, values: {<rowKey>: string}}[], JSON-string attribute form
    default: ''         # the LIVE default is `[]`; `String([])===''` is the bijection form (the option-deck.md options row precedent)
    reflect: false      # NOT reflected; a JSON-string attribute round-trips through the codec, not setAttribute
    codec: { import: './option-compare-model.ts', name: 'optionsProp' }  # ADR-0173 OF1: from(null)=[], malformed JSON also falls back to [], never throws; cleanOptions drops entries without value or title and repeated values
    description: The options, one column each, in order. Each has a value and a title, an optional subtitle, and its cell text by row key; a missing key renders an empty cell.
  - name: rows
    type: json          # {key, label}[], JSON-string attribute form
    default: ''         # the LIVE default is `[]`, the same bijection form as `options`
    reflect: false
    codec: { import: './option-compare-model.ts', name: 'rowsProp' }  # from(null)=[], malformed JSON falls back to []; cleanRows drops entries without key or label and repeated keys
    description: The attribute rows, in order. Each has a key, read from every option's values, and the label shown in the pinned label column.
  - name: best
    type: string
    default: ''
    reflect: false      # NOT reflected; the column whose value equals it carries data-best, a "Best" pill and a ring
    description: The value of the best option. Empty marks none.
  - name: value
    type: string
    default: ''
    reflect: false      # NOT reflected; bindable, the column whose value equals it is selected with the Your pick pill
    description: The picked option's value. Empty means no pick.
  - name: actionName
    type: string
    default: ''
    reflect: false
    attribute: action-name  # the kebab attribute (the option-deck.md actionName precedent)
    description: The action name a pick emits. Empty means a pick fires `select` only.
  - name: heading
    type: string
    default: ''
    reflect: false      # NOT reflected; empty renders no heading part, and the accessible name falls back to "Options"
    description: An optional heading above the columns; it also names the listbox.
  - name: inline
    type: boolean
    default: false
    reflect: true       # ADR-0223 R2: the one sizing opt-out; the host hugs its content under [inline]
    description: Hugs the content instead of filling the container (the one sizing opt-out).

properties: []          # no manual accessors beyond the typed props

events:
  - name: select
    detail: string
    description: Fired once per pick (click, Enter or Space) of an option column, after `value` is set. The detail is the picked value. Never on render.
  - name: action
    detail: '{action: string, context: {value: string}}'
    description: Fired once per pick right after `select`, only when `actionName` is set. `detail.action` is `actionName`; `detail.context.value` is the picked value.

slots: []               # no light-DOM content model: every part is control-built from props and patched in place

parts:
  - name: heading
    description: The control-built heading line. Present only when `heading` is non-empty.
  - name: scroller
    description: The horizontal scroll box around the grid. When the columns do not fit (a fourth option at the 400px column) they scroll inside it, never the host.
  - name: grid
    description: The grid of the label column then one column per option; the label column and every option span all its rows through subgrid, so the rows align across options.
  - name: labels
    description: The pinned label column, `position: sticky` at the inline start, so it stays in view while the options scroll. `aria-hidden`; each cell carries its own row label for assistive tech.
  - name: label
    description: One row label in the label column, per row.
  - name: option
    description: One column per option. The whole column is the target, carrying `role="option"`, `aria-selected`, the roving `tabindex`, `data-key` and, on the best option, `data-best`. Its accessible name is the title; the subtitle, the Best pill and the cells are its description.
  - name: head-row
    description: The column's first row, holding the pill, the title and the subtitle.
  - name: pill
    description: The state pill. "Best" with a star glyph on the best option, "Your pick" with a check glyph on the picked one; the picked option shows "Your pick" even when it is also best. Present only on those columns.
  - name: title
    description: The option title, the column's accessible name.
  - name: subtitle
    description: One quiet line under the title. Present only when the option has one.
  - name: cell
    description: One cell per row, holding the option's text for that row key; empty when the option has no value for it.
  - name: cell-label
    description: A visually hidden copy of the row label inside each cell (the ADR-0057 visually-hidden text precedent), so the column's description reads each label with its value.

customStates: []        # no custom state: the pick rides aria-selected and the best mark data-best on the option part

face:
  formAssociated: false  # outside any form: a pick fires an event, it is not a form value

aria:
  role: listbox
  roleSource: internals   # set via ElementInternals in connected(), never a host role attribute
  labelSource: prop       # internals.ariaLabel mirrors `heading`, or "Options" when it is empty
  optionRole: Each option column carries `role="option"`, `aria-selected`, `aria-labelledby` (its title) and `aria-describedby` (its subtitle, the Best pill and its non-empty cells) as attributes on the part; a part has no ElementInternals, and the host carries only internals.

keyboard:
  - keys: ArrowRight / ArrowDown
    action: Moves roving focus to the next column in tree order, looping.
  - keys: ArrowLeft / ArrowUp
    action: Moves roving focus to the previous column in tree order, looping.
  - keys: Home / End
    action: Moves roving focus to the first or last column.
  - keys: Enter / Space
    action: Picks the focused column, firing one `select` and, with `actionName` set, one `action`.

geometry:
  sizeClass: pattern
  columnGap: var(--ui-option-compare-column-gap)   # = --md-sys-control-gutter, between columns
  columnMin: var(--ui-option-compare-column-min)   # = 15n, the option track floor
  optionRadius: var(--ui-option-compare-radius)    # = --md-sys-control-radius
  note: Container spacing only, no control-height row of its own. The grid is `max-content repeat(n, minmax(15n, 1fr))`; when the option tracks do not fit, the scroller scrolls them while the label column stays pinned at the inline start. Block-level fill by default (ADR-0223); the host declares no container, so it keeps an intrinsic width inside a shrink-to-fit parent.

forcedColors: Every option keeps a CanvasText border, the best option a thicker one, the picked option a Highlight outline, and the pill a CanvasText border so it reads without its fill.
---

# ui-option-compare

`ui-option-compare` sets two to four options side by side as columns over aligned attribute rows, with a best mark, and the whole column is the pick.

```html
<ui-option-compare heading="Lisbon to Porto" best="train" action-name="pick_leg"
  rows='[{"key":"duration","label":"Duration"},{"key":"price","label":"Price"}]'
  options='[{"value":"train","title":"Train","subtitle":"Alfa Pendular","values":{"duration":"2h 50m","price":"EUR 32"}},{"value":"bus","title":"Bus","values":{"duration":"3h 30m","price":"EUR 19"}}]'>
</ui-option-compare>
```

## Anatomy

An optional heading, then a grid: a label column with one label per row, then one column per option. Each column
opens with a head row (the pill, the title and the subtitle), then one cell per row, so a value reads across the
options in one line. When the columns do not fit, they scroll inside the control and the label column stays pinned.

## Best and picked

`best` marks one option with a "Best" pill holding a star, plus a ring. The picked option shows a "Your pick" pill
holding a check, plus a fill and a ring; when it is also the best option it keeps its best mark under the pick.
Neither is shown by color alone.

## Picking

A click, Enter or Space on a column sets `value` to the option's value and fires `select` with it. When
`actionName` is set, an `action` event follows with `{action, context: {value}}`. Every column stays pressable, so a
second pick changes the choice. Setting `value` from outside marks that column the same way. There are no buttons
inside a column.

## Accessibility

The host is a `listbox` through `ElementInternals`, named by `heading`. Each column is an `option` with its title as
the name; its subtitle, Best pill and cells are the description, each cell carrying its row label, so a screen reader
hears "Duration 2h 50m, Price EUR 32". One column holds the tab stop; the arrow keys, Home and End move between
columns.
