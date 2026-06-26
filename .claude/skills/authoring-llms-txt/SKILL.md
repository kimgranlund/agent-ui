---
name: authoring-llms-txt
description: >
  Author or review an llms.txt (and llms-full.txt) — the agent-facing map of a
  documentation corpus — to the standard shape, scoring it against the bundled
  rubric. Use whenever the user mentions llms.txt, an AI-facing docs index,
  "make our docs agent-readable", "generate an llms.txt", or "review our llms.txt".
---

# Harness — llms.txt Authoring & Review

`llms.txt` is the curated index that tells agents where a corpus's authoritative content lives. Author one to the standard shape, or review one.

## Operating model (essentials; depth in `references/foundations.md`)
- Index, not content delivery: `/llms.txt` is the lean table of contents; `/llms-full.txt` carries the full corpus.
- Descriptions are what the agent routes on — one accurate sentence per link beats coverage.
- Serve at root so tools discover it without prior knowledge.

## Author
1. Standard shape: H1 project name → blockquote summary → H2 sections, each a list of links with a one-line description.
2. Curate to authoritative content; exclude chrome; ensure links resolve to markdown; split the heavy corpus into `llms-full.txt`.
3. Self-score (below); fix until every gate dimension (D1, D2, D6) ≥ 3.

## Review
1. Run the mechanical gates: `python scripts/harness_checks.py llms-txt <path/to/llms.txt>`.
2. Score the `[review]` dimensions against `references/rubric.md`. The top failure is a list of concepts with no links.
3. Findings by severity; gate verdict; top issues with a concrete fix each.

## Output contract (review)
```
Artifact: <llms.txt>  ·  Rubric: rubric-llms-txt
| Dim | Type | Score | Finding | Evidence |
Gate (D1,D2,D6): <pass/fail>   [harness_checks: <pass/fail>]
Top issues: 1) … — fix: …
```

## References & tools
| Path | Use when |
|---|---|
| `scripts/harness_checks.py llms-txt` | Mechanical gate checks (H1 + blockquote + H2 + links) |
| `references/rubric.md` | The `[review]` dimensions and anchors |
| `references/best-practices.md` | Covers references and llms.txt |
| `references/foundations.md` | When a finding turns on a shared model |
