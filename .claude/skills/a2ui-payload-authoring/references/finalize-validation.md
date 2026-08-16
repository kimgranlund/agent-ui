# Finalize-granularity validation — why an abandoned `createSurface` passes mid-stream and fails at the end

Harvested 2026-08-16 from ADR-0187 (`.claude/docs/adr/0187-validator-finalize-signal.md`, ratified
2026-08-13) and GH #829 (its design fork; the fix path for GH #802's empty-second-host symptom). Every
source fact below was re-read against `packages/agent-ui/a2ui/src/renderer/validate.ts` and the four
opt-in call sites on 2026-08-16 — the code is the canon, this file is the map. Owner of the law:
`a2ui-runtime.spec.md` SPEC-R11 + `a2ui-renderer.lld.md` §8 LLD-C11 (cite, never copy).

## The question this file answers

"My payload validates 0-failure while I compose it, then the CLI / the renderer / `produce`'s per-round
verdict fails it with `IDGRAPH ${sid}:root-missing` — what changed, and what must every `createSurface`
deliver?" — one question type: WHEN the validator judges a payload complete, and what it demands then.

## The pattern — a caller-supplied signal, never an inferred one [verified 2026-08-16]

Two payloads are byte-identical on the wire yet mean opposite things: a `createSurface` with no
`updateComponents` YET (a legitimate mid-stream prefix — more is coming) and a `createSurface` that never
receives one (an abandoned, truly-final empty surface — GH #802's permanently-empty `ui-surface-host`).
No change inside `validate.ts` can fail one without failing the other; the missing fact ("is more coming?")
exists only at the call site. ADR-0187 therefore makes the caller SAY so:

- `validateA2ui(msgOrOutput, catalog, sessionSeed?, opts?: { atFinalize?: boolean })` — a 4th
  optional OPTIONS BAG (future finalize-adjacent knobs extend it; never a 5th positional parameter).
  Absent/`false` = byte-identical to the pre-ADR verdict, by construction (`validate.ts` `validateA2ui`,
  `opts?.atFinalize === true` is the only read).
- `createSurface` now registers its `surfaceId` into the judged set unconditionally (gated on the id
  being a string) — behaviour-neutral in default mode because the empty-graph exemption stays there.
- In finalize mode a registered-but-empty surface fails the EXISTING `IDGRAPH` code with
  `${sid}:root-missing` — no new failure code (the SPEC-R6 CONTAINMENT precedent was weighed and NOT
  followed: this is the existing missing-root class judged at a new granularity, so the renderer's
  IDGRAPH filter, the wire union and the conformance code table stay untouched). One edge: a
  same-payload `deleteSurface` excludes that sid (create-then-delete leaves nothing abandoned —
  `deletedHere` in `validate.ts`).
- Heuristic finalize inference (timers, stream-end sniffing inside the validator) was rejected as a
  category error: the validator is pure and total over a static array.

## Who opts in, who stays default [verified 2026-08-16 — call sites]

| Call site | Mode | Why |
|---|---|---|
| `tools/harness/validate-payload.ts` — THE compose-loop CLI (`validate-payload.ts:122`) | `{ atFinalize: true }` | a pasted/authored payload IS a complete set |
| `corpus/admit.ts` stage 5 (`admit.ts:136`) | `{ atFinalize: true }` | an admitted record IS a complete set; the 29-record exemplar shard scanned clean 2026-08-13 |
| `agent/produce.ts` per-round verdict (`produce.ts:1011`) | `{ atFinalize: true }` | an abandoned surface becomes a PRE-WIRE self-correct round, fed back via the trace's codes |
| `renderer/renderer.ts` `finalizeSurface` (`renderer.ts:494`) | `{ atFinalize: true }` | the client half — the existing IDGRAPH-only filter passes the failure to the wire unmodified |
| `tools/conformance/run.ts` (`run.ts:126`) | per-fixture `atFinalize?` flag, default off | two committed fixtures deliberately carry createSurface-only sids for single-failure isolation |
| `site/lib/artifact-feed.ts` · per-prefix validation (message-lifecycle SPEC-R4 AC1) | default | per-artifact chunks and mid-stream prefixes are NOT finalize boundaries — "every prefix validates 0-failure" is a ratified law that stands |

## What it means for a composed payload [inferred from the table above]

- Every `createSurface` you emit must deliver an `id:"root"` node for that `surfaceId` before the
  stream is complete, or drop the unused `createSurface`, or `deleteSurface` it in the same payload.
  Opening a second surface "for later" and never filling it is exactly the shape that now fails.
- The `validate-payload` CLI in the bounded compose→verify loop judges at finalize granularity, so
  the gate catches it before grading — read `IDGRAPH ${sid}:root-missing` as "you opened a surface
  and never rooted it", not as a dangling-child error.
- Split `updateComponents` streams stay legal (runtime SPEC-R4 out-of-order tolerance): mid-stream
  emptiness is a prefix, and only the COMPLETE set is judged. A live producer that opens-and-abandons
  eats one self-correct round; the lever if that runs hot is prompt teaching, never loosening the
  validator (ADR-0187 §Consequences).
- Client-side there is ONE presentational brace and no second judge: `ui-surface-host` flips a
  host-owned terminal-empty state at `finalize()` when no root ever attached (a read of its own facts,
  covering recorded transcripts and the A2A bridge whose streams bypass the server opt-in);
  `conversation.ts` never re-judges emptiness (SPEC-N6's one-implementation law).

## Provenance

ADR-0187 (accepted 2026-08-13, ratified by kimgranlund via the `ratify ADR-0187` utterance on GH #829,
flipped by `scripts/adr_ratify.py`) · build plan `.claude/docs/lld/a2ui-validator-finalize.lld.md` ·
GH #829 Findings 1–2 (the mechanical always-strict fix, attempted and reverted with proof: it reds the
prefix laws + four suites). Harvested here 2026-08-16 (adr-queue row `adr-0187`); [drift-prone]: the
call-site line numbers in the table — re-verify against the files on any validator or renderer edit.
