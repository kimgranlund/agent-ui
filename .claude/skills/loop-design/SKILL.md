---
name: loop-design
description: >
  Design or review continuation patterns — /goal, /loop, Stop hooks, auto mode —
  that drive autonomous work, scoring against the bundled rubric. Use whenever
  setting up or auditing autonomous loops: "write a /goal", "should I use /goal
  or /loop", "my goal loop never stops / spins", "make it keep working until clean".
---

# Harness — Control Patterns (/goal, /loop) Design & Review

These decide *when the next turn fires*, never *what runs on it* — discovery handles selection underneath. Design a pattern that finishes (or polls) correctly, or review one.

## Operating model (essentials; depth in `references/foundations.md`)
- Plane separation: `/goal` does not select skills or agents — discovery does, every turn.
- Objective mode: a goal is a verifiable end-state, not a process; a separate fast evaluator judges only what the transcript surfaces.
- Hard "don't finish until X" is a Stop hook (exit 2) + a deterministic check, not a sentence.

## Design
1. Pick the pattern: finish-line the agent can prove → `/goal`; recurring external check → `/loop`; enforced "until clean" → Stop hook + check; collaboration → team.
2. Write the `/goal` as a measurable end-state with the proof method named; make the proof land in the transcript; add a turn/time cap and scope guard.
3. Self-score (below); fix until every gate dimension (C1, C3) ≥ 3.

## Review
1. Run the mechanical gates on the goal string: `python scripts/harness_checks.py goal "<goal text>"`.
2. Score the `[review]` dimensions against `references/rubric.md`. The top failure is an unverifiable or self-graded condition.
3. Findings by severity; gate verdict; top issues with a concrete fix each.

## Output contract (review)
```
Artifact: <goal/loop setup>  ·  Rubric: rubric-control-pattern
| Dim | Type | Score | Finding | Evidence |
Gate (C1,C3): <pass/fail>   [harness_checks: <pass/fail>]
Top issues: 1) … — fix: …
```

## References & tools
| Path | Use when |
|---|---|
| `scripts/harness_checks.py goal` | Mechanical gate checks (bounded, measurable, no vague terms) |
| `references/rubric.md` | The `[review]` dimensions and anchors |
| `references/best-practices.md` | Design guidance / explaining a finding |
| `references/foundations.md` | When a finding turns on a shared model |
