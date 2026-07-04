# ADR-0002 — Validator parity: missing-root in id-graph, finalize granularity, syntactic-only pointer

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-06-26
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-06-26 *(authored + ratified)* |
> | **Proposed by** | planning-lead — encoding two host-ratified parity rulings; the granularity pin was flagged by execution-lead (false-positive risk) |
> | **Ratified by** | orchestration-lead |
> | **Repairs** | renderer `LLD-C11` (§8 pipeline + parity), renderer `LLD-C13` (§11 step 11 host granularity), renderer §9 `IDGRAPH` row · corpus `LLD-C5`/`LLD-C6` (§6 pipeline, §7 surface, §8 `E_POINTER` rows). *(No edit: corpus `LLD-C3` already asserts "exactly one root"; runtime `SPEC-R11` + corpus `SPEC-R8` wording stay accurate.)* |
> | **Supersedes / Superseded by** | *(none)* |

## Context

The shared validator `validateA2ui` is one implementation with two callers — the renderer (renderer `LLD-C11` / `validate.ts`) and corpus admission tier-1 (corpus `LLD-C6`, which re-exports it) — and that parity is a normative invariant (runtime `SPEC-N6`, corpus `SPEC-N1`/`SPEC-R8 AC3`). Preparing A1's validation spine (ADR-0001) surfaced three places where the two callers could silently disagree or where a caller would violate its own SPEC:

1. **Missing-root.** A payload that delivers components but never a `root`. The renderer `LLD-C13` (host) error table (§9) enumerated `IDGRAPH` for "2nd `root`, cycle, or dangling" but **not** missing-root; corpus canonicalization (`LLD-C3`) already used "exactly one `root`" / "≠1 `root`". So a no-root payload could pass the renderer's id-graph and fail the corpus's — a parity break.
2. **Granularity (execution-lead's flagged false-positive).** Id-graph run per incremental `updateComponents` message would wrongly reject a payload whose `root` or a `child` has not *yet* arrived — but SPEC-R4 (out-of-order tolerance) makes those legal *transient* states mid-stream.
3. **Pointer resolution.** Corpus `LLD-C8` §8 stated the shared validator rejects a "JSON-Pointer that does not resolve against the data model shape." But the renderer treats an undefined `path` as a placeholder, not an error (SPEC-R4 AC2) — it streams, so the data may arrive later. If `validateA2ui` did resolution, the renderer would either violate R4 AC2 or diverge from corpus (breaking N6).

## Decision

We reconcile by repairing the **owning LLDs** (the contradiction lived in LLD detail, not in any SPEC):

1. **Missing-root is an `IDGRAPH` failure** in the shared id-graph stage — renderer `LLD-C11` (§8) and the §9 `IDGRAPH` row now read "**missing** `root`, 2nd `root`, cycle, or dangling." Corpus already agrees ("≠1 `root`"), now annotated to name the shared rule. Renderer and corpus return the same verdict on a no-root payload.
2. **Id-graph granularity is pinned to a complete output / finalize.** All id-graph checks (missing-root, dangling, cycle, 2nd-root) evaluate a **complete** component set; the renderer host (`LLD-C13`) invokes `validateA2ui` id-graph at **finalize**, never per-message (renderer §8 + §11 step 11). `LLD-C4` keeps an in-stream eager guard only for the *always*-invalid 2nd-root/cycle (SPEC-R3 AC2); missing-root and dangling are finalize-only. The corpus naturally runs it on a record's complete `a2uiOutput` — so both judge the same set.
3. **The shared validator checks JSON-Pointer *syntax* only (RFC-6901), never resolution** (renderer `LLD-C11` §8) — preserving SPEC-R4 AC2. The "does not resolve against the data model" check is reframed as a **corpus-admission-only stage** (`LLD-C5`) layered *on top of* `validateA2ui`, not part of it (corpus §6/§7/§8). It is legitimate because an exemplar bundles its complete data model (so resolution is checkable) while the renderer streams (so an unresolved path is a placeholder, not an error).

`validateA2ui` stays byte-identical for both callers (N6/N1); the stages only one caller adds — the renderer's incremental render, the corpus's pointer-resolution / dedup / leak / quality — sit *outside* the shared verdict.

## Consequences

- **A1 unblocks cleanly.** `validate.ts` (renderer `LLD-C11`, the ADR-0001 spine) now has a precise, parity-safe contract: id-graph = exactly-one-root / acyclic / no-dangling on a complete set; pointer = syntactic. Corpus admission imports it unchanged and adds its resolution/dedup/leak/quality stages on top.
- **The host carries a calling-convention constraint:** id-graph at finalize, never per-message. `execution-lead` must wire `LLD-C13` that way; the §9 row + §11 step-11 note are the test matrix.
- **Negative — two id-graph granularities.** A 2nd-`root`/cycle errors *eagerly* in-stream (`LLD-C4`); a missing-`root`/dangling errors only at *finalize* (`LLD-C11`). The distinction is explicit in §9 but is a place to get wrong; it needs both a mid-stream and a finalize test case.
- **Negative — `E_POINTER` now has two raising stages** (syntax in the shared validator; resolution in the corpus-only stage) under one code; the corpus §8 table distinguishes them by stage. Deliberately **no new error code** (so no corpus SPEC edit).
- **Propagation:** dependents are `execution-lead`'s `validate.ts` + `surface.ts` build and the corpus admission pipeline. No other document regenerates; no SPEC requirement changed.

## Alternatives considered

- **Make the shared validator resolve pointers against the data model** — rejected: the renderer streams, so resolution-at-validate would violate SPEC-R4 AC2 (undefined path = placeholder) and break N6 (renderer and corpus would disagree on a not-yet-resolved path).
- **Run the full id-graph per `updateComponents` message in the renderer** — rejected: SPEC-R4 makes missing-root/dangling legal transient states mid-stream; per-message id-graph would false-positive (the execution-lead flag).
- **Add a new error code `E_POINTER_UNRESOLVED` for the resolution stage** — rejected: error codes are corpus-SPEC-owned; the existing `E_POINTER` plus a stage distinction in the LLD §8 table covers it without SPEC churn for a single-caller stage.
- **Leave corpus §8 "resolve against data model" inside tier-1 (shared)** — rejected: that *is* the contradiction; it forces the renderer to either break R4 AC2 or diverge from corpus (break N6).
- **Repair runtime SPEC-R11 / corpus SPEC-R8 instead of the LLDs** — rejected: neither owns a contradicted fact. SPEC-R11's "schema/catalog/idgraph/pointer failure" stays accurate (idgraph subsumes missing-root; pointer-failure is syntactic); corpus SPEC-R8's "single-`root` + valid JSON-Pointer bindings" already reads correctly. The defect lived only in LLD detail — repair the owner there.
