# ADR-0016 — A2UI-faithful flex layout (Row/Column/List/Grid) + container-query intrinsic responsiveness

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-06-28
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-06-28 *(authored)* |
> | **Proposed by** | planning-lead — the design seat, ratified G9 container-family session |
> | **Ratified by** | orchestration-lead (on gate) |
> | **Repairs** | `goals §G9` (NEW — the layout-primitive DoD) · `a2ui-catalog SPEC §5.2` (`Row`/`Column` `experimental → shipped`) · `references/geometry.md` (the *Container/layout* size-class — the flex layout law) · **NEW** `controls/{row,column,list,grid}/*` · the shared `flexProps` (decomp `s2`) |
> | **Supersedes / Superseded by** | Relates: **ADR-0015** (the `--ui-space` gap ladder these consume) · the `formProps`-spread precedent (ADR-0013 — `flexProps` is the same spreadable-base pattern) · **Extended by ADR-0030** (ui-column/ui-list override the `flexProps.align` *default* to `stretch` — a per-consumer default; the grammar stands) · **Extended by ADR-0096** (the cl.4 direction switch becomes prop-gated `reflow` with per-tag defaults — column flips to locked; cl.1/2/4 stand) · **Superseded by: ADR-0087** (list/grid exclusion, Fork A — Kim resolved INCLUDE 2026-07-06) — ONLY this ADR's clause 3 parenthetical + its §5.2 "List/Grid are non-catalog primitives" note flip to catalog-shipped `List`/`Grid` types; the Row/Column faithful-flex decision (clauses 1/2/4, the shared `flexProps`, container-query responsiveness) STANDS untouched · **Superseded by ADR-0100** (partial) — ONLY cl.4's establishment sub-clause ("each layout primitive establishes a query container … the shared seam") + Amendment A1's "the whole family establishes `container-type`" reading: inline-size containment zeroes a primitive's intrinsic sizing (measured 0px Row-in-Row collapse + non-local card-tile crush), so establishment re-homes to externally-sized boundaries (the canvas/mount surfaces, app-shell, author frames); the `@container` responsiveness contract, no-breakpoint-props law, and cl.1/2 grammar STAND |

## Context

The ratified G9 session lands A2UI's layout primitives. A2UI's catalog (`a2ui-catalog SPEC §5.2`) reserves
`Row` / `Column` as `experimental` until layout primitives ship; this milestone ships them as `ui-row` / `ui-column`
(direct binding, SPEC-R8), plus two non-catalog layout `ui-*` primitives the family needs — `ui-list` (a semantic
vertical stack) and `ui-grid` (a track grid). All four are **structural** containers: they extend `UIElement`
(via the `UIContainerElement` surface base, ADR-0015), are **not** form-associated (no `ElementInternals`
value/validity), and have **no control height** (`geometry.md`'s `Container/layout` class — spacing off `--ui-space`,
ADR-0015, never `--ui-height-*`).

Two design forces:

- **A2UI describes layout with flexbox vocabulary** — alignment, distribution, gap, wrap, direction. A faithful
  catalog reflects that directly (SPEC-R8: *reflect the design system, do not adapt a generic catalog*), so the
  `ui-*` props map 1:1 onto CSS flex properties rather than inventing a parallel grammar.
- **Responsiveness with no breakpoint props.** An agent-emitted surface has no app-level media-query context, and
  A2UI primitives must reflow wherever they are dropped. A viewport breakpoint prop (`sm`/`md`/`lg`) would bind a
  primitive to a page it cannot see; the modern primitive reflows on its **own** rendered width.

## Decision

We make `ui-row` / `ui-column` / `ui-list` / `ui-grid` **A2UI-faithful flex/grid primitives** with
**container-query intrinsic responsiveness**. Four clauses, each a buildable acceptance (decomp `s3`–`s6`, with the
shared prop set in `s2`):

1. **`flexProps` — the shared, spreadable layout prop set.** A spreadable `static flexProps` (the ADR-0013
   `formProps` pattern — no static-props prototype merge) the four primitives fold into their own `static props`,
   so the layout grammar lives in **one** place. Each prop is a reflected literal-union mapping 1:1 onto a CSS
   flex property:
   - **`align`** (cross-axis) → `align-items`: `start | center | end | stretch | baseline`
   - **`justify`** (main-axis distribution) → `justify-content`: `start | center | end | between | around | evenly`
   - **`gap`** → `gap: var(--ui-space-{step})` (the ADR-0015 density-responsive ladder, never a control dimension)
   - **`wrap`** → `flex-wrap`: `nowrap | wrap` (boolean-presence form acceptable)

   The literal-union → CSS-keyword mapping lives in the `:where()` / `@scope` CSS (a role-pure repoint, never an
   inline style); a `@ts-expect-error` proves a bare string is rejected.
2. **`ui-row` / `ui-column` — `display: flex` with a fixed main axis.** `ui-row` → `flex-direction: row`,
   `ui-column` → `flex-direction: column`; both consume `flexProps`. Direction is the element's identity (the tag
   names it), not a prop — so an agent picks a row vs. a column by component type, A2UI-faithfully.
