---
# board-grid.md frontmatter: the GENERATION SOURCE for ui-board-grid's `static props` block (ADR-0173;
# ADR-0243, the BoardGrid fork sheet). The machine-checkable public surface lives HERE (frontmatter); the
# prose below the fence is the /site doc. `board-grid.props.gen.ts` is GENERATED from `attributes[]` below
# (`node scripts/generate-props.mjs board-grid`); board-grid.ts imports it, never hand-edit the generated
# file. `cells` is an ADR-0173 OF1 `codec:` reference (board-grid-model.ts's `cleanCells`-backed
# PropConfig, the source-list `sourcesProp` shape reused verbatim).
tag: ui-board-grid
description: A board of cells to target or mark, with one roving tab stop.
tier: pattern          # geometry size-class: container spacing plus ONE square cell row (46px, floored at 34px), ADR-0243 BoardGrid Geometry row and Amendment 2
extends: UIElement     # a display primitive with data-props: not a container, not form-associated (no value), ADR-0243 shared rows
uses: []
# marginal: not yet measured via `npm run size` (new control; measured at the integration wave, manual by Kim's ruling).

attributes:            # attributes-as-API: the GENERATION SOURCE for board-grid.ts's `static props` (ADR-0173)
  - name: rows
    type: number
    default: 0          # 0 rows renders no cells; a non-finite or negative value is 0, a fraction floors (boardDim)
    reflect: false
    description: The board's row count. Not bindable; a change rebuilds the board.
  - name: cols
    type: number
    default: 0          # the same guard as rows; the CSS grid takes one column per board column
    reflect: false
    description: The board's column count. Not bindable; a change rebuilds the board.
  - name: cells
    type: json          # {row, col, mark, intent, disabled}[], JSON-string attribute form (ADR-0243)
    default: ''         # the LIVE default is `[]`, `String([])===''` is the bijection form (the source-list.md precedent)
    reflect: false      # NOT reflected: a JSON-string attribute round-trips through the codec, not setAttribute
    codec: { import: './board-grid-model.ts', name: 'cellsProp' }  # ADR-0173 OF1: the safe codec (from(null)=[], malformed JSON also falls back to [], never throws). cleanCells drops an entry without integer row/col, drops an out-of-set intent as a field; placeCells drops a cell outside rows x cols, and the later of two entries at one position wins.
    description: The marked cells, 0-based row and col. Bindable; a write patches the existing cell parts in place, never a re-mount.
  - name: label
    type: string
    default: ''
    reflect: false      # internals.ariaLabel mirrors it (an empty label sets no name)
    description: The board's accessible name.
  - name: actionName
    type: string
    default: ''
    reflect: false
    attribute: action-name  # the kebab attribute (the service-card `action-label` precedent)
    description: The action name an activated cell emits. Empty means a read-only board.
  - name: inline
    type: boolean
    default: false
    reflect: true       # ADR-0223 R2, the ONE sizing opt-out
    description: Hug the board's own width instead of filling the container (ADR-0223).

properties: []         # no manual accessors beyond the six typed props

events:
  - name: action
    detail: '{action: string, context: {row: number, col: number}}'
    description: Fired once per activation (click, Enter or Space) of an enabled cell on an interactive board (`actionName` non-empty). `detail.action` is `actionName`; `detail.context` carries the cell's 0-based row and col (the Suggestions precedent). Never on render, never on a disabled cell, never on a read-only board.

slots: []              # no light-DOM content model: every part is control-built (createElement + replaceChildren), never author-slotted

parts:
  - name: row
    description: One `<div data-part="row" role="row">` per board row, `display: contents`, so its cells sit straight on the host's CSS grid. ARIA 1.2 requires a gridcell to be owned by a row.
  - name: cell
    description: One per board position, all built in one pass with no per-cell custom element. On an interactive board each is a `<button data-part="cell">` (the sanctioned internal activation class) and a disabled cell is a disabled button; on a read-only board each is a `<div data-part="cell">` and a disabled cell carries `aria-disabled="true"`. Carries `role="gridcell"`, the roving `tabindex`, `data-intent` when an intent is set, and its accessible name as `aria-label`.
  - name: mark
    description: The `<span data-part="mark">` inside each cell, holding the cell's `mark` text, centered.
  - name: intent
    description: The `aria-hidden` `<span data-part="intent">` corner glyph at the cell's bottom-right, present only when the cell has an intent (success `+`, warning `?`, neutral `-`, danger `!`, info `i`). The non-color signifier: intent never travels by color alone (ADR-0057). It is a glyph in its own glyph box `n + 6`, its cap height filling the box, inset `c` from the cell corner (ADR-0245 Amendment 6).

