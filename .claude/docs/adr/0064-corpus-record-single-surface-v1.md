# ADR-0064 — a v1 corpus record is SINGLE-SURFACE: an exemplar's `a2uiOutput` addresses exactly one surface; multi-surface records reject at the record schema

> Source: agent-ui ADR log (this directory — the numbered files ARE the index; status lives in each ADR's own header). · 2026-07-03
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

## Amendment (2026-10-03, accepted) · one surface at a time: the validator frees a surface's id graph on `deleteSurface`, so delete-then-recreate is legal within one record; concurrent surfaces stay out

> Ratified by kimgranlund (repo owner), 2026-10-03, by the ruling on GH #1736 (the ruling comment:
> https://github.com/kimgranlund/agent-ui/issues/1736#issuecomment-5974690466): "reset on delete, one
> surface at a time. The validator frees a surface's id graph on deleteSurface so delete-then-recreate is
> legal within one record; concurrent surfaces stay out of the corpus (checkSingleSurface holds). Amend
> ADR-0064 cl.4, then the validator slice, then #1731's records (delete-then-recreate and superseding only;
> drop the concurrent case)." The ratification preceded this record; no `ratify` utterance exists, so
> `scripts/adr_ratify.py` was not run and the planner seat wrote this header on the host's instruction.
>
> **Repairs (booked on ratification, applied by the id-graph reset slice; its GitHub Issue is the GH #544
> tracking record):** `src/renderer/validate.ts` (per-surface graph reset at `deleteSurface`; epoch-scoped
> `checkIdGraph` / `checkContainment`; `deletedHere` narrowed to the closed-empty case) + `validate.test.ts`
> · `src/corpus/canonical.ts` (`foldStream` reset at the same point; ordered-epoch canonical form) +
> `canonical.test.ts` · corpus LLD `a2ui-corpus-store.lld.md` §4 (fold precondition gains the epoch rule) ·
> runtime SPEC `a2ui-protocol.spec.md` validator section (the SPEC-N1 parity statement names the lifecycle
> rule) · `a2ui-corpus-curation` SKILL (the "surface lifecycle" pointer row) · GH #1731 (its records narrow
> to delete-then-recreate and superseding).

**What fired.** cl.4 armed a trigger: "the first real multi-surface exemplar need reverses this by ADR."
GH #1731 (the 2026-10-03 skill refresh) raised the first need, and tracing it (GH #1736) split it in two:

- **Lifecycle, one surface at a time**: `createSurface s → root → deleteSurface s → createSurface s →
  root` inside one record. Protocol-legal; the renderer's `#onDeleteSurface` tears the surface down and
  `store.delete`s it, so the second `createSurface` mounts a fresh surface and the second `root` is a
  first delivery. The shared validator disagrees: `validateA2ui` keeps one `SurfaceGraph` per
  `surfaceId` for the whole payload and never resets it (`renderer/validate.ts:128-129`, the surfaces map
  filled by `validateMessage` and judged once at Stage 4, `:155`), so the second `root` reads as a resend
  and fails `IDGRAPH s:root` (`checkIdGraph`, `:289`). That is a
  validator-vs-renderer parity gap (SPEC-N1), not a corpus rule, and it blocks a record the corpus
  should be able to teach (clear-and-rebuild, superseding a view).
- **Concurrency, two surfaces mounted at once**: two live `surfaceId`s in one stream. No consumer
  exists; the s2-era canonicalizer rework cl.4 priced is still the cost.

**Ruling.** cl.4 is amended, not reversed:

- **A1. Single-surface stands, as a lifetime rule.** A v1 record addresses exactly one `surfaceId`
  across every stream it bundles (ADR-0231 widens which streams and facets the walk covers:
  `priorOutput`, `clientInput`, `invalidInput`, and the `a2uiOutput` of the two new facets). `checkSingleSurface`'s rule is unchanged and keeps rejecting a second id at
  `E_SCHEMA`; ADR-0231 widens only which streams and facets it walks (today `record.ts` returns early for
  any facet but `exemplar`). "One surface at a time" is satisfied trivially by "one surface id per record"; the
  record-shape rule is the stronger one and it holds.
