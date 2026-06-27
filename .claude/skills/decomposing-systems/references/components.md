# Domain: Components

> `decomposing-systems` domain reference. Method depth in `method.md`. · 2026-06-26

Two crossing sub-planes — **COMPOSE** (how parts nest) and **REALIZE** (how a part becomes a real element). Treat COMPOSE as the OUTSIDE-IN axis and REALIZE as the INSIDE-OUT axis.

## OUTSIDE-IN axis — COMPOSE (the tier ladder)

`module → component → primitive`

- **module** — a composed unit (a field = label + control + error; a select = button + listbox).
- **component** — a single self-defining control (`ui-button`, `ui-text-field`).
- **primitive** — an irreducible element/part (a glyph, a box, a text node).
- Within a component: `anatomy → parts → slots → seams` (the overflow/slot boundaries where composition happens).

## INSIDE-OUT axis — REALIZE

`geometry → element → semantics → interaction`

- **geometry** — size/space derived from the dimensional system (height ramp, `(height − glyph)/2`).
- **element** — the host element + its custom-element tag.
- **semantics** — role/ARIA via internals, value/validity, custom states.
- **interaction** — keyboard, press activation, focus, events.

## Stop rule

Stop the tier ladder when a part is **one element with one prop/ARIA contract** (a primitive). Stop REALIZE when an interaction is **one keyboard/pointer behavior with one event**.

## Cross-check (defect quadrant)

- Every interaction must land on a part (an element/slot) → else `UNHOSTED` (a behavior with no element to bind).
- Every leaf part must carry an interaction **or** a `justify` (`structural`, `decorative-token`) → else `UNJUSTIFIED-LEAF`. This is the "clean API hiding an inert build" failure: a part that exists in the anatomy but does nothing.

## Worked pass (`ui-select`, abbreviated)

COMPOSE: `select` (module) → `{trigger-button, listbox, caret}` → `caret` (primitive, leaf).
REALIZE actions: `open`, `close`, `navigate options`, `commit selection`, `light-dismiss`.
Map: `caret` hosts no action → tag `justify:"affordance"` (it signals openability). `light-dismiss` hosts on `listbox` overlay. Re-check → clean.

```json
{
  "domain": "components",
  "nodes": [
    {"id":"trigger","label":"trigger-button"},
    {"id":"listbox","label":"listbox"},
    {"id":"caret","label":"caret","leaf":true,"justify":"affordance"}
  ],
  "actions": [
    {"id":"open","label":"open"},{"id":"nav","label":"navigate options"},
    {"id":"commit","label":"commit selection"},{"id":"dismiss","label":"light-dismiss"}
  ],
  "hosts": [
    {"action":"open","node":"trigger"},{"action":"nav","node":"listbox"},
    {"action":"commit","node":"listbox"},{"action":"dismiss","node":"listbox"}
  ]
}
```
