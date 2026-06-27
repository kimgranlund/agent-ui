# agent-ui — team roles & chain of command

> Three reusable subagent role files that compose into a planning/execution team.
> Requires `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` (set in `.claude/settings.json`; env vars load at session start, so **restart the session** for teams to activate). · 2026-06-26

## The roles

| Role | Seat | Owns | Standing skills (`skills:` preload) |
|---|---|---|---|
| [`orchestration-lead`](./orchestration-lead.md) | coordinator | chain-of-command, routing, the eval gate, the escalation loop, report rollups | `orchestration-design`, `loop-design` |
| [`planning-lead`](./planning-lead.md) | design | decomposition (two planes) + PRD · SPEC · LLD · ADR + knowledge distillation | `decomposing-systems`, `authoring-prds/specs/llds` |
| [`execution-lead`](./execution-lead.md) | build | implement to the LLD; enforce system-design rules; run the gates | `authoring-llds`, `decomposing-systems`, `authoring-components` |

Each is authored to the `authoring-agents` contract (scoped `tools`, deliberate `model`, trigger `description`, judgment-frame body). They are reusable role files: the host (or a team) composes them; a subagent does not spawn other subagents.

## How work flows

**DOWN (intent → resolution).** orchestration-lead routes: planning-lead **decomposes** (via `decomposing-systems` — both planes, coverage-clean) then **authors** PRD→SPEC→LLD; orchestration-lead runs the **eval gate**; execution-lead **builds** to the LLD and runs `npm run check && npm test`.

**UP (discovered reality → repair the owner).** execution-lead surfaces a constraint or a needed global-pattern change → **recommends** to orchestration-lead → orchestration-lead engages planning-lead to **repair the OWNING doc** (the fact's home — never patch the symptom) and record an **ADR** → orchestration-lead **ratifies** → the change **propagates** down and dependents regenerate.

```
            ┌─────────────────── orchestration-lead ───────────────────┐
            │  route · eval-gate · ratify · report                     │
            ▼                                                          ▲
      planning-lead ──(PRD→SPEC→LLD)──▶ execution-lead ──build/verify──┘
            ▲                                   │
            └────── repair owner + ADR ◀── escalate constraint ────────┘
```

## Invariants this encodes (from `docs/process.md` + the spec family)

- **Generator/critic separation** — a maker never grades its own output; orchestration-lead's eval is a separate step.
- **Repair the owner** — a change edits the document that owns the fact, then propagates; downstream copies are regenerated.
- **Decompose before authoring** — planning-lead clears `decomposing-systems`'s coverage check before a doc is written.
- **Gates are deterministic** — true/false checks are scripts/hooks (`harness_checks.py`, `coverage_check.py`, `npm run check && npm test`), not agent judgment.
- **Context isolation** — each planning/execution dispatch runs on **fresh context**; only `orchestration-lead` retains context across the loop, growing by one handoff block per slice, not a worker transcript. Parallel build dispatches use **worktree isolation** so fresh-context builders don't collide; the apex reconciles at the gate.
- **Handoff contract** — every agent reports back with the same block (Summary · Files changed · Tests/checks run · Evidence · Risks · Open questions · Recommended next action); `orchestration-lead` returns it as a team rollup. See [`handoff-contract.md`](./handoff-contract.md).

## Convening the team

With teams enabled, describe the team in the prompt (e.g. "convene the planning/execution team with orchestration-lead coordinating") and the roles above are composed at runtime. Without teams, dispatch the roles individually by their descriptions — the host plays coordinator.
