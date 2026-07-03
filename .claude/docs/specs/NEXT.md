# A2UI — the current frontier

> The living state-of-the-build note for `@agent-ui/a2ui`. **The ground truth is always
> `git log -- packages/agent-ui/a2ui/` + the realized modules and their co-located probes** — this
> file only orients; when it disagrees with the tree, the tree wins and this file gets repaired.
> Build seat: the **`a2ui-builder`** agent (`.claude/agents/a2ui-builder.md`) — one unit per
> dispatch, spec-faithful, escalates protocol-silence to the host. · updated 2026-07-03

## Realized (verified against the tree, 605 tests green across 35 files in the a2ui package)

- **A1 runtime foundation** — the shared validation spine (`renderer/validate.ts` +
  `corpus/validate.ts`, SPEC-N6 parity) + `surface.ts`/`parser.ts` (streamed payload parse) +
  `tree.ts`/`renderer.ts`/`widget.ts`/`types.ts`.
- **The full binding arc** — `binding.ts` (per-path waking via Object.is + structural sharing) ·
  `interpolate.ts` (ADR-0027 `${…}`) · `fn-expr.ts` (ADR-0028) · `functions.ts` + `@index`
  (ADR-0026) · `checks.ts` (ADR-0029 → `setCustomValidity`) · `input.ts` (LLD-C8 two-way) ·
  `list.ts` (LLD-C6 positional reconcile, ADR-0024) · `action.ts`/`dispatch.ts` (ADR-0011) ·
  `call-function.ts` (ADR-0034, `callableFrom` most-restrictive-wins) · the two-code wire-error
  boundary (ADR-0031).
- **Catalog** — `catalog/` (catalog + conformance + naming + registry + `default/`), bound
  directly to `ui-*` factories (SPEC-R8); the G9 container types + the canvas demo shipped.
- **The components dependency (PRD Assumption A-2 ≈ G7) is SATISFIED** — G7 completed 2026-07-01
  (`ui-field` + `ui-form-provider` + the keyboard-proven end-to-end form; goals §G7 DONE).
- **The corpus STORE** — **DONE 2026-07-03** (ADRs 0060–0064, `a2ui-corpus-store.lld.md` v0.5,
  decomp `a2ui-corpus-store` v5). The full admission pipeline is realized: `record.ts` (schema +
  SPEC-R2/AC3 single-surface rule) · `canonical.ts` (async crypto.subtle hash, order/whitespace/
  ID-spelling invariant) · `heal.ts` (ADR-0061's closed, form-only repair list — the fleet's ONE
  shared healer, ready for the future streaming codec) · `dedup.ts` (exact + MinHash θ=0.9
  inclusive) · `store.ts` (byte-stable JSONL, quarantine exclusion) · `admit.ts` (validate → heal
  → dedupe → record, the §8 error table as its test matrix, an injected-judge seam that fails
  closed on the eval facet until the harness exists) · `retrieve.ts` (TF-IDF top-k, hard
  exemplar-only eligibility) · `export.ts` (fine-tune JSONL + catalog-examples, the latter built
  against a **host-verified** upstream shape — google/A2UI's `dataset_schema.json` +
  `schema/manager.py`/`catalog.py`, cited verbatim in the test fixture). Exposed at the
  `"./corpus"` subpath (`src/corpus/index.ts`); root barrel proven corpus-byte-free tree-wide.
  The 11-seed shelf (ADR-0055) is imported and committed (`corpus/exemplar/v1_0/agent-ui.jsonl`),
  guarded by a standing check-time gate (`corpus-data.test.ts`) — this also closes the
  `danger`-tone item below's sibling ask, the package-side corpus probe. Independent review: GO,
  zero blocker/major; two LATENT minors booked below.

## Open (the real next intakes, in likely order)

