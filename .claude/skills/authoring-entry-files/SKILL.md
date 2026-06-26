---
name: authoring-entry-files
description: >
  Author or review a CLAUDE.md entry file as a thin standing-context index,
  scoring it against the bundled rubric. Use whenever writing or evaluating a
  CLAUDE.md (or AGENTS.md): "write my CLAUDE.md", "review this CLAUDE.md", "my
  CLAUDE.md is too long / being ignored", "what belongs in CLAUDE.md vs hooks".
---

# Harness — CLAUDE.md Entry File Authoring & Review

CLAUDE.md is *context, not enforced configuration* — loaded in full at session start, attended every turn, but probabilistic. Author a thin index of the always-true and non-obvious, or review one.

## Operating model (essentials; depth in `references/foundations.md`)
- Index, not manual: facts the model can't infer (commands, layout) + non-obvious conventions only. Length trades against adherence; under ~200 lines.
- Required reliability decides placement: anything that must hold every time is a hook, not a sentence. "IMPORTANT: never X" is not a control.
- Every line verifiable ("2-space indent," not "format properly").

## Author
1. Commands, layout, non-obvious conventions; `@path` imports for depth.
2. Push path/topic detail to `.claude/rules/`, procedures to skills, invariants to hooks — note where enforcement lives in an HTML comment (stripped before injection).
3. Self-score (below); fix until every gate dimension (B1, B3, B4, B6) ≥ 3.

## Review
1. Run the mechanical gates: `python scripts/harness_checks.py claude-md <path/to/CLAUDE.md>`.
2. Score the `[review]` dimensions against `references/rubric.md`. The top failure is enforcement-in-prose.
3. Findings by severity; gate verdict; top issues with a concrete fix each.

## Output contract (review)
```
Artifact: CLAUDE.md  ·  Rubric: rubric-entry-file
| Dim | Type | Score | Finding | Evidence |
Gate (B1,B3,B4,B6): <pass/fail>   [harness_checks: <pass/fail>]
Top issues: 1) … — fix: …
```

## References & tools
| Path | Use when |
|---|---|
| `scripts/harness_checks.py claude-md` | Mechanical gate checks (≤200 lines, no enforcement-prose) |
| `references/rubric.md` | The `[review]` dimensions and anchors |
| `references/best-practices.md` | Authoring guidance / explaining a finding |
| `references/foundations.md` | When a finding turns on a shared model |
