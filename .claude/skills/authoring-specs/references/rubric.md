# Rubric — SPEC (System / Functional Specification)

Scores a SPEC: is it a complete, unambiguous, verifiable execution contract an implementer or agent can build from without guessing, and does it trace to the PRD? Scoring method summarized at the bottom.

| # | Dimension | Type | What it checks | 1 (fail) → 3 (adequate) → 5 (excellent) |
|---|---|---|---|---|
| S1 | PRD traceability | [gate] | Every requirement links to a PRD goal ID; all PRD goals covered | 1: no links · 3: some links · 5: bidirectional trace, coverage verified |
| S2 | Testable acceptance criteria | [gate] | Each requirement has explicit, verifiable AC | 1: none / "works well" · 3: AC on some · 5: given/when/then or measurable AC on each |
| S3 | Behavioral completeness | [review] | Happy path + states + error/empty/edge behaviors; every boundary answers what crosses, in what form, under whose authority, what on failure | 1: happy path only · 3: main paths · 5: states, errors, edges, boundaries all defined |
| S4 | Typed interface contracts | [gate] | APIs, data structures, schemas defined with types | 1: prose only · 3: shapes sketched · 5: typed request/response + error codes |
| S5 | Unambiguous & normative | [review] | One reading per requirement; MUST/SHOULD language; no TBDs in normative sections | 1: ambiguous / TBD-laden · 3: mostly clear · 5: single interpretation, normative, open items tracked separately |
| S6 | Right altitude | [review] | Defines what + behavior, not internal implementation (that is LLD) | 1: dictates algorithms/file layout · 3: mixed · 5: behavior contract, implementation deferred |
| S7 | Requirement identifiers | [gate] | Each requirement uniquely IDed for LLD reference and test mapping | 1: unreferenceable prose · 3: some IDs · 5: stable unique ID per requirement |
| S8 | Non-functional requirements | [review] | Performance, security, accessibility, scale, compliance where relevant | 1: ignored · 3: mentioned · 5: NFRs stated with measurable targets |

**Gate to promote:** S1, S2, S4, S7 must each score ≥ 3. A SPEC without PRD traceability (S1), testable AC (S2), typed contracts (S4), or requirement IDs (S7) is not an execution contract — it is a wish list.

**Top failure to look for first:** the happy-path-only spec (S3 low) — an agent or engineer then "completes" it by inventing the error and edge behavior, and the contract no longer governs what gets built.

---

**Scoring method.** `[gate]` = mechanically checkable (counts, presence/absence); score by inspection. `[review]` = judgment; score against the anchors with cited evidence. Scale 1–5 (1 = failure anchor, 3 = adequate, 5 = excellence anchor); do not round everything to 3. Per dimension assign Critical / Major / Minor / Pass; every score below 4 needs cited evidence. Failing any gate dimension blocks promotion regardless of other scores.
