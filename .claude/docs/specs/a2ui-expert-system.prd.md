# PRD — A2UI Expert System

> Status: proposed · v0.1 · 2026-06-26 · Owner: agent-ui
> Document family: this PRD is upstream of the SPECs in [`specs/`](./specs/) and the LLDs in [`llds/`](./llds/). See [`README.md`](./README.md) for the map + traceability matrix.
> Altitude: this document owns **why + what-should-exist**. Behavior contracts live in the SPECs; implementation in the LLDs. Lower documents reference these goal IDs; they do not restate them.

## 1. Problem

Agents can now drive interfaces directly: **A2UI** (Google's open Agent-to-UI protocol, v0.9, Apache-2.0 — [a2ui.org](https://a2ui.org)) lets an LLM emit a declarative, streamed description of UI that a trusted client renders into native widgets, without the agent running code. The repo's first-party widget set — `@agent-ui/components`, a zero-dependency FACE control family — is a natural A2UI **catalog**: a list of trusted components an agent may request.

But "an agent can emit A2UI" and "an agent reliably emits *correct, idiomatic, composable* A2UI that renders in our controls" are different problems, and the gap is where every team stalls:

- **No first-party runtime.** There is no `@agent-ui/a2ui`: no default catalog mapping A2UI's abstract types onto our `ui-*` controls, and no renderer to turn a stream of A2UI messages into live DOM. Today, standing this up means adopting A2UI's Lit renderer — which violates the repo's zero-dependency invariant — or hand-rolling glue per app.
- **Authoring is unguided and ungraded.** A2UI is a real protocol with real failure modes (a dangling `child` ID, two `root`s, a JSON-Pointer binding to a path the data model never defines, a component type absent from the catalog). Nothing today teaches an author (human *or* agent) the idioms, and nothing scores the output before it ships.
- **Generation is unconditioned.** A2UI's own design expects catalogs to carry `examples` for few-shot, a schema to derive system prompts, and on-the-fly validation with "healing" of partial LLM output. Without a curated **training corpus** of patterns, an agent generates A2UI from zero context and drifts; with an *unmaintained* corpus, it drifts as the catalog evolves and nobody notices.

**Evidence it matters.** A2UI v0.9 ships a security model built entirely on the catalog (the agent may only name pre-approved components), which means *the catalog and the corpus that teaches it are the product's correctness surface* — get them wrong and the agent either can't render or renders the wrong thing. The protocol is explicitly "LLM-friendly" precisely because raw LLM A2UI is error-prone enough to need a flat, ID-referenced, incrementally-streamable shape and SDK-side healing. A zero-dependency repo cannot adopt the upstream renderers, so the runtime gap is structural, not incidental.

**Who has the problem.** (1) *Agent/app builders* on this stack who want agent-driven UI without per-app glue or new runtime dependencies. (2) *Authors* — the human+agent pair producing catalogs, A2UI payloads, and streaming pipelines — who need idioms and a quality bar. (3) *The repo itself*, which must keep catalog, renderer, corpus, and skills coherent as `@agent-ui/components` grows.

## 2. Goals & success metrics

Each goal carries a stable ID and a priority tier. Metrics are baselined at **0 / not-possible-today** unless noted (nothing exists yet); targets are stated against named milestones **A1–A4** (defined in §6). SPEC requirements trace to these IDs.

| ID | Priority | Outcome |
|---|---|---|
| **PRD-G1** | must | Default-catalog generation works end-to-end |
| **PRD-G2** | must | Two-tier extensibility — apps add their own catalog/renderer with zero edits to `@agent-ui/a2ui` |
| **PRD-G3** | must | Authoring is guided by domain skills and graded by rubrics |
| **PRD-G4** | must | Generated A2UI is provably valid before it ships |
| **PRD-G5** | must (flagship) | A maintainable training corpus measurably lifts generation reliability |
| **PRD-G6** | should | The system stays coherent over time (no silent drift) |
| **PRD-G7** | could | A2UI streams interoperate over standard transports (AG-UI / A2A / MCP) |

**PRD-G1 — Default-catalog generation works end-to-end.** An agent emits a streamed A2UI message sequence (`createSurface` → `updateComponents` → `updateDataModel`) that renders through `@agent-ui/a2ui`'s default catalog into `@agent-ui/components` controls, interactive, with no app-specific code.
- *Metric*: share of the default-catalog eval set (representative intents) that renders without error **and** is interactive (actions/bindings fire).
- *Baseline*: 0 — no `@agent-ui/a2ui` exists.
- *Target*: ≥ 95 % valid-and-interactive on the default-catalog eval set.
- *Timeframe*: by milestone **A1**.

**PRD-G2 — Two-tier extensibility.** A consuming app/service defines a *project-specific* catalog + rendering on top of `@agent-ui/a2ui` and uses it to generate output, without forking or editing the package.
- *Metric*: edits required to `@agent-ui/a2ui` to add a project catalog of ≥ 10 component types, and files/LOC per component mapping.
- *Baseline*: not possible today.
- *Target*: **zero** edits to `@agent-ui/a2ui`; ≤ 1 mapping unit per component type; proven by a reference project catalog.
- *Timeframe*: by milestone **A3**.

**PRD-G3 — Guided + graded authoring.** Human+agent authors produce A2UI catalogs, payloads, and streaming pipelines using first-party domain skills, and the artifacts are scored by first-party rubrics.
- *Metric*: (a) rubric score of reference artifacts; (b) skill-routing accuracy on a trigger eval set; (c) inter-author consistency.
- *Baseline*: none — no skills/rubrics exist.
- *Target*: reference artifacts score ≥ 4/5 on every gated rubric dimension; routing ≥ 90 % on the trigger set.
- *Timeframe*: by milestone **A2**.

**PRD-G4 — Provable validity before ship.** Deterministic gates reject non-conformant A2UI (schema violation, multiple/zero `root`, dangling ID references, catalog-absent component or property, invalid JSON-Pointer binding) — judgment never does a machine's job.
- *Metric*: false-pass rate over a labelled invalid-payload set; gate coverage of known failure classes; presence of a schema per catalog.
- *Baseline*: none.
- *Target*: 0 known invalid-payload classes pass; gates run in CI; every catalog ships a machine-checkable schema.
- *Timeframe*: by milestone **A2**.

**PRD-G5 — Maintainable corpus that lifts reliability (flagship).** A curated, versioned training corpus of A2UI patterns conditions generation (few-shot / retrieval / fine-tune) and is repaired automatically when the catalog changes.
- *Metric*: (a) valid-and-interactive render rate **with vs without** corpus conditioning; (b) corpus staleness rate after a catalog version bump.
- *Baseline*: the no-corpus render rate measured at **A1**.
- *Target*: corpus conditioning lifts the PRD-G1 rate by ≥ 10 percentage points over the no-corpus baseline; after a catalog version bump, 0 corpus records remain silently stale (every record re-validates or is flagged by an automated repair loop).
- *Timeframe*: by milestone **A4**.

**PRD-G6 — Coherence over time.** Catalog ↔ renderer ↔ corpus ↔ skills stay in sync; divergence surfaces mechanically as orphans/gaps, not as silent rot.
- *Metric*: traceability coverage across the spec family (orphan/gap count); share of corpus records + catalogs that pin an A2UI protocol version.
- *Baseline*: none.
- *Target*: `trace_check` reports 0 orphans/gaps on the spec family; 100 % of corpus records and catalogs pin a protocol version.
- *Timeframe*: continuous from **A2**.

**PRD-G7 — Transport interop.** A2UI streams ride standard transports and are servable via MCP (self-hosted or CLI-based).
- *Metric*: number of transports with a passing conformance smoke; MCP serving of catalog + corpus retrieval demonstrated.
- *Baseline*: 0.
- *Target*: raw JSONL/stdio **plus** at least one of AG-UI / A2A pass a conformance smoke; one MCP server exposes catalog + corpus retrieval.
- *Timeframe*: by milestone **A3**.

## 3. Scope

### In scope
- **`@agent-ui/a2ui` runtime foundation**: the **default catalog** (maps A2UI abstract component types → `@agent-ui/components` controls) and a **zero-dependency native renderer** that consumes A2UI's streamed server→client messages and progressively builds/updates live DOM, including the data-model binding (JSON Pointer) and action/check handling. *(serves PRD-G1)*
- **The two-tier catalog model**: the extensibility surface by which a project defines its own catalog + renderer over `@agent-ui/a2ui`, plus one reference project catalog as proof. *(PRD-G2)*
- **The expert harness**: authoring **agents** (catalog author, payload/stream composer, corpus curator), domain-expertise **skills** (core component patterns; composability into modules; JSONL + MCP workflows; corpus authoring), eval **rubrics** (A2UI-payload-quality, catalog-quality, corpus-quality), and the deterministic **gates** (schema/catalog/ID-graph/pointer validators). *(PRD-G3, PRD-G4)*
- **Streaming A2UI systems / pipelines / workflows**: producing ordered A2UI message streams, their JSONL serialization, and MCP-based serving/validation/retrieval. *(PRD-G1, PRD-G7)*
- **The training corpus subsystem** (flagship): format, sourcing, quality gating, consumption hooks, maintenance/repair loop, and evaluation. *(PRD-G5)*

### Out of scope (with rationale)
- **Authoring the A2UI standard itself.** We *conform to* Google A2UI v0.9; we do not define or fork the protocol. — *it is an external standard; owning it is not our job.*
- **Adopting A2UI's upstream renderers** (Lit / Angular / Flutter). — *explicitly rejected; they violate the zero-dependency invariant. We ship our own native renderer.*
- **Project-specific catalogs/renderers for real applications.** We ship the default catalog, the extensibility surface, and one reference example only. — *those are downstream consumers built by app teams using PRD-G2; building them all is unbounded.*
- **Model fine-tuning / training infrastructure** (GPUs, training pipelines, eval harness for model weights). — *the corpus may feed fine-tuning, but we own the corpus's format + consumption hooks, not the training ops.*
- **Re-specifying `@agent-ui/components`.** The control family is already owned by [`../plan.md`](../plan.md)/[`../goals.md`](../goals.md); `@agent-ui/a2ui` consumes it. — *one fact, one home.*
- **Backend agent frameworks** (ADK, LangGraph, CrewAI, …). — *we interoperate via transport (PRD-G7); we do not build agent runtimes.*

## 4. Constraints & assumptions

**Constraints** (as of 2026-06-26):
- **C1 — Conform to A2UI v1.0.** The runtime, catalogs, payloads, and corpus target Google A2UI **v1.0** ([a2ui.org](https://a2ui.org); aligns to the v1.0 basic-catalog guide + `v1_0_prompts` eval set) and are protocol-version-aware (version negotiation; every record/catalog pins a version, default `v1.0`). **Caveat:** as of 2026-06-26 v1.0 is a *release candidate* and upstream recommends **v0.9.1** for production — so v0.9.1 is a first-class supported pin and the production-stable fallback; the repair loop migrates across versions. *(Decided 2026-06-26 — supersedes the initial v0.9 anchor.)* v1.0 message-model deltas to honor: `createSurface.surfaceProperties` (was `theme`), the new server `actionResponse` message, `actionId` + `wantResponse` on actions, `Video`/`TextField.placeholder` components, UAX-31 naming + reserved `@` namespace.
- **C2 — Zero runtime dependencies.** `@agent-ui/a2ui` may depend only on `@agent-ui/components` (+ `@agent-ui/shared`); no native form elements; strict, decorator-free TS (`erasableSyntaxOnly` etc.); inward-only layering — per [`../../CLAUDE.md`](../../CLAUDE.md).
- **C3 — Governance via the harness.** Every skill/agent/rubric is authored with the local first-party `authoring-*` / `agent-*` skill family and obeys [`../process.md`](../process.md): true/false → script/hook (never agent judgment); judgment grounds against a small rubric; progressive disclosure.
- **C4 — Documents are authored via the spec family.** PRD → SPEC → LLD, authored with `prd-author/specs/llds`; reference-by-ID, not duplication; traceability is a CI check.

**Assumptions** (as of 2026-06-26):
- **A-1** — A2UI v1.0's message model (catalog, surfaces, the server messages, data-model binding, progressive streaming) is stable enough to build against; cross-version churn is absorbed by version pinning + the corpus repair loop. *Re-verify the v1.0 envelope against the runtime SPEC before A1.*
- **A-2** — `@agent-ui/components` reaches enough coverage (button, text-field, checkbox, switch, select, field) to make the default catalog useful; `@agent-ui/a2ui` cannot outrun the controls that exist (it depends on the component plan reaching ~G7). *Tracks [`../goals.md`](../goals.md).*

## 5. Open decisions

Each is owned by a downstream document. **All five are now resolved by their owners** (recorded here; edit the owner to change one).

| ID | Decision | Resolution | Owner |
|---|---|---|---|
| **PRD-D1** | Primary corpus-consumption mode | **Layered**: static few-shot via catalog `examples` (baseline) · MCP retrieval (scale) · fine-tune (export) | `specs/a2ui-training-corpus.spec.md` (R10–R12) |
| **PRD-D2** | First-class transport | **raw JSONL/stdio default**; AG-UI + A2A as adapters | `specs/a2ui-streaming-pipeline.spec.md` (R3) |
| **PRD-D3** | Default catalog vs A2UI "Basic" | **First-party catalog reflecting `@agent-ui/components` directly** (not a Basic-adapter); names aligned with Basic where they correspond | `specs/a2ui-catalog.spec.md` (R8) |
| **PRD-D4** | Corpus storage substrate | **Flat JSONL in-repo**, sharded by facet+version (revisit > 10⁵ records) | `llds/a2ui-corpus-store.lld.md` (C1) |
| **PRD-D5** | MCP delivery default | **CLI-based** MCP server (self-hosted HTTP optional) | `llds/a2ui-streaming-pipeline.lld.md` (C6) |

## 6. Milestones (for metric timeframes)

Sequencing rationale only; the SPECs own the behavior and the LLDs own the build order. Each milestone gates the next.

- **A1 — Runtime foundation.** Default catalog + zero-dep renderer render a streamed A2UI payload into live, interactive controls. Establishes the PRD-G1 and PRD-G5 baselines. *(depends on `@agent-ui/components` ≈ G7)*
- **A2 — Harness + gates.** Domain skills, rubrics, and deterministic validators exist; authoring is guided and graded; CI rejects invalid payloads. *(PRD-G3, PRD-G4, PRD-G6 begins)*
- **A3 — Pipelines + extensibility.** Streaming pipelines, JSONL + MCP serving, and a reference project catalog over `@agent-ui/a2ui`. *(PRD-G2, PRD-G7)*
- **A4 — Corpus.** The flagship corpus subsystem conditions generation and self-repairs against catalog change. *(PRD-G5)*

## 7. Downstream documents (the series this PRD spawns)

This PRD is refined by the following SPECs (what must be built / how it behaves) and LLDs (how it is built). Status and traceability are tracked in [`README.md`](./README.md).

- `specs/a2ui-runtime.spec.md` — protocol-conformance behavior + the zero-dep renderer contract *(PRD-G1)*
- `specs/a2ui-catalog.spec.md` — catalog model: default catalog + the two-tier extensibility surface *(PRD-G1, PRD-G2, PRD-D3)*
- `specs/a2ui-streaming-pipeline.spec.md` — streaming systems/pipelines/workflows, JSONL, MCP transport *(PRD-G1, PRD-G7, PRD-D2)*
- `specs/a2ui-expert-harness.spec.md` — authoring agents + domain skills + rubrics + deterministic gates *(PRD-G3, PRD-G4)*
- `specs/a2ui-training-corpus.spec.md` — **flagship**: corpus format, sourcing, gating, consumption, maintenance, eval *(PRD-G5, PRD-D1)*

Each SPEC spawns one or more LLDs in `llds/` (renderer, default-catalog mapping, catalog schema/validators, stream codec, MCP server, corpus store, harness wiring).
