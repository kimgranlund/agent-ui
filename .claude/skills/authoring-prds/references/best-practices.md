# Best Practices — Authoring a PRD

How to write a PRD that aligns humans on the problem without prescribing the solution. Assumes `foundations.md` and `document-relationships.md`. Scored by `rubric.md`.

## What a PRD is for

A PRD looks outside-in. It defines what should exist and why, and its job is alignment: PM, design, engineering, and business reading the same document and agreeing on the user problem, the intended outcomes, the scope, the constraints, the success metrics, and the priority. It is the top of the ladder — it owns intent. It does not own behavior (that is the SPEC) or implementation (that is the LLD).

## Principles

**Lead with the problem, grounded.** Name the user, the problem, and the evidence it matters before any solution. A claim without grounding is an assertion; assertions get challenged, grounded claims ship. The fastest way to spot a weak PRD is that it opens with features instead of problems.

**Make success measurable.** Every outcome gets a metric, a baseline, a target, and a timeframe. "Improve onboarding" is not a success criterion; "reduce time-to-first-value from 9 min to under 4 min within one quarter" is. Unmeasurable success means no one can tell whether the thing worked.

**Bound the scope on both sides.** State what is in and, explicitly, what is out. The out-of-scope list is where brittle-feature infection is refused entry — it is the document's standing answer to "while we're at it, could we also…".

**Stay solution-agnostic.** Describe what and why; leave how to the SPEC. Premature design choices in a PRD collapse the ladder and pre-commit decisions that belong to people with more information later. If a technical constraint genuinely shapes the product, state it as a constraint, not a design.

**Prioritize.** A flat list of equally-important features is an abdication. Tier them (must/should/could, or ranked) with rationale, so the SPEC and the build can sequence against intent.

**Give every goal a stable ID.** `PRD-G1`, `PRD-G2`, … These are the join keys the SPEC traces to. A goal with no ID is a goal the rest of the family cannot reference without restating it.

**Track open decisions as first-class.** An unresolved question is not a hole; it is a tracked decision with options and an owner. Papering over ambiguity creates downstream surprises; naming it creates informed choices.

## Do / don't

Do: open with a grounded problem; quantify success; list out-of-scope; ID every goal; tier priority; track open decisions.

Don't: prescribe implementation; ship unmeasurable outcomes; leave scope open-ended; present an undifferentiated feature list; bury ambiguity in confident prose.

## Best-in-class (shape)

```markdown
# PRD-07 — Encounter Coding Assist
> Reduce clinician time spent on diagnosis coding without lowering coding accuracy.

## Problem  (grounded)
Clinicians spend ~6 min/encounter on coding; 18% of claims are returned for
specificity errors. [source: Q1 RCM audit]

## Goals
- PRD-G1 Cut median coding time per encounter.   Priority: Must
- PRD-G2 Reduce specificity-error returns.        Priority: Must
- PRD-G3 Surface HCC-relevant gaps.               Priority: Should

## Success metrics
- G1: median coding time 6 min → < 3 min within one quarter
- G2: specificity-error returns 18% → < 8%

## Scope
In: ICD-10 suggestion + validation at point of care.
Out: CPT autocoding; billing submission; payer-specific rules. (this release)

## Constraints & assumptions
- Must run inside the existing EHR iframe. Assumes FY2026 code set. (2026-06)

## Open decisions
- PRD-OD1: real-time vs. post-encounter suggestion? Options + tradeoffs tracked.
```

Measurable, bounded, IDed, prioritized, and solution-agnostic — a SPEC can be built straight off it because every goal is referenceable and every outcome is checkable.
