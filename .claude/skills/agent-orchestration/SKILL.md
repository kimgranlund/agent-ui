---
name: agent-orchestration
description: >
  Design or review how skills, subagents, and agent teams discover and compose,
  and the YAML frontmatter that wires them, scoring against the bundled rubric.
  Use whenever deciding skill vs subagent vs team, wiring capabilities, or
  auditing an agent system's integration: "should this be a subagent or a team",
  "how do my skills and agents connect", "review my frontmatter".
---

# Harness — Orchestration & Frontmatter Design & Review

Design how capabilities compose, or review an arrangement. The unit is chosen by task shape: skill (procedure), subagent (result-only delegation), team (collaboration).

## Operating model (essentials; depth in `references/foundations.md`)
- Discovery (descriptions select, every turn) vs continuation (`/goal`,`/loop`,hooks decide when the next turn fires) — never conflated.
- Descriptions are the connective tissue: the orchestrator routes on them, not on file cross-references.
- Static vs dynamic wiring: `skills:` preload hard-wires standing expertise; leave the rest to discovery.

## Design
1. Match the unit to the task; justify team fan-out by genuine parallel value.
2. Each description a precise interface; `tools` scoped, `model` to task class, `skills:` only for standing expertise; verify keys against the installed build.
3. Keep teammate roles as subagent definitions (teams compose them at runtime).
4. Self-score (below); fix until every gate dimension (A2, A4) ≥ 3.

## Review
1. This skill's gates are systemic judgment, not a single-file mechanical check — there is no `harness_checks` subcommand. Score by inspection against `references/rubric.md`, citing evidence on the 1–5 anchors.
2. Check plane separation first (the top failure: expecting `/goal` to select capabilities).
3. Findings by severity; gate verdict; top issues with a concrete fix each.

## Output contract (review)
```
Artifact: <system/frontmatter>  ·  Rubric: rubric-orchestration
| Dim | Type | Score | Finding | Evidence |
Gate (A2,A4): <pass/fail>
Top issues: 1) … — fix: …
```

## References & tools
| Path | Use when |
|---|---|
| `references/rubric.md` | Scoring dimensions and anchors (judgment-based) |
| `references/best-practices.md` | Design guidance / explaining a finding |
| `references/foundations.md` | When a finding turns on a shared model (discovery vs continuation) |
