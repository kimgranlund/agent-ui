---
name: harness-orchestration-design
description: >
  Design or review how skills, subagents, and agent teams discover and compose,
  and the YAML frontmatter that wires them, scoring against a bundled rubric. Use
  whenever the user is deciding skill vs subagent vs team, wiring capabilities
  together, or auditing an agent system's integration: "should this be a subagent
  or a team", "how do my skills and agents connect", "review my frontmatter",
  "design the orchestration". Use even when the user describes a multi-capability
  workflow without naming orchestration.
---

# Harness — Orchestration & Frontmatter Design & Review

Design how capabilities compose, or review an existing arrangement against the rubric. The unit of work is chosen by task shape: skill (procedure), subagent (result-only delegation), team (collaboration).

## When to use
The user is choosing or auditing how skills/subagents/teams fit together, or scoring the frontmatter that wires them.

## Foundations (essentials; full models in `references/foundations.md`)
- **Discovery vs. continuation** — selection runs off descriptions every turn (discovery); `/goal`,`/loop`,hooks decide when the next turn fires (continuation). Never conflate them.
- **Descriptions are the connective tissue** — every capability's description is concatenated into the system prompt; the orchestrator routes on them, not on file cross-references.
- **Static vs. dynamic wiring** — `skills:` preload hard-wires standing expertise into a subagent; leave the rest to dynamic discovery.

## Design
1. Match the unit to the task: result-only → subagent; discussion required → team; recurring method → skill. Justify any team fan-out by genuine parallel value.
2. Write each description as a precise interface (the trigger).
3. Set frontmatter deliberately: `tools` scoped, `model` to task class, `skills:` preload where a specialist needs standing expertise; verify keys against the installed build.
4. Keep teammate roles as subagent definitions (teams compose them at runtime; there is no team file to author).
5. Self-score against `references/rubric.md`; fix until every gate dimension (D2, D4) ≥ 3.

## Review
1. Load `references/rubric.md`.
2. Score each dimension — `[gate]` by inspection, `[review]` with cited evidence — on the 1–5 anchors. Check plane separation first (the top failure: expecting `/goal` to select capabilities).
3. Findings by severity; gate verdict; top issues with a concrete fix each.

## Output contract (review)
```
Artifact: <system/frontmatter>  ·  Rubric: rubric-orchestration
| Dim | Type | Score | Finding | Evidence |
|-----|------|-------|---------|----------|
Gate (D2,D4): <pass/fail>
Top issues: 1) … — fix: …   2) … — fix: …
```

## References
| File | Load when |
|---|---|
| `references/rubric.md` | Always when reviewing or self-scoring |
| `references/best-practices.md` | When designing or explaining a finding |
| `references/foundations.md` | When a finding turns on a shared model (discovery vs. continuation) |
