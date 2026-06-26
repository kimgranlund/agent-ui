---
name: harness-control-patterns
description: >
  Design or review continuation patterns — /goal, /loop, Stop hooks, auto mode —
  that drive autonomous work, scoring against a bundled rubric. Use whenever the
  user is setting up or auditing autonomous loops: "write a /goal", "should I use
  /goal or /loop", "my goal loop never stops / spins", "review this autonomous
  setup", "make it keep working until clean". Use even when the user describes
  wanting the harness to run on its own toward an outcome.
---

# Harness — Control Patterns (/goal, /loop) Design & Review

Design a continuation pattern that finishes (or polls) correctly, or review one against the rubric. These decide *when the next turn fires*, never *what runs on it* — discovery handles selection underneath.

## When to use
The user is writing or scoring a `/goal` condition, choosing `/goal` vs `/loop`, or wiring a Stop hook for enforced continuation.

## Foundations (essentials; full models in `references/foundations.md`)
- **Plane separation** — `/goal` does not select skills or agents; discovery does that every turn. Expecting a goal to "find the right tools" is the top failure.
- **Objective control mode** — a goal is a verifiable end-state, not a process; a separate fast evaluator judges only what the transcript surfaces.
- **Enforcement vs. guidance** — for a hard "don't finish until X", a Stop hook (exit 2) is the enforced form, paired with a deterministic check.

## Design
1. Pick the pattern: finish-line the agent can prove → `/goal`; recurring check of external state → `/loop`; hard "keep going until clean" → Stop hook + a check; collaboration → team.
2. Write the `/goal` condition as a measurable end-state with the proof method named ("`pnpm test` exits 0 — show output").
3. Make the proof land in the transcript (self-evidencing); add a turn/time cap and a scope guard.
4. Verify version-pinned mechanics against the installed build (`/goal` availability and `/loop` form drift).
5. Self-score against `references/rubric.md`; fix until every gate dimension (C1, C3) ≥ 3.

## Review
1. Load `references/rubric.md`.
2. Score each dimension — `[gate]` by inspection, `[review]` with cited evidence — on the 1–5 anchors. Check the end-state is verifiable and self-evidencing first (the top failure).
3. Findings by severity; gate verdict; top issues with a concrete fix each.

## Output contract (review)
```
Artifact: <goal/loop setup>  ·  Rubric: rubric-control-pattern
| Dim | Type | Score | Finding | Evidence |
|-----|------|-------|---------|----------|
Gate (C1,C3): <pass/fail>
Top issues: 1) … — fix: …   2) … — fix: …
```

## References
| File | Load when |
|---|---|
| `references/rubric.md` | Always when reviewing or self-scoring |
| `references/best-practices.md` | When designing or explaining a finding |
| `references/foundations.md` | When a finding turns on a shared model (discovery vs. continuation, control modes) |
