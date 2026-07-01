---
name: authoring-skills
description: >
  Author or review a Claude Code SKILL.md to production standard, scoring it
  against the bundled rubric. Use whenever creating, editing, or evaluating a
  skill: "write a skill", "review this skill", "why isn't my skill triggering",
  "score this skill". Use even when the user only describes a workflow to capture.
---

# Harness — Skill Authoring & Review

A skill is a *procedure* artifact loaded on demand. Author one that triggers reliably and behaves consistently, or review one against the rubric. Two modes: **author** and **review**.

## Operating model (essentials; depth in `references/foundations.md`)
- Calibration test per line: cut what the model knows, route the deterministic to a script, state only the specific and non-obvious — and **lead with the reasoning-frame word** (hoist the operative imperative/priority/conditional to the front; cut openers like `It is important to…`). Leading words are the densest tokens you spend — depth in `references/best-practices.md` "Lead with the frame".
- The description is the interface — pre-loaded, matched on. A precise body behind a vague description is a dead capability.
- Progressive disclosure: SKILL.md lean; depth in `references/`; determinism in `scripts/`.

## Author
1. Write the description first: capability + when-to-use, in the user's words; slightly pushy to avoid under-triggering.
2. Draft the body against `references/best-practices.md` — non-obvious only, fully-qualified tool names (`Server:tool`).
3. **Ship the references bundle (required)** — every skill carries `references/foundations.md`, `references/best-practices.md`, and `references/rubric.md`. See "The references bundle" below.
4. Route exact work to a script; build in a validation loop (draft → check → fix → re-check).
5. Self-score (below); fix until every gate dimension (D1, D2, D5, D7, D9) ≥ 3.

## The references bundle (required for every skill)

A skill is not done until it ships all three, each substantive and scaled to the skill — no filler, no general-knowledge lecture, canonical-or-derived (cite sources; never duplicate a doc owned elsewhere):

- **`references/foundations.md`** — the load-bearing mental models / domain concepts the skill assumes (the things every later judgement leans on).
- **`references/best-practices.md`** — the how-to depth: do/don't, the non-obvious, worked patterns.
- **`references/rubric.md`** — the standard to score the skill's *outputs* (dimensions × 1–5 anchors × a gate rule; build it via the `authoring-rubrics` skill). If a canonical rubric for those outputs already lives elsewhere (e.g. `docs/rubrics/`), this file POINTS to it (derived) rather than copying it.

**Grounding rule:** write these from solid knowledge or not at all — when the domain isn't already known cold, research it first (`WebSearch` / `WebFetch`, several authoritative sources) and cite. Invented or filler references fail D9 as surely as missing ones.

## Review
1. Run the mechanical gates: `python scripts/harness_checks.py skill <path/to/SKILL.md>`.
2. Score the `[review]` dimensions against `references/rubric.md` with cited evidence on the 1–5 anchors.
3. Findings by severity; gate verdict; top issues with a concrete fix each.

## Output contract (review)
```
Artifact: <skill>  ·  Rubric: rubric-skill
| Dim | Type | Score | Finding | Evidence |
Gate (D1,D2,D5,D7): <pass/fail>   [harness_checks: <pass/fail>]
Top issues: 1) … — fix: …
```

## References & tools
| Path | Use when |
|---|---|
| `scripts/harness_checks.py skill` | Mechanical gate checks (run every review/self-score) — incl. D9 references-bundle presence |
| `references/rubric.md` | The `[review]` dimensions and anchors |
| `references/best-practices.md` | Authoring guidance / explaining a finding |
| `references/foundations.md` | When a finding turns on a shared model |
| `WebSearch` / `WebFetch` | Grounding a new skill's foundations/best-practices/rubric when the domain isn't known cold |
