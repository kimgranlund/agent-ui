---
doc-type: ticket
id: tkt-0033
status: doing
date: 2026-07-13
owner:
kind: bug
---
# TKT-0033 — the docs-site API-reference tables are data-shaped, not developer-shaped

## Summary
Kim's report (2026-07-13, screenshot of `ui-text-field`'s **Attributes** table): "these tables are
just kind of sad looking. take a step back re-consider what the intent was here and system-decompose
what the right kind of display is." The API tables (`Attributes`, and the sibling `Properties` /
`Events` / `Slots` / `Parts`) all render from ONE module, `site/lib/doc-page.ts`, as **unstyled
default HTML `<table>`s** — `renderApiTable` / `renderSequenceTable` build `<table><thead><tbody>`
straight from the parsed `{name}.md` descriptor, and the site carries essentially **no table CSS**
(verified: no `table`/`th`/`td` selectors in `_page.css`). The result reads as a raw data grid, not
a reference a developer scans.

## Acceptance
- The API-reference display is re-designed from its INTENT (a developer's scan-and-look-up of a
  component's public surface), not patched cosmetically — and the chosen form is Kim's call (a
  user-facing docs-design fork; candidate forms decomposed in Findings below).
- The redesign applies to the whole family the one module renders — Attributes + Properties + Events
  + Slots + Parts — as ONE coherent reference pattern (they share `doc-page.ts`), not just the
  Attributes table.
- The derive-from-descriptor guarantee is preserved: the display stays read straight from the parsed
  `{name}.md` (the published surface IS the contract — `doc-page.ts`'s load-bearing property), and
  the drift gates that back it stay green. No per-control hand-authoring creeps in.
- Responsive + theme-aware + AA, consistent with the fleet's own token system (it should look like it
  belongs to agent-ui, using `--md-sys-*` roles, not a bespoke one-off).

## Repro
Open any control doc page (e.g. `ui-text-field`) → the **Attributes** section. Default `<table>`
auto-layout: the widest cell (the spelled-out `type` enum — `text · email · url · …`) sets the column
width and pushes `Default`/`Reflect` to the far right, leaving a large dead horizontal gap on the
short rows; empty `Default` cells render a lonely empty chip outline; `Reflect: true/false` occupies a
full headline column disproportionate to its value.

## Expected vs actual
- **Expected:** a scannable API reference — the attribute NAME is the primary axis; type (with its
  enum set), default, and reflection read as supporting detail; no dead space; empty defaults read as
  "—" not an empty box; low-value fields (reflect) demoted.
- **Actual:** a raw four-column default table (`Name · Type · Default · Reflect`) with auto-layout
  dead space, empty-chip cells, and reflect as a headline column.

## Classification
Axis: **visual + structural (wrong display TYPE for the data's job)** — subjective in trigger ("sad
looking") but the root is a real information-design mismatch: reference data rendered as an unstyled
grid. Plane: `site/lib/doc-page.ts` (the single shared renderer — `renderApiTable` /
`renderSequenceTable`) + the site's table CSS (currently absent). Every control doc page consumes it,
so the fix is one place, fleet-wide.

## Severity
**minor** — nothing is functionally broken or wrong (the data is truthful and derived); the cost is a
docs surface that reads as unpolished and scans poorly, on the fleet's primary developer-reference
pages.

## Links
- `site/lib/doc-page.ts` (`renderApiTable` L25-44 · `renderSequenceTable` L82-98 · the Attributes/
  Properties/Events/Slots/Parts family) · the `{name}.md` descriptor parser (`@agent-ui/components/
  descriptor`, the derive-from-source contract) · `site/pages/_page.css` (where table styling would
  land) · the doc-page drift gates (must survive the redesign).
- `docs-author` skill (the site-page authoring standard) · `agent-ui-component-standards` (the token
  roles the redesign should consume).

## Findings

### 2026-07-13 — intent decomposition + candidate display forms (system-decompose)

**What is this display FOR?** A developer reading a control's doc page, doing one of three tasks:
(1) SCAN the set of attributes a control exposes; (2) LOOK UP one attribute's type / default /
allowed values; (3) understand an enum's options. It is **reference data** — scanned and indexed, not
read linearly. The primary axis is the attribute NAME; type/default/enum are the payload; `reflect`
is a rarely-needed footnote.

**Why the current form fails the intent:** it renders the descriptor's FIELDS as table COLUMNS (a
data-dump shape) with browser-default auto-layout — so column widths are set by the longest value
(the enum), not by the reader's scan path; the name (the index key) gets no visual primacy; `reflect`
(a footnote) gets equal headline weight; and empty defaults render as visual noise (empty chips). The
form mirrors the DATA's shape, not the READER's task.

**Candidate display forms (the fork — Kim's call):**
- **A — Proportioned prop table.** Keep tabular, but `table-layout: fixed` with sized columns, the
  name column emphasized, the enum rendered as a wrapped chip-set (not one long string), default as
  "—" when empty, `reflect` demoted to a small dot/badge. Lowest effort; keeps dense scannability;
  still a table (still weak on narrow widths).
- **B — Per-attribute reference rows (definition-list).** Each attribute is a row/block: the NAME
  prominent on the left (fixed rail), and a right column carrying type (enum as chips) + default +
  reflect badge, flowing. No dead gap; degrades cleanly to stacked on narrow; the name is the clear
  index. Medium effort. (Recommended — matches modern component-doc convention: Radix/Storybook
  argsTable rows.)
- **C — API cards.** Each attribute a bordered card (name + type signature + default + reflect +
  room for a per-attribute description if the descriptor grows one). Richest, most padding; best if
  descriptions are coming; heaviest vertically for a 15-attribute control like text-field.
- **D — Grouped rows.** B, plus grouping (core attributes vs type-specific: `currency`/`unit`/`step`
  only apply to numeric types; `format` only to color) with subheads — turns text-field's 15 flat
  attributes into scannable clusters. Highest value for the big controls, most design work.

**Recommendation: B (per-attribute rows) as the base pattern, applied to all five sibling tables,
with D's grouping as a follow-on for the large controls if Kim wants it.** It fixes the dead-gap +
empty-chip + reflect-overweight problems at the root, reads well responsive, keeps the name as the
scan axis, and stays a thin descriptor-derived render (no hand-authoring).

### 2026-07-13 — Kim's ruling: Form B (per-attribute rows)

Kim chose **Form B** (per-attribute rows) — name as the prominent left rail / index, type · default ·
reflect flowing in a right column, enums as chips, empty default = "—", reflect a subtle badge; applied
to all five sibling tables; responsive-stacking; theme-aware + AA on `--md-sys-*` roles. Build:
implement in `doc-page.ts`'s `renderApiTable` + `renderSequenceTable`, with the styling in a DEDICATED
stylesheet doc-page imports (NOT `_page.css` — a concurrent nav wave owns that file). Stays a thin
descriptor-derived render; the doc-page drift gates stay green; independently reviewed before commit.
D's grouping is a deferred follow-on, not this build.