- **A2. The validator frees a surface's id graph at `deleteSurface`.** `validateA2ui` partitions a
  surface's messages into **epochs**: an epoch opens at a `createSurface` (or at the first
  surface-bearing message if no create precedes it, today's implicit open) and closes at the next
  `deleteSurface` for that id. Each closed epoch is judged by `checkIdGraph` and `checkContainment` on
  its own graph when it closes; the epoch still open at the end of the payload is judged at Stage 4 as
  today. A message addressing a deleted surface before a new `createSurface` opens a fresh epoch for it
  (the renderer re-creates implicitly on first delivery; the validator mirrors that, as it does for an
  uncreated surface today). Codes and paths are unchanged (`sid:root`, `sid:root-missing`,
  `compId->ref`, `sid:cycle`); a failure in epoch k carries the same path shape it carries today.
- **A3. The ADR-0187 `deletedHere` exemption narrows to the empty closed epoch.** Today a surface
  created and deleted in the same payload is exempt from the finalize emptiness arm
  (`renderer/validate.ts:151-155`: `deletedHere` is computed at finalize and passed as the negated
  emptiness flag to `checkIdGraph`), because it mounted nothing, so nothing was abandoned. Under epochs that exemption applies to a **closed epoch with no component
  deliveries**, and only to that. A closed epoch that delivered components is judged in full at close
  (a dangling reference followed by a delete still fails, as today). The epoch open at payload end,
  including one opened by a `createSurface` after the last `deleteSurface`, is judged normally at
  finalize: `createSurface s → root → deleteSurface s → createSurface s` with nothing after it fails
  `s:root-missing`, because the renderer would be showing an empty surface.
- **A4. The session seed interplay is unchanged.** TKT-0081's `createdHere` already skips the seed merge
  for a surface the payload itself creates (`renderer/validate.ts:138-141`); under epochs the seed applies to the first epoch only when
  that epoch was not opened by a `createSurface` in this payload. A multi-turn follow-up (ADR-0231 cl.2)
  that deletes and recreates its surface therefore validates its new epoch fresh, which is what the
  renderer does.
- **A5. The canonicalizer folds per epoch, and single-epoch output is byte-identical.** `foldStream`
  resets `byId` and the data model at the same `deleteSurface` boundary. The canonical form of a record
  with one epoch is exactly today's form (the 74 committed exemplars re-hash identical, gated). A record
  with N closed-or-open epochs canonicalizes as an ordered list of the per-epoch forms, each the
  existing shape; the hash covers the list. Two records that end on the same tree but reach it through
  different intermediate epochs are therefore distinct (they teach different lifecycles), and a record
  whose final epoch is empty cannot admit (A3 reds it at tier-1 before the fold).
- **A6. Pointer resolution is per epoch.** Admission's `findUnresolvedPointers` resolves a binding
  against its own epoch's data model; a binding in epoch 2 does not see epoch 1's data, because the
  renderer dropped that store on delete.
- **A7. The widening trigger is re-armed, narrower.** What re-opens the multi-surface question is a
  *genuine concurrent-surface consumer*: a producer or retrieval consumer that needs two live surfaces in
  one record. Lifecycle needs (clear-and-rebuild, superseding, delete-then-recreate) are now in scope
  under A2 to A6 and do not fire it. GH #1731's records narrow to delete-then-recreate and superseding;
  its concurrent case is dropped, not deferred.

**Consequences of the amendment.**

- **Validator parity moves toward the renderer** on a real, previously undocumented divergence. The
  change is in the shared validator, so every consumer (the producer self-correct loop, the
  `validate-payload` CLI, admission, the standing gate) sees it at once; the parity statement in the
  runtime SPEC is repaired to name the lifecycle rule.
