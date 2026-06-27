# Rubric — Control Patterns (/goal, /loop)

Scores the use of continuation patterns. Scoring method (1–5, `[gate]`/`[review]`, findings by severity, gate threshold) is summarized at the bottom.

| # | Dimension | Type | What it checks | 1 → 3 → 5 |
|---|---|---|---|---|
| C1 | Verifiable end-state | [gate] | Goal names a measurable condition + proof method | 1: "make it clean" · 3: measurable · 5: measurable + proof method stated |
| C2 | Self-evidencing | [review] | Proof lands in the transcript the evaluator can read | 1: relies on unseen state · 3: partial · 5: every condition provable from output |
| C3 | Bounded | [gate] | Turn/time cap present | 1: unbounded · 3: capped · 5: capped + scope guard |
| C4 | Right pattern | [review] | `/goal` for finish-lines, `/loop` for polling | 1: misused (`/loop` on finite work) · 3: correct · 5: correct + Stop-hook where enforcement needed |
| C5 | Plane separation | [review] | Doesn't expect `/goal` to do discovery | 1: conflated · 3: mostly · 5: clean |

**Gate to promote:** C1, C3 must each score ≥ 3.

**Top failure to look for first:** an unverifiable or self-graded condition (C1) — if the separate evaluator cannot read the proof from the transcript, the goal spins or self-certifies.

---

**Scoring method.** `[gate]` = mechanically checkable (counts, presence/absence); score by inspection. `[review]` = judgment; score against the anchors with cited evidence. Scale 1–5 (1 = failure anchor, 3 = adequate, 5 = excellence anchor); do not round everything to 3. Per dimension assign Critical / Major / Minor / Pass; every score below 4 needs cited evidence. An artifact that fails any gate dimension is not production-ready regardless of other scores.
