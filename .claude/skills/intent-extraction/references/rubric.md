# Rubric — extracted intent (the skill's output)

> Scores a "Resolved Intent" (ROOT GOAL · LITERAL ASK · DELTAS · OPEN · SHARPENED) for whether it
> captured the real goal and resolved the gaps well. Scale 1–5; `[gate]` = mechanically checkable,
> `[review]` = judgement with cited evidence. 2026-06-26.

| # | Dimension | Type | What it checks | 1 (fail) → 3 (adequate) → 5 (excellent) |
|---|---|---|---|---|
| D1 | Goal fidelity | [review] | Executing SHARPENED would produce ROOT GOAL | 1: restatement drifts from the goal · 3: mostly aligned · 5: exact — SHARPENED *is* the goal made executable |
| D2 | Delta coverage | [gate] | Every ambiguity/conflict/assumption is resolved-with-assumption or in OPEN — none dropped | 1: deltas dropped silently · 3: most covered · 5: every delta accounted for, each resolution's assumption stated |
| D3 | Question necessity | [gate] | Every OPEN question's answer would change the output | 1: manufactured/unnecessary questions · 3: mostly load-bearing · 5: only load-bearing forks asked (or none — clean extraction) |
| D4 | Question effort | [review] | Questions follow low-effort closed design | 1: open/leading/dripped · 3: closed but clunky · 5: MCQ, 2–4 options, recommend-first, neutral, batched, previews where concrete |
| D5 | Grounding | [gate] | Every inferred goal/assumption traces to text / context / a named convention | 1: invented intent · 3: mostly grounded · 5: every inference traceable; ungrounded ones downgraded to questions |
| D6 | Restatement executability | [review] | SHARPENED is concrete, scoped (non-goals), with a success criterion | 1: vague/unscoped · 3: actionable · 5: ready to hand to another agent and execute verbatim |

**Gate to promote:** D2, D3, D5 must each score ≥ 3. A resolved intent that drops a delta (D2), asks
unnecessary questions (D3), or invents intent the source doesn't support (D5) is worse than no
extraction — it launders a wrong reading as a confirmed one.

**Top failure to look for first:** manufacturing questions for an already-clear ask (over-clarifying,
D3), or inventing a goal the text doesn't support (D5) — both erode trust faster than a missed nuance.
