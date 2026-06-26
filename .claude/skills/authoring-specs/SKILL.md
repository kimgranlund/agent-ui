---
name: authoring-specs
description: >
  Author or review a SPEC (system/functional specification) to production
  standard, scoring it against the bundled rubric. Use whenever writing,
  improving, or evaluating a spec, requirements doc, or execution contract:
  "write a spec", "spec this out", "turn the PRD into requirements", "define the
  API/data/acceptance requirements". Use even when the user wants a buildable
  contract from a product idea.
---

# Harness — SPEC Authoring & Review

The SPEC is the inside-out, what-must-be-built + how-it-behaves document and the main execution contract in agentic coding; it sits between PRD and LLD. Author one an implementer or agent can build from without guessing, or review one.

## Operating model (essentials; depth in `references/foundations.md`)
- Execution contract: defines what must be built and how it behaves; the artifact the agent builds against.
- Acceptance criteria are the executable form of a requirement and the bridge to tests.
- Right altitude: behavior, not internal implementation (defer to LLD); trace up to PRD goals.

## Author
1. Trace every requirement to a `PRD-G*`; cover all PRD goals; give each a stable ID (`SPEC-R1`…) and testable acceptance criteria.
2. Specify behavior at the boundaries (states, errors, empty, edges); type the contracts (APIs, data, schemas, error codes); state non-functionals with targets; keep TBDs out of normative sections.
3. Self-score (below); fix until every gate dimension (S1, S2, S4, S7) ≥ 3.

## Review
1. Run the mechanical gates: `python scripts/harness_checks.py spec <path>`. For a full family, run `python scripts/trace_check.py <prd> <spec> <lld>`.
2. Score the `[review]` dimensions against `references/rubric.md`. The top failure is a happy-path-only spec.
3. Findings by severity; gate verdict; top issues with a concrete fix each.

## Keep the family in sync
Every requirement traces up to a PRD goal and down to LLD + tests. No PRD goal → scope creep; no acceptance test → unverifiable. See `references/document-relationships.md`.

## Output contract (review)
```
Artifact: <SPEC>  ·  Rubric: rubric-spec
| Dim | Type | Score | Finding | Evidence |
Gate (S1,S2,S4,S7): <pass/fail>   [harness_checks: <pass/fail>]
Top issues: 1) … — fix: …
```

## References & tools
| Path | Use when |
|---|---|
| `scripts/harness_checks.py spec` | Mechanical gate checks (requirement IDs, PRD trace, acceptance) |
| `scripts/trace_check.py` | Cross-document traceability (orphans/gaps) |
| `references/rubric.md` | The `[review]` dimensions and anchors |
| `references/best-practices.md` | Authoring guidance / explaining a finding |
| `references/document-relationships.md` | Tracing up/down or propagating a change |
| `references/foundations.md` | When a finding turns on a shared model |
