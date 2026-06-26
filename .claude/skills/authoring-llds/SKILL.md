---
name: authoring-llds
description: >
  Author or review an LLD (low-level design / implementation plan) to production
  standard, scoring it against the bundled rubric. Use whenever writing,
  improving, or evaluating a low-level design, technical design doc, or
  implementation plan: "write the LLD", "design the implementation", "how should
  we build this", "plan the components and data models".
---

# Harness — LLD Authoring & Review

The LLD is the how-it's-built-internally document and the plan an agent executes; it sits below the SPEC. Author one an engineer or agent can implement directly, or review one.

## Operating model (essentials; depth in `references/foundations.md`)
- Bottom of the ladder: add the how, reference the SPEC for the what; never re-derive behavior.
- Enumeration is the value: errors, edges, failure handling per case is what an LLD adds over a SPEC.
- Build center-out: order steps by dependency, each independently verifiable.

## Author
1. Map every component to `SPEC-R*` IDs (no orphans, no gold-plating); make interfaces and data models concrete (signatures, schemas, invariants).
2. Enumerate failure modes, edge and empty cases with handling; show control/state flow for non-trivial paths; name files/modules and integration; sequence the build with checkpoints.
3. Self-score (below); fix until every gate dimension (L1, L3, L5) ≥ 3.

## Review
1. Run the mechanical gates: `python scripts/harness_checks.py lld <path>`. For a full family, run `python scripts/trace_check.py <prd> <spec> <lld>`.
2. Score the `[review]` dimensions against `references/rubric.md`. The top failure is hand-waved error handling.
3. Findings by severity; gate verdict; top issues with a concrete fix each.

## Keep the family in sync
Each component traces up to a SPEC requirement. If implementation reveals a requirement is impossible, fix the SPEC (and maybe PRD) and re-derive the LLD — do not patch the LLD and leave the SPEC stale. See `references/document-relationships.md`.

## Output contract (review)
```
Artifact: <LLD>  ·  Rubric: rubric-lld
| Dim | Type | Score | Finding | Evidence |
Gate (L1,L3,L5): <pass/fail>   [harness_checks: <pass/fail>]
Top issues: 1) … — fix: …
```

## References & tools
| Path | Use when |
|---|---|
| `scripts/harness_checks.py lld` | Mechanical gate checks (component IDs, SPEC trace, error/edge) |
| `scripts/trace_check.py` | Cross-document traceability (orphans/gaps) |
| `references/rubric.md` | The `[review]` dimensions and anchors |
| `references/best-practices.md` | Authoring guidance / explaining a finding |
| `references/document-relationships.md` | Propagating a discovered constraint upward |
| `references/foundations.md` | When a finding turns on a shared model |
