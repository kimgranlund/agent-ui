---
name: harness-skill-authoring
description: >
  Author or review a Claude Code SKILL.md to production standard, scoring it
  against a bundled rubric. Use whenever the user is creating, editing, or
  evaluating a skill — including phrases like "write a skill", "review this
  skill", "is this SKILL.md good", "why isn't my skill triggering", or "score
  this skill". Use even if the user only describes a workflow they want to
  capture as a skill without saying the word "rubric".
---

# Harness — Skill Authoring & Review

Author a SKILL.md that triggers reliably and behaves consistently, or review an existing one against the rubric. A skill is a *procedure* artifact loaded on demand.

## When to use
The user wants to write a new skill, fix one that under-triggers or misbehaves, or score a skill before promoting it.

## Foundations (essentials; full models in `references/foundations.md`)
- **Calibration test** — every line must pass: cut what the model already knows; route the deterministic to a script; state only the specific and non-obvious.
- **Description is the interface** — it is pre-loaded and is what the router matches on. A precise body behind a vague description is a dead capability.
- **Progressive disclosure** — SKILL.md lean; depth in `references/`; determinism in `scripts/` (executed, never loaded).

## Author
1. Write the description first: state *what it does* and *when to use it*, third-person, carrying the words a user would actually say. Make it slightly pushy to avoid under-triggering.
2. Draft the body against `references/best-practices.md` — lean (~1,500–2,000 words, ≤500 lines), non-obvious only, fully-qualified tool names (`Server:tool`).
3. Route exact/deterministic work to a script; build in a validation loop (draft → check → fix → re-check → finalize only when clean).
4. Self-score against `references/rubric.md`; fix until every gate dimension (D1, D2, D5, D7) ≥ 3.

## Review
1. Load `references/rubric.md`.
2. Score each dimension — `[gate]` by inspection (counts, presence/absence), `[review]` with cited evidence — on the 1–5 anchors.
3. Assign findings by severity; state the gate verdict; list top issues with a concrete fix each.

## Output contract (review)
```
Artifact: <skill>  ·  Rubric: rubric-skill
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
| `references/foundations.md` | When a finding turns on a shared model (control mode, the two diseases) |
