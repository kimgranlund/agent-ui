# Changelog

Notable milestones of `agent-ui`. This file is the shipping summary; the sources of truth are the
milestone ledger (`.claude/docs/goals.md`), the plan (`.claude/docs/plan.md`), and the decision log
(`.claude/docs/adr/`).

## 2026-07-05 — the components foundation is COMPLETE (G0–G9 · Control Suite · icons · G8)

The full arc — G0 (tooling) through G8 (gallery + release-readiness) — is done and green. `agent-ui` is a
zero-dependency, signals-based web-component library in strict modern TypeScript: signals reactivity ·
FACE custom elements · tagged-template rendering · traits.

### What shipped

- **The foundation (G0–G7, G9).** The signals kernel (push-staleness / pull-value graph, equality cutoff,
  ownership scopes, budgeted microtask scheduler) · the `UIElement`/`UIFormElement` FACE hosts with
  props-as-typed-signals (`ReactiveProps`, decorator-free) · the tagged-template engine with the public
  `mount` + `repeat`/`watch` + directive-authoring seam (ADR-0023) · the trait system · the
  container/layout family (row/column/list/grid/card/tabs/modal, ADR-0015/0016). Light DOM by default,
  ARIA via `ElementInternals` only, zero native form elements, imports strictly inward.
- **The full FACE Control Suite (Waves 0–5 + the G7 completion).** ~25 `ui-*` controls: button · the
  12-type `ui-text-field` (`text … password · number · currency · unit · percent · date · time`, ADR-0044/
  0047/0048) · the Indicator family (checkbox/switch/radio/radio-group) · the Range family (slider/
  slider-multi) · the Overlay family (popover/tooltip/menu/select/combo-box, ADR-0043/0045) · `ui-calendar`
  · `ui-field` + `ui-form-provider` (ADR-0050/0051) · `ui-text` (ADR-0078). Every control shipped through
  the per-control bar: descriptor + contract trip-wire, jsdom probes, the cross-engine browser smoke
  (Chromium AND WebKit), and an independent review ≥ 4 on both rubric axes.
- **`@agent-ui/icons` + `ui-icon` (ADR-0065/0066).** The swappable icon-pack adapter (registry · resolver ·
  declarative consumer), Phosphor vendored at build time as the default pack — zero runtime dependency.
