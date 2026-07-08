# ADR-0100 — Query-container establishment moves off the layout primitives to externally-sized boundaries; card `min-inline-size: 0` retained

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-07
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-07 *(authored)* |
> | **Proposed by** | system-planner — the design seat, from the live visual audit (computed-style proofs, Chromium + WebKit identical) |
> | **Ratified by** | Kim (host) · 2026-07-08 — ratified knowingly on the review's stated trade (reflow granularity coarsens to boundary level); Status flipped by Kim's own edit |
> | **Repairs** | on ratification+build: `controls/_surface/container.css` (DELETE the blanket `container-type` rule + banner rewrite) · `controls/{row,column,list,grid}/*.css` banners + `row.md`/`column.md`/`list.md`/`grid.md` responsiveness sections (they cite the shared establishment seam) · `column.browser.test.ts:122-124` re-key (it encodes the shrink-to-~0 as expected) · site mount surfaces gain establishment: `site/lib/canvas-surface.css` (`.canvas-surface`) · `site/lib/a2ui-gallery.css` (`.seed-surface`) · `site/pages/a2ui-patterns.css` surface + a `host.mount()` grep sweep for any further mounts · the A2UI embedding contract (`a2ui-catalog.spec.md` §5.2 Row/Column responsiveness note) · `card.css:122` comment sharpened (retention rationale — see Decision cl.3) + `card.md` sizing note · the named Acceptance test legs. This change (docs-only): ADR-0016 header reciprocal line · README index row · decomp [`layout-containment-ruling.decomp.json`](../decompositions/layout-containment-ruling.decomp.json) |
> | **Supersedes / Superseded by** | **Partially supersedes ADR-0016** — ONLY clause 4's establishment sub-clause ("each layout primitive establishes a query container (`container-type: inline-size`) — the shared seam") and Amendment A1's "the whole family establishes `container-type`" reading; the `@container` responsiveness contract, the no-breakpoint-props law, the flex grammar (cl.1/2), and A1's ancestor-query mechanics all STAND · **extends ADR-0096** (the `reflow` prop gate and its per-tag defaults ride unchanged on the surviving rules) · relates **ADR-0030** (the column `align:stretch` default that *masked* this collapse; its "card composes under any parent" claim is now measured — see cl.3) · **ADR-0084** (app-shell's own `container-type` is externally sized — untouched, the model case for cl.2's law) |

## Context

A live visual audit (computed-style proofs, Chromium + WebKit identical) found two shipped-page layout
breaks; tracing them lands on **one root cause** in a deliberate, documented decision.

**The observation.** `container.css:127-129` (ADR-0016 cl.4) makes all four layout primitives query
containers: `:where(ui-row, ui-column, ui-list, ui-grid) { container-type: inline-size; }`. But
`container-type: inline-size` applies **inline-axis size containment**: the box's intrinsic inline sizes
are computed **as if it had no contents** (CSS Containment — the same anti-cycle rule that forbids an
element to size-query itself, which ADR-0016 A1 already records). The engine resolves the contradiction
between "be a query container" and "be sized by your content" by deleting the content from sizing.
Measured (probe: `defect-probe.{html,mjs}` + audit `shots/`; both engines agree on the DISPOSITION of
every case — zero-vs-nonzero, equal-vs-equal, direction flips — while text-metric-driven widths differ
sub-case by a few px between Chromium and WebKit, e.g. the actions cluster 136.2 vs 124.7; quoted
numbers below are Chromium's):

- **Direct collapse** — a primitive in any *content-sized position* renders 0px wide: a Row nested on a
  Row's main axis (the `document-row-toolbar` seed: both nested rows **0px**, restored to 115.6px /
  136.2px with containment off — the audit's live toggle measured the same 0 → 251px on the shipped
  page); equally a primitive on the cross axis of a `ui-column[align='start'|'end'|'baseline']`
  (measured 0px → 49.8px). Column-nested primitives survive **only** because ADR-0030 flipped the column
  default to `align: stretch` — external sizing that masks the defect, not absence of it.
