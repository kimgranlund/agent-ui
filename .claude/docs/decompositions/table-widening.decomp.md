# Decomposition — the ADR-0163 `ui-table` widening build (dispatchable slices + test plan)

> Status: proposed · v0.1 · 2026-07-28 · Contract: ADR-0163 + the SPEC/LLD amendment sheets (this folder). Build starts only from the RATIFIED ADR text. One writer per file per slice; every slice ends `npm run check && npm test` green (exit codes, never grep), browser shards where named.

## S-DOCS — apply the amendment sheets (serial, FIRST post-ratification; one writer)

- Files: `.claude/docs/spec/report-family.spec.md` (v0.1 → v0.2 + dated changelog line, the
  sheet's §A/§B/§C applied verbatim) · `.claude/docs/lld/report-family.lld.md` (§11 LLD-C17…C21
  + ledger rows 20–28) · `.claude/docs/prd/report-family.prd.md` §3 (four items move from
  ruled-out to admitted, ADR-0163 cited) · `.claude/docs/adr/0111-report-family-v1-scope.md`
  (forward pointer to ADR-0163 — a pointer note, NEVER a Status change) ·
  `.claude/docs/adr/README.md` (the 0163 index row).
- Accept: docs-grammar/adr gates green; every sheet clause present verbatim; no Status cell
  touched by this seat.

## S0 — baseline capture (BEFORE any code change; serial, first code slice)