customStates: []       # no custom state: hover, focus and disabled paint key on the native parts and attributes

face:
  formAssociated: false  # a display primitive: extends UIElement, no value/validity participation

aria:
  role: grid
  roleSource: internals   # set via ElementInternals in connected(), never a host role attribute
  labelSource: prop       # internals.ariaLabel mirrors `label`
  cellRole: gridcell      # each cell part carries role="gridcell" inside a role="row" part
  cellName: "the non-empty parts of mark, intent word, row {row+1}, column {col+1}, joined by a comma and a space (ADR-0243:131)"

keyboard:
  - note: ONE tab stop in both modes, a roving tabindex. Exactly one cell has tabindex 0 (the first enabled cell until focus moves) and every other cell has tabindex -1.
  - note: ArrowLeft and ArrowRight move one cell toward that physical side (under `dir="rtl"` the grid mirrors, so ArrowLeft steps to the next column, T-0539); ArrowUp and ArrowDown move one row. A move skips disabled cells in its direction and stays put at the edge (no wrap).
  - note: Enter and Space activate the focused enabled cell on an interactive board, emitting one `action` event. A read-only board keeps the roving tab stop but never activates.
  - note: The roving position survives a `cells` update; a rows or cols change rebuilds the board and keeps the position when it is still on the board.

geometry:
  sizeClass: pattern
  cellSize: var(--ui-board-grid-cell-size)   # 46px, the approved mockup's cell (ADR-0243 Amendment 2): square cells, each track minmax(--ui-board-grid-cell-min, cell-size)
  cellMin: var(--ui-board-grid-cell-min)     # 34px, the target-size floor a cell never goes under in a narrow container
  gap: var(--ui-board-grid-gap)              # --md-sys-space-xs, scale-responsive: the tight data-grid gap between cells (the approved mockup's 4px)
  frame: none                                # T-0146: the board paints no frame, so it carries no inset; its first cell sits on the text edge
  note: Block-level FILL by default (ADR-0223); the board's tracks are up to cell-size wide (down to cell-min when the container is narrow) and pack to the start. The `inline` boolean flips to inline-grid and the host hugs the board. The cell gap stays tight on purpose, a board reads as one unit; the 8px rhythm applies at the container level, between the board and its siblings. As a surface root the board fills the canvas width (applyRootStretch, ADR-0046 Amendment 7).

forcedColors: A dedicated `@media (forced-colors: active)` block. Every cell keeps a `CanvasText` border, an intent cell's corner glyph stays real text, and a disabled cell steps to `GrayText`, so no state rides color alone.
---

# ui-board-grid

`ui-board-grid` is a board of cells to target or mark.

```html
<ui-board-grid
  rows="6" cols="6"
  label="Enemy waters"
  action-name="fire"
  cells='[
    {"row":0,"col":1,"mark":"●","intent":"danger","disabled":true},
    {"row":1,"col":1,"mark":"✕","intent":"neutral","disabled":true}
  ]'
></ui-board-grid>
```

It renders `rows` x `cols` cells in one pass on one CSS grid, with no per-cell custom element, so a board
of 72 or more cells stays cheap. `cells` lists only the marked positions; every other position is a blank
cell.

## Modes

- **Interactive**: with `actionName` set, every cell is a real `<button>`. Activating an enabled cell
  (click, Enter or Space) emits one `action` event with `{action: actionName, context: {row, col}}`.
- **Read-only**: without `actionName`, cells are plain parts and nothing is emitted. The board keeps its
  one roving tab stop so a screen reader user can still walk it.

## Marks and intent

A cell's `mark` is centered text. Its `intent` (`neutral`, `info`, `success`, `warning`, `danger`) tints
the cell with that family's container color and its high ink, and adds a corner glyph (`-`, `i`, `+`, `?`,
`!`), so the intent never rides color alone. Each cell's accessible name joins mark, intent, row and column,
for example "●, danger, row 1, column 2".

## Updates

A `cells` write patches marks, intents and disabled flags in place: the same cell elements stay and the
roving position survives. A `rows` or `cols` change rebuilds the board. Empty `cells` is the blank board.

## Hardening

- An entry without non-negative integer `row` and `col` is dropped.
- An out-of-set `intent` is dropped, so the cell renders with no intent.
- A cell outside `rows` x `cols` is dropped.
- When two entries share one position, the later entry wins.
