---
name: harness-entry-file-authoring
description: >
  Author or review a CLAUDE.md entry file as a thin standing-context index,
  scoring it against a bundled rubric. Use whenever the user is writing or
  evaluating a CLAUDE.md (or AGENTS.md): "write my CLAUDE.md", "review this
  CLAUDE.md", "my CLAUDE.md is too long / being ignored", "what belongs in
  CLAUDE.md vs hooks". Use even when the user describes wanting to give Claude
  Code standing project context.
---

# Harness — CLAUDE.md Entry File Authoring & Review

Author a CLAUDE.md that earns its place in every-turn context, or review one against the rubric. CLAUDE.md is *context, not enforced configuration* — loaded in full at session start, attended to every turn, but probabilistic.

## When to use
The user wants to write, trim, or score a CLAUDE.md, or decide what belongs there vs. rules vs. hooks.

## Foundations (essentials; full models in `references/foundations.md`)
- **Index, not manual** — only facts the model can't infer (commands, layout) and non-obvious conventions. Length trades against adherence; keep under ~200 lines.
- **Required reliability decides placement** — anything that must hold every time is a hook, not a sentence. "IMPORTANT: never X" is not a control.
- **Calibration test** — cut general knowledge; route determinism to code; state only the specific and non-obvious.

## Author
1. Write commands, layout, and non-obvious conventions only; use `@path` imports for depth (`@docs/architecture.md`).
2. Make every line verifiable ("2-space indent," not "format properly").
3. Push path/topic detail to `.claude/rules/` (scoped via `paths:`), procedures to skills, invariants to hooks — note in an HTML comment where enforcement lives (comments are stripped before injection).
4. Keep it coherent with Project Knowledge / Project Instructions; resolve contradictions immediately.
5. Self-score against `references/rubric.md`; fix until every gate dimension (D1, D3, D4, D6) ≥ 3.

## Review
1. Load `references/rubric.md`.
2. Score each dimension — `[gate]` by inspection, `[review]` with cited evidence — on the 1–5 anchors. Check for enforcement-in-prose first (the top failure).
3. Findings by severity; gate verdict; top issues with a concrete fix each.

## Output contract (review)
```
Artifact: CLAUDE.md  ·  Rubric: rubric-entry-file
| Dim | Type | Score | Finding | Evidence |
|-----|------|-------|---------|----------|
Gate (D1,D3,D4,D6): <pass/fail>
Top issues: 1) … — fix: …   2) … — fix: …
```

## References
| File | Load when |
|---|---|
| `references/rubric.md` | Always when reviewing or self-scoring |
| `references/best-practices.md` | When authoring or explaining a finding |
| `references/foundations.md` | When a finding turns on a shared model (control modes, required-reliability) |
