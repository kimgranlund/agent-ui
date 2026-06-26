# Rubric — CLAUDE.md Entry File

Scores a CLAUDE.md as standing-context entry point. Scoring method (1–5, `[gate]`/`[review]`, findings by severity, gate threshold) is summarized at the bottom.

| # | Dimension | Type | What it checks | 1 → 3 → 5 |
|---|---|---|---|---|
| D1 | Length | [gate] | Under ~200 lines | 1: >200 · 3: within · 5: lean |
| D2 | Index-not-manual | [review] | Facts + non-obvious conventions only; no general-knowledge restating | 1: lectures/everything-file · 3: mixed · 5: pure index of the non-obvious |
| D3 | Verifiable instructions | [gate] | Concrete, checkable directives | 1: "format properly" · 3: mostly concrete · 5: all verifiable |
| D4 | Enforcement delegated | [gate] | Invariants in hooks, not prose | 1: "IMPORTANT: never" as control · 3: mixed · 5: invariants in hooks, noted in comment |
| D5 | Scope hygiene | [review] | Path/topic detail in rules/; procedures in skills | 1: everything inline · 3: some scoping · 5: detail correctly externalized |
| D6 | No contradictions | [gate] | No conflicting rules | 1: contradictions present · 3: none found · 5: verified consistent |
| D7 | KB sync | [review] | Does not contradict Project Knowledge / Project Instructions | 1: conflicts · 3: untested · 5: verified coherent |

**Gate to promote:** D1, D3, D4, D6 must each score ≥ 3.

**Top failure to look for first:** enforcement-in-prose (D4) — "IMPORTANT: never X" treated as a control. If it must hold every time, it belongs in a hook; CLAUDE.md only shapes behavior probabilistically.

---

**Scoring method.** `[gate]` = mechanically checkable (counts, presence/absence); score by inspection. `[review]` = judgment; score against the anchors with cited evidence. Scale 1–5 (1 = failure anchor, 3 = adequate, 5 = excellence anchor); do not round everything to 3. Per dimension assign Critical / Major / Minor / Pass; every score below 4 needs cited evidence. An artifact that fails any gate dimension is not production-ready regardless of other scores.
