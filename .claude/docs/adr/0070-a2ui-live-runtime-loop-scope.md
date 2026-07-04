# ADR-0070 — the live runtime loop is the SPEC-R6 contract minus the critic round: generate → heal+validate → self-correct (maxRounds 3) → VALIDATE-THEN-STREAM → render; the rubric stays authoring-time

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-04
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-04 |
> | **Proposed by** | planner (design seat — the live-agent intake, NEXT item 3) |
> | **Ratified by** | orchestration-coordinator + Kim ("proceed", 2026-07-04) — green gates: coverage --strict · adr_check 5/5 · harness spec/lld 3/3; all 3 independent doc-reviews GO |
> | **Repairs** | `a2ui-live-agent.spec.md` (states the runtime loop scope + the validate-then-stream ordering) · `a2ui-streaming-pipeline.lld.md` LLD-C2 (`produce()` inherits this exact bound) |
> | **Supersedes / Superseded by** | Relates ADR-0067 (the harness SPEC-R6 loop contract this specializes for runtime) · harness LLD §6 (the round-orchestration rules; the critic round is authoring-time) · ADR-0073 (the injected `AgentProvider` this loop consumes) |

## Context

The expert harness (ADR-0067) defines the bounded compose→validate→self-correct loop (SPEC-R6):
generate corpus-conditioned → run the deterministic gates FIRST (`validate-payload`) → grade against
the `a2ui-payload` rubric via the `a2ui-reviewer` critic ONLY on gate-green → self-correct →
`maxRounds = 3` → halt-and-report. That loop is HOST-orchestrated: the host dispatches the critic seat
between rounds.

The live-agent demo is the first PROGRAMMATIC realization of this loop (harness LLD §6, streaming
LLD-C2). But a running web demo is not a Claude Code host: it has no Task tool, cannot dispatch the
`a2ui-reviewer` critic, and must not (a rubric-grading round is a second model call the demo has no
budget or seat for). So the runtime loop is NOT identical to the authoring loop — its scope must be
pinned, or the build will either try to make an impossible critic call or silently drop provable
validity.

A second decision is ordering: A2UI is streamed (the demo's whole aesthetic is watching a surface
assemble), but PRD-G4 demands provable validity before ship. Streaming raw model tokens live and
validating only at finalize (the renderer's ADR-0002 validate-at-finalize) can paint an INVALID
partial surface before the failure is caught.

## Decision

**The runtime loop is the SPEC-R6 contract with the critic round removed and a validate-then-stream
ordering.**

> This ADR ratifies TWO coupled decisions under one record — (1) *drop the runtime rubric-critic
> round* and (2) *validate-then-stream ordering*. They are kept together because both are consequences
> of "a web demo runs the loop but has no seat/critic": (1) is why there is no grading call, (2) is how
> provable validity is preserved without one. Ratify both knowingly.

1. **Deterministic gate only, at runtime.** Each turn's loop is: retrieve exemplars → generate →
   `heal` + `validateA2ui` (the SHARED healer + validator, no fork — SPEC-N3 parity) → on failure,
   feed the validator's structured failures back into the next generation → bounded at
   `maxRounds = 3` → halt-and-report. The deterministic gate is the WHOLE runtime verifier. There is
   **no runtime rubric-grading round** — `a2ui-payload.md` + `a2ui-reviewer` are authoring/eval-time
   actors, not a call a web demo makes.

2. **Quality is enforced at authoring/curation time, not runtime.** The rubric still governs: the
   recorded-transcript backbone's payloads were graded ≥4 against `a2ui-payload.md` before commit
   (they reuse shelf seeds, already validator-clean), and the corpus the demo retrieves over is
   already tier-2 judged (ADR-0068). Runtime conditions on judged quality; it does not re-grade.

3. **Validate-then-stream.** The loop produces a FULLY validated payload for a turn BEFORE streaming
   its lines to the browser. Provable validity (PRD-G4) precedes any paint. The lines are then streamed
   (optionally paced) so the surface still assembles progressively (root-early → first paint before
   finalize) — the streaming aesthetic is preserved, but nothing invalid is ever rendered. This also
   keeps the browser transport IDENTICAL between the recorded backbone and the live overlay: both
   stream validated JSONL lines.

4. **The driver is provider-agnostic + testable.** `produce()` takes an injected `AgentProvider`
   (the `stream(...)` seam of ADR-0073); the proxy supplies one backed by a real model, tests supply a
   stub. So the loop's mechanics (self-correction, the bound, halt-and-report) are gate-covered
   deterministically with no live model.

## Consequences

- **First-paint latency is honest.** Validate-then-stream means the surface paints only after the
  agent has generated and validated — the "agent thought, checked, then the surface streamed in"
  experience. The pure streaming aesthetic (paced arrival of a known-good payload) is already owned by
  the `a2ui-stream` page; the live page's point is that a REAL model produced a VALIDATED surface.
- **The loop is CI-provable without a model.** The stub-generator unit test proves only-valid-emitted,
  feedback-driven self-correction, and halt-at-bound — the SPEC-R6 mechanics, deterministic and
  secret-free.
- **Generator ≠ critic is preserved by construction.** No agent grades its own output at runtime
  because no grading happens at runtime; the deterministic gate is not grading (checking output
  against a script is not self-grading — the harness's own rule).
- **The streaming LLD-C2 driver inherits this exact bound** — one loop contract, specialized here.
- **Stale → re-verify on the build gate:** `maxRounds`/the bound (if a real live run shows 3 rounds is
  too few for hard intents, revisit — but never make it unbounded) · the injected-`AgentProvider`
  signature (tracks ADR-0073) · the "validate-then-stream" ordering claim if a future "raw live"
  variant lands (it must stay a variant, not replace the default).

## Acceptance

- `produce()` with a stub generator (first-invalid-then-valid) emits ONLY the validated stream within
  `maxRounds = 3`, feeds the validator's failures back on the invalid round, and halts-and-reports on
  exhaustion — a deterministic unit test, `npm run check` + `npm test` green.
- A grep/read confirms no runtime rubric-grading call and no `a2ui-reviewer` dispatch in the demo/proxy
  code path.
- The browser transport streams validated JSONL identically for the recorded and live paths (the
  round-trip gate uses the same ingest path for both).

## Alternatives considered

- **Include the rubric-critic round at runtime.** Rejected: a web demo has no Task tool / seat-dispatch
  and no budget for a second grading model call; rubric grading is an authoring-time discipline
  (harness §6), and forcing it into runtime would be unbuildable and off-charter.
- **Stream raw model output live, validate at finalize (ADR-0002).** Rejected as the default: it can
  paint an invalid partial surface before the failure is caught, breaking PRD-G4's "provable validity
  before ship." Noted as a documented variant behind the same transport for a future "raw live" demo,
  guarded by the renderer's fault-isolation.
- **No loop — one-shot generate then render.** Rejected: drops self-correction, so a single formatting
  slip renders nothing or errors; the bounded loop is the whole point of a reliable generator (PRD-G1).
