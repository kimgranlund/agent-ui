---
name: harness-agent-authoring
description: >
  Author or review a Claude Code subagent definition (.claude/agents/*.md) to
  production standard, scoring it against a bundled rubric. Use whenever the
  user is creating, editing, or evaluating a subagent — including "write a
  subagent", "review this agent", "why won't my agent auto-delegate", "is this
  agent's tools list safe", or "score this agent". Use even when the user just
  describes a delegated role they want, without saying "rubric".
---

# Harness — Agent (Subagent) Authoring & Review

Author a subagent that auto-delegates cleanly and stays in its blast radius, or review one against the rubric. A subagent is *delegation with isolation* — a focused worker in its own context window that returns a summary.

## When to use
The user wants to write a new subagent, fix one that won't trigger or over-reaches, or score one before promotion.

## Foundations (essentials; full models in `references/foundations.md`)
- **Description is the trigger** — capability + a model-evaluable condition + a proactive nudge where apt. Do not encode preconditions the router can't evaluate ("in the last 5 minutes").
- **Required reliability decides placement** — invariants belong in hooks, not "never do X" in the body.
- **Tools = blast radius** — omitting `tools` inherits everything including MCP; that is the common unsafe default.

## Author
1. Write the description as a trigger (capability + condition + nudge).
2. Scope `tools` to exactly the verbs the role needs (a read-only reviewer gets `Read, Grep, Glob, Bash`).
3. Set `model` to the task class (fast for search, stronger for build); add `skills:` preload if the role needs standing expertise.
4. Write the body as a judgment frame — priorities and focus, scope its reads (e.g., diff only), return a summary — not a rigid template or linter-work-in-prose.
5. Self-score against `references/rubric.md`; fix until every gate dimension (D1, D2, D5, D7) ≥ 3.

## Review
1. Load `references/rubric.md`.
2. Score each dimension — `[gate]` by inspection, `[review]` with cited evidence — on the 1–5 anchors. Check `tools` scoping first (the top failure).
3. Findings by severity; gate verdict; top issues with a concrete fix each.

## Output contract (review)
```
Artifact: <agent>  ·  Rubric: rubric-agent
| Dim | Type | Score | Finding | Evidence |
|-----|------|-------|---------|----------|
Gate (D1,D2,D5,D7): <pass/fail>
Top issues: 1) … — fix: …   2) … — fix: …
```

## References
| File | Load when |
|---|---|
| `references/rubric.md` | Always when reviewing or self-scoring |
| `references/best-practices.md` | When authoring or explaining a finding |
| `references/foundations.md` | When a finding turns on a shared model |