- **Non-local corruption** — a contained primitive contributes **0 intrinsic size through every
  content-sized ancestor**. The `pattern-dashboard-tiles` seed's cards crush to ~38px in a wrap row
  (36px in the probe — chrome-only width: borders, region margins and padding, zero content — because the
  contained inner `ui-column` zeroed the card's min-/max-content). This is why **no selector can repair
  the rule in place**: fixing containment at the row-nested positions still leaves the tiles at 36px
  (measured — the harmful containment sits *inside the card*, in a position that is locally safe), so
  there is no enumerable exception set. Safety is a property of the whole ancestor chain, invisible to CSS.

**The forcing constraint:** the primitives' own sizing model is content-driven (`geometry.md`
Container/layout class — shrink-wrap, no frame), and A2UI compositions nest them freely under cards,
rows, and columns; an **intrinsically-sized query container is a CSS impossibility**, so blanket
establishment deterministically corrupts any payload with a primitive in a content-sized chain — a
Gen-UI model can emit that shape any time and (per ADR-0096's consumer analysis) has no CSS verb to
escape it. Separately, ADR-0016 A1's "the A2UI canvas mounts surfaces under a container context" is
today **aspirational**: no site/canvas mount surface establishes `container-type` at all (grep-verified —
only `containers.css` `.reflow-frame` and app-shell do); nested reflow worked only via the primitives'
own harmful establishment.

**Defect B, re-attributed.** The audit flagged `card.css:122`'s unconditional `min-inline-size: 0` as the
tile-crush suspect. Measured: it is **not binding** — with containment live, a `min-inline-size:
min-content` floor renders the identical 36px (min-content itself is gutted); with containment fixed, a
wrap row places tiles at their content size (~176-180px) with or without the floor (line-breaking uses the
hypothetical main size, which the min floor does not raise). What the declaration **does** do, measured:
in a `ui-grid` track a card with unbreakable content held exactly the 200px track with `0`, and **blew out
to 484.2px** with a min-content floor — the "composes under any parent (a grid cell)" behavior ADR-0030
already leans on.

## Decision

One decision — **query-container establishment is re-homed from the layout primitives to
externally-sized composition boundaries** — in three clauses:

1. **The blanket establishment leaves `container.css`.** Delete
   `:where(ui-row, ui-column, ui-list, ui-grid) { container-type: inline-size; }`. A layout primitive is
   **never a size query container by default** — an intrinsically-sized box cannot be one. The
   `@container` reflow rules in `row.css`/`column.css` keep their ADR-0096-gated selectors **unchanged**
   (`:scope:not([reflow='locked'])` / `:scope[reflow='auto']`) and resolve, as they always mechanically
   did (ADR-0016 A1), against the nearest **ancestor** container — now one a boundary establishes.
   `ui-grid`'s auto-fit/`minmax` responsiveness is track sizing, not a query — unaffected.
2. **Establishment belongs to the externally-sized boundary — the law.** `container-type: inline-size`
   may be declared only on a box whose inline size is externally determined (definite, stretched, or
   track-sized — never content-derived). App-shell (ADR-0084) is the shipped model case. At build, the
   known A2UI mount boundaries gain it: `.canvas-surface` (definite `inline-size: min(32rem, …)` —
   canvas-surface.css:36), the gallery's `.seed-surface`, the patterns page surface, plus a
   `host.mount()` sweep for any further mount surface; `.reflow-frame` already complies. The A2UI
   **embedding contract** gains the normative line: an embedder's mount ancestor SHOULD establish
   `container-type: inline-size`; without one, the reflow rules never match and every tag renders its
   cl.2 identity — the graceful degradation, never an axis flip. (This turns ADR-0016 A1's canvas
   precondition from prose into contract.)
3. **`ui-card` keeps `min-inline-size: 0` — the audited Defect B is dispositioned, not patched.** The
   crush the audit attributed to it is clause 1's defect end-to-end (measured equalities above); the
   declaration's documented scenario is real and measured (grid-track fit; scroll-mode shrink), and a
   min-content floor would *introduce* the grid blowout. The `geometry.md` floor law splits by class:
   Action/Entry controls carry floors; the **Container class deliberately keeps the shrink permission**.
   The comment at `card.css:122` is sharpened at build to carry this rationale, and the tile composition
   gains a whole-shape regression leg so the crush class cannot silently return. Residual, named: a
   `reflow="locked"` nowrap row narrower than the sum of its cards' min-contents still crushes them
   (equal-share, below min-content) — accepted because the default row *stacks* below 24rem before that
   window opens, and an author with CSS owns the exotic case.

## Acceptance

Whole-shape doctrine — rendered bounding boxes in realistic compositions, Chromium + WebKit, each leg
with a negative control:

- **Toolbar leg** (the `document-row-toolbar` shape): in a 600px *established* container, both nested
  rows' widths > 0 and ≈ content (engine-loose bounds — text metrics differ per engine: info within
  100–130px, actions within 110–160px at default type; measured Chromium 115.6/136.2, WebKit ~/124.7),
  and the actions cluster's right edge ≈ the toolbar's right edge (`justify="between"` honored).
  **Negative control:** re-adding `container-type: inline-size` to a nested row fails the leg (0px).
