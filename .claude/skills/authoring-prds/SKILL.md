---
name: authoring-prds
description: >
  Author or review a PRD (Product Requirements Document) to production standard,
  scoring it against the bundled rubric. Use whenever writing, improving, or
  evaluating a PRD or product brief: "write a PRD", "review this PRD", "define
  the requirements for this feature", "what are the success metrics". Use even
  when the user describes aligning stakeholders on a product problem.
---

# Harness — PRD Authoring & Review

The PRD is the outside-in, why/what-should-exist document; it owns intent and sits above the SPEC. Author one that aligns humans on the problem without prescribing the solution, or review one.

## Operating model (essentials; depth in `references/foundations.md`)
- Abstraction ladder: PRD owns why + what-should-exist; it stays in problem space (SPEC owns behavior, LLD owns implementation).
- One fact, one home: the PRD owns intent and metrics; downstream docs reference its goal IDs, never restate them.
- Right altitude: describe what/why, not how.

## Author
1. Lead with a grounded problem (user + problem + evidence), not a feature list.
2. Quantify success (metric + baseline + target + timeframe); bound scope on both sides; give every goal a stable ID (`PRD-G1`…); tier priority; track open decisions.
3. Self-score (below); fix until every gate dimension (P2, P3, P5, P7) ≥ 3.

## Review
1. Run the mechanical gates: `python scripts/harness_checks.py prd <path>`. For a full family, run `python scripts/trace_check.py <prd> <spec> <lld>`.
2. Score the `[review]` dimensions against `references/rubric.md`. The top failure is a feature list disguised as a problem statement.
3. Findings by severity; gate verdict; top issues with a concrete fix each.

## Keep the family in sync
A PRD goal with no downstream SPEC requirement is a gap. Changes to intent enter here and flow down. See `references/document-relationships.md`.

## Output contract (review)
```
Artifact: <PRD>  ·  Rubric: rubric-prd
| Dim | Type | Score | Finding | Evidence |
Gate (P2,P3,P5,P7): <pass/fail>   [harness_checks: <pass/fail>]
Top issues: 1) … — fix: …
```

## References & tools
| Path | Use when |
|---|---|
| `scripts/harness_checks.py prd` | Mechanical gate checks (goal IDs, out-of-scope, priority) |
| `scripts/trace_check.py` | Cross-document traceability (orphans/gaps) |
| `references/rubric.md` | The `[review]` dimensions and anchors |
| `references/best-practices.md` | Authoring guidance / explaining a finding |
| `references/document-relationships.md` | Tracing to a SPEC or propagating a change |
| `references/foundations.md` | When a finding turns on a shared model |
