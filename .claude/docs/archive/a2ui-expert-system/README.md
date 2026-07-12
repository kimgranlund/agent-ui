# A2UI Expert System — spec family (ARCHIVED charter)

> **SUPERSEDED 2026-07-12 (repo-alignment Phase 1):** the tree this README mapped dissolved into
> the unified doc map — its specs live in `../../spec/`, LLDs in `../../lld/`, the PRD in
> `../../prd/a2ui-expert-system.prd.md`, the decomposition in `../../decompositions/`. Kept as the
> family's historical charter; the status table below reflects 2026-07-08.

> The PRD → SPEC → LLD document family for the **A2UI Expert System**: a first-party runtime (`@agent-ui/a2ui`), a harness of authoring agents + domain skills + eval rubrics + deterministic gates, and a training corpus — for authoring streaming A2UI (Google A2UI v0.9) against this repo's zero-dependency controls.
> Authored via the `prd-author/specs/llds` skills. Altitude discipline and sync mechanics: see [`../process.md`](../../process.md) and each skill's `references/document-relationships.md`.

## How to read this

- **[`a2ui-expert-system.prd.md`](../../prd/a2ui-expert-system.prd.md)** — start here. Owns *why + what-should-exist*: the problem, goals (`PRD-G#`), scope, constraints, open decisions (`PRD-D#`), milestones (A1–A4).
- **[`specs/`](../../spec/)** — owns *what must be built / how it behaves*. Each SPEC requirement (`SPEC-R#`) traces up to a `PRD-G#`.
- **[`llds/`](../../lld/)** — owns *how it is built*. Each component (`LLD-C#`) traces up to a `SPEC-R#`.

One fact, one home: lower documents reference upper IDs, they never restate them. Change a fact by editing its owner, then propagate down.

## Document map & status

| Doc | Layer | Owns | Traces to | Status |
|---|---|---|---|---|
| `a2ui-expert-system.prd.md` | PRD | the whole system: intent, goals, scope | — | ✅ drafted v0.1 |
| `specs/a2ui-runtime.spec.md` | SPEC | protocol conformance + zero-dep renderer behavior | PRD-G1 | ✅ drafted v0.1 (gate-clean) |
| `specs/a2ui-catalog.spec.md` | SPEC | default catalog + two-tier extensibility | PRD-G1, G2 · D3 | ✅ drafted v0.1 (gate-clean) |
| `specs/a2ui-streaming-pipeline.spec.md` | SPEC | streaming pipelines, JSONL, MCP transport | PRD-G1, G7 · D2 | ✅ drafted v0.1 (gate-clean) |
| `specs/a2ui-expert-harness.spec.md` | SPEC | authoring agents + skills + rubrics + gates | PRD-G3, G4 | ✅ drafted v0.1 (gate-clean) |
| `specs/a2ui-training-corpus.spec.md` | SPEC | **flagship** corpus: format→eval | PRD-G5 · D1 | ✅ drafted v0.1 (gate-clean) |
| `specs/a2ui-live-agent.spec.md` | SPEC | the live-agent example: real LLM → validated stream → render → round-trip; the transport seam + deterministic backbone + security posture (VITE_ build-key-safety) + the model-provider seam | PRD-G1, G7 (realizes pipeline R2 + harness R6) | accepted v0.1 (gate-clean; ADR-0069–0073 accepted) |
| `llds/a2ui-renderer.lld.md` | LLD | zero-dep renderer internals (+ shared `validate.ts`) | (a2ui-runtime) | ✅ drafted v0.1 (gate-clean) |
| `llds/a2ui-catalog.lld.md` | LLD | default-catalog mapping + `catalog.json` schema + registry + validators | (a2ui-catalog) | ✅ drafted v0.1 (gate-clean) |
| `llds/a2ui-streaming-pipeline.lld.md` | LLD | JSONL codec + transports (stdio/AG-UI/A2A) + MCP serving | (a2ui-streaming-pipeline) | ✅ drafted v0.1 (gate-clean) |
| `llds/a2ui-corpus-store.lld.md` | LLD | corpus storage, dedup, versioning, repair | (a2ui-training-corpus) | ✅ drafted v0.1 (gate-clean) |
| `llds/a2ui-harness-wiring.lld.md` | LLD | agent/skill/rubric/gate orchestration | (a2ui-expert-harness) | ✅ drafted v0.1 (gate-clean) |
| `llds/a2ui-live-agent.lld.md` | LLD | live-agent module map (site/tools, zero package additions) + backbone contract + round-trip state machine; realizes pipeline LLD-C2 `produce()` | (a2ui-live-agent) | accepted + REALIZED v0.4 (ratified 2026-07-04; realized 2026-07-05) |

## Traceability matrix

The join-key table that turns "are these in sync?" into a coverage check. A `PRD-G#` with no `SPEC-R#` is a gap; a `SPEC-R#` with no `PRD-G#` is scope creep; a `SPEC-R#` with no `LLD-C#`/test is unimplemented. Run `python ../../.claude/skills/prd-author/scripts/trace_check.py <prd> <spec> <lld>` to check mechanically.

| PRD goal | SPEC requirements | LLD components | Status |
|---|---|---|---|
| PRD-G1 | runtime SPEC-R1–R13 · catalog SPEC-R1,R3–R5 · pipeline SPEC-R1,R2,R8 | renderer LLD-C1–C13 · catalog LLD-C1–C8 · pipeline LLD-C1–C3 | **covered** |
| PRD-G2 | catalog SPEC-R6 · runtime SPEC-R9 | catalog LLD-C3 · renderer LLD-C7 | **covered** |
| PRD-G3 | harness SPEC-R1,R2,R5,R6,R7 | harness LLD-C1,C2,C5,C6 | **covered** |
| PRD-G4 | corpus SPEC-R8,R14 · runtime SPEC-R11 · catalog SPEC-R7,R9 · harness SPEC-R3,R4,R8 | corpus LLD-C5,C6 · renderer LLD-C11 · catalog LLD-C6 · harness LLD-C3,C4,C7 | **covered** |
| PRD-G5 | corpus SPEC-R2,R5–R8,R10–R16 | corpus LLD-C1–C12 | **covered** |
| PRD-G6 | corpus SPEC-R1,R9,R13,R16 · runtime SPEC-R13 · catalog SPEC-R2 · harness SPEC-R4,R7 · pipeline SPEC-R7 | corpus LLD-C1,C2,C11 · catalog LLD-C2 · harness LLD-C4,C7 · pipeline LLD-C7 | **covered** |
| PRD-G7 | pipeline SPEC-R3–R6 · corpus SPEC-R11 · runtime SPEC-R12 | pipeline LLD-C3–C6 · corpus LLD-C13 · renderer LLD-C12 | **covered** |

_All 7 PRD goals are now served by a drafted SPEC + LLD (0 family-level gaps). Each vertical is internally gate-clean (every `SPEC-R`→`LLD-C`, every doc passes its `harness_checks`). Open decisions PRD-D1–D5 are resolved by the owning specs (see PRD §5)._
