---
id: T-0410
title: "A surface retired by the one-per-new-id rule leaves a SURFACE_REPLACED tally in the turn trace"
type: chore           # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-22
claimed_by: claude:a8ce3b21 2026-10-22
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
When produce() retires a surface under the one-per-new-id rule (a flagged-only surface replaced by a new id, packages/agent-ui/a2ui/src/agent/produce.ts near :1864), the turn trace records it as a tally (for example `SURFACE_REPLACED` naming the retired and the new id), so trace review and probes can see a retired surface instead of only the original `IDGRAPH`.

## Intent
- Do: first confirm on main that a retirement leaves no trace entry (reproduce probe P1 from the note: round 1 `ask-1` IDGRAPH plus a clean `greet-1`; round 2 `greet-1` plus a new `info-1`); then add the tally on the same channel the existing tallies use (find how NARRATION_UNCORRECTED or the shipped-tallied codes reach the trace and follow that pattern), with a test beside produce that is red on main. Keep it out of the repair round and out of every model-read hint: it is trace-only. If the trace type or a devtools/trace reader enumerates codes, add it there too.
- Non-goals: changing which surface is kept (notes :152, :154 are rule-consistent by design); any prompt text.
- Done when: the new test fails on main and passes after; `npm run check`, `npx vitest run packages/agent-ui/a2ui/src/agent packages/agent-ui/a2ui/src/live-agent`, and the probe project (`npx vitest run --project scripts scripts/e2e-admin/probe`) exit 0; prompt-equivalence baseline unchanged.

## Context
From .sdlc/notes/notes.md :153 (the T-0330-era solo listed the missing SURFACE_REPLACED tally as open). Skill a2ui-build. Producer notes in packages/agent-ui/a2ui/AGENTS.md (Wire and validator spine).

## Constraints
No em dashes. Prompt stack byte-pinned. Never rewrite .sdlc/evals/rounds.
- Lane: solo because size L2 (steps.py lane); overnight goal 2026-10-21

## Acceptance criteria
- The two `T-0410` tests in `packages/agent-ui/a2ui/src/live-agent/produce-response-type.test.ts` pass; the first failed on 9992495f7 (`expected [ 'IDGRAPH' ] to deeply equal [ 'IDGRAPH', 'SURFACE_REPLACED' ]`).
- P1 (round 1 `ask-1` IDGRAPH plus clean `greet-1`; round 2 `greet-1` plus new `info-1`) ships with trace `failureCodes` `["IDGRAPH","SURFACE_REPLACED"]` and `replaced` `[{"surfaceId":"ask-1","by":"info-1"}]`; no provider request of the turn contains `SURFACE_REPLACED`.
- The tally is added in `traceFor` (produce.ts), so every trace-shipping path carries it; `TurnTrace.replaced` is declared in `meta-line.ts` and carried by `tools/agent/trace-log.ts`.
- `npm run check`, `npx vitest run packages/agent-ui/a2ui/src/agent packages/agent-ui/a2ui/src/live-agent` and `npx vitest run --project scripts scripts/e2e-admin/probe` exit 0; `prompt-equivalence.baseline.json` unchanged.

## Outcome

2026-10-22 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 9992495f7246
- Changed: A surface retired by the one-per-new-id rule adds a trace-only SURFACE_REPLACED tally with the retired and new ids
- Commits: none
- Check: 1 The two `T-0410` tests pass; the first failed on 9992495f7: pass
- Check: 2 P1 ships `failureCodes` `["IDGRAPH","SURFACE_REPLACED"]` and `replaced` `[{"surfaceId":"ask-1","b...: pass
- Check: 3 The tally is added in `traceFor` (produce.ts); `TurnTrace.replaced` declared in `meta-line.ts`, c...: pass
- Check: 4 `npm run check`, the agent plus live-agent vitest run, the probe project exit 0; baseline unchanged: pass
