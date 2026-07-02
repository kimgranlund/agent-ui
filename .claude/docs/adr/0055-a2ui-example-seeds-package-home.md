# ADR-0055 — example payloads move to a package-owned seed shelf (`src/examples/` + a standing check-time validity gate)

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-02
>
> | Field | Value |
> |---|---|
> | **Status** | accepted *(2026-07-02 — forks F1 [the fine-grained canonical form seed] and F2 [the fault-injection affordance] recommendation-defaulted during the build and CONFIRMED by Kim ("proceed"); ratified by the orchestrator on the green wave gate: check + jsdom 2079 + browser 554/554 both engines; the standing gate examples.test.ts live with its negative control + the stream-narration shape pins; shown ≡ fed ≡ gated holds across all five pages)* |
> | **Date** | 2026-07-02 |
> | **Proposed by** | planner (design seat — the streaming/corpus-seed examples intake) |
> | **Ratified by** | orchestration (the coordinator seat) — 2026-07-02, on the green wave gate; forks confirmed by Kim |
> | **Repairs** | `packages/agent-ui/a2ui/package.json` (gains the `"./examples"` subpath export) · **NEW** `src/examples/*` (seed modules + the gate test) · the four `/site` example pages (payload consts replaced by seed imports) — all edited at build time, gated on this ADR's ratification |
> | **Supersedes / Superseded by** | None. **Relates** the corpus-store LLD (`a2ui-corpus-store.lld.md` — the seeds are its future AUTHORED candidates; admission stays its single write path) · corpus SPEC-R1/R2/R5/R9 (the record fields the seed shape pre-aligns) · ADR-0002 (finalize validation the gate reuses) |

## Context

Every example payload today is page-local and validated at RUNTIME only: the four `/site` A2UI pages
(canvas · dynamic list · generative form · patterns) each inline their `A2uiServerMessage[]` consts, and
`site/` sits outside the vitest include (`packages/agent-ui/*/src/**`) — so "every demo payload MUST be
validator-clean" is enforced by nothing at check time (the gap both page builders flagged). Meanwhile the
training-corpus SPEC needs exactly these payloads as its first AUTHORED exemplars (corpus SPEC-R5), and the
next example page (streaming) wants to REUSE the generative-form payload — a second inline copy would be
the first payload fork. One home must serve all three pulls without rivaling the corpus store's storage
layer (`corpus/exemplar/**.jsonl`, single-writer admission).

## Decision

We will move the example payloads into a **package-owned seed shelf** with a standing gate:

1. **Home: `packages/agent-ui/a2ui/src/examples/`** — typed TS modules (one per example family:
   `canvas-button` · `dynamic-lists` · `generative-form` · `patterns`), exporting `ExampleSeed` records:
   `{ name, description, promptText, surfaceId, protocolVersion: 'v1.0', catalogId: 'agent-ui',
   messages: readonly A2uiServerMessage[] }`. The first four fields pre-align field-for-field with
   `CorpusRecord` (corpus SPEC-R1/R9), and `messages` is the future `a2uiOutput` — a seed IS an authored
   admission candidate awaiting the store.
2. **Seed shelf, not store:** the seeds are SOURCE (authored, reviewed, type-checked); the corpus store's
   `corpus/exemplar/**.jsonl` remains the only admitted DATA, written exclusively by the admission
   pipeline (store invariant). When the store lands, a seed-import script maps `ExampleSeed` →
   `CorpusRecord` candidates (`provenance: {source:'authored', origin:'src/examples/<name>.ts'}`) and runs
   them through `admit()` — the single write path holds.
3. **Exposure: a `"./examples"` subpath export**, NOT the root barrel — payload JSON must never enter a
   renderer consumer's bundle. The site pages import `@agent-ui/a2ui/examples` (resolved through the
   workspace `exports` map, the proven vite path; zero vite-config edits).
4. **The standing gate: `src/examples/examples.test.ts`** — inside the vitest include by construction.
   For every exported seed: (a) `validateA2ui(messages, defaultCatalog)` verdict is valid (the shared
   spine, SPEC-N3 parity); (b) a jsdom renderer smoke — `createRenderer` → `mount` → `ingest` each message
   as a JSONL line (dogfooding the line path) → `finalize(surfaceId)` — asserts ZERO error messages on the
   client channel. Runtime-only validation becomes check-time.
