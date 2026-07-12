# Phase 5 — Execution manifest (compiled from both Phase-4 lenses)

> Status: awaiting ratification (the pre-execution checkpoint). Verdict sources:
> `phase-4-corpus-verdicts.md` · `phase-4-harness-verdicts.md`. Cross-lens conflicts: none found.

## WP1 — corpus mechanical repairs

| # | Item | Action | Referrer note |
|---|---|---|---|
| M1 | 7 docs (the a2ui PRD + 6 sibling specs) cite the FROZEN archived README as the live traceability home | Repoint the one "traceability tracked in README.md" sentence per file to the current homes (the unified `spec/`·`lld/` map + `adr/README.md`'s index), annotating the old charter as archived | self-contained |
| M2 | ADR-0088/0089/0090/0097/0098: `accepted` Status beside an unfilled "pending Kim" Ratified-by placeholder | Source each ratification from git history (the commit where Status flipped) + the ledger; fill the cell with the evidenced date/wave. Status cells untouched (already accepted — the guard permits) | adr gate re-run |
| M3 | `drafts/container-family-design.md` — dead orphan (scope shipped via ADR-0046+ without ever citing it) | `git mv` → `archive/` + superseded banner naming ADR-0046 and the shipped waves; `drafts/` dir dissolves | zero inbound refs (verified) |

## WP2 — harness repairs

| # | Item | Action |
|---|---|---|
| M4 | CLAUDE.md:13 documents `check` as two steps; it runs three (`tsc && check:site && check:tools`) | Repair the Commands line (+2–4 lines projected; the residency audit found NOTHING else to evict — CLAUDE.md is healthy) |
| M5 | `scripts/harness_wiring_check.py` BROKEN (exit 1): hunts the pre-rename global skill dirs; docstring cites the dissolved specs paths | Repair-in-place: forge-plugin-cache glob + declared-or-absent SKIP posture (never assume operator-local tooling), docstring paths to the unified map; prove by running it |
| M6 | `component-builder.md` + the house process gate on "component-reviewer" — the REPO agent was deleted 2026-07-02; the plugin `ui:component-reviewer` has served the role since | Repair the seat doc to name the resolvable `ui:component-reviewer`; QUEUE (not execute) the deeper verification — does the plugin agent grade against THIS repo's `rubrics/component.md`? → follow-up, orchestration-reviewer pass |

## WP3 — gate promotion (the campaign's exit criteria become standing law)

| # | Item | Action |
|---|---|---|
| M7 | Hygiene H2 (lowercase `tkt-####` prose cites) | Mechanical sweep to `TKT-####` in active docs (historical records excluded), then PROMOTE H2 to structural |
| M8 | Hygiene H4 (skill dials) — backlog cleared in Phase 3 | PROMOTE to structural |
| M9 | Hygiene H3 (ADR numbering gap 0108) | Convert to a documented KNOWN_GAPS allowlist so FUTURE gaps still surface; 0108 itself is history, never re-numbered |
| M10 | NEW structural S5: no active doc cites `archive/` as live authority | Add after M1 lands (grep-verify, annotate any legitimate historical cite) |

## NOT executed in-campaign → the Phase-6 follow-up queue

- The LLD three-dialect/Layer-spelling unification (update-in-place authoring; hygiene H1 keeps reporting).
- The a2ui-compose (154) / docs-author (165) oversize splits (authoring judgment).
- The M6 deep verification (plugin reviewer ↔ repo rubric — orchestration-reviewer).
- The component-NAMING master plan (`references/naming.md` — Kim's parallel exploration; needs its own inventory).
- tkt-0024 (the renderer structural-resend defect — the standing top engineering item, pre-campaign).

## Keep (suspicion overturned — for the record)

Agents' `skills:` preloads all resolve · a2ui-builder's paths already repaired in Phase 1 ·
`scheduled_tasks.lock` is the LIVE session's lock (git-excluded locally, never committed) · all 15
skills correctly dialed/specied with live consumers · 20-ADR drift sample fully clean · all
supersession chains bidirectional · zero orphaned follow-up promises across done tickets.

## CHECKPOINT OUTCOME (2026-07-12): RATIFIED by Kim — execute all ten.
