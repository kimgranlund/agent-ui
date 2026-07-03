# ADR-0063 — the corpus record aligns to the verified upstream `dataset_schema.json`: unconditional `description`, `target` defaults to `description`, `E_NO_TARGET` retired, interop = projection onto the upstream field set

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-03
>
> | Field | Value |
> |---|---|
> | **Status** | accepted *(2026-07-04 — ratified on Kim's "proceed"; the reversal was independently host-verified against the live google/A2UI `dataset_schema.json` before this ADR was written [C1 evidence], not merely inferred; `record.ts` ships the corrected contract with the retired `E_NO_TARGET` code grep-clean under `src/corpus/**`.)* |
> | **Date** | 2026-07-03 |
> | **Proposed by** | planner (design seat — ruling on the host-verified upstream schema facts) |
> | **Ratified by** | orchestration (host), 2026-07-04 — on Kim's "proceed" + the green wave gate |
> | **Repairs** | corpus SPEC v0.4 — R1 AC1/AC2 · R2 + AC2 · §5.1 `required`/`allOf` · §5.3 (`E_NO_TARGET` row removed) · R16 AC1 note · §7 open item resolved — and corpus LLD v0.3 — §0/§3/§6/§8/§11/§13 (all edited this change) · `src/corpus/record.ts` + `record.test.ts` (build-time follow-up, s1 builder, gated on ratification) · decomp `a2ui-corpus-store` v3 (n3/n8 accepts) |
> | **Supersedes / Superseded by** | **Reverses the SPEC-v0.3 eval/target carve-out** (a doc repair, not an ADR — nothing to supersede) · relates ADR-0060 (fail-closed eval is why this lands at near-zero cost) · relates the repo-absence ≠ spec-absence discipline |

## Context

SPEC v0.3 (2026-07-03, earlier the same day) resolved an internal schema contradiction in favor of an
eval/target carve-out: `description` required for every record EXCEPT an eval-facet record carrying
`target`. That reading was flagged as unverifiable from the repo (§7 open item: "host fetch to verify").
The host fetched the authoritative source — **google/A2UI@main, `eval/datasets/dataset_schema.json`** —
and the verbatim facts falsify the carve-out and more:

1. `"required": ["name", "description", "promptText"]` — upstream requires `description`
   **unconditionally**.
2. `target`: "The expected outcome or grading criteria… **If omitted, defaults to the value of
   `description`.**" — upstream has **no missing-target failure mode**; `description` IS the fallback
   target.
3. `"additionalProperties": false` on items — a record projected for upstream may contain **only** the
   7 upstream fields; `a2uiOutput` is NOT among them, so SPEC-R1 AC1's "stripping the curation-metadata
   block" (strip `meta` only) fails upstream validation for **every exemplar record**, carve-out or not.
4. The schema's top level is `"type": "array"` — an upstream dataset file is one JSON **array** of
   samples, not JSONL.

Constraint **C1** (the SPEC §1: external A2UI facts are conformed to, not redefined) plus SPEC-R1 AC1 and
SPEC-R16 make these facts binding. Mitigation: ADR-0060's fail-closed eval facet means the carve-out is
currently dead code — the record contract can be corrected before s6 (admission) builds against it.

## Decision

We will align the corpus record contract to the verified upstream schema (SPEC → v0.4, corpus LLD → v0.3,
both repaired in this change):

1. **`description` is unconditionally required** — the v0.3 carve-out is reversed. §5.1's top-level
   `required` returns to `["name","description","promptText","meta"]`; the eval `anyOf(target,
   description)` branch is **removed** (not merely unreachable); the exemplar branch returns to requiring
   `["a2uiOutput"]` alone. R1 AC2 reverts to the unconditional trio → `E_SCHEMA`.
2. **`target` stays optional with the upstream fallback semantic made explicit** (SPEC-R2): an eval
   record's effective judge target is `target ?? description`. The fallback is a **consumer rule** (the
   tier-2 judge / LLD-C12 scoring read it), not a validation rule — validation only type-checks `target`
   when present.