5. **Migration:** the four pages replace their payload consts with seed imports; shown≡fed strengthens
   (the shown, the fed, and the gated objects are now the SAME objects). The canvas page's two
   `callFunction` RPC literals (`ping` / `required`) stay PAGE-LOCAL — they are protocol probes (one
   expects a rejection), not surface-content exemplars, and the shared validator does not yet know the
   `callFunction` envelope. The generative-form seed is re-sliced into a fine-grained message sequence
   (several `updateComponents` lines) so one canonical seed serves both the form page and the streaming
   page's line-by-line feed.

## Consequences

- **Payloads become single-owner and drift-proof** — but page-local pedagogy (blurbs, step labels,
  proves/teaches notes) stays in `site/`; the package owns only the wire objects. A page needing a payload
  tweak now edits the package (a heavier touch, deliberately: payload changes should face the gate).
- **The gate makes invalid demo payloads a RED build**, closing the flagged gap with zero vitest-config
  change. Cost: the a2ui test suite now imports the controls barrel per smoke (already true of
  catalog/renderer tests — marginal).
- **The seed shape is a pre-alignment, not a dependency:** nothing in `src/examples/` imports corpus code
  (none exists); if the corpus record schema shifts at store-build time, the import script absorbs it —
  the seeds' fields are the stable subset (name/description/promptText/pins/output).
- **The re-sliced form seed lengthens the form page's payload pane** (more, smaller messages) — accepted:
  the finer sequence is MORE honest to what an agent streams, and it is what makes the streaming page's
  reuse drift-free.
- **A discovered parity gap is recorded, not papered over:** `renderer/validate.ts`'s `MESSAGE_KINDS`
  omits the `callFunction` envelope that `dispatch.ts` routes (runtime SPEC-R14, shipped ADR-0034) — the
  shared validator would call a spec-legal stream SCHEMA-invalid. The seeds sidestep it (RPC literals stay
  page-local), and the widening is scheduled as its own small build slice; it needs no ADR (it completes a
  ratified contract).
- **Stale → re-verify:** the four page modules · `package.json` exports · the vitest-alias caveat (a
  cross-package TEST importing `@agent-ui/a2ui/examples` would need a more-specific alias row FIRST — the
  `@agent-ui/components/components` prefix-match precedent; package-internal tests import relatively and
  need nothing).

## Acceptance

- `npm test` includes the examples gate: every seed validates 0-failure AND renders through the real host
  with an empty error channel; a deliberately-broken fixture (negative control, not exported) fails it.
- `npm run check` (incl. `check:site`) green with all four pages importing seeds; the rendered pages are
  behavior-identical (the same objects flow).
- A consumer importing only `@agent-ui/a2ui` (root barrel) tree-shakes to ZERO examples bytes; the
  `"./examples"` subpath resolves in the site build.
- Grep proof: no `A2uiServerMessage[]` payload const remains in `site/pages/*.ts` except the canvas RPC
  literals and the streaming page's labeled fault-injection line.

## Alternatives considered

- **Seed the corpus store's JSONL shards directly (`corpus/exemplar/v1_0/agent-ui.jsonl`)** — rejected:
  the admission pipeline (heal/canonicalize/dedup/admit) is unbuilt, and hand-writing store data would
  break its single-writer invariant before it exists; pages importing raw JSONL also lose TS typing
  against `protocol.ts`.
- **A `site/`-side shared payload module + widening the vitest include to `site/**`** — rejected: leaves
  the payloads outside the package that owns the protocol types, inverts the dependency direction the
  corpus needs (package ← site), and widens the test include for one file.
- **Re-exporting examples from the root barrel** — rejected: demo payload JSON in every consumer bundle;
  the subpath keeps the consumer surface clean (the `components/components` precedent).
- **Duplicating the form payload into the streaming page** (no shared home) — rejected: the first payload
  fork; the two copies WILL drift and the streamed demo would silently stop matching the form page.
