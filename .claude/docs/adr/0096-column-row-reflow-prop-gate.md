# ADR-0096 — The `reflow` prop gate: catalog-reachable container-reflow control for `ui-row`/`ui-column`, column default flips to locked

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-07
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-07 *(authored)* |
> | **Proposed by** | system-planner — the design seat, from Kim's reproduced live Gen-UI card-game layout break (screenshot-verified, source-traced) |
> | **Ratified by** | *(pending — orchestration-coordinator / Kim, on gate; doc-reviewer pass first)* |
> | **Repairs** | on ratification+build: `controls/column/{column.ts,column.css,column.md}` + `controls/row/{row.ts,row.css,row.md}` (the prop + the guarded `@container` rules + descriptor rows) · `catalog.json` `Row`/`Column` rows + a2ui-catalog SPEC §5.2 (`a2ui-catalog.spec.md`) · `site/pages/layout-permutations.ts` prose (lines 97/104 — column no longer switches by default) · test re-keys named in §Consequences. This change (docs-only): ADR-0016 `Extended by` back-link · README index row · decomp [`column-row-reflow-lock.decomp.json`](../decompositions/column-row-reflow-lock.decomp.json) |
> | **Supersedes / Superseded by** | **Extends ADR-0016** (clauses 1/2/4 all stand — the flex grammar, direction-as-tag-identity, and container-query responsiveness survive; this gates *when the identity may adapt* behind a prop and re-bases one default on evidence 0016 never had) · relates ADR-0030 (per-consumer default precedent) · ADR-0075 (element-local prop, not `flexProps`) · ADR-0076 (enum honoring makes the new enum load-bearing) · ADR-0071 (derived inventory advertises it) · ADR-0091 (the idiom-teaching lane) |

## Context

Kim generated a card game through the live Gen-UI pipeline and the layout broke severely: what the model
composed as a vertically stacked `Column` of card sections rendered as a squeezed horizontal row — text
clipped mid-word, buttons overlapping. Traced to source, not guessed:

- `column.css:130-134` implements ADR-0016 clause 4 as an **unconditional switcher**: once a `ui-column`'s
  nearest ancestor query container is ≥ 30rem (480px) wide, `@container (min-width: 30rem) { :scope {
  flex-direction: row } }` flips the column to a row. `row.css:124-128` is the mirror: under 24rem (384px)
  a `ui-row` stacks to a column. Neither is prop-controlled — the flip is baked into each element's
  `@scope` block with no attribute to override it.
- ADR-0016 considered and rejected a layout-mode prop (§Alternatives: "a bespoke layout grammar… rejected");
  its stated escape hatch is **plain CSS on the element** (the `ui-grid` `columns` alternative names the
  same pattern: "an explicit track override stays available as plain CSS on the element, the escape hatch").
- **The forcing constraint 0016 never saw:** the catalog's primary consumer class has no CSS-authoring verb
  at all. A live model composes an A2UI payload as a validated, prop-only node tree
  (`catalog.json` → `factories.ts` → `renderer.ts` builds real DOM from props); its entire vocabulary is the
  catalog's component types and props (`system-prompt.ts` derives the inventory from `catalog.json` per
  ADR-0071, and ADR-0076 drops any value outside a declared enum). "Write a higher-specificity CSS rule" is
  a verb this consumer structurally does not have. So on any real canvas ≥ 480px wide, an agent-emitted
  `Column` silently and unpreventably renders as a row — the model cannot lock it, and a human reading only
  the catalog's prop vocabulary cannot either.
- The two legs are **not symmetric**. `ui-column`'s wide→row flip fires in the *common* case (real screens
  are ≥ 480px; the four layout primitives all establish `container-type: inline-size` per `container.css:128`,
  so nearly every nested Column queries a wide ancestor) and it *contradicts the tag's own identity* —
  ADR-0016 clause 2 says "direction is the element's identity (the tag names it)", yet the render says row
  where the tag says column. `ui-row`'s narrow→column flip fires only in the *cramped edge* case (< 384px)
  and is protective — content stacks instead of clipping, the classic graceful degradation the switcher
  idiom exists for.