- **Tiles leg** (the `pattern-dashboard-tiles` shape): three tile cards in a ~500px established wrap
  row render content-sized (each ≥ 8rem), x-ranges disjoint, single line; in a 320px container the
  default row stacks them full-width one per line.
- **Reflow-preserved legs** (re-keys of ADR-0096's acceptance, wrappers already establish containers):
  default `ui-row` computes `column` + stacked child positions in a 300px established container;
  `ui-row[reflow='locked']` stays `row`; `ui-column[reflow='auto']` computes `row` in a 600px container;
  default `ui-column` stays `column`. The axis-flip bug cannot resurrect: the 0096 gated selectors are
  untouched and their negative controls stand.
- **Non-locality leg**: a card (card-content › column › text) in a wrap row renders at ≈ its standalone
  content width. **Negative control:** `container-type: inline-size` on the inner column collapses the
  card to chrome-only width (~36px).
- **Grid-guard leg** (pins cl.3): a card with a long unbreakable string inside `ui-grid` renders at
  exactly the track width — no blowout. **Negative control:** `min-inline-size: min-content` on the card
  blows the track (~484px at the probe geometry).
- **CSS tripwire**: a text probe asserts `container.css` declares NO `container-type` on the four
  primitives (the `column-css.test.ts` guarded-selector pattern).
- **Site sweep**: every `host.mount()` surface establishes a container (grep-driven checklist);
  gallery + patterns re-shots show the toolbar clusters and content-sized tiles; the corpus
  exemplars/seeds re-render as authored.
- `npm run check && npm test` green.

## Consequences

- **Intrinsic sizing is restored fleet-wide** — shrink-wrap, `justify` distribution, wrap-at-content,
  and min-content floors all become real again in nested compositions (measured: toolbar 115.6/136.2px
  with `between` honored; tiles 176–180.5px on one line at 600px, stacked full-width at 320px).
- **Reflow granularity coarsens — accepted, and priced.** A primitive now reflows on the nearest
  *boundary* width, not the nearest primitive's. Mid-tree stacking driven by a narrow primitive ancestor
  is gone: a row inside a ~15rem grid cell on a wide canvas no longer stacks (measured: shipped stacks at
  300px cell; post-change renders `row`) and can overflow a cramped cell. Accepted because the old
  granularity only ever worked when no content-sized ancestor was being corrupted — it was priced in 0px
  collapses. If cell-local reflow proves needed, the named extension is an explicit, catalog-reachable
  "externally sized" opt-in prop — deliberately NOT decided here.
- **Until the site build lands, canvases have no container context** — top-level rows on the A2UI
  surfaces won't stack on narrow (they render identity — graceful). The build wave adds the boundary
  establishment in the same change that deletes the blanket rule; ship them together.
- **ADR-0016's story is corrected, not weakened:** cl.4's responsiveness contract survives verbatim; only
  *who establishes* moves. A1's "top-level primitive needs a container-context parent" was always the
  mechanics — clause 2 makes it the norm and makes the canvas claim true (it is false today,
  grep-verified).
- **`column.browser.test.ts:122-124`** (which documents shrink-to-~0 as expected) re-keys to assert real
  shrink-wrap; ADR-0080 size marginals re-measure (a deleted rule — bytes drop).
- **Honest cost, cl.3:** keeping `min-inline-size: 0` keeps the exotic crush window (locked nowrap row
  below n×min-content) — named above with its trigger and escape; watched by the tiles leg, not fixed.
- **Stale → re-verify** on ratification: `row.md`/`column.md`/`list.md`/`grid.md` responsiveness
  sections, `a2ui-catalog.spec.md` §5.2 note, `card.md` sizing note, the container.css/row.css/column.css
  banners, ADR-0016 header (reciprocal line lands with this change).

## Alternatives considered

- **Position-conditional containment** (`:where(ui-row) > primitive { container-type: normal }` + the
  non-stretch column legs) — rejected on measurement: the tile cards stay 36px (the harmful containment
  is inside the card, locally safe) — harm is non-local, so the exception set is unbounded; a partial fix
  would ship the same class of silent collapse one nesting level deeper.
- **A targeted counter-rule `flex: 1 1 auto` on nested primitives** (the dispatch's candidate; measured
  373px on the live page) — rejected: containment zeroes *all* intrinsic sizing, so no flex basis can
  restore shrink-wrap — grow-fill only papers it: measured 300/300 equal split with the actions cluster
  starting mid-toolbar, defeating `justify="between"`; and it covers primitives only, never the crushed
  cards.
- **Gate establishment on the `reflow` prop** — rejected as a category error: a query container serves
  its *children's* queries (A1), not its own rule, so an attribute on the element cannot express whether
  its children need it; and a `reflow="locked"` row's children may still legitimately query.
- **`contain-intrinsic-inline-size` placeholder sizes** — rejected: it substitutes a fixed guess for
  content-driven sizing; wrong by construction for shrink-wrap primitives.
- **A card min-content floor (the dispatch's Defect-B lean, the text-field-precedent reading)** —
  rejected on measurement: no effect on the audited crush (identical 36px under containment), no effect
  in wrap rows once the root cause is fixed (identical 176–180.5px), and it *introduces* grid-track
  blowout (484.2px vs the 200px track). The control-class floor law does not extend to the Container
  class.
- **Keep establishment on grid-item primitives only** (preserve cell-local stacking, since grid items
  are track-stretched) — rejected: it keeps the non-local landmine (a grid inside a wrap-row tile
  re-guts the tile's intrinsic size) — trading a clean safety law for an edge granularity.

## Erratum (2026-07-08 — post-build review; append-only, per the ADR log's own rule)

The Acceptance sweep line above ("every `host.mount()` surface establishes a container") is corrected
to **"every EXTERNALLY-SIZED `host.mount()` surface establishes a container"** — the build's mount
sweep correctly found one surface that must NOT establish: **`.ask-surface`** (`site/pages/a2ui-live.css`,
the ADR-0097 feed-ask bubbles). Its ancestor bubble is `align-self: flex-start` + `max-inline-size: 92%`
— a content-derived box — so establishing there would compute its inline size as-if-empty and crush the
bubble one level up: the exact clause-1 anti-pattern. `.ask-surface` is hereby the worked example of
clause 2's "content-derived boxes never qualify"; the reviewer verified the exclusion against the real
CSS and ruled it correct. A future maintainer "completing the sweep" must not establish there.
