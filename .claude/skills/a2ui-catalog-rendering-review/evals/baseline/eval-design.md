## The frame

Each catalog example is a **pair**: a payload/catalog-entry on the props side, and real `ui-*` DOM on the rendered side. Each side can pass alone while the pair lies — a payload that validates but paints nothing, a beautiful render driven by a prop the catalog never declares. So the design is three checklists: props, rendered, and the **join** between them (where the highest-value findings live).

## 1. Inventory first — before any judgment

Enumerate catalog rows from the catalog source (the source of truth), enumerate the examples actually on the page, and diff:

- **Rows with no example** — coverage hole, found mechanically, argues with nobody.
- **Examples for no row** — orphan/stale.
- **Rows with exactly one example** — flag; one specimen can't show a variant axis.

This is finding #1 and it costs nothing. Everything subjective comes after.

## 2. Props side (static — no browser)

| Check | Failure it catches |
|---|---|
| **Validator-clean** | unknown props, missing required, wrong types |
| **Prop coverage** | declared props × exercised-in-example matrix; a declared prop no example sets is undiscoverable to an agent |
| **No undeclared props** | example teaches a shape the catalog doesn't promise |
| **Idiomatic tree** | adjacency-list w/ id references, `ChildList` templates for repeats — not hand-unrolled children |
| **Binding realism** | ≥1 example per type binds to the data model, not only literals; two-way inputs write to a real path |
| **Action wiring** | action names an agent would plausibly emit; `checks` clauses valid |
| **Representative specimen** | the standing law: a `ui-grid` with one cell, an empty container, "Sample content", a Select with 2 options — all teach nothing. Real content, realistic quantity |
| **Semantic honesty** | the type used for its actual job, not as a spacer/wrapper of convenience |
| **Determinism** | no stale dates, dead asset URLs, locale-fragile strings — same render on a cold load next month |
| **Cross-row consistency** | same data-model naming/idioms page-wide, so the page reads as one grammar an agent can learn |

## 3. Rendered side (live, at :5174 — pixel-truth, not source-inference)

- **Rendered at all** — non-empty subtree, zero console errors, no unknown-type fallback placeholder.
- **Correct element** — resolved to the intended `ui-*` tag, props landed as signals; not a bare `div` fallback that happens to look plausible.
- **Whole-shape gestalt** — assert the bounding box, not per-part: no zero-height, no clipped text, no overflow past the container, no collapsed cell.
- **Token fidelity** — colors/type/spacing from `--md-sys-color-*` / typescale / dimensions; nothing hardcoded; **both schemes**, contrast checked. Light-only checking is the classic miss.
- **Breakpoints** — fleet default 414×896 *and* wide; specifically probe the ADR-0150 compact line (below 52.5rem/840px). A row that only works wide is a defect.
- **Interactivity proves the binding** — click the button, watch the action fire and the data model change; type in the field, watch write-back. A static screenshot cannot distinguish a live binding from a baked literal.
- **Reactivity** — a data-model poke repaints only the bound node; no whole-surface reflow.
- **A11y** — role/name via `ElementInternals` (never host attrs), focus visible, tab order, name computed from real content.
- **Cross-row rendering consistency** — the same control at the same size looks identical in every example; catalog-grid alignment holds.

## 4. The join — where the real defects hide

1. **Every prop set → an observable effect.** A prop that changes nothing visible is a dead prop, a renderer bug, or a bad example. Test by toggling it.
2. **Every prop omitted → a sensible default render.**
3. **Declared-but-never-visible** props (catalog promises what the renderer ignores).
4. **Rendered-but-undeclared** behavior (renderer does more than the catalog advertises — invisible to a producing agent).
5. **Prose vs. pixels** — the label/description beside the example matches what the example actually demonstrates.

## 5. Method, so it's repeatable rather than a vibe pass

- **Two independent passes, generator ≠ critic**: a static pass over payloads/catalog with no browser, and a live pass in a real browser. Join by row id afterward.
- **Fixed rubric with a gate-to-promote** — per-dimension 0–3, any dimension at 0 fails the row regardless of total. Comparable across rows and across sweeps. Natural home: `.claude/docs/rubrics/a2ui-catalog-example.md` (already in your tree).
- **Severity classes**: 🔴 blocker (doesn't render / validator error / wrong element) · 🟡 major (unrepresentative specimen, dead prop, coverage hole, a11y break) · minor (polish).
- **Output = one row × dimension table**, every finding with `file:line` and a screenshot for anything visual. That table is the durable baseline — the next sweep is a diff, not a re-derivation.

## 6. Threats to the evaluation itself

- Evaluating a **stale dev server** — a cached build makes you grade last week's page.
- Attributing the **page harness's** own bugs to the example.
- Grading the payload source when the page ships a different, transformed copy.

If you want, I can turn this into the rubric file with the scoring bands filled in, or run the inventory-diff pass first so we know the coverage holes before spending judgment on the subjective dimensions.
