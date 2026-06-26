# Rubric — PRD (Product Requirements Document)

Scores a PRD: does it align humans on the right problem and the right bar for success, without prescribing the solution? Scoring method summarized at the bottom.

| # | Dimension | Type | What it checks | 1 (fail) → 3 (adequate) → 5 (excellent) |
|---|---|---|---|---|
| P1 | Problem grounding | [review] | Names the user, the problem, and evidence it matters; not a feature in disguise | 1: feature list framed as problems · 3: problem stated, thin evidence · 5: crisp user + problem + grounded evidence |
| P2 | Measurable success | [gate] | Outcomes quantified with metric + baseline + target + timeframe | 1: "delight users" · 3: a metric named · 5: metric, baseline, target, timeframe each present |
| P3 | Scope boundaries | [gate] | Explicit in-scope AND out-of-scope | 1: no boundaries · 3: in-scope only · 5: in and out, each with rationale |
| P4 | Solution-agnostic | [review] | Describes what/why, not how; no premature design or tech choices | 1: prescribes implementation · 3: mostly problem-space · 5: stays in problem space, defers how to SPEC |
| P5 | Prioritization | [gate] | Outcomes/features tiered (e.g., must/should/could) | 1: flat undifferentiated list · 3: priority present · 5: explicit tiers with rationale |
| P6 | Constraints & assumptions | [review] | Business/legal/timeline/platform constraints and stated assumptions, dated | 1: none · 3: some · 5: constraints + assumptions explicit and dated |
| P7 | Traceable anchors | [gate] | Each goal/outcome has a stable ID for the SPEC to reference | 1: prose blob, nothing referenceable · 3: some headings · 5: every goal carries a stable ID |
| P8 | Open decisions first-class | [review] | Unresolved questions tracked with options, not papered over | 1: ambiguity hidden · 3: noted informally · 5: tracked by ID with options and owners |

**Gate to promote:** P2, P3, P5, P7 must each score ≥ 3. A PRD with no measurable success (P2), no scope boundary (P3), no priority (P5), or no traceable anchors (P7) cannot ground a SPEC.

**Top failure to look for first:** a feature list wearing the costume of a problem statement (P1/P4 low) — it smuggles the solution in and skips the alignment the PRD exists to create.

---

**Scoring method.** `[gate]` = mechanically checkable (counts, presence/absence); score by inspection. `[review]` = judgment; score against the anchors with cited evidence. Scale 1–5 (1 = failure anchor, 3 = adequate, 5 = excellence anchor); do not round everything to 3. Per dimension assign Critical / Major / Minor / Pass; every score below 4 needs cited evidence. Failing any gate dimension blocks promotion regardless of other scores.
