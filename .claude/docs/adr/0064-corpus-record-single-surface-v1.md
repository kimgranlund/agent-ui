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

## Erratum to the 2026-10-03 amendment (2026-10-04, data-only epochs, GH #1750 / PR #1764 review; append-only)

**A5's epoch count was underspecified.** A5 says a record "with N closed-or-open epochs canonicalizes as
an ordered list of the per-epoch forms" and that records reaching the same tree "through different
intermediate epochs are therefore distinct". It never said whether an epoch that received only
`updateDataModel` writes is one of those N.

**The rule, narrowing A5 (and read into A6).** An epoch counts only if it delivered at least one
component. A data-only epoch counts in neither the canonical fold (it contributes no form) nor pointer
resolution (its writes satisfy no binding in a later epoch, because the fold resets at the
`deleteSurface` that closes it). "Distinct intermediate epochs" therefore means distinct mounted trees,
so two records that differ only in a data-only epoch's data are exact-hash duplicates.

**Why, briefly.** The validator already judges a data-only closed epoch as A3's empty closed epoch
(a data write registers no graph). No component ever bound its store, and the renderer frees that store
at the delete, so nothing observes it. Counting it would also trip the canonicalizer's root guard on a
record tier-1 accepted. No committed hash moves: none of the 78 committed exemplars has a data-only
epoch.

The rule's home is corpus LLD `a2ui-corpus-store.lld.md` §4, v0.7.1 ("Data-only epochs count in neither
the fold nor resolution").

## Erratum to the 2026-10-03 amendment (2026-10-04, resolution resets at re-create, GH #1765; append-only)

> Ratified by kimgranlund (repo owner), 2026-10-04, by the ruling on GH #1765 (the ruling comment:
> https://github.com/kimgranlund/agent-ui/issues/1765#issuecomment-5982535594): "reset at re-create".
> Stage 6 resets its resolution fold at a `createSurface` that follows prior content in the epoch
> (components or data); the canonical hash fold is untouched, so all 78 exemplar hashes stay stable. The
> ruling's intent is the renderer's store, which any re-create replaces, so the boundary is every
> `createSurface` that follows prior content. (The first build scoped it to a component-bearing epoch and
> left a data-only prefix open; PR #1771 review widened it before merge.)

A6 inherited a boundary that is wrong for resolution. A5 says a `createSurface` inside an open epoch is
not a boundary, which is the shared validator's A2 rule: it keeps the resend rule intact (two `root`s with
no `deleteSurface` between still fail `sid:root`). A6 resolved each binding "against its own epoch's data
model" on those same epochs, so a follow-up that re-sends `createSurface` without a `deleteSurface` first
stayed on the prior epoch and resolved against the prior turn's data. Two other layers disagree with that.
The renderer replaces the surface and its store on a re-create (`renderer.ts#onCreateSurface` tears the
live surface down and `SurfaceStore.create` disposes the prior one and builds a fresh one), and A4 already
has the validator refuse the session seed to any epoch a `createSurface` opened or landed in. So, after the
login prior, a follow-up `[createSurface, root->status (a Text bound /status)]` with no data write
validated fresh and admitted, though the rendered surface has no `/status`. The #1764 review found it.

The rule, narrowing A6 (A5 is unchanged). Admission's resolution fold (`foldForResolution`, `admit.ts`)
closes its epoch at a `createSurface` that follows prior content in the epoch, components or data, as well
as at a `deleteSurface`, and the next epoch starts from an empty component map and an undefined data
model. A `createSurface` over an empty fold closes nothing: a leading create, and the create that
follows a delete (the delete already closed the epoch). So the rule needs no content test: every
`createSurface` closes the fold, and over nothing that is a no-op. A data write that precedes the first
`createSurface` is the renderer's dropped delivery (no surface exists yet), so a create after it is also a
reset and the write resolves nothing. The rule covers every stream stage 6 folds, a
multi-turn record's `priorOutput` then `a2uiOutput`, and a single `a2uiOutput`. Within one stream it
reaches stage 6 only when the re-create delivers no second `root`; a re-sent `root` is the validator's
`sid:root` at tier-1, before stage 6.

