# A2UI — the current frontier

> The living state-of-the-build note for `@agent-ui/a2ui`. **The ground truth is always
> `git log -- packages/agent-ui/a2ui/` + the realized modules and their co-located probes** — this
> file only orients; when it disagrees with the tree, the tree wins and this file gets repaired.
> Build seat: the **`a2ui-builder`** agent (`.claude/agents/a2ui-builder.md`) — one unit per
> dispatch, spec-faithful, escalates protocol-silence to the host. · updated 2026-07-02

## Realized (verified against the tree, 374 tests green across 24 files)

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

## Open (the real next intakes, in likely order)

1. **The corpus STORE** — `a2ui-corpus-store.lld.md` is designed but unrealized (`corpus/` holds
   only the validation half). Admission rides the shared spine (N6).
2. **The streaming pipeline tail** — RECONCILED at v0.2 (2026-07-02): every CONSUMER-side streaming
   behavior is realized in the renderer (parse/fault-isolation/arrival-order/render-on-root); the
   pipeline's OWN scope (codec · driver · transports · MCP — LLD-C1..C7) is entirely unbuilt and
   stays deliberately unscoped until a producer need arrives. The fabricated "renderer heal.ts"
   citations were excised — healing belongs to the corpus store's ONE shared healer (its LLD-C7).
   The STREAMING EXAMPLE shipped (`site/a2ui-stream` — root-early vs root-last on the shared seed,
   the live first-paint metric, mid-stream fault isolation).
3. **The expert harness** — `a2ui-expert-harness.spec.md` + `a2ui-harness-wiring.lld.md`
   (rubrics + wiring; unrealized).
4. ~~G7-unblocked integration work~~ — **DONE 2026-07-02** (ADR-0053/0054, decomp
   `a2ui-form-catalog-examples`): six catalog rows (Field · FormProvider · Checkbox · Switch ·
   Select · Option) + the 12-type TextField reach + the submit-gated action; the examples suite is
   now FOUR pages (canvas · dynamic list · **generative form** · **patterns**), all wired into the
   dual TOC. Follow-ups it minted: a `danger` Button tone (the P2 confirmation pattern exposed the
   gap — components backlog) · a check-time demo-payload validity gate (site payloads validate at
   runtime only; a package-side corpus probe is the candidate home) · defer `<ui-calendar>` element
   creation to first-open (ADR-0048's lazy spirit; the eager element is guarded but still built).
5. **The live-agent example** — the ladder's last rung (streaming SHIPPED 2026-07-02, item 2): a
   real LLM emitting A2UI over the wire — prompt → streamed payload → rendered surface → the human
   interacts → client messages return → the agent continues. Rides item 3's harness + item 1's
   corpus (whose seed shelf now exists: ADR-0055 — the seeds ARE the store's authored admission
   candidates, field-aligned with CorpusRecord). Also shipped this wave: ADR-0056 (the region-less
   card humane default + the container pedagogy) · the validator/dispatch envelope parity closed ·
   `type=date`'s calendar now built on first-open.

## How to start a unit

Dispatch `a2ui-builder` with the unit's `SPEC-R#`/`LLD-C#` IDs. For anything needing a NEW
decision: `system-planner` first (decomposition + ADR), per the operating model. Cross-package
needs (a component-side prop/event) escalate to `component-builder` territory via the coordinator.
