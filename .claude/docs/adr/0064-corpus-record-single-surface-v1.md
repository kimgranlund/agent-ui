# ADR-0064 — a v1 corpus record is SINGLE-SURFACE: an exemplar's `a2uiOutput` addresses exactly one surface; multi-surface records reject at the record schema

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-03
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-03 |
> | **Proposed by** | planner (design seat — ruling on the s6 builder's multi-surface trace) |
> | **Ratified by** | orchestration (host), 2026-07-04 — on Kim's "proceed" + the green wave gate |
> | **Repairs** | corpus SPEC v0.5 — R2 single-surface clause · corpus LLD v0.4 — §3 (record rule) · §4 (fold precondition) · §8 (row) · `src/corpus/record.ts` + `record.test.ts` (its OWN small slice, s6 seat, recommendation-adoption — books correction: the ADR-0063 follow-up had ALREADY landed 2026-07-03 15:38 when this ADR was authored, so there was nothing to join) · decomp `a2ui-corpus-store` v4 (n3 accept) |
> | **Supersedes / Superseded by** | Relates ADR-0063 (the sibling record.ts contract change, separately landed) · relates the fleet's on-demand/YAGNI discipline (ADR-0031/0058 precedent — a named widening trigger, no speculative machinery) |

## Context

The s6 admission build traced why the canonicalizer's `E_IDGRAPH` backstop cannot fire for a
tier-1-green single-surface record, and surfaced the real gap behind it: **the shared validator scopes
per surface, the canonicalizer folds globally.** `validateA2ui` accumulates a `SurfaceGraph` per
`surfaceId` and judges each independently (`renderer/validate.ts:70-74` — a multi-surface stream with one
`root` per surface is protocol-legal and tier-1-green), but `canonical.ts`'s `foldStream` upserts every
component into ONE global map keyed by id (`canonical.ts:93-99`). A hypothetical multi-surface record —
where both surfaces legally declare `id:"root"`, or reuse any id — would pass tier-1 and then be
**silently merged into a last-write-wins chimera** before hashing: no error, a corrupt canonical form,
and a `canonicalHash`/dedup identity computed over a tree no surface ever declared. The corpus SPEC is
silent on whether a record may span surfaces; the s6 builder deliberately encoded no assumption and
escalated. Meanwhile every real producer is single-surface: the exemplar definition is "a stream that
renders to **a UI**" (SPEC §3), `ExampleSeed` carries exactly one `surfaceId`, all 11 seeds are
single-surface, an upstream catalog example is one payload file, and a fine-tune pair is one output.

## Decision

We will make the v1 corpus record **normatively single-surface**:

1. **SPEC-R2 gains the clause** (SPEC → v0.5): an exemplar's `a2uiOutput` MUST address **exactly one
   surface** — every surface-bearing message (`createSurface`/`updateComponents`/`updateDataModel`/
   `deleteSurface`/`actionResponse`) carries the same `surfaceId`, and at least one such message exists
   (an output of only surfaceless `callFunction` envelopes renders no UI and is not an exemplar).
   Surfaceless `callFunction` messages are excluded from the count, not banned.
2. **The rejection site is the record schema** (LLD-C2 `validateRecord`, `E_SCHEMA` at the offending
   message's path) — a record-SHAPE rule, enforced by the same message walk `checkPins` already does.
   Placing it here (not as an admission stage) means the standing corpus-data gate (LLD-C15) enforces it
   over STORED records too, not only at the admission door. The check ships as its own small slice
   (dispatched to the s6 seat, file-disjoint from the in-progress s7; the ADR-0063 follow-up had already
   landed when this ADR was authored — crossed-messages books correction).
3. **The canonicalizer's global fold is thereby CORRECT by precondition** — LLD §4 records the guard:
   `canonicalize` assumes a single-surface output, guaranteed by the schema stage that precedes it in
   the §6 pipeline. No surface-scoped folding is built.
4. **The widening trigger is named**: the first real multi-surface exemplar need reverses this by ADR —
   delivering surface-scoped folding (an s2-seat follow-up), per-surface canonical forms, and a defined
   multi-surface hash/dedup semantic. Until a consumer exists, that machinery is speculative.

## Consequences

- **The corpus is narrower than the protocol, deliberately.** Multi-surface streams stay fully legal at
  the renderer/wire level — this is a corpus-only admission/storage rule, so validator parity (SPEC-N1)
  is untouched (`validateA2ui` gains nothing; the rule lives beside the pin walk in `validateRecord`).
- **The silent-corruption hazard is closed by prohibition**, at the cost that a future multi-surface
  corpus need pays an ADR + an s2-era canonicalizer rework. Accepted: zero producers exist, and encoding
  per-surface hash semantics now would be design without a consumer.
- **The exactly-one (not at-most-one) bound also closes the callFunction-only hole**: an exemplar whose
  output contains no surface-bearing message would otherwise pass tier-1 vacuously (zero surfaces → zero
  id-graph checks) while rendering nothing.
- **Stale → re-verify on this slice's gate:** `record.ts` (the surfaceId walk + `E_SCHEMA` arm) ·
  `record.test.ts` (multi-surface negative + callFunction-only negative + a callFunction-alongside-one-
  surface positive) · LLD §4/§6/§8 · decomp v4 n3 accept.

## Acceptance

- A two-surface `a2uiOutput` (each surface individually tier-1-green) rejects `E_SCHEMA` at the second
  surface's message path — before canonicalization can merge it.
- An exemplar whose output holds only `callFunction` envelopes rejects `E_SCHEMA` (no surface addressed).
- An output mixing one surface's messages with surfaceless `callFunction` envelopes passes the rule.
- The stored-shard gate (corpus-data.test.ts, when built) fails on a hand-edited multi-surface line.

## Alternatives considered

- **Legalize multi-surface now (surface-scoped folding in `canonical.ts`)** — rejected: no producer or
  consumer exists; it forces per-surface canonical forms, a composite hash semantic, and per-surface
  `componentsUsed` — real design surface with zero present need (YAGNI; the named trigger reverses this
  cheaply when a need arrives).
- **Reject at an admission pipeline stage instead of the record schema** — rejected: duplicates a
  message walk `validateRecord` already performs, and admission-only placement would let a hand-edited
  multi-surface line sit undetected in a stored shard (the standing gate validates records, not
  admissions).
- **Leave it undefined (the pre-s6 state)** — rejected: the hazard is live TODAY — tier-1 passes a
  multi-surface record and the global fold silently chimeras it into the corpus identity machinery.
  Undefined behavior in the single mutation path is not a neutral default.