Why the resolution fold and the canonical fold now differ. The canonical fold (A5,
`canonical.ts#foldStream`) keeps `createSurface` a non-boundary, because the ruling froze every committed
hash and a boundary there would change the identity of any record that re-creates without a delete. The
two folds also answer different questions. The canonical fold derives a record's dedup identity from its
tree and stays aligned with the validator's A2 epochs. The resolution fold asks whether each binding
resolves in the store the renderer would hold, which is the renderer's question, and the renderer resets
here. The cost is that on this one shape a record's identity merges what its resolution keeps apart: it
hashes as one epoch and can carry prior-turn components and data the renderer dropped at the re-create.

Not covered. The validator judges the id graph across a re-create inside one stream (A2: not a boundary),
a graph the renderer does not hold after the re-create, so a rootless second epoch is graph-valid at
tier-1 while the surface has no `root`. That is the validator's rule, not resolution's, and it is not
changed here.

No committed hash moves and the validator is untouched (`canonical.ts` and `renderer/validate.ts` are not
edited, and resolution is the corpus-only stage that sits outside `validateA2ui`, so SPEC-N6 parity is
unaffected). All 78 committed exemplars re-admit through `admit()` with their stored `canonicalHash`, and
none holds more than one `createSurface` or a write before its `createSurface`, so no committed record
can reach the new boundary (the committed `multi-turn` and `repair` shards, #1766 and #1768, re-admit unchanged).

The rule's home is corpus LLD `a2ui-corpus-store.lld.md` §6 stage 6, v0.7.2.

## Erratum to the 2026-10-03 amendment (2026-10-04, the validator resets the id graph at re-create, GH #1772; append-only)

> Ratified by kimgranlund (repo owner), 2026-10-04, by the ruling on GH #1772 (the ruling comment:
> https://github.com/kimgranlund/agent-ui/issues/1772#issuecomment-5983017105): "reset the graph at
> re-create. The validator resets the surface's id graph at any `createSurface`, matching the renderer.
> A rootless re-create then fails `root-missing`." The ratification preceded this record; no `ratify`
> utterance exists, so `scripts/adr_ratify.py` was not run.

**A2 left a re-create inside one stream as one epoch.** The amendment's A2, with its closing sentence in
the validator header, says a `createSurface` that lands inside an already-open epoch is not a boundary, so
two `root`s with no `deleteSurface` between still fail `sid:root`. The renderer does not agree. Its
`#onCreateSurface` tears the live surface's DOM down and `SurfaceStore.create` disposes the prior surface
and builds a fresh one, so after a re-create the surface holds no `root`, no components, no data and no
session seed, whether or not a `deleteSurface` came first. The validator kept one merged graph across the
re-create, which made the two disagree in both directions (the SPEC-N6 parity gap this amendment exists to
close). `createSurface s, root, createSurface s` with no second `root` was graph-valid while the renderer
holds no `root`; and `createSurface s, root, createSurface s, root` failed `s:root` though the renderer
mounts the second `root` as a first delivery.

**The rule, replacing A2's "a `createSurface` inside an open epoch is not a boundary" clause.** Every
`createSurface` closes its surface's open epoch, if there is one, and opens a fresh epoch. No
`deleteSurface` is needed, and a re-create does not mark the surface deleted (the create is the reopen).
Everything else in A2 to A4 and the 2026-10-04 delete erratum stands, applied to the finer epochs:

- A3: a closed epoch that delivered no component mounted nothing and is exempt in both modes; a closed
  epoch that delivered components is judged in full in both modes; the epoch still open at payload end
  takes the finalize arm. A `createSurface` over an empty open epoch (a leading create, a create right
  after a create, the create after a delete) therefore changes no verdict.
- A4: every epoch a `createSurface` opens is `created`, so the session seed never applies to it. The seed
  continues only a first epoch no `createSurface` opened, which is now also the epoch an `updateComponents`
  opened implicitly before the surface's first `createSurface`.
- The resend rule holds within an epoch. Two `root`s with no `createSurface` or `deleteSurface` between
  them still fail `sid:root`, and a second `root` inside the re-created epoch fails the same way.
- Codes and path shapes are unchanged. No new failure code, so the two-code wire contract (ADR-0031) and
  `protocol.ts` are untouched.

**What changes for a stream.** One verdict loosens and two tighten, each toward the renderer.

- Loosens: `create s, root, create s, root` validates in both modes (it failed `s:root`).
- Tightens: `create s, root, create s, <components with no root>` fails `s:root-missing` in both modes
  (the first epoch's `root` no longer satisfies the second epoch). `create s, root, create s` with nothing
  after passes by default, which the prefix laws (message-lifecycle SPEC-R4 AC1, live-agent SPEC-R5 AC1)
  require, and fails `s:root-missing` at finalize, as a create after a delete always did (A3).
- Tightens, the implicit open: an `updateComponents` that reaches a surface before its first
  `createSurface` is the delivery the renderer drops (an unknown surface), so it is its own epoch and the
  create then replaces it. `root, create` passes by default and fails `s:root-missing` at finalize, and an
  unseeded `<non-root component>, create, root` fails `s:root-missing` for the first epoch. No committed
  record has a second `createSurface` for a surface (checked across the exemplar, multi-turn and repair
  shards, `invalidInput` included), and the only streams that update before a `createSurface` are the
  two multi-turn follow-ups, which hold no `createSurface` at all and so keep the seed.

**Hashes and the canonical fold are untouched.** The ruling froze every committed hash, so
`canonical.ts#foldStream` still treats `createSurface` as a non-boundary and its source is not edited (the
comment there that it matches the validator's A2 rule is stale as of this erratum, and is booked below).
For a record tier-1 now accepts, the two folds differ on this one shape only in what the merged fold
retains. Tier-1 guarantees the second epoch is self-contained (a reference to an id only the first epoch
delivered dangles in the second), so every id reachable from the second `root` was delivered by the second
epoch and wins the upsert; the first epoch's other components fold as disconnected and drop. A record
`create, tree A, create, tree B` therefore hashes equal to `create, tree B` (checked: same hash, the
superseded ids reported as `disconnected`). What the merged fold still carries is the first epoch's data
model, which the renderer dropped at the re-create, so such a record's hash can include data the rendered
surface does not have. That is the same identity-versus-resolution difference the GH #1765 erratum above
records for resolution.

**Not covered.**

- `createSurface` with an unregistered `catalogId`. The renderer emits `CATALOG_UNKNOWN` and returns before
  its teardown, so a live surface survives. The validator holds one catalog, checks only that `catalogId`
  is a string, and treats that create as a reset. Corpus admission pins every `createSurface.catalogId`
  to `meta.catalogId` (`E_PIN`) before tier-1, so no admitted record reaches the difference.
- The canonical fold and its retained data model, above.

**Supersedes, in the GH #1765 erratum above.** Its "Not covered" paragraph ("the validator judges the id
graph across a re-create inside one stream ... so a rootless second epoch is graph-valid at tier-1") and
its sentence that a re-sent `root` inside one stream is the validator's `sid:root` at tier-1 describe the
validator as A2 left it, and no longer hold: tier-1 resets at the re-create, so a re-create that delivers
its own `root` reaches stage 6 and a rootless one fails `root-missing` first. Its "the validator is
untouched" is a statement about that build, not about this one. The resolution rule itself (stage 6 resets
at every `createSurface`) is unchanged, and the exemplar shape `create, root, dm, create, root` it names is
now reachable at stage 6.

**Repairs booked.** Applied by the build of this erratum (GH #1772): `src/renderer/validate.ts` (the
`createSurface` arm closes the open epoch; header and helper docs) with `validate.test.ts` and
`src/corpus/validate.test.ts` (the parity table gains the re-create shapes); `src/corpus/admit.test.ts`
(the one-stream tests the GH #1765 build wrote against the old validator are rewritten: the
re-sent-`root` stream now reaches stage 6, the rootless one now fails tier-1, and the positive control
uses two complete epochs, because each epoch is judged on its own graph); the runtime SPEC
`a2ui-runtime.spec.md` SPEC-R11's REV paragraph and SPEC-N6's row; the validator-finalize LLD
`a2ui-validator-finalize.lld.md` mechanic 4's REV; and the corpus LLD `a2ui-corpus-store.lld.md` v0.7.3
(§4's epoch-rule sentence and §6 stage 6's "Not covered" note). Booked and NOT applied, because the ruling
keeps `canonical.ts` untouched: the comment at `canonical.ts#foldStream` ("a createSurface never resets an
open epoch, matching the validator's A2 rule"), stale as of this erratum.

**Acceptance addendum.** (1) `create s, root, create s, root` exits 0 in both default and finalize mode.
(2) `create s, root, create s, <a non-root component>` fails `IDGRAPH s:root-missing` in both modes.
(3) `create s, root, create s` passes by default and fails `IDGRAPH s:root-missing` at finalize. (4) The
delete-then-create items 1 to 5 of the amendment and the 2026-10-04 delete erratum's addendum are
unchanged, and amendment Acceptance 4 reads "no intervening `deleteSurface` or `createSurface`". (5) The
committed corpus is unmoved: every committed exemplar line (78), the multi-turn shard (2) and the repair shard (5, with its
`invalidInput` streams) validate with an identical verdict under the old and the new validator in both
modes (184 of 184 comparisons), every record's stored `canonicalHash` re-derives, and `corpus-data.test.ts`
(the stored-hash leg) and `repair-shard.test.ts` (the `validatorErrors` recomputation) pass. (6) `corpus/validate.ts` is the single re-export of the renderer validator, and
`corpus/validate.test.ts` proves the identity and the re-create verdicts through the corpus entry point.

The rule's home is the runtime SPEC `a2ui-runtime.spec.md` SPEC-R11's 2026-10-04 REV (re-create).

## Erratum to the 2026-10-03 amendment (2026-10-04, the canonical fold keeps a re-create as one epoch, GH #1778; append-only)

> Basis: kimgranlund's ruling on GH #1765 (the ruling comment:
> https://github.com/kimgranlund/agent-ui/issues/1765#issuecomment-5982535594): "The canonical hash fold
> is untouched, so all 78 exemplar hashes must stay stable", which the GH #1772 build (PR #1777) kept by
> leaving `canonical.ts` unedited. This erratum records the consequence of that ruling as the intended
> design and closes the two items the GH #1772 erratum left under "Not covered" (GH #1778). It adds no
> new ruling; no `ratify` utterance exists, so `scripts/adr_ratify.py` was not run.

**The decision: the canonical fold keeps a re-create without a delete as one epoch, by design.** A5's fold
(`canonical.ts#foldStream`) closes an epoch only at a `deleteSurface`. The validator (the GH #1772
erratum) and admission's resolution fold (the GH #1765 erratum) also close one at every `createSurface`,
because the renderer replaces the surface there. The canonical fold does not follow them, and that is
intended, not a gap awaiting a hash migration. The canonical hash is a record's IDENTITY over the full
stream it bundles (dedup's exact-match leg, LLD-C4), not a model of what the renderer shows at the end,
and the ruling above freezes every committed hash. Making `createSurface` a boundary would rehash any
record that re-creates without a delete, and would reopen the hash contract for a shape no committed
record holds.

**The known divergence from renderer-visible state.** On a record `create s, <epoch 1>, create s, <epoch 2>`
with no `deleteSurface` between, the canonical fold merges both epochs into one form while the renderer
holds only epoch 2. The component half converges, as the GH #1772 erratum showed: tier-1 makes the second
epoch self-contained, so every id reachable from the second `root` comes from epoch 2, and the first
epoch's other components fold as `disconnected` and drop. The data model does not converge. Epoch 1's
`updateDataModel` writes stay in the merged data model, though the renderer dropped them at the
re-create. Such a record's hash can therefore include data the rendered surface does not have, and two
records that differ only in that dropped data are distinct to dedup though they render the same. The
divergence is in identity only: resolution (stage 6) resets at the re-create, so no binding resolves
against the dropped data.

**Supersedes, in the GH #1765 erratum above.** Its sentence that the canonical fold "stays aligned with the
validator's A2 epochs" describes the validator before the GH #1772 erratum. The validator now closes an
epoch at every `createSurface` and the canonical fold does not, so on a re-create without a delete the
two differ. The rest of that paragraph stands: the fold keeps `createSurface` a non-boundary because the
hashes are frozen.

**Unregistered `catalogId`: recorded, not changed.** The GH #1772 erratum's "Not covered" names a
`createSurface` whose `catalogId` the renderer has not registered. The renderer emits `CATALOG_UNKNOWN`
and returns before its teardown, so a live surface survives, while the validator treats that create as a
reset. The validator is not changed to skip that reset, for three reasons.

1. The validator cannot decide "registered". Its input is one `Catalog` (`validateA2ui(payload, catalog,
   seed?, opts?)`), not the renderer's registry, which holds the default catalog, `a2ui-basic` and its
   canonical-URI alias (ADR-0169), and the persona-derived `<base>--<persona>` ids. Comparing the
   `catalogId` to the one catalog's id would call a registered alias unregistered and move verdicts for a
   caller that validates against a single catalog (`site/lib/artifact-feed.ts` validates every feed
   against `defaultCatalog`). Passing the registry's ids in would widen the validator's interface
   (SPEC-R11, LLD-C11, ADR-0187's options bag) for a caller that does not exist.
2. Skipping the reset would move the gap, not close it. The renderer also reports `CATALOG_UNKNOWN`,
   which the validator has no arm for, and when no live surface exists it drops every later delivery to
   that id, while the validator's implicit open still builds a graph from them. Real parity needs a new
   validator failure for an unregistered `catalogId`, which changes SPEC-R11's verdict and needs its own
   ruling.
3. No caller in the tree reaches the case with a registry to judge it by. The renderer's own validator
   leg (`#finalizeSurface`) passes one synthetic `updateComponents` built from the live surface, never a
   `createSurface`. The producer (`produce.ts`) stamps every `createSurface.catalogId` with its catalog's
   id before it validates. Corpus admission pins every `createSurface.catalogId` to `meta.catalogId`
   (`E_PIN`) before tier-1. The harness CLI, the conformance runner and the site's artifact feed validate
   against one named catalog and hold no registry.

The validator is not edited, so the shared spine (SPEC-N6) is unchanged. `renderer/validate.test.ts` pins
the recorded behavior: a re-create under a `catalogId` the catalog does not carry resets like any other.

**Repairs applied.** The comment the GH #1772 erratum booked is repaired: the note at the end of
`canonical.ts#foldStream`'s loop now says a `createSurface` is a boundary for the validator and the
resolution fold but not for this fold, by design, and cites this erratum; the module header gains one
sentence saying the same. Both are comment-only edits, so no hash moves. The corpus LLD
`a2ui-corpus-store.lld.md` §4 (v0.7.4) records the decision beside its epoch rule. The behavior of
`canonical.ts` and of `renderer/validate.ts` is unchanged.

**Acceptance addendum.** (1) `git diff` on `canonical.ts` changes comment lines only. (2) Every committed
record re-derives its stored `canonicalHash` (`corpus-data.test.ts`, the stored-hash leg): the 81
exemplar lines (the 78 the ruling froze plus the three GH #1731 lifecycle seeds, PR #1779), the 2
multi-turn records and the 5 repair records. (3) No committed record holds a `createSurface` for a surface
already live in the same stream (none across `a2uiOutput`, `priorOutput` and `invalidInput`, nor across a
multi-turn record's `priorOutput` then `a2uiOutput`), and every `createSurface.catalogId` equals its
record's `meta.catalogId`, so neither divergence reaches committed data. (4) The two `validate.test.ts`
pins above pass. (5) `npm run check` and `npx vitest run packages/agent-ui/a2ui` exit 0.

The rule's home is the corpus LLD `a2ui-corpus-store.lld.md` §4, v0.7.4.