- The blast is already live beyond the reproduced bug: **8 of the 11 shipped corpus exemplars emit
  `Column`** (`corpus/exemplar/v1_0/agent-ui.jsonl` — team directory, settings, wizard, dashboard, confirm
  dialog…); on a wide canvas each of their Columns whose nearest ancestor container is ≥ 480px renders
  axis-flipped, i.e. not as authored or judged.

## Decision

We make the container-query direction switch **prop-gated** on `ui-row`/`ui-column` with **per-tag
defaults**, so the reflow contract is reachable from the catalog alone. Five clauses:

1. **A new reflected enum prop `reflow: 'auto' | 'locked'`** on `ui-row` and `ui-column` (element-local on
   each, deliberately NOT folded into the shared `flexProps` — the ADR-0075 `stretch` precedent; `ui-list`
   has no `@container` rule and `ui-grid`'s auto-fit IS its responsiveness, so both are untouched).
   `auto` = today's ADR-0016 cl.4 container-query switching; `locked` = `flex-direction` pinned to the tag's
   cl.2 identity regardless of container width. Direction itself stays the tag — `reflow` gates *whether the
   identity may adapt*, never *what it is*.
2. **Per-tag defaults; the column default flips to `locked`.** `ui-row` defaults `auto` (its narrow→stack
   leg is protective and stays the shipped behavior); `ui-column` defaults **`locked`** (its wide→row leg is
   the reproduced defect). Each tag orders its enum default-first so `values[0]` is both the default and the
   invalid-value snap target (the `column.ts` `align` precedent): row `['auto','locked']`, column
   `['locked','auto']`. Per-tag defaults over one shared prop name are established doctrine (ADR-0030's
   `align` start/stretch split, which ADR-0016's own header records as "a per-consumer default; the grammar
   stands").
3. **CSS mechanism = one selector edit per sheet, attribute-guarded.** `column.css`: the `@container
   (min-width: 30rem)` rule's inner selector becomes `:scope[reflow='auto']` — since a default is never
   reflected as an attribute (ADR-0005), an unadorned column can never match: locked by construction.
   `row.css`: `@container (inline-size < 24rem)` inner selector becomes `:scope:not([reflow='locked'])` —
   absent/default keeps stacking; the explicit attribute pins. No new rule, no JS, no new token.
4. **Catalog reachability.** `catalog.json`'s `Row`/`Column` rows gain the `reflow` property (enum, per-tag
   member order); `rowFactory`/`columnFactory` are plain `accessorFactory` pass-throughs
   (`factories.ts:168-169`), so a reflecting accessor prop flows 1:1 with zero factory change; the ADR-0071
   derived inventory advertises it automatically (drift-gated by `prompt-drift.test.ts`); ADR-0076's
   enum-honoring validates its values at widget resolution. The model can now emit
   `{"component":"Row","reflow":"locked",…}`.
5. **Idiom teaching is optional because the default is safe.** With clause 2, a model that never sets
   `reflow` composes correct layouts — correctness does not depend on prompt uptake. One ADR-0091 mini-skill
   module ("pin a toolbar `Row` with `reflow:'locked'`; let a stats `Column` spread wide with
   `reflow:'auto'`") is recommended at build time for the *advanced* idiom, within the existing cap — a
   quality refinement, not a safety dependency. No corpus record changes: the shipped exemplars' intent was
   stacked layout, and the new default renders them as authored.

## Acceptance

- Cross-engine browser legs: in a 600px query-container wrapper, a default `ui-column` computes
  `flex-direction: column` (the regression the card game hit); `ui-column[reflow='auto']` computes `row`;
  in a 300px wrapper `ui-row[reflow='locked']` computes `row` while a default `ui-row` computes `column`
  (the preserved leg). Child-position assertions, not computed-only (the anti-vacuous rule).
- `column-css.test.ts` / `row-css.test.ts` re-keyed to the guarded selectors, each with a negative control
  (an unguarded `@container` direction rule FAILS).
- `prompt-drift.test.ts` green with the new catalog rows; a live-loop probe of the ADR-0071 prompt lists
  `reflow` under both `Row` and `Column`.
- Rendering the shipped dashboard/settings exemplars on a wide canvas shows stacked Columns.
- `npm run check && npm test` green.

## Consequences

- **A breaking behavior change to a shipped default, accepted deliberately.** Any consumer relying on the
  implicit column→row spread must now opt in with `reflow="auto"`. Blast radius — corrected: THREE static
  `ui-column` construction sites exist, not one. (1) `column-doc.ts:20` — a three-item specimen inside its
  wide demo frame (`containers.css:69` makes the frame a query container); renders *flipped* today, so the
  new default *repairs* it. (2) `layout-permutations.ts`'s "four primitives" figure (`:46-51`) constructs a
  `ui-column` inside a `.demo-grid` cell (`containers.css:62-66`, `auto-fill, minmax(15rem, 1fr)`) — whether
  that cell is currently ≥30rem (flipped, repaired by this change) or <30rem (already correct, a no-op here)
  is VIEWPORT-DEPENDENT and was not measured for this record; the build wave's browser leg must render it at
  a representative width and confirm which case holds before claiming "repairs" for this site specifically.
  Its prose (`:41` — "ui-column and ui-list stack them vertically") already promises the post-fix behavior
  either way. Separately, `layout-permutations.ts`'s prose at `:104` ("the same @container intrinsic
  responsiveness ui-column and ui-list share") must be corrected in the same change (column = opt-in now;
  list never had the rule) regardless of which figure it describes. (3) `component-preview.ts`'s playground
  lists `ui-column` in `STRUCTURAL` (`:494`) and seeds 3 sample items (`:304`) — a dynamically-constructed,
  user-resizable canvas, so its rendered direction is inherently viewport/panel-width-dependent and not a
  fixed repair-or-no-op case; the build wave should confirm the playground's default panel width doesn't
  strand a user on an already-flipped column with no visible way to discover `reflow`. `layout-permutations.ts`'s
  live reflow demo (`:108`) uses `ui-row` and is unchanged. Footer rows in card/modal/popover/tooltip demos
  ride the unchanged row default.
- **Residual risk, row side, accepted.** `ui-row` keeps `reflow="auto"` by default, so a model that needs a
  row to STAY horizontal even in a cramped (<24rem) container must still remember to set
  `reflow="locked"` — the same probabilistic model-uptake this ADR rejects as insufficient for column.
  Accepted here because the two legs fail in opposite directions: column's auto-default fails
  *destructively* in the *common* case (≥30rem is nearly every real canvas; text clips, elements overlap —
  the reproduced harm), while row's auto-default fails *gracefully* in the *edge* case (<24rem; a cramped
  toolbar stacks but stays fully readable — no clip, no overlap) and narrow containers are the exception,
  not the common case. Locking column by default eliminates the deterministic common-case corruption this
  ADR exists to fix; row's softer, edge-case-only failure mode does not carry the same urgency, so it is
  left opt-in rather than paying the same default-flip cost for a lower-severity, rarer failure.
