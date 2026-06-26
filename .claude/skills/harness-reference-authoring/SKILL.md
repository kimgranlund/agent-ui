---
name: harness-reference-authoring
description: >
  Author or review a referential knowledge document — a skill references/ file,
  an @-imported doc, or a Project Knowledge file — to production standard,
  scoring it against a bundled rubric. Use whenever the user is writing or
  evaluating knowledge/ground-truth docs for an agent: "write a reference doc",
  "structure my project knowledge", "is this knowledge file retrievable", "audit
  our docs for drift". Use even when the user just wants to capture domain facts
  for Claude to consult.
---

# Harness — Reference (Knowledge Doc) Authoring & Review

Author ground truth an agent consults, or review one against the rubric. A reference is *retrieved, never obeyed* — a derived view of, or the canonical source for, some fact.

## When to use
The user wants to write or restructure a knowledge doc, or score one for retrievability and drift resistance.

## Foundations (essentials; full models in `references/foundations.md`)
- **Referential, not behavioral** — it grounds and informs; it does not instruct. Behavioral directives belong in skills/CLAUDE.md.
- **Canonical or derived, never a duplicate** — two copies of a fact diverge; the only question is when. Duplication is the precondition for drift.
- **Write for retrieval** — headed, scannable structure retrieves far better than dense prose.

## Author
1. Scope to one domain; point to siblings rather than sprawl.
2. Head every section; keep statements short and declarative; use consistent terminology.
3. Make it canonical or explicitly derived from a named source — never a hand-maintained duplicate.
4. Date/version anything volatile (API surfaces, pricing, version-pinned mechanics).
5. Self-score against `references/rubric.md`; fix until every gate dimension (D1, D3, D5) ≥ 3.

## Review
1. Load `references/rubric.md`.
2. Score each dimension — `[gate]` by inspection, `[review]` with cited evidence — on the 1–5 anchors. Check for a hand-maintained duplicate first (the top failure).
3. Findings by severity; gate verdict; top issues with a concrete fix each.

## Output contract (review)
```
Artifact: <reference>  ·  Rubric: rubric-reference
| Dim | Type | Score | Finding | Evidence |
|-----|------|-------|---------|----------|
Gate (D1,D3,D5): <pass/fail>
Top issues: 1) … — fix: …   2) … — fix: …
```

## References
| File | Load when |
|---|---|
| `references/rubric.md` | Always when reviewing or self-scoring |
| `references/best-practices.md` | When authoring or explaining a finding (covers references and llms.txt) |
| `references/foundations.md` | When a finding turns on a shared model (the two document axes, the two diseases) |
