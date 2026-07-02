# A2UI build — next session (post-restart)

> Paste the prompt below after restarting (the restart activates agent-teams via `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`). · 2026-06-26
> Context: the full A2UI architecture is drafted + gate-clean in [`./`](./) (PRD → SPECs → LLDs); the team roles are in [`../../.claude/agents/README.md`](../../.claude/agents/README.md); handoffs follow [`../../.claude/agents/handoff-contract.md`](../../.claude/agents/handoff-contract.md).

## The prompt

```
Convene the planning/execution team (agent-teams is now enabled) with orchestration-lead
coordinating, planning-lead in the design seat, and execution-lead in the build seat — per
.claude/agents/README.md. Every agent reports back via the handoff contract
(.claude/agents/handoff-contract.md).

GOAL: begin the A2UI build at milestone A1 (runtime foundation) from the architecture in
.claude/docs/specs/ — the zero-dependency renderer + default catalog that render a streamed A2UI
v1.0 payload into live @agent-ui/components controls (PRD-G1).

HOW (honor the operating model):
1. orchestration-lead — route + sequence the work, run the eval gate between phases,
   surface blockers to me, and keep the loop bounded.
2. planning-lead — FIRST decompose A1 with system-decompose (both planes; clear
   scripts/coverage_check.py) against the existing LLDs (.claude/docs/specs/llds/a2ui-renderer.lld.md
   and a2ui-catalog.lld.md), reusing their build sequences. Surface any DEPENDENCY GAPS —
   A1 assumes @agent-ui/components ≈ G7 (PRD Assumption A-2); if the control family isn't
   built, propose the smallest viable slice and flag it. If a doc needs revision, repair the
   OWNING doc and record an ADR in .claude/docs/adr/.
3. execution-lead — build the FIRST SLICE ONLY: validate.ts (the shared validator, renderer
   LLD build-sequence step 1), to its acceptance (runtime SPEC-R11 + the N6 parity invariant).
   Scaffold packages/agent-ui/a2ui only as that slice needs; keep npm run check && npm test green.

BOUND: deliver (a) the A1 decomposition (coverage-clean), (b) any dependency-gap findings,
and (c) the validate.ts slice — then STOP and report (via the handoff contract) before going
further. Do not build the whole milestone in one shot.
```

## Notes

- **If teams didn't activate** (restart didn't pick up the env var): the prompt still works — the host plays coordinator and dispatches `planning-lead` / `execution-lead` individually by description. Confirm with `/agents`, or check that "convene the team" spawns teammates rather than one subagent.
- **Why `validate.ts` first:** it's the shared gate used by the renderer, corpus admission, and CI (the parity invariant N6), and it's largely standalone — buildable even if the `@agent-ui/components` control family isn't fully ready, which de-risks the dependency on Assumption A-2.
