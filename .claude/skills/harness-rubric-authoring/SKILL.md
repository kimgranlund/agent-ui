---
name: harness-rubric-authoring
description: >
  Author or review a rubric so it produces consistent, actionable judgments,
  scoring it against a bundled rubric-for-rubrics. Use whenever the user is
  building or evaluating a scoring rubric, eval criteria, a quality checklist, or
  a /goal completion condition: "write a rubric", "is this rubric any good",
  "my reviewers score differently", "turn this into eval criteria". Use even when
  the user describes wanting a repeatable standard to judge output against.
---

# Harness — Rubric Authoring & Review

Author a rubric that two reviewers would score the same way, or review one against the rubric-for-rubrics. A rubric is the verification artifact native to agentic systems: it is to qualitative output what a schema is to structured data.

## When to use
The user wants to write a rubric/eval criteria, or score an existing rubric for usability.

## Foundations (essentials; full models in `references/foundations.md`)
- **A rubric is criteria × levels × descriptors × aggregation** — miss one and it stops being usable.
- **`[gate]` vs `[review]`** — gate = mechanically checkable (counts, presence/absence); review = judgment against anchors with cited evidence. The tag must be accurate.
- **Anchors, not adjectives** — concrete 1/3/5 descriptors a reviewer can match to evidence, never "good/adequate/poor".

## Author
1. Name each dimension; type it `[gate]`/`[review]` and get the tag right.
2. Write concrete 1/3/5 behavioral anchors and state the measurement plan (the evidence) for each.
3. Keep dimensions independent (no double-counting); make each failure imply a specific fix.
4. State the aggregation/gate rule: which dimensions must score ≥ 3 to promote, and the top failure to look for first.
5. Self-score against `references/rubric.md`; fix until every gate dimension (D1, D3, D5, D8) ≥ 3.

## Review
1. Load `references/rubric.md` (the rubric-for-rubrics).
2. Score each dimension — `[gate]` by inspection, `[review]` with cited evidence — on the 1–5 anchors. Check for bare scales with no anchors first (the top failure).
3. Findings by severity; gate verdict; top issues with a concrete fix each.

## Output contract (review)
```
Artifact: <rubric>  ·  Rubric: rubric-rubric
| Dim | Type | Score | Finding | Evidence |
|-----|------|-------|---------|----------|
Gate (D1,D3,D5,D8): <pass/fail>
Top issues: 1) … — fix: …   2) … — fix: …
```

## References
| File | Load when |
|---|---|
| `references/rubric.md` | Always when reviewing or self-scoring |
| `references/best-practices.md` | When authoring or explaining a finding |
| `references/foundations.md` | When a finding turns on a shared model (the control modes, the two diseases) |