1. **The expert harness** — `a2ui-expert-harness.spec.md` + `a2ui-harness-wiring.lld.md`
   (rubrics + wiring; unrealized). Inherits four surfaces from the corpus store, all behind
   `@agent-ui/a2ui/corpus`: `validateA2ui` (the admission/runtime/CI parity anchor) · `heal` (the
   SAME closed healer, so pre-scoring healing and admission grade intent, not formatting) ·
   `retrieve`/`exportCatalogExamples` (conditioning material) · the ADR-0060 judge seam (the
   harness's corpus-quality rubric is the FIRST real tier-2 judge — plugging it in activates
   E_QUALITY and can back-score phase-1's unjudged records via the absent `qualityScore` marker).
   The harness's first eval set is authored held-out prompts admitted only once its own
   contamination guard (corpus LLD-C8) lands — phase 1 ships no eval facet at all (fail-closed).
2. **The streaming pipeline tail** — RECONCILED at v0.2 (2026-07-02): every CONSUMER-side streaming
   behavior is realized in the renderer (parse/fault-isolation/arrival-order/render-on-root); the
   pipeline's OWN scope (codec · driver · transports · MCP — LLD-C1..C7) is entirely unbuilt and
   stays deliberately unscoped until a producer need arrives. Healing belongs to the corpus store's
   ONE shared healer (`corpus/heal.ts`, ADR-0061 — now realized, text-first signature designed for
   per-line codec reuse). The STREAMING EXAMPLE shipped (`site/a2ui-stream` — root-early vs
   root-last on the shared seed, the live first-paint metric, mid-stream fault isolation).
3. ~~G7-unblocked integration work~~ — **DONE 2026-07-02** (ADR-0053/0054, decomp
   `a2ui-form-catalog-examples`): six catalog rows (Field · FormProvider · Checkbox · Switch ·
   Select · Option) + the 12-type TextField reach + the submit-gated action; the examples suite is
   now FOUR pages (canvas · dynamic list · **generative form** · **patterns**), all wired into the
   dual TOC. Follow-ups it minted: a `danger` Button tone (the P2 confirmation pattern exposed the
   gap — components backlog; still open) · ~~a check-time demo-payload validity gate~~ — **DONE**,
   see the corpus store's `corpus-data.test.ts` above · defer `<ui-calendar>` element creation to
   first-open (ADR-0048's lazy spirit; the eager element is guarded but still built — still open).
4. **The live-agent example** — the ladder's last rung (streaming SHIPPED 2026-07-02, item 2): a
   real LLM emitting A2UI over the wire — prompt → streamed payload → rendered surface → the human
   interacts → client messages return → the agent continues. Rides item 1's harness + the corpus
   store's `retrieve()` for its few-shot conditioning (over the SAME 11 seed payloads the example
   pages render — shown ≡ fed ≡ retrieved). Also shipped this wave: ADR-0056 (the region-less
   card humane default + the container pedagogy) · the validator/dispatch envelope parity closed ·
   `type=date`'s calendar now built on first-open.

## Corpus-store follow-ups (from the 2026-07-03 wave, all latent/safe-direction — none blocking)

- `admit.ts`'s `computeScopes` lacks the absolute-path short-circuit `renderer/binding.ts`'s
  `scopedPointer` has — a nested dynamic-list with an absolute INNER template path would be
  mis-scoped and false-rejected E_POINTER. No seed reaches this; fix is a one-line mirror of the
  `startsWith('/')` branch.
- `admit.ts`'s `findUnresolvedPointers` scans disconnected components that `canonical.ts` drops —
  an orphan component with an unresolvable relative binding is rejected though the renderer never
  mounts it. Safe-direction (over-strict), latent.
- The purity-grep tests in `index.test.ts` key on `from\s+['"]`, blind to dynamic `import()` —
  harmless today (zero exist under `src/corpus/`), a future-violation blind spot only.
- `corpus-data.test.ts`'s standing gate re-validates schema/tier-1/hash but not admission's
  pointer-RESOLUTION stage — a hand-edited shard line could pass the gate while failing `admit()`.
- `catalog/default/index.ts`'s bare `import catalogDoc from './catalog.json'` fails under Node's
  native ESM loader (`ERR_IMPORT_ATTRIBUTE_MISSING`, ESM wants an explicit `type:'json'` import
  attribute Node won't infer) — worked around Node-shell-side in `tools/corpus/import-seeds.ts`;
  a `with {type:'json'}` fix upstream is components/catalog territory, not a2ui's.
- No `@agent-ui/a2ui` line-item exists in `scripts/measure-size.mjs` — acceptable by construction
  today (no consumer bundle carries corpus bytes; the package is in-repo-only); mint one at the
  first external consumer of `@agent-ui/a2ui`, per ADR-0040 §3's manual-size discipline.

## How to start a unit

Dispatch `a2ui-builder` with the unit's `SPEC-R#`/`LLD-C#` IDs. For anything needing a NEW
decision: `system-planner` first (decomposition + ADR), per the operating model. Cross-package
needs (a component-side prop/event) escalate to `component-builder` territory via the coordinator.
