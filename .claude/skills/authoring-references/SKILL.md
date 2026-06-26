---
name: authoring-references
description: >
  Author or review a referential knowledge document (a skill references/ file,
  an @-imported doc, or a Project Knowledge file) to production standard, scoring
  it against the bundled rubric. Use whenever writing or evaluating knowledge /
  ground-truth docs for an agent: "write a reference doc", "structure my project
  knowledge", "is this retrievable", "audit our docs for drift".
---

# Harness — Reference (Knowledge Doc) Authoring & Review

A reference is ground truth the agent consults — *retrieved, never obeyed*. Author one that retrieves well and resists drift, or review one.

## Operating model (essentials; depth in `references/foundations.md`)
- Referential, not behavioral: it grounds and informs; directives belong in skills/CLAUDE.md.
- Canonical or derived, never a hand-maintained duplicate — duplication is the precondition for drift.
- Write for retrieval: headed, scannable, short declarative statements, one topic.

## Author
1. Scope to one domain; point to siblings rather than sprawl.
2. Head every section; consistent terminology; make it canonical or explicitly derived from a named source.
3. Date/version anything volatile.
4. Self-score (below); fix until every gate dimension (D1, D3, D5) ≥ 3.

## Review
1. Run the mechanical gates: `python scripts/harness_checks.py reference <path>`.
2. Score the `[review]` dimensions against `references/rubric.md`. Check first for a hand-maintained duplicate (the top failure).
3. Findings by severity; gate verdict; top issues with a concrete fix each.

## Output contract (review)
```
Artifact: <reference>  ·  Rubric: rubric-reference
| Dim | Type | Score | Finding | Evidence |
Gate (D1,D3,D5): <pass/fail>   [harness_checks: <pass/fail>]
Top issues: 1) … — fix: …
```

## References & tools
| Path | Use when |
|---|---|
| `scripts/harness_checks.py reference` | Mechanical gate checks (headings, freshness marker) |
| `references/rubric.md` | The `[review]` dimensions and anchors |
| `references/best-practices.md` | Covers references and llms.txt |
| `references/foundations.md` | When a finding turns on a shared model |
