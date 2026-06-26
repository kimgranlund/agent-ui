# Rubric — Orchestration & Frontmatter Integration

Scores a system's use of skills, subagents, and teams together, and the frontmatter that wires them. Scoring method (1–5, `[gate]`/`[review]`, findings by severity, gate threshold) is summarized at the bottom.

| # | Dimension | Type | What it checks | 1 → 3 → 5 |
|---|---|---|---|---|
| D1 | Right unit choice | [review] | skill / subagent / team matched to task (procedure / result / collaboration) | 1: team where a subagent would do · 3: defensible · 5: each unit matched to task shape |
| D2 | Connective-tissue health | [gate] | Every capability's description is a precise interface | 1: vague descriptions present · 3: mostly precise · 5: all descriptions are clean triggers |
| D3 | Static vs. dynamic wiring | [review] | `skills:` preload for standing expertise; discovery left dynamic otherwise | 1: hard-wires everything or nothing · 3: partial · 5: deliberate split |
| D4 | Frontmatter validity | [gate] | Required fields present, correct keys, version-checked | 1: missing/invalid keys · 3: valid · 5: valid + verified against build |
| D5 | Plane separation | [review] | Discovery and continuation not conflated | 1: expects `/goal` to select agents · 3: mostly separated · 5: cleanly separated |
| D6 | Fan-out justified | [review] | Team/subagent token cost matched by parallel value | 1: unjustified fan-out · 3: reasonable · 5: fan-out clearly earns its cost |

**Gate to promote:** D2, D4 must each score ≥ 3.

**Top failure to look for first:** plane conflation (D5) — treating "give it a goal and let it find the tools" as one mechanism. Discovery selects every turn; continuation only decides when the next turn fires.

---

**Scoring method.** `[gate]` = mechanically checkable (counts, presence/absence); score by inspection. `[review]` = judgment; score against the anchors with cited evidence. Scale 1–5 (1 = failure anchor, 3 = adequate, 5 = excellence anchor); do not round everything to 3. Per dimension assign Critical / Major / Minor / Pass; every score below 4 needs cited evidence. An artifact that fails any gate dimension is not production-ready regardless of other scores.
