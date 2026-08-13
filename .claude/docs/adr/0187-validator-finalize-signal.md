# ADR-0187 — the validator finalize signal (GH #829): `validateA2ui` gains an opt-in `atFinalize` option — an abandoned content-less `createSurface` fails `IDGRAPH sid:root-missing` at the two finalize call-sites (renderer finalize + produce's per-round judgment) and at corpus admission, while every default-mode verdict stays byte-identical and the ratified prefix laws stand untouched

> Source: agent-ui ADR log (this directory — the numbered files ARE the index; status lives in each ADR's own header). · 2026-08-13
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-08-13 |
> | **Proposed by** | planner seat (GH [#829](https://github.com/kimgranlund/agent-ui/issues/829)'s design leg — the issue's second Findings entry explicitly routes the fork here rather than re-attempting the reverted mechanical fix) |
> | **Ratified by** | kimgranlund (repo owner), 2026-08-13, via the [`ratify ADR-0187` utterance](https://github.com/kimgranlund/agent-ui/issues/829#issuecomment-5284005297) — verified + flipped by `scripts/adr_ratify.py` (ADR-0149) |
> | **Repairs** | on ratification+build: [`a2ui-runtime.spec.md`](../spec/a2ui-runtime.spec.md) SPEC-R11 (finalize-granularity sentence) + SPEC-R4 (mid-stream-only REV cross-ref) · [`a2ui-live-agent.spec.md`](../spec/a2ui-live-agent.spec.md) SPEC-R5 (per-round judgment runs at finalize granularity) + SPEC-R4 (the fed-back failure class includes the at-finalize empty surface) · [`a2ui-message-lifecycle.spec.md`](../spec/a2ui-message-lifecycle.spec.md) SPEC-R4 AC1 (per-prefix validation scoped to DEFAULT mode) · [`a2ui-training-corpus.spec.md`](../spec/a2ui-training-corpus.spec.md) SPEC-N1/R8-AC3 parity prose (admission judges at finalize granularity) · [`../lld/a2ui-renderer.lld.md`](../lld/a2ui-renderer.lld.md) §8 LLD-C11 granularity/parity paragraphs + §9 IDGRAPH row |
> | **Supersedes / Superseded by** | **Relates** TKT-0081 (the `SurfaceSeed` merge this composes with, no carve-out change) · ADR-0128 (cross-turn IDGRAPH guard, untouched) · a2ui-container-vocabulary SPEC-R6 (the new-code precedent weighed and NOT followed — §Alternatives) · **Resolves** GH #829's design fork (build BLOCKED on ratification) — the fix path for GH #802's empty-second-host symptom |

## Context

GH #829's diagnosis (two dated Findings, 2026-08-13, both verified against source) is complete:
`validateMessage`'s `createSurface` case never registers the surfaceId into the `surfaces` map, so a
createSurface that never receives any `updateComponents` is invisible to the id-graph stage —
`validateA2ui` returns fully clean, the payload ships, and `conversation.ts` mounts a
permanently-empty `ui-surface-host` beside the working card (GH #802). The same gap holds
client-side: `renderer.ts#finalizeSurface` re-frames such a surface as
`updateComponents { components: [] }`, which `checkIdGraph`'s `byId.size === 0` early return waves
through.

The mechanical fix — register + drop the exemption — was **attempted and reverted with proof**: it
reds the ratified prefix laws (message-lifecycle SPEC-R4 AC1's "every prefix validates 0-failure",
the live-agent round-trip prefix suite) plus the conformance CLI's single-failure-isolation fixtures
and two stubbed-round suites. The two shapes are byte-identical on the wire: "a legitimate prefix,
more still coming" and "an abandoned, truly-final empty surface" are the SAME static array. No
caller-agnostic change to `validate.ts` can fail one without failing the other — the missing fact
(*is more coming?*) lives only at the call sites. That is a genuine fork: the signal's shape, who
opts in, the failure code, and whether the client also defends all had real alternatives.

## Decision

1. **`validateA2ui` gains a 4th optional parameter `opts?: { atFinalize?: boolean }`.** An options
   bag (future finalize-adjacent knobs extend it, never param #5). Absent/false = byte-identical to
   today — every existing caller, test, and fixture is untouched by construction.
2. **`createSurface` registers its surfaceId into the judged set unconditionally** (gated on
   `surfaceId` being a string, so a SCHEMA-invalid line isn't double-flagged). Behavior-neutral
   alone: the `byId.size === 0` exemptions stay for default mode.
3. **In finalize mode, a registered-but-empty surface fails the EXISTING `IDGRAPH` +
   `${sid}:root-missing`** — no new failure code (§Alternatives). One new edge is specified: a
   same-payload `deleteSurface` excludes that sid from the emptiness judgment (create-then-delete
   leaves nothing abandoned).
4. **Opt in:** `renderer.ts#finalizeSurface` (the client half — the existing IDGRAPH-only filter
   passes the failure to the wire unmodified) · `produce.ts`'s per-round verdict (the server half —
   an abandoned surface becomes a pre-wire self-correct round) · `corpus/admit.ts` stage 5 and its
   mirror `tools/harness/validate-payload.ts` (an admitted/pasted record IS a complete set; the
   29-record exemplar shard scanned clean 2026-08-13 — nothing reds). **Stay default:** the
   conformance runner (two committed fixtures deliberately carry createSurface-only sids for
   single-failure isolation; the fixture schema instead gains an additive per-fixture
   `atFinalize?: boolean` + a negative/positive fixture pair) · `site/lib/artifact-feed.ts`
   (per-artifact chunks are not finalize boundaries) · `workbench-summary`'s gate (named hold, may
   follow up).
5. **TKT-0081 needs NO new carve-out**: the seed merge already runs before the id-graph stage and
   already skips `createdHere` sids (GH #307 F2) — a session-known touched surface merges its prior
   graph (never judged empty), a re-created-empty surface is judged standalone (exactly the
   defect), an untouched seeded surface never enters the judged set.
6. **Client-side: single-owner with one presentational brace.** `conversation.ts` never
   re-judges emptiness; `ui-surface-host` flips a host-owned terminal-empty state at `finalize()`
   when no root ever attached (a state read of its own facts, not a re-validation) — covering
   non-produce producers (recorded transcripts, the A2A bridge) whose streams bypass the server
   opt-in. Defer-mount and unmount-at-finalize are rejected (§Alternatives).

The how — signatures, stage ordering, fixture deltas, slice plan, acceptance — lives in
[`../lld/a2ui-validator-finalize.lld.md`](../lld/a2ui-validator-finalize.lld.md). The owning-doc
clauses this repairs are enumerated in **Repairs** above; their REV blocks land with the build,
after ratification.

## Consequences

- The public `validateA2ui` signature widens (additive). SPEC-R11's "one shared implementation"
  law is preserved — one function, one new mode, no fork.
- Zero wire widening: `IDGRAPH` → `VALIDATION_FAILED` + surfaceId per the existing §9 mapping; the
  `A2uiWireError` union and the conformance code table are untouched.
- Live models that open-and-abandon a second surface now eat a self-correct round (observable via
  the trace's fed-back codes, SPEC-N4); the hint prose teaches the exact repair (deliver `root` or
  drop the unused `createSurface`). If measured hot, the lever is prompt teaching — never
  loosening the validator.
- Two stub fixtures legitimately change and are repaired in their slices:
  `a2ui-surface-toggle.test.ts`'s bare-createSurface round gains a minimal root delivery;
  `conversation.test.ts`'s composition-parity trace gains the designed finalize `'client'` entry.
- Both prefix suites and the two isolation fixtures stay byte-identical green — they are the
  regression proof that default mode did not move.

## Alternatives considered

- **Always-strict validator (the reverted fix)** — rejected with proof: reds the ratified prefix
  laws + 4 more suites; mid-stream prefix and abandoned surface are indistinguishable without the
  caller's signal. GH #829 Findings 2 documents the revert.
- **A new failure code (`ABANDONED_SURFACE`/`EMPTY_SURFACE`, the SPEC-R6 CONTAINMENT precedent)** —
  rejected: CONTAINMENT expressed a genuinely NEW structural relation; this defect IS the existing
  missing-root class, judged at a new granularity. Reuse keeps the renderer's IDGRAPH filter, the
  wire union, the §9 table, and the conformance manifest all unmodified. A code split stays
  additive later if telemetry ever needs it.
- **Client-only fix (defer mount until content arrives)** — rejected: kills the streaming
  placeholder affordance, changes legit first-paint sequencing, and leaves the invalid payload
  validating clean everywhere else (symptom patch, not root cause).
- **Unmount the empty host at finalize** — rejected: `routeLine`'s known branch routes later turns
  to the ORIGINAL host (SPEC-R7); unmounting breaks that route and hides the evidence.
- **Heuristic finalize inference (timers / stream-end sniffing inside `validate.ts`)** — rejected:
  the validator is pure and total over a static array; inferring liveness inside it is a category
  error and exactly the ambiguity the explicit signal removes.
- **A duplicated emptiness judgment in `conversation.ts`** — rejected: a second judge forks the
  one-implementation law (SPEC-N6); the host presents its own already-held state instead.
