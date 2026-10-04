# ADR-0231 — the corpus gains two model-visible facets, `multi-turn` (client `action` in, follow-up stream out) and `repair` (invalid input + recomputed validator errors + corrected output); the exemplar branch is unchanged

> Source: agent-ui ADR log (this directory, the numbered files ARE the index; status lives in each ADR's own header). · 2026-10-03
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-10-03 |
> | **Proposed by** | planner (design seat, recording Kim's two 2026-10-03 rulings on GH [#1730](https://github.com/kimgranlund/agent-ui/issues/1730) and GH [#1733](https://github.com/kimgranlund/agent-ui/issues/1733); the shared facet-schema question is why the two are ruled in one record) |
> | **Ratified by** | kimgranlund (repo owner), 2026-10-03, by the rulings themselves: the [#1730 ruling comment](https://github.com/kimgranlund/agent-ui/issues/1730#issuecomment-5974689452) ("new multi-turn facet ... as a separate facet; the exemplar record shape (ADR-0063) is unchanged. Needs an ADR for the facet schema") and the [#1733 ruling comment](https://github.com/kimgranlund/agent-ui/issues/1733#issuecomment-5974689814) ("in scope as a new `repair` facet: invalid input + validator errors + corrected output. Schema via ADR"). The ratification preceded the record (the ADR-0063/ADR-0064 "on Kim's proceed" shape); no `ratify ADR-0231` utterance exists, so `scripts/adr_ratify.py` was not run and the planner seat wrote this cell on the host's explicit instruction. |
> | **Repairs** | **Booked on ratification, applied by the facet build slice (its GitHub Issue is the GH #544 tracking record):** corpus SPEC `a2ui-training-corpus.spec.md` §2 (the facet table gains the two rows and the model-visible/held-out class), SPEC-R2 (facet-conditional record branches), SPEC-R3 (the leak invariant reads over the model-visible class), §5.1 (the `facet` enum + the two `allOf` conditionals + the four new top-level fields), SPEC-R1 AC1 (the upstream projection drops the four new fields too) · corpus LLD `a2ui-corpus-store.lld.md` §3 (record model), §4 (fold input per facet), §6 (facet-dispatched stages), §8 (rows), §9 (retrieval facet filter) · rubric `.claude/docs/rubrics/a2ui-corpus.md` 1.2 → 1.3 (D6/D7, facet applicability, the re-author sentence qualified) · `src/corpus/record.ts` + `record.test.ts` · `src/corpus/admit.ts` + `admit.test.ts` · `src/corpus/store.ts` (shard path + `facetOfPath`) · `src/corpus/canonical.ts` (facet identity input) · `src/corpus/retrieve.ts` (opt-in facet filter) · `src/corpus/corpus-data.test.ts` (per-shard legs) · `src/examples/types.ts` + `tools/corpus/import-seeds.ts` (the two seed kinds) · `.claude/skills/a2ui-corpus-curation/SKILL.md` (facet pointer rows) |
> | **Supersedes / Superseded by** | **Extends [ADR-0063](./0063-corpus-record-upstream-dataset-schema-alignment.md)** (the record contract: the exemplar branch is unchanged, the upstream projection gains four more dropped fields) · **Extends [ADR-0064](./0064-corpus-record-single-surface-v1.md) and its 2026-10-03 amendment** (single-surface applies to every stream a record bundles; every `fold` this ADR names is the amendment's epoch-aware fold, A5/A6) · **Extends [ADR-0068](./0068-corpus-quality-judge-verdict-adapter.md)** (the verdict shape and adapter are unchanged; the rubric gains facet-scoped dimensions) · relates [ADR-0060](./0060-corpus-store-phase1-admission-seams.md) (the eval fail-closed gate is untouched) · relates [ADR-0061](./0061-corpus-shared-healer-contract.md) (text-level healing stays the healer's; the `repair` facet teaches semantic repair) · relates [ADR-0187](./0187-validator-finalize-signal.md) (finalize granularity is the recomputation mode) |

## Context

The 2026-10-03 A2UI skill refresh profiled the committed exemplar shard
(`packages/agent-ui/a2ui/corpus/exemplar/v1_0/agent-ui.jsonl`, 74 records at profiling time) and found
two teaching gaps that the record contract cannot express:

1. **No client turn, no follow-up** (GH #1730). Every record is a server-to-client stream. Nothing in the
   corpus shows an `action` envelope arriving and the producer answering it with `updateDataModel` /
   `updateComponents` on the live surface, so the round-trip is untaught beyond the button wiring. The
   shared validator already owns the cross-turn mechanic a follow-up needs: `validateA2ui`'s
   `sessionSeed` (`SurfaceSeed`, TKT-0081) merges a prior turn's graph under the payload so an update-only
   follow-up validates and a `root` resend fails `sid:root`, the renderer's exact cross-turn failure
   (ADR-0128). Admission never passes a seed, because no record carries a prior turn.
2. **No broken-then-repaired pairs** (GH #1733). All records are valid positives. The SPEC-R6 compose,
   validate, self-correct loop (`src/agent/produce.ts`) has nothing to learn correction from: no record
   shows an off-enum variant, a dangling child id, or a missing root alongside the validator's verdict and
   the fixed stream.

Kim ruled both on 2026-10-03: a new multi-turn facet ("client action in, follow-up updates out, as a
separate facet; the exemplar record shape (ADR-0063) is unchanged"), and a new `repair` facet
("invalid input + validator errors + corrected output"). Both rulings name the same prerequisite, an ADR
for the facet schema, and the two facets hit the same seven decision points (record branch, validation,
admission stages, identity for dedup, shard home, verdict/rubric, exemplar non-regression), so they are
ruled together here rather than in two records that would restate each other.

Constraints the design inherits, by ID: the record is a superset of upstream `dataset_schema.json`
and the upstream projection must still validate (SPEC-R1 AC1, ADR-0063 cl.4); `description` is
unconditionally required (ADR-0063 cl.1); every bundled stream addresses exactly one surface (ADR-0064,
SPEC-R2 AC3); the eval facet fail-closes (ADR-0060, SPEC-R4); admission is the one write path (LLD §2
invariant iv) and judges at finalize granularity (ADR-0187); the tier-2 verdict shape
`{ qualityScore, passed, failingDimensions }` is consumed by `createVerdictJudge` and the rubric's
`version:` marker is a runtime contract (ADR-0068 cl.1/cl.2); the shared validator's internal `ErrorCode`
taxonomy (`protocol.ts`) is distinct from the corpus `E_*` admission codes (LLD §0, §6 mapping table);
the validator and the canonicalizer free a surface's id graph and data model at `deleteSurface` and fold
per epoch (ADR-0064 amendment of 2026-10-03, A2/A5/A6), so wherever this ADR says `fold(stream)` it
means that epoch-aware fold, and "the fold's components / data model" means the final epoch's.

## Decision

We will widen the corpus record's `meta.facet` enum to `exemplar | eval | multi-turn | repair` and give
each new facet its own conditional branch of required top-level fields, admitted through the existing
pipeline with facet-dispatched stages. The exemplar and eval branches are not edited.

### 1 · Facet classes

Facets fall into two classes. **Model-visible**: `exemplar`, `multi-turn`, `repair` (public, conditioning
material, plain `.jsonl` shards). **Held-out**: `eval` (SPEC-R4, `.jsonl.enc`, fail-closed per ADR-0060
until LLD-C8 lands). Every rule that today says "exemplar vs eval" in a contamination sense (SPEC-R3's
leak invariant, the leak gate in `admit()`, `store.ts`'s shard shelving) reads over the model-visible
class. The eval fail-closed gate matches `facet === 'eval'` exactly and is untouched.

### 2 · The `multi-turn` record branch

A `multi-turn` record MUST carry, in addition to the ADR-0063 trio and `meta`:

| Field | Type | Meaning |
|---|---|---|
| `priorOutput` | `A2uiOutput` (array of server envelopes) | Turn 1: the stream that put the surface on screen. Self-contained by design: retrieval is per record, so a record that only referenced another record's output would teach nothing on its own. |
| `clientInput` | array of client envelopes, v1: exactly one `{ version, action: A2uiAction }` | The client turn. `A2uiAction` is the runtime SPEC §5.2 / `protocol.ts` shape: `surfaceId`, `actionId`, `name`, `sourceComponentId`, `timestamp`, `context`, optional `wantResponse`, optional `dataModel`. |
| `a2uiOutput` | `A2uiOutput` | Turn 2: the follow-up stream. Reusing the exemplar's field name keeps "the record's output" one field for every consumer that reads it. |

Rules, each with its rejection site and code:

- **Shape** (`validateRecord`, `E_SCHEMA` at the field path): all three present; `clientInput` has length 1
  and its one envelope is an `action` whose body carries the six required `A2uiAction` fields with the
  right primitive types. Any other client envelope kind rejects at `clientInput[0]` in v1 (the
  `error` and `functionResponse` arms are named non-goals, below).
- **One surface across the record** (`checkSingleSurface` widened to walk `priorOutput`, `clientInput`
  and `a2uiOutput`; `E_SCHEMA` at the first message on a second surface): the ADR-0064 rule applies to
  the union of the three streams, not to each separately. The action's `surfaceId` is a surface-bearing
  message for this walk.
- **Pins** (`checkPins`, `E_PIN`): `version` on every envelope in all three streams and `catalogId` on
  every `createSurface` agree with `meta.protocolVersion` / `meta.catalogId`.
- **Tier-1, prior** (`admit()` stage 5, `E_*` per the LLD §6 mapping): `validateA2ui(priorOutput,
  catalog, undefined, { atFinalize: true })` must be clean. Turn 1 is a complete stream.
- **Tier-1, follow-up with the prior seed** (same stage): `validateA2ui(a2uiOutput, catalog, seed,
  { atFinalize: true })` must be clean, where `seed` is the one-entry map `surfaceId → { components:
  fold(priorOutput).components, rootDelivered: fold(priorOutput) delivered root }`. This is the TKT-0081
  mechanism used as designed: an update-only follow-up passes, a follow-up that resends `root` fails
  `IDGRAPH sid:root` (the renderer's own failure), and the record cannot be admitted. The follow-up MUST
  contain at least one surface-bearing message (an empty follow-up teaches nothing; `E_SCHEMA` at
  `a2uiOutput`).
- **Action grounding** (`admit()` stage 5, mapped to `E_IDGRAPH`, the dangling-reference class):
  `clientInput[0].action.sourceComponentId` MUST resolve to a component id in `fold(priorOutput)`, and
  that component MUST declare an action whose resolved name (`readActionSpec`, the ADR-0011 canonical
  shape plus its tolerated arms) equals `action.name`. An action no component in the prior turn can emit is
  a fabricated turn.
- **Pointer resolution** (`admit()` stage 6, `E_POINTER`): the follow-up's bindings resolve against the
  data model folded from `priorOutput` then `a2uiOutput` in stream order, per epoch (amendment A6): a
  follow-up that only updates the live surface may bind to data turn 1 delivered; a follow-up that
  `deleteSurface`s and recreates it opens a new epoch and sees only what that epoch delivered.
- **Identity** (canonical + hash, `E_DUP`): the canonical form is the epoch-aware fold of
  `priorOutput ⊕ a2uiOutput` (amendment A5: one epoch serializes as today, N epochs as the ordered list)
  extended with a `clientInput` member holding the action minus its per-session nonces (`actionId`,
  `timestamp`). Two records with the same end state and the same action are duplicates; a different
  action over the same surface is not.
- **`componentsUsed`** is computed over the merged fold's final epoch.
- **Ordering with the id-graph reset slice**: a multi-turn record whose streams never `deleteSurface`
  has exactly one epoch, so the seed, grounding, resolution and identity rules above are fully defined
  on today's validator and canonicalizer; only delete-then-recreate follow-ups need the amendment's
  slice first. The two build slices are therefore independent; the first delete-recreate seed waits
  for both.

### 3 · The `repair` record branch

A `repair` record MUST carry, in addition to the ADR-0063 trio and `meta`:

| Field | Type | Meaning |
|---|---|---|
| `invalidInput` | `A2uiOutput` (array of message objects) | The broken stream a producer actually emitted or would emit. Message objects, not raw text: text-level breakage (truncated JSON, fence wrappers) is the healer's domain (ADR-0061) and stays out of this facet. |
| `validatorErrors` | `Failure[]` (`{ code: ErrorCode, path: string }`, the shared validator's internal taxonomy from `protocol.ts`) | What the shared validator says about `invalidInput`, stored so a reader sees the verdict next to the breakage. |
| `a2uiOutput` | `A2uiOutput` | The corrected stream. |

Rules:

- **Shape** (`validateRecord`, `E_SCHEMA`): all three present; `validatorErrors` non-empty, every entry a
  `{ code, path }` with `code` in the `ErrorCode` union. An empty list is not a repair record.
- **Recomputation equality** (`admit()` stage 5 and the standing gate, `E_SCHEMA` at `validatorErrors`):
  `validateA2ui(invalidInput, catalog, undefined, { atFinalize: true }).failures`, compared as a set of
  `(code, path)` pairs, MUST equal `validatorErrors`. The stored errors are verified, never asserted, and
  a validator change that moves a verdict reds the shard gate instead of silently rotting the record.
  Because the recomputation IS the shared validator on an array input that already passed `E_PIN`, the
  codes a v1 pair can carry are exactly the ones `validateA2ui` emits on that input (`renderer/validate.ts`
  Stage 3 to 4b): `SCHEMA`, `CATALOG`, `IDGRAPH`, `POINTER` (syntax), `DEPTH_EXCEEDED`, `CONTAINMENT`.
  The other four members of `ErrorCode` are unreachable here and a curator MUST NOT author a pair around
  them: `PARSE` (the input is message objects, never text), `VERSION_UNSUPPORTED` (the pin walk rejects
  it first, below), `CATALOG_UNKNOWN` (raised by the renderer's registry at mount, not by the static
  validator) and `FUNCTION` (a render-time binding-evaluation code; `admit.ts`'s `mapTier1Code` header
  records that `validateA2ui` never emits it). The shape rule checks membership in the full union; the
  recomputation rule is what enforces reachability. Two breakages GH #1733's body lists as examples are
  likewise **out of the v1 facet, by construction, not by oversight**: an *unbound path* (syntactically valid pointer, no datum) is
  caught by admission's corpus-only `findUnresolvedPointers` (stage 6), not by the shared validator; and
  a *same-turn create+delete* validates clean at finalize (ADR-0187's `deletedHere` exemption) and is
  reported as `NET_NOOP` by the producer loop's own taxonomy (`src/agent/produce.ts`, GH #1142), which is
  not a validator code. Widening `validatorErrors` to admission- or loop-level codes is a named future
  trigger (Consequences), not v1.
- **Pins** (`E_PIN`): the pin walk covers `invalidInput` as well, so a `VERSION_UNSUPPORTED` or wrong
  `catalogId` breakage cannot be a v1 pair (it would fail `E_PIN` before tier-1). Those are healer-class
  repairs (ADR-0061), a named non-goal.
- **One surface** (`checkSingleSurface` over `invalidInput ⊕ a2uiOutput`, `E_SCHEMA`): the corrected
  stream repairs the same surface the broken one addressed.
- **The corrected stream takes the full exemplar path**: tier-1 clean at finalize, pointer resolution,
  canonical + hash, dedup, judge. A `repair` record whose `a2uiOutput` would not admit as an exemplar
  does not admit as a repair.
- **Identity** (`E_DUP`): the canonical form is the corrected stream's canonical form (as today) extended
  with a `validatorErrors` member holding the sorted `(code, path)` set. Two records that fix the same
  breakage into the same tree are duplicates; the same tree reached from a different breakage is a
  distinct pair (it teaches a different correction).

### 4 · Admission dispatch, store, consumers

- `admit()` keeps its stage order (LLD §6) and dispatches by `record.meta.facet` inside stages 2, 5, 6,
  8: shape branch, tier-1 inputs (which streams, with which seed), resolution data model, identity
  input. Stage 3 (eval fail-closed), stage 7 (leak gate, now over the model-visible class), stage 9
  (dedup, one index, names unique across facets per LLD §2 invariant i), stage 10 (judge seam) and
  stage 11 (write) are facet-agnostic.
- Stage 1 (heal, ADR-0061) stays as built: it heals `a2uiOutput` only. `priorOutput` and `invalidInput`
  are never healed (both are message arrays by contract; a text-level defect in either is `E_SCHEMA`),
  and `clientInput` is not a stream. A `repair` record whose *corrected* stream needed text healing is
  therefore both `meta.status: "repaired"` and `meta.facet: "repair"`; the combination is legal, the two
  fields answer different questions (Consequences, name collision), and the curator should expect it to
  be rare because a corrected stream is authored, not captured.
- `store.ts` shelves by facet as today: `corpus/multi-turn/<pin>/<catalogId>.jsonl` and
  `corpus/repair/<pin>/<catalogId>.jsonl`; `facetOfPath` learns the two segments; a shard whose lines
  disagree with its directory still throws at load.
- The standing corpus-data gate (LLD-C15, `corpus-data.test.ts`) runs per shard with facet-specific legs:
  the exemplar legs are unchanged; multi-turn re-runs the prior-seeded follow-up validation and the action
  grounding check; repair re-runs recomputation equality and the corrected stream's tier-1.
- `retrieve()` gains an optional `facet` filter whose **default is `exemplar`**, so every existing caller
  is byte-identical. `exportCatalogExamples` and `exportFineTune` keep their exemplar-only hard invariant;
  a facet-specific export shape (a fine-tune pair for a turn, or for a repair) lands when a consumer
  names it, by amendment here, not speculatively.
- Seeds: `src/examples/types.ts` gains `MultiTurnSeed` and `RepairSeed` beside `ExampleSeed`;
  `import-seeds.ts` maps each to its record branch and sets `meta.facet`. The site's example pages key off
  `ExampleSeed` only; rendering a multi-turn or repair seed on a page is a non-goal.

### 5 · Verdict and rubric

The verdict shape and the adapter are unchanged (ADR-0068 cl.1/cl.2): one VerdictsFile per judged run,
`verdicts[name] = { qualityScore, passed, failingDimensions? }`, `qualityScore = MIN` across the
applicable `[gate]` dimensions, `passed = qualityScore >= 4`. `a2ui-corpus.md` bumps **1.2 → 1.3** with:

- **Facet applicability column.** D1 (ground-truth validity) applies to the exemplar's `a2uiOutput`, to a
  multi-turn record's *merged* `priorOutput ⊕ a2uiOutput` stream (the `validate-payload` CLI floor runs on
  the merged stream, which is exactly what the renderer would have mounted; a follow-up judged standalone
  would fail P3 for want of the prior graph and prove nothing), and to a repair record's *corrected*
  `a2uiOutput`. D2 to D5 apply to every model-visible facet; D1 stays omitted for eval.
- **D6, Turn coherence `[gate]`, multi-turn only.** Deterministic floor: action grounding and the seeded
  follow-up validation (both mechanical, cl.2). Judgment above the floor: the follow-up is the response a
  competent producer gives to *that* action with *that* context (a form submit acknowledges or shows the
  submitted values; a list select reveals the selected item), updates the live surface rather than
  rebuilding it, and leaves the data model coherent. Anchors: 1 = the follow-up ignores the action or
  rebuilds the surface from scratch; 3 = a plausible response that over- or under-updates; 5 = minimal,
  intent-matched, idiomatic follow-up.
- **D7, Repair fidelity `[gate]`, repair only.** Deterministic floor: recomputation equality (cl.3).
  Judgment above the floor: the breakage is one a producer actually makes (not contrived), the correction
  is minimal (fixes the recorded errors, changes nothing else), and the corrected stream preserves the
  evident intent of the broken one. Anchors: 1 = the fix rewrites the UI or the breakage is artificial;
  3 = correct fix with incidental drift; 5 = minimal fix, realistic breakage, intent preserved.
- **The re-author sentence is qualified.** "Every prior VerdictsFile must be re-authored against the new
  version" holds when a dimension or anchor *that applies to the judged facet* moves. 1.3 adds
  facet-scoped dimensions and leaves D1 to D5's text unchanged for exemplar records, so the archived
  1.0 to 1.2 files stay valid history under their version and no exemplar is re-judged. New VerdictsFiles
  cite `1.3`; `parseVerdictsFile` rejects a new file still citing `1.2`, as the marker contract requires.

### 6 · The exemplar path does not regress

Normative, gated: `validateRecord` on every line of the committed exemplar shard returns `[]` before and
after; re-admitting the shard yields a byte-identical `canonicalHash` for every line (the exemplar
identity input is unchanged); `retrieve()`, `exportCatalogExamples()` and `exportFineTune()` with their
existing arguments return byte-identical results; `record.test.ts`'s existing cases pass unedited. The
upstream projection (ADR-0063 cl.4, SPEC-R1 AC1) drops `meta`, `a2uiOutput`, and now also `priorOutput`,
`clientInput`, `invalidInput`, `validatorErrors`, so a projected record of any facet still carries only
the 7 upstream fields.

### 7 · Non-goals, named

Client envelopes other than `action` in `clientInput` (the `error` and `functionResponse` arms); more than
one client turn per record (a chain is N records); text-level breakage in `invalidInput` (healer);
admission- or loop-level codes in `validatorErrors` (see cl.3); facet-specific exports; rendering the new
seeds on site pages; any change to the `eval` facet.

## Consequences

- **Two new shard directories, one pipeline.** Admission stays the single write path and the standing gate
  still re-validates everything committed; a hand-edited multi-turn or repair line fails loudly, with the
  facet-specific leg naming why.
- **The TKT-0081 seed mechanism gains its first in-repo consumer.** Admission passing a `sessionSeed`
  exercises a validator path only the live producer used before; any seed-merge defect now reds the
  corpus gate rather than surfacing as a client-error round in a game loop.
- **A repair record is a validator regression detector.** Recomputation equality means a validator
  change that alters a verdict on a stored `invalidInput` reds the shard gate. That is the intended
  coupling: the corpus teaches the validator's verdicts, so it must track them. The curator's remedy is a
  judged re-admission of the affected pair (the ADR-0068 `--replace` path), never a hand edit.
- **Name collision, recorded.** `meta.status: "repaired"` (ADR-0061: admission healed the text) and
  `meta.facet: "repair"` (this ADR: the record teaches a repair) are orthogonal axes that share a stem.
  Kim's ruling names the facet `repair`; the collision is documented here and in the SPEC §2 table rather
  than renamed around.
- **Rubric 1.3 is a runtime bump.** Every VerdictsFile authored from the bump on cites `1.3`; a curator
  who copies a 1.2 header is rejected at `parseVerdictsFile`. Exemplar verdicts are not re-authored
  (cl.5).
- **Named future triggers** (each an amendment here, never silent widening): a client envelope kind beyond
  `action`; a multi-turn chain longer than one client turn; `validatorErrors` widened to admission-level
  (`E_POINTER` resolution) or loop-level (`NET_NOOP`, `FLOW_END_MISSING`) codes once a pair needs them;
  a facet-specific export shape when a fine-tune or few-shot consumer names it.
- **GH #1733's example list is narrowed, and the issue is annotated.** The issue body names "unbound
  path" and "same-turn create+delete" as candidate pairs; cl.3 excludes both for v1 with their mechanism.
  The repair-pairs slice issue carries the reachable code set verbatim, and #1733 receives a comment
  pointing at cl.3, so a curator working from the issue text does not reach for the excluded cases.
- **No ADR for the seeds themselves.** The two multi-turn seeds (form submit, list item select) and the
  five repair pairs are curation work under `a2ui-corpus-curation`, filed as GitHub Issues blocked on the
  facet build slice; they earn no decision record (doc-standards §1c).
- **Stale → re-verify on the build gate:** everything in the Repairs cell; `a2ui-corpus-curation`'s
  "record schema" pointer row gains this ADR; `corpus/verdicts/README.md` if it restates the rubric
  version.

## Acceptance

Checkable predicates the facet build slice is dispatched against:

1. `validateRecord` accepts a conforming `multi-turn` record and a conforming `repair` record (`[]`),
   and rejects, each at the named path with `E_SCHEMA`: a multi-turn record missing `priorOutput` /
   `clientInput`; a `clientInput` of length 2; a `clientInput[0]` that is not an `action`; a `repair`
   record with empty `validatorErrors`; a `validatorErrors` entry whose `code` is outside `ErrorCode`.
2. `admit()` rejects a multi-turn record whose follow-up resends `root` with `E_IDGRAPH` (path
   `sid:root`), accepts the same record with the `root` resend removed, and rejects a record whose
   `action.sourceComponentId` is absent from the prior fold with `E_IDGRAPH`.
3. `admit()` rejects a repair record whose stored `validatorErrors` differ from the recomputed set
   (`E_SCHEMA` at `validatorErrors`), and accepts it once they match; a repair record whose corrected
   stream fails tier-1 rejects with that tier-1 code; a repair record whose `validatorErrors` carries
   `FUNCTION` or `CATALOG_UNKNOWN` rejects at recomputation (the set can never match).
4. Two multi-turn records differing only in `actionId`/`timestamp` collide `E_DUP`; two differing in
   `action.name` do not. Two repair records differing only in `validatorErrors` do not collide.
5. Every line of the committed exemplar shard (74 lines on 2026-10-03) re-admits with a byte-identical
   `canonicalHash`; `retrieve()` called with no `facet` argument deep-equals the output captured from
   the pre-change implementation in the test fixture, for each existing call shape in `retrieve.test.ts`.
6. `a2ui-corpus.md` reads `version: 1.3`; `parseVerdictsFile` rejects `rubricVersion: "1.2"` against
   it; the archived verdict files are untouched.
7. A `multi-turn` record and a `repair` record whose `promptText` near-matches an eval prompt reject
   `E_LEAK` (the leak gate covers the model-visible class); `facetOfPath` returns `multi-turn` and
   `repair` for their shard paths and still throws on an unknown segment.
8. `corpus-data.test.ts` has a per-facet leg for each new shard directory that passes against a
   fixture shard in the test (the seed slices then make the committed shards real).
9. After the id-graph reset slice lands: a multi-turn follow-up that `deleteSurface`s and recreates its
   surface and binds to a path only turn 1 delivered rejects `E_POINTER`.
10. `npm run check` and `npm test` exit 0.

## Alternatives considered

- **Widen the exemplar record instead of adding facets** (an optional `clientInput` on an exemplar, or
  an optional `invalidInput` pair): rejected. Kim's #1730 ruling fixes the exemplar shape as unchanged;
  an optional client turn would also change what "the record's output" means for `exportFineTune` and
  retrieval, and a repair pair is not an exemplar (its `invalidInput` must never be retrieved as
  conditioning material by a consumer that forgets to check for it). Facets keep the consumers'
  eligibility filters honest by construction.
- **Reference the prior turn by record name instead of embedding it**: rejected. Retrieval and the
  standing gate are per record; a cross-record reference needs a resolver in both, a dangling-reference
  failure mode, and a rule for what happens when the referenced exemplar is quarantined or replaced.
  Embedding costs bytes and buys a self-contained teaching unit.
- **Let `validatorErrors` be authored prose or admission `E_*` codes**: rejected. Prose cannot be
  recomputed; `E_*` codes are admission results, not what the producer loop sees from the validator. The
  shared `ErrorCode` taxonomy is the one the self-correct loop reads back, and it is the one the gate
  can recompute. The two GH #1733 breakages this excludes are named in cl.3 with their mechanism.
- **A separate rubric document per facet** (`a2ui-corpus-multi-turn.md`, `a2ui-corpus-repair.md`):
  rejected. `parseVerdictsFile` pins `rubric: 'a2ui-corpus'` and one `rubricVersion`; per-facet rubrics
  would need a per-facet adapter and a VerdictsFile per facet per run. Facet-scoped dimensions inside one
  rubric keep the adapter unchanged.
- **Bump the rubric and re-judge all exemplars**: rejected. D1 to D5 do not move for exemplar records;
  re-authoring 74 verdicts to satisfy a sentence written before facet-scoped dimensions existed is
  process, not quality. The sentence is qualified instead (cl.5).
- **Include the two excluded breakages by recomputing admission's stage 6 as well**: deferred, not
  rejected. It is a clean widening (`validatorErrors` gains an `E_POINTER` arm computed by
  `findUnresolvedPointers`), but no v1 pair needs it and mixing two taxonomies in one field without a
  consumer is speculative. Named as a trigger.

## Erratum to cl.3 (2026-10-04, GH #1756, from the independent review of PR #1749; append-only)

Cl.3's "Recomputation equality" rule says a *same-turn create+delete* validates clean at finalize "(ADR-0187's
`deletedHere` exemption)". PR #1749 (GH #1740) removed that name: `deletedHere` no longer exists in
`renderer/validate.ts`. The behavior the sentence describes still holds, and only its mechanism name is
stale. A payload that sends `createSurface s` and then `deleteSurface s` in the same turn still validates
clean at finalize, and so does `createSurface s, root, deleteSurface s`.

**The current rule** is the surface epochs of the ADR-0064 2026-10-03 amendment (A2, A3). A surface's
messages partition into epochs, and a `deleteSurface` closes the open one. A closed epoch never takes the
finalize emptiness arm (an empty closed epoch mounted nothing, so nothing was abandoned; a non-empty one is
judged in full in both modes). Only the epoch still open at payload end takes that arm, so a same-turn
create plus delete passes, while `createSurface s, root, deleteSurface s, createSurface s` with nothing after
it fails `s:root-missing`. Read cl.3's parenthetical as "(the ADR-0064 2026-10-03 amendment's epochs)"; the
rest of the sentence stands, including `NET_NOOP` being the producer loop's own taxonomy
(`src/agent/produce.ts`, GH #1142) and not a validator code.