- **Stricter in one place.** A3 turns a passing payload into a failing one: create, deliver, delete,
  create, stop. Nothing committed does this (gated by the 74-hash re-admission), and the producer loop's
  `NET_NOOP` already treats a bare create+delete as a loop defect, so the new failure is aligned with
  existing intent.
- **The canonical form grows a shape only multi-epoch records use.** Single-epoch consumers
  (`retrieve`, both exporters, every existing verdict) are untouched; the exporters' behaviour on a
  multi-epoch exemplar (export the final epoch, or the whole lifecycle) is decided when the first such
  record is exported, by amendment here.
- **Stale → re-verify on the slice gate:** everything in the Repairs cell above; LLD §4's "assumes a
  single-surface output" guard gains "and folds per epoch"; the `a2ui-catalog-rendering-review` traps
  table if it restates the validator's resend rule.

**Acceptance (the id-graph reset slice is dispatched against these).**

1. `validate-payload.ts` on `createSurface s, root, deleteSurface s, createSurface s, root` exits 0 in
   both default and finalize mode.
2. The same stream without the second `root` fails `IDGRAPH s:root-missing` at finalize and passes in
   default mode (A3).
3. `createSurface s, deleteSurface s` (nothing after) still passes at finalize: the empty closed epoch,
   the one case the A3 exemption keeps (today's behaviour, `validate.ts:151-155`).
3b. `createSurface s, root, deleteSurface s` (nothing after) passes at finalize because the closed epoch
   is non-empty and its graph is clean; it is judged at close, not exempted.
4. `root` delivered twice with no intervening `deleteSurface` still fails `IDGRAPH s:root` (the resend
   rule is untouched).
5. A dangling child reference in epoch 1 followed by `deleteSurface` fails `IDGRAPH compId->ref` (A3,
   second sentence).
6. `canonicalize` of every committed exemplar line yields today's `canonicalHash` (74/74); a two-epoch
   record canonicalizes deterministically and differs from its final epoch alone.
7. `npm run check` and `npm test` exit 0.

## Erratum to the 2026-10-03 amendment (2026-10-04, independent review of PR #1749, GH #1740; append-only)

**A2's renderer premise was false.** A2 says a message addressing a deleted surface before a new
`createSurface` "opens a fresh epoch for it (the renderer re-creates implicitly on first delivery; the
validator mirrors that, as it does for an uncreated surface today)". The renderer does not re-create: `renderer.ts#onUpdateComponents` returns early
for an unknown or deleted surface (the LLD §9 no-op), and `#onUpdateDataModel` does the same, so such a
delivery is dropped. A validator that reopened the epoch would pass `createSurface s, root, deleteSurface
s, root` while the renderer shows nothing, the SPEC-N1 parity gap this amendment exists to close.

**The rule, replacing A2's implicit-reopen sentence.** After a `deleteSurface` on a `surfaceId`, only a
`createSurface` reopens that id. An `updateComponents` or `updateDataModel` addressing the deleted id
before it is re-created fails the EXISTING `IDGRAPH` code at path `${surfaceId}:update-after-delete`,
once per such message, and joins no graph (the renderer never applies it). A surface this payload never
deleted keeps the implicit open on its first `updateComponents`, so every verdict for a payload without a
`deleteSurface` is unchanged. The canonicalizer's fold (A5) skips the same deliveries, so it stays
faithful for a direct caller; tier-1 rejects such a stream before any admitted record reaches the fold.
A4 needs no separate delete check as a result: an epoch preceded by a delete is always opened by a
`createSurface`, so the seed never applies to it.

**Repairs pointer correction.** The Repairs cell above names the runtime SPEC as `a2ui-protocol.spec.md`;
no such file exists. The parity statement lives in `.claude/docs/spec/a2ui-runtime.spec.md` (SPEC-R11 and
SPEC-N6), where the repair landed.

**Acceptance addendum.** `createSurface s, root, deleteSurface s, root` fails `IDGRAPH
s:update-after-delete` in both modes; the same stream with a `createSurface s` before the second `root`
is Acceptance 1 and validates.
