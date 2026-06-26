# Rubric — Skill

Scores a SKILL.md (and its bundle) for triggerability and behavioral quality. Scoring method and finding severities: see `README.md`. `[gate]` = mechanically checkable; `[review]` = judgment with cited evidence.

| # | Dimension | Type | What it checks | 1 (fail) → 3 (adequate) → 5 (excellent) |
|---|---|---|---|---|
| D1 | Description trigger | [gate] | Description states both *what it does* and *when to use it* | 1: capability only or "helps with X" · 3: both present, generic · 5: both present, carries the words a user would actually say, third-person |
| D2 | Token economy | [gate] | Body ≤ ~500 lines / ~2,000 words; detail split into references/ and scripts/ | 1: >500 lines, monolithic · 3: within limit, little disclosure · 5: lean body, references/scripts carry depth |
| D3 | Control-mode fit | [review] | Procedure vs. trust-the-model is matched to task; determinism routed to scripts | 1: prose decision tree the model executes worse · 3: mixed · 5: prescriptive only where reliability needs it, code for the exact |
| D4 | Non-obvious only | [review] | Adds project-specific/non-obvious content; no general-knowledge lecturing | 1: lectures the model on its own domain · 3: some filler · 5: every line passes the calibration test |
| D5 | Validation loop | [gate] | A check/verify step exists (reference comparison or script) | 1: none · 3: a verify step named but vague · 5: explicit draft→check→fix→re-check, finalize only when clean |
| D6 | Cold-start usability | [review] | A worked example / quick start; concepts defined inline | 1: no example, undefined terms · 3: example present · 5: concrete worked example + inline definitions |
| D7 | Tool reference hygiene | [gate] | MCP/tool references fully qualified (`Server:tool`) | 1: bare names · 3: mostly qualified · 5: all qualified |
| D8 | Drift resistance | [review] | No duplicated facts; references not fossil-prone; single source | 1: duplicates owned facts · 3: minor duplication · 5: canonical/derived, nothing to fossilize |
| D9 | References bundle | [gate] | Ships `references/{foundations,best-practices,rubric}.md`, each substantive + grounded | 1: missing any of the three · 3: all present but thin · 5: all present, researched + sourced, scaled to the skill, canonical-or-derived (no filler, no duplication) |

**Gate to promote:** D1, D2, D5, D7, D9 must each score ≥ 3. A skill that cannot be triggered (D1), has no check (D5), or ships without its references bundle (D9) is not production-ready regardless of body quality.

**Top failure to look for first:** a precise body behind a vague description (D1 low, D3/D4 high) — a dead capability that never fires.
