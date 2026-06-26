# Best Practices — Control Patterns (/goal, /loop, and the continuation plane)

How to drive autonomous work without conflating selection and control. Assumes `00-foundations.md`. Scored by `rubric-usage-patterns.md` (§C). Version-sensitive mechanics are marked `△ verify against your build`.

## The continuation plane

These patterns decide *when the next turn fires*, not *what runs on it*. Discovery (description-matching) handles selection underneath, every turn. Do not expect any continuation pattern to "find the right agents and skills" — that is always-on behavior, orthogonal to the goal.

| Pattern | Job | Control mode |
|---|---|---|
| `/goal` | Run until a verifiable condition holds | Objective |
| `/loop` | Re-run a prompt on a timer (polling) | Objective (recurring) |
| Auto mode | Approve tool calls automatically | — |
| Stop hook (exit 2) | Force continued work until a check passes | Objective (enforced) |
| Agent team | Self-coordinating, long-running | Mission |

## /goal — objective-driven autonomy

`/goal` sets a completion condition and keeps working toward it without per-step prompting. After each turn a separate fast evaluator model reads the transcript and answers met / not-met; if not met, another turn starts. `△ requires a recent build (v2.1.139+); one active goal per session.`

The condition is a one-line rubric, and its quality is the whole game:

- **Verifiable end-state, not process.** Name a measurable condition with a stated proof: "`pnpm test` exits 0," "every call site compiles," not "the code is clean."
- **Self-evidencing.** The evaluator judges only what the agent has surfaced in the transcript — it does not run commands or read files itself. The proof must land in the conversation, or the gate is judging vapor.
- **Bounded.** Append a cap ("or stop after 25 turns") so an unmeetable goal cannot run forever.

## /loop — polling, not finishing

`/loop` re-runs a prompt on an interval. Use it to monitor external state that changes ("check the build status; alert on failure"). Putting `/loop` on work with a finish line burns turns re-running a completed job; putting `/goal` on external state spins because the condition is not the agent's to move. `△ /loop may be built-in or a custom command in .claude/commands/ depending on build — verify.`

## Stop hooks — enforced continuation

When you need "do not finish until X," a Stop hook that exits 2 makes the agent read stderr and keep working. This is the enforced form of an objective: the harness, not the model, decides the run is not done. Pair it with a deterministic check (lint, tests) so "X" is real.

## Right-pattern selection

- Finish-line work the agent can prove → `/goal`.
- Recurring check of external state → `/loop`.
- Hard "keep going until clean" → Stop hook + a check.
- Parallel work needing discussion → agent team (mission mode).
- One scoped delegation returning a result → subagent (not a control pattern; see orchestration).

## Do

- Write goals as verifiable end-states with the proof method named.
- Make the proof land in the transcript.
- Bound every goal with a turn/time cap.
- Use `/loop` for polling, `/goal` for finish-lines.
- Keep selection (discovery) and continuation separate when debugging.

## Don't

- Expect `/goal` to select skills or agents.
- Give the evaluator a condition it cannot read from the conversation ("make it elegant").
- Use `/goal` to poll external state, or `/loop` for finite work.
- Treat the worker's self-assessment as the gate — use the separate evaluator or a check.

## Best-in-class example

```
/goal every call site of the old billing API is migrated to v2, `pnpm test`
exits 0, and `pnpm lint` is clean — prove each by showing command output;
do not modify unrelated test files; or stop after 25 turns
```

Measurable end-state, three checkable conditions, surfaced proof, a scope guard, and a bound. The agent will route to whatever skills and subagents each step triggers — discovery does that — while the goal only decides when to stop.