- **G8 — the gallery + release-readiness pass (ADR-0079/0080/0081).**
  - `<component-gallery>`: the docs-site surface that dogfoods the kernel end to end — a `filter` signal,
    a `watch`+`repeat`-reconciled grid over descriptor-derived members, `watch` readouts — composed over
    `<component-preview>` (hardened for fleet-wide construction: the `NO_SLOT_TEXT`/`SLOT_TEXT_OK`
    partition, sample children, demo seeds — ADR-0077 Amendment 1).
  - `<theme-provider>`: ONE theming subtree — `scheme` (light/dark) · `scale` · `density` live, plus the
    **reserved `theme` package seam** (one `default` package; the multi-theme package-swapping system is
    next-tier scope).
  - **Per-control `exports` + the marginal size gate (ADR-0080):** `@agent-ui/components/controls/{name}`
    public entries + the leave-one-out per-control marginal in `npm run size` — the eventual DISTRIBUTED
    footprint is now what the gate measures (realizes ADR-0049 Amendment 1).
  - **The family-coherence standing gate (ADR-0081):** 3 groups / 9 invariants across the whole fleet
    (events vocabulary + the pure-activation `click` carve-out · size-enum + inverse-`[size]` · base
    ladder · descriptor naming · token discipline · registration · the two-way `open` pair), each with a
    biting negative control — plus a judged read-only audit, clean at zero MAJOR (the one MAJOR found,
    select's missing size axis, closed: `ui-select` joined the sized entry family).

### Final gates (2026-07-05)

- `npm run check` (tsc + check:site) — green.
- `npm test` — **2684** jsdom tests, 0 expected-fail markers.
- `npm run test:browser` — **806** tests, Chromium + WebKit.
- `npm run size` — foundation **6542 / 7168 B gz** · family barrel **22935 / 23552 B gz** · per-control
  marginals within budget (one cited override: text-field **4021 / 4352 B gz** — the 12-type family).

### Decision ledger

ADRs **0001–0081** ratified (log + lifecycle: `.claude/docs/adr/README.md`; supersessions and amendments
recorded append-only). `plan.md` §12's open decisions are all **resolved or explicitly deferred** — the
one deferral: **library emit** (per-control exports are emit-ready on TS source; the `dist/` + `.d.ts`
flip lands at first publish — Kim-confirmed).

### Deferred follow-ups (recorded, owned)

- `ui-combo-box` `size` axis — the second picker's sized-entry-family completion.
- `formUserInvalid` per-control error legs (the recorded G7 follow-up).
- Button-motion browser-test flake hardening.
- The multi-theme `theme` package-swapping system (the seam is wired; one `default` package ships).

### Next tier

Layout/display primitives vs agent-app surfaces (+ the multi-theme package system) is **Kim's scope-dial
decision — deliberately left unchosen here**.

## 2026-07-06 — G8 polish + the agent-app-shell M1 (ADR-0082–0086)

### What shipped

- **The agent-app-shell — M1 of agent-app-surfaces (ADR-0082/0083/0084).** `ui-app-shell` gains **per-instance
  style isolation** (`isolated` reflected prop, default `false`; `attachShadow` at connect — not the
  class-level `static shadow` seam — with the fleet's foundation + component CSS injected inside the
  boundary so theme tokens and control styles still reach shadow-tree content, ADR-0082). The region model
  **decouples its column placement from its ARIA landmark** (ADR-0083) and gains a **per-region narrow-reflow
  strategy** — `collapse: hide | stack` (ADR-0084), resolving the LLD's reserved §7.5 revisit surfaced by the
  a2ui-live dogfood. A new docs-site page documents the composition.
- **The `ui-select` / `ui-combo-box` labelling seam (ADR-0085).** The trigger's accessible name is now
  correctly composed (label + selected-value concatenation via a new `[data-part=aria-label]` wire),
  closing the ADR-0051 "select/combo-box labelling wires" follow-up and correcting a `combo-box.md` drift
  (a documented `label` slot / `aria-label` / `<label for>` the code never had).
- **`ui-radio-group[variant=segmented]`** — a joined-button single-select presentation reusing the group's
  existing exclusivity/roving/validity machinery, with one shared animated `::before` indicator. *(Superseded
  two days later by ADR-0095, below — the tag itself turned out to be the requirement.)*
- **Overlay geometry + site dogfooding.** Menu-list inset/items now carry the trigger's size relationship;
  the docs site dogfoods its own controls in more places (component-preview knobs + search fields, the
  provider-switcher on `ui-select`, the a2ui-live canvas tabs on `ui-tabs`, small-enum knobs rendered as
  segmented controls) and gets representative preview specimens with de-doubled knob/variant rows. A new
  `example-builder` agent seat is added to own this class of fix.

### Final gates (2026-07-06)

- `npm run check` — green throughout.
- `npm test` — **2754 → 2824** jsdom tests across the wave (both snapshots recorded green in-wave commit
  messages); `npm run test:browser` — **878** tests recorded at wave start (Chromium + WebKit), green
  throughout.

### Decision ledger

ADR-**0082, 0083, 0084, 0085** accepted. ADR-0086 (segmented radio-group variant) accepted this wave, then
**superseded by ADR-0095** (2026-07-07/08, below) once Kim ruled the tag itself is the requirement.

### Deferred follow-ups (recorded, owned)

- The rest of `agent-app-surfaces` beyond M1 (isolation/region/reflow only) — later milestones unscoped here.
- The multi-theme package-swapping system (unchanged from the 2026-07-05 deferral).

### Next tier

Whether `ui-segmented-control` earns standalone status (ADR-0092's fork) is picked up two days later.

## 2026-07-08 (morning) — `@agent-ui/a2a` + the A2UI live-agent/feed/bridge wave (ADR-0087–0100)

### What shipped

- **`@agent-ui/a2a` — a new top-level, zero-dep package**: the A2A (Agent2Agent) protocol core (wire types +
  task-lifecycle model pinned to spec v0.3.0), the **tic-tac-toe arena** — an isolation-proven agent-vs-agent
  match harness with a recorded flagship Sonnet-vs-Haiku match plus contaminated-control negative-control
  matches proving cross-contamination is mechanically detectable, not just assumed absent — and a
  **17-record concepts/demo corpus** (15 concept + 2 demo records, `corpus/{concept,demo}/v0_3_0/a2a.jsonl`).
  New docs-site pages: the a2a arena and concepts pages, plus a2ui gallery + patterns polish and feed-asks
  page wiring.
- **The live-agent conversational + Gen-UI control layer.** A natural-language `note` channel beside (never
  inside) the A2UI stream, with a grounded per-turn decision-trace and `wantResponse`-routed click→turn
  (ADR-0088); clarify-before-acting — the agent can emit a note-only turn to ASK instead of guessing, honest
  about catalog-boundary limits (ADR-0089); a per-turn `mode` axis (`specific` ↔ `blue-sky`) scaling that ASK
  grammar under one mode-invariant honesty floor (ADR-0090); the Gen-UI **mini-skill registry** — a modular,
  on-demand prompt-injectable idiom-instruction layer bounded to a per-module ~200-token budget × per-turn
  cap of 3, so the system prompt cannot bloat regardless of registry size (ADR-0091 — authored this wave,
  its first real consumer, the form-rhythm mini-skill, ships in the next wave; the ADR itself was not
  ratified until 2026-07-09, see below).
- **Feed-embedded interactive A2UI asks (ADR-0097).** The ADR-0089 ASK becomes a small inline surface inside
  a chat message — an `ask` routing field on the ADR-0088 meta envelope, a per-message frozen-history
  lifecycle, and a gate-encoded feed sub-catalog.
- **B6 — the A2UI-over-A2A bridge + the artifact-feed demo (SPEC-R16).** Realizes the long-standing
  pipeline SPEC-R5/LLD-C5 adapter stub — envelope↔DataPart mapping, capabilities/extension injection — and
  ships a live demo page where chat messages can carry A2UI artifacts (a report as a chart, etc.).
- **Control-fleet fixes.** `ui-calendar` gains a `mode="range"` date-range selection (paired-pick, single
  grid, ADR-0093); the slider thumb gains a third contrast ring dimension against the page/track surfaces
  (ADR-0094); `ui-row`/`ui-column` gain a catalog-reachable `reflow: auto | locked` gate — **column's default
  flips to `locked`** because its wide→row switcher fired in the common case for a model with no CSS escape
  hatch (ADR-0096); the validator now enforces catalog enum membership at the schema line, feeding
  non-member literals into the self-correct loop (ADR-0098); `updateDataModel path:"/"` is honored as the
  spec's whole-model root alias at every apply site (ADR-0099); query-container establishment moves off the
  four layout primitives onto externally-sized boundaries only, fixing a silent 0px collapse whenever a
  primitive sat in a content-sized position (ADR-0100).
- **`ui-segmented-control` becomes standalone (ADR-0095, supersedes ADR-0086).** Kim's T3 ruling — the tag
  itself is the requirement, not a `ui-radio-group` presentation variant — fires the reopen trigger ADR-0086
  itself pre-booked; the visual/interaction/geometry/motion/a11y design carries over unchanged, re-keyed onto
  the new tag; `ui-radio-group`'s `variant` prop is retired.

### Final gates

- `npm run check` — green throughout.
- `npm test` — jsdom climbed through the wave; no single isolated snapshot was recorded exactly at this
  wave's boundary (the next wave's opening commit records **3712** — see below).
- `npm run test:browser` — green throughout; no isolated whole-suite snapshot recorded at this wave's exact
  boundary either (see the 1230-passed figure recorded later the same day, next entry).

### Decision ledger

ADR-**0088, 0089, 0090, 0093, 0094, 0095, 0096, 0097, 0098, 0099, 0100** accepted. ADR-**0087** (A2UI default
catalog covers the whole shipped fleet — a gate-encoded exclusion allowlist) was authored this wave and
remains **proposed** — an open decision, not yet ratified. ADR-0092 (the segmented-control pattern-identity
fork that preceded 0095) is **superseded**, never having been accepted. ADR-0091 was authored this wave but
not ratified until 2026-07-09 (see the final entry's decision ledger).

### Deferred follow-ups (recorded, owned)

- ADR-0087's whole-fleet catalog scope policy — still open, Kim's ratification pending.
- The mini-skill registry's upgrade trigger (promote to corpus records once the registry exceeds ~15–20
  modules, or a module needs per-turn quality-gating) — named, not yet fired.

### Next tier

The CSS-less-consumer contract law (a fleet-wide generalization of this wave's ADR-0096 forcing argument)
and the chart family are the immediate next wave, below.

## 2026-07-08 (afternoon/evening) — the CSS-less-consumer law + the chart family (ADR-0101–0110)

### What shipped

- **The CSS-less-consumer contract law (ADR-0102).** Generalizes ADR-0096's forcing argument fleet-wide:
  no rendered-correctness concern (layout/spacing/surface/width/overflow) may live only in "the page
  author's CSS," because the catalog's #1 consumer class — a live model composing validated prop-only node
  trees — has no CSS verb. Three lanes: **A** component-owned safe default, **B** catalog-reachable intent
  prop, **C** taught idiom (only for graceful, non-destructive no-uptake failures). Five applications shipped
  the same wave:
  - **Overlay transitions always announce (ADR-0101).** `toggle`/`close` now fire on every actual
    show/hide — including a component-driven commit-close (e.g. menu selection) — ending the light-dismiss-
    only suppression that let a model's `open` binding silently desync from the real panel state.
  - **`ui-radio-group` owns its interior layout; `ui-form-provider` teaches the wrap idiom (ADR-0103).**
    The group's `orientation` prop finally gets a visual referent (flex axis + `--ui-radio-group-gap`); a
    new form-rhythm mini-skill (ADR-0091's first real consumer) teaches the Column-gap wrap idiom.
  - **`ui-tabs` drops its self-seeded surface plane (ADR-0104)** — transparent by default, restoring
    ADR-0015 cl.1; a plane is now an asked-for `elevation`/`brightness` intent, not a bolted-on default.
  - **`ui-calendar` fills its given width (ADR-0105)** — fluid `minmax()` tracks + a two-layer cell (a
    stretching band layer for the in-range wash/hit-target, a fixed-size point layer for the circular
    selected/endpoint marks), fixing stretched-panel ellipse endpoints and band holes.
  - **`ui-text` gains `truncate` (ADR-0106)** — CSS-only single-line ellipsis + an unconditional `title`
    mirror; rich reveal stays a taught `Tooltip > [Text truncate]` idiom, never auto-minted.
- **The chart family v1 — `ui-sparkline` + `ui-bar-chart` (ADR-0107).** Axis-free by construction, hand-rolled
  inline-SVG/CSS (no charting dependency): sparkline as a component-built SVG polyline in `currentColor`,
  bar-chart as CSS rows with mixed-sign/diverging-bar support (RTL-verified). Ships with new catalog rows,
  doc pages, feed dispositions, and a report-card exemplar that closes the trace end-to-end.
- **`ui-text` gains `emphasis` (ADR-0109)** — the schema's fifth orthogonal axis, a boolean visual-weight
  intent (`[emphasis]` repoints `--ui-text-weight` to 700) — purely visual, no `<strong>`/`<b>` stamping.
- **The visual-regression (pixel-diff) harness (ADR-0110).** `vitest-native `toMatchScreenshot`` — zero new
  dependency (already bundled with the installed `@vitest/browser`) — opt-in by filename (`*.visual.browser.
  test.ts`), Chromium-only pixel truth (WebKit keeps the whole-shape computed-style doctrine), committed
  baselines at `__baselines__/`, tolerance config-level (YIQ 0.1, 1% mismatch ratio). A same-day follow-up
  commit (`5a4a792`) measured and fixed a teardown-timeout flake and a phantom-skip collision rather than
  guessing at them.

### Final gates

- `npm run check` — green throughout.
- `npm test` — **3712** jsdom tests green (recorded at this wave's closing commit, `7090838`); the site's own
  browser project measured **242/242** the same commit.
- `npm run test:browser` (full cross-package) — **1230 passed / 0 skipped**, recorded mid-wave at `5a4a792`
  after the teardown/phantom-skip fixes (the wave's remaining commits were docs + one bar-chart test leg, not
  expected to move this materially).

### Decision ledger

ADR-**0101, 0102, 0103, 0104, 0105, 0106, 0107, 0109, 0110** accepted. **ADR-0108 was never issued** — the
number was reserved against a concurrent-intake numbering race and deliberately left unused (its siblings,
the report/feed/content family ADRs, hold 0111–0114 instead — see the next entry).

### Deferred follow-ups (recorded, owned)

- ADR-0102's flagged-not-repaired items: the #27 stamp gap (needs a live re-diagnosis post-ADR-0100) and the
  catalog `Text` row's inability to express emphasis/bold (closed the same wave by ADR-0109 above).
- The visual-regression harness's named demotion trigger: a recurring cross-machine flake moves it out of
  the standing `test:browser` gate to a manual one (the `npm run size` precedent) — not fired.
- Chart family v2 (additional chart types beyond sparkline/bar) — unscoped.

### Next tier

The report/content/feed component families and a first application-framework package (a router) are the
next wave, below.

## 2026-07-09 — report/content/feed component families + `@agent-ui/router` (ADR-0111–0115)

Twelve new components across three families, each built → independently reviewed → integrated → documented
→ catalogued, plus a brand-new top-level package.

### What shipped

- **Report family — `ui-table`, `ui-stat`, `ui-badge` (ADR-0111).** Static display vocabulary only —
  sorting/selection/pagination/virtualization/resizing/cell-renderers, chips, anchored count-dots, the stat
  child seam, and delta valence are all fenced as separate future intakes. `ui-table` renders a **real
  native `<table>`** in light DOM (caption/`thead`/`th scope`/`tbody` — native table accessibility, free).
- **Content family — `ui-code`, `ui-disclosure`, and a hyperlink extension to `ui-text` (ADR-0113/0114).**
  `ui-code` is a Display-class verbatim-code leaf (`white-space: pre`, component-owned horizontal scroll,
  `language` as inert metadata — no vendored tokenizer/highlighter). `ui-disclosure` wraps native
  `<details>/<summary>` (fold animation and a rich `summary` slot deliberately deferred — cross-engine
  `::details-content` support is too fresh). `ui-text` gains `as="a"` + a reflected `href`, enforced through a
  **component-side scheme allowlist** (`https:`/`http:`/`mailto:` only, via `new URL()`; anything else — incl.
  `javascript:`/`data:`/`blob:`/`file:` — never reaches the `<a>`, fail-closed) with a fixed
  `target="_blank"` + `rel="noopener noreferrer"` (same-tab navigation would destroy a live agent session).
- **Feed/agent-activity family — `ui-progress`, `ui-avatar`, `ui-attachment`, `ui-toast` + `ui-toast-region`
  (ADR-0112).** Bar-only indeterminate-capable progress; avatar with a src→initials→glyph fallback chain
  (never silent-empty, no per-identity hue coding); a `FilePart`-aligned attachment card; and the fleet's
  **first transient/timed overlay** — `ui-toast-region` as a `popover=manual` top-layer stack, auto-dismiss
  pausing on hover/focus, an actionable toast never auto-dismissing. `Toast`/`ToastRegion` are **permanently
  excluded** from the A2UI catalog (history-must-not-lie: a live notification cannot honestly replay).
- **`@agent-ui/router` (ADR-0115) — a new top-level package.** Memory-first: route state is one kernel
  signal, the single source of truth in every host; URL reflection is an **opt-in projection**
  (`connectUrl` — hash default, history opt-in with state-stamped stack sync). A factory-seam
  `ui-router-outlet` (lazy `import()`, last-navigation-wins) and a dedicated `ui-router-link` (real `<a>`
  stamp, plain-click intercept, modified/middle-click native fallthrough, `aria-current="page"`). The A2UI
  catalog's `Route`/`Router` surface is structurally fenced — a2ui has no router edge, not merely deferred.
- **Cross-cutting fixes discovered and closed during the build:**
  - `family-coherence.test.ts`'s toggle+close gate now correctly scopes to the true light-dismiss overlay
    class, carving out `ui-disclosure` as a documented non-overlay exception (ADR-0101: a fold has nothing
    external that can dismiss it, so it correctly has `toggle` with no `close`) — with a negative control
    proving the exception list can't silently absorb a real overlay regression.
  - `ui-attachment`'s byte-count prop renamed `size` → `sizeBytes` (ADR-0112 Amendment 1) to stop colliding
    with the fleet's reserved `[sm,md,lg]` widget-tier `size` enum.
  - A genuine `npm run build` break — a raw-TypeScript cross-package import reaching `vite.config.ts`'s
    Node-native plugin chain — traced and fixed with a local constant + a new cross-package sync test.
  - The router's URL-reflection replace-vs-push decision was rebuilt on the memory stack's own
    `historyIndex` after the original one-shot flag proved unable to actually distinguish a replace
    navigation from a push.

### Final gates (2026-07-09)

- `npm run check` (tsc + check:site + check:tools) — green.
- `npm run build` — green (the build-break fix above verified against a real production build, not just
  the dev server).
- `npm test` — **4390** jsdom tests passing, 0 failures, across 249 test files.
- `npm run test:browser` — **could not be measured in this environment tonight**: two consecutive runs
  (default heap, then `--max-old-space-size=8192`) both crashed with a Node OOM during the run, diagnosed as
  environment resource contention rather than a real regression (`npm run check`, the full jsdom suite, and
  `npm run build` all completed clean in the same session). The last independently recorded whole-repo
  browser figure is **1230 passed / 0 skipped** (`5a4a792`, 2026-07-08) — recorded **before** tonight's wave,
  which shipped its own `*.browser.test.ts` file per new control plus a router browser suite, so the true
  current total is materially higher than 1230; re-run `npm run test:browser` in an isolated environment to
  get a real current figure before relying on one.
- `npm run size` — foundation **6542 / 7168 B gz** · family barrel **29542 / 30720 B gz** (30 KB re-based
  this wave, ADR-0111/ADR-0112, ten new controls landed in two integration slices) · `@agent-ui/app` marginal
  **1225 / 3072 B gz** · **NEW** `@agent-ui/router` marginal **-1374 / 4096 B gz** (solo 5168 B gz, informational).

### Decision ledger

ADR-**0111, 0112, 0113, 0114, 0115** accepted — ratified 2026-07-09 by Kim's explicit instruction after the
self-flip guard hook (`.claude/hooks/adr-status-guard.py`) was deliberately deregistered to permit the flip;
every fork in all five records stands as recommended (no objection raised). **ADR-0091** (the Gen-UI
mini-skill registry, authored 2026-07-07) was ratified in the same pass, closing a long-standing
shipped-but-proposed flag. **ADR-0087** (whole-fleet catalog scope policy, open since the 2026-07-08 morning
wave) was ratified by Kim the same day as this wave, closing the last standing `proposed` record.

### Deferred follow-ups (recorded, owned)

- `ui-table`/`ui-stat`/`ui-badge`: sorting, selection, pagination, virtualization, resizing, cell-renderers,
  chips, anchored count-dots, the stat child seam, delta valence — each its own future intake (ADR-0111).
- `ui-attachment`'s name-cell-as-`<a>` rendering leg — the catalog/factory wiring is correct and inert today;
  the component-side rendering is a separately tracked follow-up (feed-family LLD-C6).
- `ui-code`: no highlighter (deliberate — a tokenizer is runtime code), no v1 copy-to-clipboard affordance.
- `ui-disclosure`: no fold animation, no rich `summary` slot, no v1 `name`-based accordion grouping.
- `@agent-ui/router`: nested routes, route ranking, guards, loaders, and keep-alive are all named and fenced,
  not built.
- `npm run test:browser` needs a real isolated re-run to get a current pass count (see Final gates above).

### Next tier

Whether/how the twelve new components extend into the A2UI feed and report surfaces beyond their v1 scope,
and the router's URL-reflection replace/push semantics under real multi-tab usage, are **Kim's scope-dial
decisions — deliberately left unchosen here**.

## 2026-07-09 (late) — the docs conceptual layer + B7 live real-time A2A arms (ADR-0116)

### What shipped

- **The docs site's conceptual layer** — seven guide pages (getting-started · theming · a fully-derived
  token reference · sizing & density with a live measured matrix · an end-to-end forms guide · a
  which-component-when chooser · the changelog on-site), plus `/llms.txt` (the agent-facing index, 83
  pages) and `/llms-full.txt` (the fetch-readable corpus: every component descriptor's prose + this
  changelog, drift-gated byte-identical to its generator).
- **TKT-0002 — a real production-only bug found by the theming guide's own demo**: LightningCSS was
  rewriting all 310 `light-dark()` declarations into a `prefers-color-scheme`-only polyfill, silently
  breaking `<theme-provider scheme>`'s whole per-subtree mechanism in every `vite build` while dev stayed
  correct. Fixed at the build config (`Features.LightDark` exclude — the narrowest option), proven
  bidirectionally against the served production artifact, gated (`light-dark-minify.test.ts`).
- **ui-segmented-control dropped its inter-segment dividers** (Kim's ruling — the outer track, moving
  fill, and hover washes carry the segmentation), with the old divider assertions inverted into
  zero-divider regression guards. **TKT-0001/0004** — the ADR-index search field's discarded inner grid
  anatomy (`display: block` → `grid`) and the artifact-feed's missing animate-to-new-content scroll.
- **B7 — the A2A examples went live, real-time, user-initiated (ADR-0116, proposed).** The arena's
  dev-only live match now STREAMS move-by-move into the shipped replay UI (a shared NDJSON line reader ·
  a replay accumulator whose `isComplete()` tracks the referee's terminal event — completion is a tracked
  fact, never inferred from stream end, the doc-review's HIGH corrected at design · a real abort seam
  through `runMatch` with a byte-identical no-signal control · cancel = abort + discard, and the isolation
  verdict runs the same checker over the completed transcript only). The artifact-feed's reserved live arm
  became a real conversational loop over A2A: a part-frame protocol whose header declares the part count
  (completeness decidable from the frames), the client-held A2A log as the whole session (the proxy stays
  stateless), a new `/__a2a/feed` mount that server-verifies the HV-8 caps handshake, and a composer that
  genuinely sends — prose + live A2UI artifacts rendering progressively. Proven with a real
  Sonnet-5-vs-Haiku-4.5 match streamed over ~25s plus a clean mid-match disconnect; offline stub legs +
  biting truncation negatives are the CI truth. Recorded-default and the server-side-key trust boundary
  unchanged — both arms stay dev-only, tree-shaken from the static build.

### Final gates (2026-07-09, late)

- `npm run check` — green. `npm test` — **4495** jsdom tests across 258 files, 0 failures.
- Scoped browser legs (both engines): the arena + feed pages incl. the new live suites — green. The full
  `test:browser` matrix remains environment-bound (the standing OOM ceiling); scoped runs are the truth.
- `npm run build` — green; the dist grep over both live mounts shows zero functional leakage (the only
  textual hits are ADR prose inside the embedded decision-log page, by design).

### Decision ledger

ADR-**0116** proposed — seven forks carrying firm recommendations, awaiting Kim (the SPEC §4.6 widening
passed independent doc-review, one HIGH corrected at design). TKT-0001/0002/0004 closed `done`; TKT-0003
(ship theme-provider as a real component) recorded `open`.

### Deferred follow-ups (recorded, owned)

- ADR-0116 Open #2: a "save this live run as a fixture" affordance — deferred until a run worth curating.
- The feed's user-bubble UX in live mode shows the handshake + wire only (no human-readable action
  description — `deriveFeedEntry` has no such field, unlike a2ui-live's bespoke describer); a follow-up
  if the sparseness grates.
- Cancel does not reach into an in-flight provider HTTP call (ADR-0116's accepted risk — one dangling
  model call may run to its per-move timeout server-side after a cancel).

### Next tier

Ratification of ADR-0116's forks and TKT-0003's theme-provider promotion are **Kim's calls — deliberately
left unchosen here**.