3. **`E_NO_TARGET` is retired** from the §5.3 normative vocabulary, the LLD-C2/C5 stages, and the
   `AdmitCode` union: with `description` always present, an effective target always exists — the code is
   unreachable by construction, and upstream's own semantics never fail on a missing target. This ADR is
   its tombstone; the vocabulary carries no dead row.
4. **R1 AC1's interop check becomes a projection**: validating upstream means projecting the record onto
   the upstream 7-field surface — dropping `meta` AND (for exemplars) `a2uiOutput` — because upstream
   sets `additionalProperties: false`. The exporter/interop surfaces own that projection.
5. **The upstream array-form fact is recorded** where the deferred waves will need it (LLD §11 / SPEC-R16
   note): a decrypted eval slice must reach the upstream harness as one JSON array; whether the at-rest
   `.enc` form is the array itself or JSONL plus a one-line assembler is the LLD-C8/C12 wave's call — the
   normative behavior stays "0 schema errors on upstream load".

`record.ts`/`record.test.ts` are repaired by the s1 builder on ratification (the exact contract is in the
handoff; it also retires the file's now-stale "flagged to the team lead" comment).

## Consequences

- **The day-old v0.3 repair is reversed** — the cost of ruling before verifying an external authority.
  The §7 open item did its job (it predicted exactly this THEN-branch), but the sequencing lesson stands:
  a C1-touching resolution should trigger the host fetch BEFORE the SPEC encodes it, not after.
- **`AdmitCode` shrinks by one member** — a breaking edit to shipped s1 source, caught while s6 is
  unbuilt and the eval facet is fail-closed (zero admitted records can exercise the old path). After s6,
  the same fix would have rippled through the admission matrix and any recorded verdicts.
- **Eval authoring gets simpler, judging stays intentional**: authors always write `description`; they
  add `target` only when the judge criteria differ from the description. Consumers MUST use the
  `target ?? description` fallback — a judge reading `target` raw would silently grade `undefined`
  (named as a scoring-slice acceptance when LLD-C12 builds).
- **The exemplar interop projection is now honest** — v0.1–v0.3's "strip the curation-metadata block"
  never validated upstream for exemplars (`a2uiOutput` violated `additionalProperties: false`); the AC
  no longer overpromises.
- **Stale → re-verify on the build gate:** `record.ts` (unconditional description; `AdmitCode` minus
  `E_NO_TARGET`; header comment) · `record.test.ts` (the inverted carve-out controls) · LLD §6/§8 ·
  decomp v3 n3/n8 accepts · the future s6 matrix (no `E_NO_TARGET` row) and LLD-C12 fallback acceptance.

## Acceptance

- An eval record with `description` and no `target` validates clean (`[]`) — the upstream-fallback
  positive control; a record missing `description` fails `E_SCHEMA` at path `description` regardless of
  facet or `target` (the inverted v0.3 control).
- `E_NO_TARGET` appears nowhere in the SPEC, LLD, decomp accepts, or `src/corpus/` (grep-clean).
- A stripped-and-projected record (drop `meta` + `a2uiOutput`) contains only the 7 upstream fields.
- SPEC §7's upstream-required-list open item reads *Resolved 2026-07-03* with the verbatim facts.

## Alternatives considered

- **Keep the carve-out as an internal-only rule** (admission permits what upstream rejects; the exporter
  back-fills `description` at projection time) — rejected: manufactures a field the author never wrote,
  makes the stored record ≠ the interop record, and buys nothing (the carve-out has zero admitted users).
- **Keep `E_NO_TARGET` as a reserved arm** — rejected: the reserved-arm discipline (ADR-0031/0051/0058)
  requires a *named future activation trigger*; none exists — upstream semantics make the state
  unrepresentable, not merely unimplemented. A code that can never fire is dead vocabulary.
- **Re-scope R1 AC1 to eval records only** (exempt exemplars from upstream validation instead of
  projecting) — rejected: exemplars feed `exportFineTune`/few-shot surfaces that deliberately mirror the
  upstream prompt fields; losing the check for the larger facet weakens R1 where it does the most work.
- **Defer the whole ruling to the eval/LLD-C8 wave** (the carve-out is dead code anyway) — rejected:
  s6 (admission) builds against `AdmitCode` and the §8 matrix next; correcting after s6 multiplies the
  edit across the pipeline and its tests for no benefit.