- Capture the migration byte-identity baseline from main: render the SPEC-R2/R3 fixtures,
  serialize host `outerHTML`, commit as test fixture data (SPEC-R25's committed baseline).
  Capture IN THE SAME BROWSER ENGINES S4 leg 1 compares in (Chromium + WebKit, one fixture
  per engine if serialization differs) — never jsdom (serializer drift would false-fail the
  gate).
- Files: NEW `controls/table/table-baseline.fixture.json` (or the build's chosen home — one
  writer) + the capture script note in the test file header.
- Accept: fixture exists and matches a fresh render on unmodified main.

## S1 — the pure view pipeline (parallel-safe with S2)

- Files: NEW `controls/table/table-view.ts` + NEW `controls/table/table-view.test.ts`.
- Build LLD-C17: `rowIdentity` · `compareCells` · `applySort` · `foldText` · `applySearch`
  · `applyFilter` · `pageWindow` · `reconcileSelected` · `sortProp`/`selectedProp`/
  `filterProp` codecs.
- Accept (SPEC-R21/R22/R23/R27/R28 slices, DOM-free): comparator table incl. all SPEC-R3
  degenerate cases sorting last + stability; fold cases (diacritics, case, locale);
  rendered-text search matching incl. the Intl-formatted-number case and `searchable:false`
  exclusion; facet AND/OR + String-coerced equality + unknown-key arm; identity fast paths
  (`''`/`[]` return the input reference); clamp cases incl. the matching set's `pageCount`; codec
  hardening (malformed JSON, bad direction, non-array selected, malformed filter entries →
  defaults/drops, never throw); reconcile order-keeping.

## S2 — `ui-pagination` (parallel-safe with S1)

- Files: NEW `controls/pagination/{pagination.ts,pagination.css,pagination.md,
  pagination.test.ts,pagination.browser.test.ts}` + the shared-file integration touches
  (`controls/index.ts`, `component-styles.css`, exports map — the LLD-C10-style single-writer
  wiring, serialized after S1/S2 bodies land).
- Build LLD-C19.
- Accept (SPEC-R24): jsdom — empty below `pages=2`, window algorithm shape, clamp, commit-law
  (programmatic write emits nothing), one `change` per activation with `{page}` detail.
  Browser (both engines) — computed role `navigation` + accessible name = `label`;
  `aria-current="page"` on exactly one stop; ends disabled; whole-shape box probe
  (test-the-whole-shape); forced-colors leg.

## S3 — `ui-table` element + CSS widening (serial, after S1 + S2)

- Files: `controls/table/table.ts` · `controls/table/table.css` (one writer each).
- Build LLD-C18 (props incl. `search`/`filter` as one-way view inputs, four effects with
  the R23 pipeline order, selection column, sort buttons, footer, focus restoration,
  select-all over the matching-set universe).
- Accept: the EXISTING table suites pass unmodified (SPEC-R25's second half) + new jsdom
  legs per SPEC-R21 AC3–AC5, R22 AC2–AC3, R23 AC1, R27 AC2–AC3, R28 AC1–AC2.

## S4 — real-engine interaction + a11y + byte-identity probes (serial, after S3)

- Files: `controls/table/table.browser.test.ts` (extend) + NEW
  `controls/table/table-interactive.browser.test.ts` if the shard budget wants the split
  (a near-ceiling shard splits further — the standing browser-gate law; never re-monolith).
- Legs (both engines):
  1. **Byte-identity** — defaults-on render `outerHTML` === S0 fixture, byte-for-byte
     (SPEC-R25).
  2. **Sort** — click header button → row reorder + `aria-sort` on exactly one `<th>` +
     one `change`; cycle asc→desc; switch column resets to asc (SPEC-R22 AC1).
  3. **Selection** — keyboard Space on a row checkbox → `selected`/`select`/`data-selected`
     (R21 AC1); select-all matching-set semantics (= the whole rendered set in this
     no-filter given) + `indeterminate` (R21 AC2).
  4. **Pagination** — footer click → windowed `<tbody>`, one table `change`, skeleton node
     identity held (R24 AC3); page clamp on rows shrink (R23 AC1).
  5. **Focus restoration** — focus a row checkbox, swap `rows` keeping that identity →
     focus on the same identity's input; swap removing it → focus on `#scroll` (R4.5).
  5b. **Filter/search** — diacritic+case fold match (R27 AC1) and rendered-text matching;
     facet AND/OR (R28 AC1); the full interplay: filter + search + sort + `page-size` in
     one instance renders the right window in the right order (R23's normative order,
     observed through the stamped rows); selection persists across a filter that hides a
     selected row, and select-all under an active filter selects exactly the matching
     set while preserving filtered-out selections (R28 AC3, probed with facet alone AND
     with an active search narrowing further); the FOOTER re-derives `pages` from the
     matching set's count when a filter/search change shrinks it (the footer-effect wake
     assertion); zero-result filter → honest empty `<tbody>`, no throw, no announcement
     node.
  6. **Scroll preservation regression** — SPEC-R4 AC1 re-run with all capabilities ON.
  7. **A11y sweep** — computed roles (`table`/`columnheader` retained), no host ARIA, no
     empty accessible name over every stamped focusable (R26 AC1); RTL selection-column
     position; forced-colors native-control survival.
- Any focus-timing flake goes to `FOCUS_TIMING_FILES` as a one-line append, never a new
  shard.

## S5 — descriptors + catalog + feed (serial, after S3; a2ui writer)

- Files: `controls/table/table.md` (rewrite per LLD-C20) ·
  `a2ui/src/catalog/default/{catalog.json,factories.ts}` · `tools/agent/feed-catalog.ts` ·
  `a2ui-catalog.spec.md` §5.2 · a table-capability exemplar in the examples shelf.
- **External dependency:** the ADR-0161 BUILD (M-B phase 1 — the `types.ts` value-union +
  the `input.ts` per-slot loop) must be merged before this slice; today's shipped validator
  carries only the singular mark. If absent when this slice dispatches, ESCALATE — never
  inline the 0161 build here.
- Accept: descriptor↔props trip-wire green over the widened prop set; catalog coverage gate
  green with `Pagination` declared+bound, zero allowlist residue; ADR-0161 multi-slot mark
  validates (renderer input controller binds `selected` when bound `{path}`, proven by an
  a2ui renderer test: commit → `surface.data` write); feed partition gate green with the
  `Pagination` disposition + reason; corpus/derived prompt re-validate.

## S6 — site + docs + size (serial, last)

- Files: `site/pages/pagination-{doc,demo}.ts` · table doc/demo capability sections ·
  preview specimen/knobs (the example-builder seat's concern boundary respected) · the
  data-table toolbar RECIPE page (ADR-0163 cl.2's taught COMPLEMENT — `ui-text-field` +
  `ui-segmented-control` driving the first-class `search`/`filter` props, incl. a visible
  results count covering the zero-result announcement residual) · `npm run size` note
  (SPEC-N4 marginal caps; any family-ceiling re-base recorded).
- Accept: per-tier page-set gate green; visual shard re-baselined deliberately (zero
  tolerance law) only where new anatomy appears.

## Coverage map (clause → slice)

ADR-0163 cl.1 → S-DOCS (fence prose in SPEC/PRD) · cl.2 → S1 (fold/search/filter pure fns)
+ S3 (wiring) + S4 leg 5b + S5 (catalog one-way props) + S6 (the complement recipe) · cl.3 →
S3/S4 · cl.4 → S1/S3/S4 · cl.5 → S1/S3/S4 · cl.6 → S2/S3/S4 · cl.7 → S1/S3 · cl.8 → S3 (no
FACE — asserted by the existing non-form-associated test staying green) · cl.9 → S5 · cl.10
→ S0/S4-leg-1 · the SPEC/LLD/PRD/ADR-0111/index doc applications → S-DOCS · SPEC-R21…R28 →
as per-slice accepts above · LLD-C17 → S1 · C18 → S3 · C19 → S2 · C20 → S2 (`pagination.md`)
+ S5 (`table.md`) · C21 → S5/S6.

*(ID note: the amendment sheets numbered these components C11…C15; they were applied to the LLD as
C17…C21 — C11–C16 were already taken by the M1/M2 waves. Mapping C11→C17 · C12→C18 · C13→C19 ·
C14→C20 · C15→C21; failure-ledger rows 18–26 likewise landed as 20–28.)*

Escalation law: any wall the frozen design causes REOPENS the design via escalation — no
local deviation without the docs amended in the same wave.
