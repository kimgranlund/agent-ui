# Rubric — handoff-block quality (rubric-handoff)

Score a returned handoff block. No canonical rubric for this output lives elsewhere, so it is defined here (authored in the `authoring-rubrics` shape: dimensions × 1–5 anchors × a gate rule). Score by inspection of the block against the work it reports.

| Dim | Name | [gate] |
|---|---|---|
| **H1** | Completeness | gate |
| **H2** | Verifiability | gate |
| **H3** | Honesty of Risks | |
| **H4** | Routing-readiness | |
| **H5** | Freshness | |

## H1 — Completeness [gate]

All seven fields present and in order, each empty one written as `(none)` rather than omitted.

- **1** — fields missing or merged; no way to tell an empty field from a forgotten one.
- **3** — all seven present; empties marked `(none)`; *Files changed* lists every path.
- **5** — + each field is tight and on-topic (Summary is outcome, not process; no field padded with another's content).

## H2 — Verifiability [gate]

A reviewer can confirm the Summary *without re-doing the work*, from **Evidence** + **Tests/checks run**.

- **1** — "tests pass" / "it works"; no command, no count, no citation — the reader must re-run or re-read to trust it.
- **3** — gates named by command with their result; key claims carry a `file:line` or a count.
- **5** — + the evidence is **non-vacuous** (a negative control, a count delta, the exact failing→passing transition) and names any gate *not* run, so the true coverage is legible.

## H3 — Honesty of Risks

Risks name real fragility, assumptions, and blast radius — not reassurance.

- **1** — "no risks" on non-trivial work; known edges or untested combinations hidden.
- **3** — the genuine risks and assumptions are listed with their blast radius.
- **5** — + each risk is actionable (what would confirm or fix it) and deferred tensions are booked, not buried.

## H4 — Routing-readiness

**Recommended next action** is a single step with an owner; **Open questions** are real, decision-shaped forks.

- **1** — "various follow-ups remain" / no owner; open questions rhetorical or already answered.
- **3** — one concrete next step + its owner; open questions each need a real decision by a named role/human.
- **5** — + the recommendation reflects the true critical path, and each open question is framed so the decider can answer it in one pass.

## H5 — Freshness

Composed after draining the inbox — no stale re-ask, re-edit, or retraction.

- **1** — re-asks an answered question, re-edits a committed artifact, or retracts an already-fixed finding.
- **3** — consistent with all delivered messages and the committed tree at hand-back time.
- **5** — + explicitly reconciles any crossed/late message it superseded.

## Gate rule

**H1 and H2 must both be ≥ 3.** A block that is incomplete or unverifiable fails regardless of the other dimensions — those two are what the next step routes and grades on. H3–H5 below 3 are findings to fix, not gate failures.
