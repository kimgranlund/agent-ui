# A2UI Inventory — `@agent-ui/a2ui` (2026-08-05 snapshot)

## 1 · SHIPPED (load-bearing today)

- **Two first-party catalogs, both registered on every renderer.** `default` (58 component types,
  `catalog/default/catalog.json`) and, new since 07-28, **`a2ui-basic`** — the upstream Google A2UI
  v0.9.1 Basic Catalog, 14 of 18 upstream types + 13 of 14 upstream functions (**ADR-0169**, accepted
  2026-08-04, ratified via PR #430). Both `Renderer` constructor-registers unconditionally
  (`renderer/renderer.ts:149`), plus a canonical-URI inbound alias
  (`https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json`) — an upstream-authored stream
  resolves on any fleet renderer with zero translation. `catalogId` threads end-to-end: the
  agent-admin picker (`A2UI_CATALOG_OPTIONS`, now a "Catalogs" library-section entry per ADR-0170) →
  the produce POST body → both server transports (`dev-proxy-plugin.ts`, `worker/index.ts`, the
  shared fail-closed `selectCatalog()` helper in `chat-validation.ts`) → `produce()`'s
  `deps.catalog` seam → the renderer registry. GH #413 (M-B box 4) closed 2026-08-04.
- `a2ui-basic` package shape mirrors `default/`: `catalog.json` · `factories.ts` (REUSE-wrapped +
  bespoke, a `withBasicCommon` decorator applying the schema-wide `weight`/`accessibility` props) ·
  `functions.ts` (boolean-dialect impls, registered per-catalog so they never collide with the
  shared `{valid,message}` table — ADR-0034's new per-catalog override seam) · `index.test.ts` (the
  18-type partition coverage gate) · `factories.test.ts` · `upstream-fixtures.test.ts` (3 pinned
  upstream payloads validate + render against `a2uiBasicCatalog`).
- **E7 gate-encoded — GH #429 closed.** ADR-0169's `Action.functionCall` exclusion was render-time
  only at ratification (validated `true`, rendered its Button, click dispatched nothing — a
  silent-dead-control). Fixed same window: commit `4b69cfb` "gate-encode E7 at conformance — a2ui-basic
  rejects Action functionCall at validate time (Fixes #429)" — a narrow `mapsTo:'action'`
  conformance rule scoped to `a2ui-basic` only, so the other catalogs' ADR-0011 Postel tolerance
  arms stay un-narrowed. Verified via `gh issue view 429` (state: CLOSED).
- **`ValueSlot` widened** (`catalog.ts`): optional `readProp` (DOM property read on commit, defaults
  to `prop`) and closed `marshal: 'singletonStringList'` — amends ADR-0019/0161, absent-⇒-byte-identical.
  First consumers: `CheckBox` (`readProp:'checked'`), `ChoicePicker`→`ui-select` (`marshal`, array↔string).
- **Per-catalog function implementations** (amends ADR-0034): `CatalogEntry.functions?` + `Registry.register`'s
  optional third param; `renderer/functions.ts` looks up `entry.functions?.[name] ?? catalogFunctions[name]`.
- **Upstream `Action` third Postel arm** (amends ADR-0011): `readActionSpec` now tolerates
  `{event:{name,context}}` alongside the canonical `{action,…}` shape and the two prior tolerance arms;
  outbound wire is untouched.
- **`ui-table`/`ui-pagination` now expressed in the catalog** (ADR-0163 cl.9, part of the just-closed
  M-A arc): commit `57e9575` "catalog + feed express the widened ui-table and mint Pagination" — the
  default catalog's `Table`/`Pagination` rows exist today (`catalog.json:427,457`).
- **Tool-enablement layer threaded through** (ADR-0168, S4/S6): the integration manifest registry
  (`registerIntegration()`), `auth:'serverKey'`, and the prose-chat + producer arms; MCP-client
  adoption is explicitly deferred (GH #438, open — a future ADR is its own acceptance criterion).
- **Producer toolkit `./agent`** (ADR-0137/0138) unchanged in shape from 07-28: `produce()` round
  loop, `system-prompt.ts`, `mini-skills.ts`, transport+session seam, provider dispatch, recorded
  transport for demos — now catalog-parameterized (the `produce.ts:81` pinned `CATALOG_ID` literal
  is **deleted**; `queryOf` takes the request's `deps.catalog.catalogId`, ADR-0169 cl.4).
- **Live-turn lifecycle progress channel** (ADR-0146), produce-halt surfacing, in-persona
  self-correct feedback — unchanged, still load-bearing.
- **GenUI wire** (ADR canon B0–B2): `genui-line.ts` reader/writer at `@agent-ui/a2ui/agent`,
  `produce()` peeling genui lines pre-heal/validate, `GENUI_*` failure codes, 3 pattern-source
  packs + degradation-safe prompt block (SPEC-R9). GenUI's own arc (M-C) is now fully **DONE**
  (roadmap §3, closed 2026-07-29) — dogfood mode (ADR-0162) shipped S0–S5.
- **Dev live-agent proxy on Cloudflare Worker** (ADR-0152, `tools/agent/worker/`).
- **A2A bridge** (`src/bridge/`) — A2UI-over-A2A, unchanged.
- **Corpus store** (`src/corpus/`) — **grown**: the exemplar shard
  (`corpus/exemplar/v1_0/agent-ui.jsonl`) now holds **24 records** (up from the 07-28 snapshot's "1
  exemplar file, thin" — `corpus/index.json`'s `counts.byFacet.exemplar: 24`, all `valid`, zero
  quarantined/repaired), spanning canvas/list/pattern/booking/report/persona-status shapes
  (`trivia-round-resume`, `booking-reservation`, `report-card-dashboard`, `agent-task-status`, etc).
  All 24 are keyed `byCatalogId: {"agent-ui": [...]}` — **`a2ui-basic` has zero exemplars** (ADR-0169's
  own recorded consequence: Basic turns retrieve nothing until a Basic shard is seeded, an explicit
  accepted degrade, not an oversight).

## 2 · IN-FLIGHT

- **GH #453 — the 2026-08-05 A2UI ecosystem survey, open PR, awaiting Kim.** A proposed SPEC
  (`docs(spec): a2ui-ecosystem-alignment`) capturing a two-scout upstream-alignment survey: real
  drift found (`protocol.ts:120`'s `surfaceProperties?: object` — the upstream v1.0 RC **removed**
  this field entirely, "Decoupled Branding"), 8 future-work requirements (SPEC-R1–R8: AG-UI
  transport-binding priority, a conformance-fixture packaging lane since upstream has none, a
  deceptive-composition eval lane, a render-depth guard, MCP Apps ruled a non-goal-as-delivery-vehicle).
  Governance note: canonical upstream repo moved to `a2ui-project/a2ui`; v1.0 is Release Candidate,
  v0.9.1 is the production recommendation. Status: proposed, nothing yet routed to Issues.
- **No other open a2ui-scoped work.** The three milestones that governed the 07-28→08-05 window
  (M-B "Personas that don't lie", M-C "GenUI speaks fleet", M-A "SaaS Data Workbench") are ALL now
  closed (roadmap.md §2 arc-status line, 2026-08-05) — every a2ui-relevant follow-up they spawned
  (#429, #409, #404 from M-B; #454/#455/#457/#465 from M-A) is closed or non-a2ui-owned (the M-A
  follow-ups are components/app-size and report-family-spec wording, not a2ui core).

## 3 · CANDIDATE INCREMENTS (grounded)

1. **Ratify/route GH #453's SPEC-R1–R8** — the fix cited as already-needed is real: `protocol.ts:120`
   carries a field the upstream v1.0 RC removed. This is a live drift a maintainer would hit today
   comparing our wire types against the current spec.
2. **Seed an `a2ui-basic` corpus shard.** Named follow-up recorded at ADR-0169 ratification
   (Decision §4/Consequences): zero exemplars for Basic turns today; default-dialect exemplars would
   few-shot the wrong prop vocabulary, so retrieval degrades to empty rather than wrong — correct but
   thin. A small Basic-dialect shard (mirroring the `agent-ui` shard's shape) closes the gap.
3. **Drain the ADR-0169 exclusion table (§12, E1–E7 minus E7 which is now closed).** Six live rows:
   E1/E2 (`Video`/`AudioPlayer` — no fleet media control), E3 (`Tabs` — needs a reference-typed-prop
   mount seam), E4 (`Modal` — needs named-slot children grammar + a trigger-entry mechanism), E5
   (`Icon.name`'s `{svgPath}` object arm), E6 (`ChoicePicker.variant:'multipleSelection'` — no
   multi-select control exists). Each is its own scoped intake per the ADR's own text; none is
   silent, but Tabs/Modal both name concrete architectural blockers a design intake could take on.
4. **GH #421 — bespoke per-persona A2UI catalogs (open, size:big).** `catalog = shared primitives +
   shared system + local patterns` (Maître d' ≠ Croupier). Explicitly rides on ADR-0169's
   `catalogId` plumbing (now shipped) and is named in roadmap.md §4 as a live "Later" deferral, not
   scheduled. Now that catalog selection is a proven, threaded seam end-to-end, this is architecturally
   closer than it was at the 07-28 snapshot — the prerequisite it names is done.
5. **GH #438 — MCP client for tool enablement (open, size:big, deferred by ADR-0168).** Explicit
   trigger condition: "revisit when a real external-integration need lands" (the hotel booking/PMS
   integration is the named first candidate). Not actionable until that need materializes; tracked
   here as a standing candidate, not urgent.
6. **Corpus growth beyond the 24-record shard.** 24 is a real improvement over 07-28's single file,
   but still thin against the catalog's 58 default types + newly-expressed `Table`/`Pagination` rows
   (ADR-0163 cl.9) — no exemplar currently teaches the table/pagination pattern by name in the
   `byCatalogId` list. Worth a deliberate coverage pass, not just organic growth.
7. **Required-ness enforcement (ADR-0169 §9a "global note", recorded non-wave item).** v1 is
   permissive-in / unenforced-out: the schema's per-type `required` markers have no `PropDef.required`
   mechanism or conformance check on our side. A named follow-up, not urgent, but a real interop-out
   gap for any Basic-dialect producer that under-emits.
8. **Per-catalog picker vehicle already changed underneath ADR-0169 cl.6** (ADR-0170, ratified
   2026-08-04) — the bare `ui-select` picker retired in favor of the "Catalogs" library-section
   pattern; confirm the doc trail (`agent-admin.md` §surface-catalog) reflects this if not already
   repaired (ADR-0169's own Repairs row still names the retiring wording as a to-do).

## 4 · EDGES — as CONSUMER

- Depends on `ui-sandbox-frame` (components) for the GenUI wire — unchanged, that arc is closed.
- Depends on `@agent-ui/components`' `ui-*` control descriptors for both catalogs' factories; the
  whole-fleet coverage gate (ADR-0087, `default/index.test.ts`) already accounts for every landed
  control as of this snapshot — `ui-textarea` is a catalog row (`Textarea`), and
  `ui-command-modal`/`ui-toast`/`ui-status-stream`/`ui-theme-provider` are all PERMANENT allowlist
  exclusions with cited ADRs (0112 cl.6, 0117, 0122 F5, 0125 F8) — the "per-control catalog intake"
  item roadmap.md §3 still lists as open appears **already resolved in-tree** (dated comments as old
  as 2026-07-10), a doc-drift worth a small repair pass on the roadmap itself.
- Depends on `@agent-ui/icons`' vendored Phosphor subset for `a2ui-basic`'s `Icon` factory — ADR-0169
  cl.9 names a required regeneration (32 → ~85 glyphs) to cover the 59-identifier upstream enum; not
  independently verified in this pass whether the regeneration has landed (the ADR text describes it
  as part of the same build wave that shipped `a2ui-basic`).
- Consumes `ui-agent-admin` as its live host for the produce loop, Surface Options, and the new
  Catalogs library section (ADR-0170) — any shell-side regression is a direct a2ui blast-radius item.

## 5 · EDGES — as PROVIDER

- `ui-agent-admin` depends on a2ui for: the live produce loop, the progress channel, GenUI parallel
  mount, the Surface Options catalog/GenUI toggle, and now the Catalogs library section for
  default-vs-Basic selection (ADR-0170).
- SaaS/persona patterns depend on catalog write-back fidelity (ADR-0161, shipped and proven live —
  M-B's Hotel Concierge date-range criterion) and IDGRAPH-safe resume semantics (#307, closed on 34
  cumulative clean turns per roadmap.md §3).
- Upstream-conformant external producers/consumers are now a real provider edge for the first time:
  `a2ui-basic` plus the canonical-URI alias mean any A2UI-Basic-speaking client or server can
  interop with this fleet's renderer without translation — the interop claim is test-proven
  (`upstream-fixtures.test.ts` against three pinned upstream payloads), not just asserted.
- GH #453's survey, if ratified, would make this package a **provider of ecosystem contributions**
  for the first time (R5: packaging our validator fixtures as a conformance suite, since upstream
  has none) — a new kind of edge, not yet real.

## Sources checked

- `.claude/docs/adr/0169-a2ui-basic-catalog-upstream-interop.md` (accepted 2026-08-04)
- `gh issue view 429` (closed, E7 gate-encoding), `413` (closed, M-B box 4), `421` (open, per-persona
  catalogs), `438` (open, MCP client deferral), `453` (open, ecosystem survey SPEC), `454`/`455`/`457`/`465`
  (closed, M-A follow-ups, non-a2ui-core)
- `packages/agent-ui/a2ui/src/catalog/{default,a2ui-basic}/` (tree + `catalog.json` component counts)
- `packages/agent-ui/a2ui/corpus/index.json`, `corpus/exemplar/v1_0/agent-ui.jsonl` (24 lines)
- `git log --oneline -20 -- packages/agent-ui/a2ui/src` (ADR-0169/0168 build commits, E7 fix, ADR-0163
  cl.9 table/pagination catalog commit)
- `.claude/docs/roadmap.md` §2 (2026-08-05 arc-status line), §3 (Next), §4 (Later + dated closures)
- `.claude/docs/archive/a2ui-expert-system/{README,NEXT}.md` — confirmed SUPERSEDED 2026-07-12; the
  "a2ui expert system" scope intake roadmap.md §3 footer still lists as parked is this same archived
  charter, not a live document (its content now lives split across `.claude/docs/{spec,lld,prd}/`
  under the harness/corpus/runtime SPECs, all still `accepted`/gate-clean, but the family as a whole
  is not an active build lane — no new work against it this window).
