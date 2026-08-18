---
name: a2ui-review
description: >-
  The a2ui-review-agent seat's artifact-to-rubric routing table, grading ground rules, per-artifact
  procedure, and the ADR-0068 corpus VerdictsFile contract — for A2UI payloads, catalog rows, corpus
  records, compose-time mechanism functions, and skill-doc pattern sections. Model-only knowledge
  preloaded by the a2ui-review-agent seat; not a user-facing action.
user-invocable: false
disable-model-invocation: false
---

# a2ui-review-agent standards

## The one thing → the one rubric

Route by artifact type; score against that rubric's dimensions ONLY. Do not mix rubrics.

| Artifact under grade | Named rubric | Deterministic floor you CITE (never re-decide) |
|---|---|---|
| An A2UI payload (`A2uiOutput` stream / message batch) | `.claude/docs/rubrics/a2ui-payload.md` (P1–P9) | the `validate-payload` CLI verdict |
| A catalog row (one `catalog.json` type ↔ `ui-*` factory, its tests/example/doc) | `.claude/docs/rubrics/a2ui-catalog.md` (D1–D6) | `naming.ts`/`conformance.ts`/`registry` probes via `npm test` |
| A corpus record (one `CorpusRecord` line) | `.claude/docs/rubrics/a2ui-corpus.md` (D1–D5) | `a2ui-payload.md` (folded), `validateRecord`'s enum, the θ_dup index |
| A compose-time mechanism function (`compose.ts`-class — code that assembles/derives/selects at compose time) | `.claude/docs/rubrics/a2ui-mechanism.md` (M1–M4) | M1: the co-located `*.test.ts` via `npm test` · M2's cited floor: `layering.test.ts` + the biting test (M2 itself is [review], definitional) |
| A skill-doc pattern section (an `a2ui-multi-catalog`-class pattern row) | `.claude/docs/rubrics/a2ui-skill-pattern.md` (S1–S3) | none — S1 is [review], definitional (fixed open-and-diff method against every cited source; no realized script) |

The last two rows are the GH #493 siblings — before them, mechanism functions and pattern sections were
graded against `a2ui-catalog.md` by analogy (PR #492's escalation); never do that again. A persona
fragment's own rows (`catalog/personas/*/`) are catalog rows and take the catalog-row route.

## Ground rules + per-artifact procedure + VerdictsFile — read `references/grading-standards.md`

The seven ground rules (gates-first-cite-don't-rejudge · the `repairs: []` signal · no
cross-dimension compensation · adversarial stance · evidence to file:line · scope your reads ·
ambiguity escalates) and the per-artifact grading procedure for each of the five rows above
(exact CLI invocations, which dimensions are `[gate]` vs `[review]`, and the ADR-0068
VerdictsFile JSON contract corpus-record grading must emit) live in `references/grading-standards.md`
— read it in full before grading anything; this SKILL.md's routing table only tells you which
rubric applies, not how to apply it.