3. **`ui-list` / `ui-grid` — the two layout extensions.** `ui-list` is a `ui-column` specialization carrying list
   **semantics** (`role=list` via `ElementInternals`; children are list items) — a stack with meaning, not just a
   flex column. `ui-grid` is `display: grid` with an intrinsic, **auto-fit/`minmax`** track model
   (`grid-template-columns: repeat(auto-fit, minmax(var(--ui-grid-min), 1fr))`) consuming `gap` from `flexProps`;
   it reflows by available width with **no** explicit column-count prop (responsiveness clause 4). *(List/Grid are
   not A2UI catalog types — they ship as `ui-*` primitives usable directly; only Row/Column flip to shipped in
   §5.2. Flagged, not re-opened.)*
4. **Container-query intrinsic responsiveness (no breakpoint props).** Each layout primitive establishes a query
   container (`container-type: inline-size`) — the shared seam lives in the `UIContainerElement` base CSS
   (`s2`) — and reflows on its **own** rendered width via `@container` rules (e.g. a `ui-row` that wraps to a
   column under a narrow container). There are **no** viewport/breakpoint props; the primitive is self-describing
   and composes anywhere. The `@container` rules are per-primitive (in each element's `@scope` block); the
   `container-type` establishment is shared.

## Consequences

- **Realized by** decomp `s2` (the shared `flexProps` + the `container-type` seam in `container.css`) and `s3`–`s6`
  (the four element folders — `{name}.{ts,css,md}` + probes). The A2UI catalog entries for `Row`/`Column`
  (`s11`) bind these tags directly; List/Grid are non-catalog primitives.
- **One layout grammar, four consumers.** Putting `align`/`justify`/`gap`/`wrap` in a shared spreadable set means a
  later layout primitive (e.g. `ui-stack`) inherits the same vocabulary with no drift — the same DRY win
  `formProps` bought the form family.
- **No control geometry leaks in.** These primitives never read `--ui-height-*`; spacing is `--ui-space` ×
  `[density]` only (ADR-0015). The geometry smoke for them asserts *spacing* responds to `[density]`, not a frame.
- **Responsiveness is provably context-free.** Because there are no breakpoint props, the cross-engine smoke asserts
  a `ui-row` reflows by **container** width (resize the wrapper, not the viewport) — the intrinsic-responsiveness
  proof. `@container inline-size` is broadly supported in the target engines (Chromium/WebKit); no JS
  `ResizeObserver` fallback is in scope.
- **Stale → re-verify:** `a2ui-catalog SPEC §5.2` flips `Row`/`Column` to shipped (`s11`); `geometry.md`'s
  `Container/layout` row gains the flex law. Nothing shipped depends on these primitives (net-new).

## Alternatives considered

- **Breakpoint props (`cols-sm`/`cols-lg`, a `responsive` matrix)** — rejected: an agent-emitted primitive has no
  viewport context to key a breakpoint to, and it couples the primitive to a page it cannot see. Container queries
  make the primitive intrinsically responsive — the modern, context-free answer.
- **A bespoke layout grammar** (named layout modes, e.g. `layout="cluster|sidebar|switcher"`) — rejected: it is an
  *adapter* over flexbox, violating SPEC-R8 (reflect the design system directly). A2UI speaks flex vocabulary;
  the props map 1:1.
- **`ui-grid` with an explicit `columns` integer prop** — rejected as the default: a fixed column count is not
  responsive and re-introduces the breakpoint problem. `auto-fit`/`minmax` reflows intrinsically; an explicit
  track override stays available as plain CSS on the element, the escape hatch, not the default contract.
- **Per-element duplicated layout props** (no shared `flexProps`) — rejected: four copies of `align`/`justify`/
  `gap`/`wrap` drift; the `formProps` precedent (ADR-0013) proved the spreadable-base pattern keeps a fleet prop
  set single-homed.

## Amendments

> Append-only. The clauses above are unchanged; these entries refine wording the build surfaced.

### A1 — container-query responsiveness is **ancestor-context**, not self-width (finding #90, decomp `s12`)

The Context and Decision (clauses 4) phrase the responsiveness as a primitive reflowing on its **"own"**
rendered width. That is loose: per the CSS Containment spec an element that declares `container-type:
inline-size` becomes a query container for its **descendants**, and an `@container` rule resolves against the
**nearest ancestor** query container — an element cannot size-query *itself* (the spec forbids it to avoid a
layout↔style loop). The precise statement of the contract:

- A layout primitive's `@container` rule reflows it on the width of its **nearest ancestor container**. Because
  the whole family establishes `container-type: inline-size` (the shared `UIContainerElement` seam, clause 4),
  a **nested** primitive's nearest ancestor container is its **parent container** — so dropping a `ui-row`
  inside any family container makes it reflow on that parent's width, intrinsically and context-free. This is
  what the cross-engine smoke already exercises: it resizes the **wrapper** (the ancestor container), not the
  viewport, and asserts the child reflows.
- A **top-level** primitive with **no container ancestor** has no container context to query, so its
  `@container` rule never matches and it does not reflow on its own. To be responsive it needs a
  **container-context parent** — a family container (or the renderer mount / page) that establishes
  `container-type` above it. The A2UI canvas mounts surfaces under a container context, so an agent-emitted
  root primitive is covered; a primitive used standalone on a host page should be wrapped in (or given) a
  container-context parent. No clause changes — this records the precondition the wording implied.