- **ADR-0016's ambient-responsiveness story narrows for column.** "Reflows wherever it is dropped" now
  holds unconditionally only for `ui-row`; a column spreads only when asked. This is the cost of serving a
  consumer class that cannot consent to the flip — and it *restores* cl.2's identity claim at render time.
- **Named test/doc re-keys** (build wave): `column.browser.test.ts` (locked default + opt-in legs),
  `column-css.test.ts:85-88` + `row-css.test.ts` (guarded selectors + negative controls),
  `column-descriptor.test.ts`/`row-descriptor.test.ts` + `column.md:116`/`row.md:122-124` (the switcher
  paragraphs become the `reflow` contract), catalog `index.test.ts`/conformance + `prompt-drift.test.ts`
  rows, a2ui-catalog SPEC §5.2 Row/Column rows. ADR-0080 marginals re-measure (a few bytes; no re-base
  expected).
- **The fleet gains a second per-tag-default shared-name prop** (after ADR-0030's `align`) — a small,
  precedented cognitive cost; the descriptor tables carry each tag's own default.
- **Out of scope, unchanged:** `ui-list`/`ui-grid` (no switcher to gate), the app-shell narrow reflow
  (ADR-0084's `collapse` is an independent mechanism), the `@container` *mechanism* and the no-breakpoint-props
  law (both stand), the corpus records, the renderer, the wire protocol.
- **Flagged, not repaired here:** ADR-0016's `Status` cell still reads `proposed` in the file and the index
  despite its shipped, ratified G9 build wave — a ratifier-side bookkeeping follow-up; this ADR does not
  touch another record's status.
- **Stale → re-verify** on ratification: `column.md`/`row.md` responsiveness sections, `a2ui-catalog.spec.md`
  §5.2, `layout-permutations.ts` prose, the ADR-0091 registry if the mini-skill module lands.

## Alternatives considered

- **Opt-in lock prop, both defaults unchanged (the minimal extension).** Rejected: it fixes nothing by
  default. Safety would hinge on the model *reliably setting* a prop — and this repo's own Gen-UI record
  (ADR-0091's premise) is that schema availability ≠ reliable reach; idiom uptake needs prompt/corpus
  reinforcement and is probabilistic even then. The 8 shipped Column exemplars would stay corrupted on wide
  canvases until every one was re-authored. A deterministic, unconsented defect deserves a deterministic
  fix, not a probabilistic mitigation.
- **Flip BOTH defaults to locked (fully opt-in switcher, symmetric).** Rejected: `ui-row`'s narrow→stack leg
  is protective, fires only when cramped, and is currently load-bearing — the `layout-permutations` live
  demo exercises it and footer button rows degrade gracefully in narrow containers. Locking it by default
  trades working graceful degradation for a symmetry no consumer asked for; the reproduced harm is entirely
  the column leg.
- **Keep CSS as the only escape hatch and teach the model around the flip (prompt/corpus only).** Rejected:
  structurally impossible — the renderer builds DOM from validated prop-only node trees; there is no CSS
  verb for prompt guidance to reach. You cannot teach a consumer to use a mechanism its grammar cannot
  express.
- **Host-side patch (the canvas overrides the flip, the `applyRootStretch` pattern at `a2ui-live.ts:231`).**
  Rejected: repairs one embedder, not the contract — every A2UI host would need the same private CSS patch,
  and the catalog would still describe a `Column` that isn't one on wide screens.
- **A `direction` prop.** Rejected: reintroduces exactly the mode grammar ADR-0016 cl.2 rejected — direction
  stays the tag's identity; `reflow` gates adaptation, never identity.
- **Fold `reflow` into the shared `flexProps`.** Rejected: `ui-list` carries no `@container` direction rule
  and `ui-grid`'s auto-fit is its own responsiveness — a grammar-wide prop would dangle on two of four
  consumers (the ADR-0075 element-local precedent).
- **A boolean prop (`fixed`/`lock`/`static`).** Rejected: presence-booleans cannot express the per-tag
  default asymmetry (row needs switching default-ON but lockable; column needs it default-OFF but
  enable-able) without two inverted names; one enum with per-tag default-first ordering expresses both, and
  ADR-0076's enum honoring gates its values at the renderer. (`static`/`fixed` also collide with CSS
  positioning vocabulary; `switch` collides with the catalog's `Switch` component type.)
