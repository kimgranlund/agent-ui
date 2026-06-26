---
name: authoring-agents
description: >
  Author or review a Claude Code subagent (.claude/agents/*.md) to production
  standard, scoring it against the bundled rubric. Use whenever creating,
  editing, or evaluating a subagent: "write a subagent", "review this agent",
  "why won't my agent auto-delegate", "is this tools list safe". Use even when
  the user just describes a delegated role.
---

# Harness — Agent (Subagent) Authoring & Review

A subagent is *delegation with isolation* — a focused worker in its own context window returning a summary. Author one that auto-delegates cleanly and stays in its blast radius, or review one.

## Operating model (essentials; depth in `references/foundations.md`)
- The description is the auto-delegation trigger: capability + a model-evaluable condition + a proactive nudge.
- Required reliability decides placement: invariants belong in hooks, not "never do X" in the body.
- `tools` is the blast radius — omitting it inherits everything including MCP.

## Author
1. Description as trigger; `tools` scoped to the verbs the role needs; `model` set to the task class; `skills:` preload only for standing expertise.
2. Body as a judgment frame — priorities, scoped reads (e.g. diff only), returns a summary — not a rigid template or linter-work in prose.
3. Self-score (below); fix until every gate dimension (D1, D2, D5, D7) ≥ 3.

## Review
1. Run the mechanical gates: `python scripts/harness_checks.py agent <path/to/agent.md>`.
2. Score the `[review]` dimensions against `references/rubric.md` with cited evidence. Tools scoping is the top failure to check.
3. Findings by severity; gate verdict; top issues with a concrete fix each.

## Output contract (review)
```
Artifact: <agent>  ·  Rubric: rubric-agent
| Dim | Type | Score | Finding | Evidence |
Gate (D1,D2,D5,D7): <pass/fail>   [harness_checks: <pass/fail>]
Top issues: 1) … — fix: …
```

## References & tools
| Path | Use when |
|---|---|
| `scripts/harness_checks.py agent` | Mechanical gate checks (tools/model present, no enforcement-prose) |
| `references/rubric.md` | The `[review]` dimensions and anchors |
| `references/best-practices.md` | Authoring guidance / explaining a finding |
| `references/foundations.md` | When a finding turns on a shared model |
