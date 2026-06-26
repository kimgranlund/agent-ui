---
name: authoring-rubrics
description: >
  Author or review a rubric so it produces consistent, actionable judgments,
  scoring it against the bundled rubric-for-rubrics. Use whenever building or
  evaluating a scoring rubric, eval criteria, a quality checklist, or a /goal
  completion condition: "write a rubric", "is this rubric any good", "my
  reviewers score differently", "turn this into eval criteria".
---

# Harness — Rubric Authoring & Review

A rubric is the verification artifact native to agentic systems: criteria × levels × descriptors × aggregation. Author one two reviewers would score the same way, or review one against the rubric-for-rubrics.

## Operating model (essentials; depth in `references/foundations.md`)
- `[gate]` = mechanically checkable; `[review]` = judgment against anchors with cited evidence. The tag must be accurate.
- Anchors, not adjectives: concrete 1/3/5 descriptors a reviewer can match to evidence.
- End with the aggregation/gate rule and the top failure to look for first.

## Author
1. Name each dimension; type it correctly; write concrete 1/3/5 anchors and the measurement plan (the evidence).
2. Keep dimensions independent; make each failure imply a specific fix; state the gate set + threshold.
3. Self-score (below); fix until every gate dimension (D1, D3, D5, D8) ≥ 3.

## Review
1. Run the mechanical gates: `python scripts/harness_checks.py rubric <path>`.
2. Score the `[review]` dimensions against `references/rubric.md`. The top failure is bare scales with no anchors.
3. Findings by severity; gate verdict; top issues with a concrete fix each.

## Output contract (review)
```
Artifact: <rubric>  ·  Rubric: rubric-rubric
| Dim | Type | Score | Finding | Evidence |
Gate (D1,D3,D5,D8): <pass/fail>   [harness_checks: <pass/fail>]
Top issues: 1) … — fix: …
```

## References & tools
| Path | Use when |
|---|---|
| `scripts/harness_checks.py rubric` | Mechanical gate checks (dims typed, gate rule present) |
| `references/rubric.md` | The `[review]` dimensions and anchors |
| `references/best-practices.md` | Authoring guidance / explaining a finding |
| `references/foundations.md` | When a finding turns on a shared model |
