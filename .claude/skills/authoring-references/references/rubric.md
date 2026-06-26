# Rubric — Reference (Knowledge Document)

Scores a referential knowledge doc (skill `references/` file, `@`-imported doc, Project Knowledge file). Scoring method and severities: see `README.md`.

| # | Dimension | Type | What it checks | 1 (fail) → 3 (adequate) → 5 (excellent) |
|---|---|---|---|---|
| D1 | Retrieval-grade structure | [gate] | Clear headings, short declarative statements, scannable | 1: dense prose, few headings · 3: headed · 5: every section headed, statements short and declarative |
| D2 | Referential, not behavioral | [review] | Grounds/informs; does not instruct behavior | 1: reads as instructions · 3: mixed · 5: pure ground truth, no directives |
| D3 | Canonical or derived | [gate] | Single source, or generated from one — not a hand-maintained duplicate | 1: duplicates facts owned elsewhere · 3: mostly unique · 5: canonical or explicitly derived |
| D4 | One topic | [review] | Scoped to a single domain; points to siblings | 1: sprawls across topics · 3: mostly focused · 5: one domain, links out for the rest |
| D5 | Freshness markers | [gate] | Volatile content dated/versioned | 1: undated volatile facts · 3: some dating · 5: source + date/version on anything that changes |
| D6 | Terminology consistency | [review] | Same terms used as the rest of the corpus | 1: conflicting terms · 3: minor drift · 5: consistent throughout |
| D7 | Conflict-free | [review] | No contradiction with sibling references | 1: contradicts another doc · 3: untested · 5: verified consistent |

**Gate to promote:** D1, D3, D5 must each score ≥ 3. A reference that doesn't retrieve well (D1), duplicates a source (D3), or hides staleness (D5) actively generates drift.

**Top failure to look for first:** a hand-maintained duplicate of a fact owned elsewhere (D3) — guaranteed to diverge.
