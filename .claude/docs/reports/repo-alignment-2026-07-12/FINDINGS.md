# FINDINGS index — repo-alignment 2026-07-12

| # | Phase | Finding | Where |
|---|---|---|---|
| F1 | 0 | Two live doc-map generations (specs/ tree beside spec/·lld/·prd/) | phase-0-inventory.md §4 — RESOLVED (Phase 1 WP3, `fe5c1c6`) |
| F2 | 0 | Root strays: literal `undefined/` dir (build-css falsy root), empty root `public/`, `docs/other/` | §2 — RESOLVED (WP1, `70384c9`, + the guard) |
| F3 | 0 | Five June foundation ADRs stale-`proposed` while shipped as law | §5.1 — RESOLVED (Kim ratified; WP2, `9b134f2`) |
| F4 | 0/3 | 18→22 shipped-but-`proposed` SPECs — judged DELIBERATE convention, not rot | survey A3; codified in agent-ui-doc-standards §2 |
| F5 | 1 | Four pre-existing dangling refs caught by the move sweep (ADR-0066 wrong filename ×2, chart-family wrong-depth links, anatomy.md → the renamed component-author skill, + the expert-system PRD's phantom `.claude/CLAUDE.md`) | RESOLVED (WP3) |
| F6 | 3 | `adr-status-guard.py` — the ADR-0086-incident guard — was REGISTERED NOWHERE (dead protection) | RESOLVED: registered PreToolUse + smoke-tested both directions; S4 prevents recurrence |
| F7 | 3 | scribe doc_lint structurally blind to the repo dialect (YAML-only; draft/approved enums) — only tickets lintable; bug-ticket sections would fail its T3 | codified as the local-authority boundary (standards skill §5); no repo gate change owed to scribe |
| F8 | 3 | tkt-0003 predates the `kind`/`size` convention (caught by the NEW S1 gate's first run) | RESOLVED (backfilled) |
| F9 | 3 | Hygiene backlog (reported by the standing gate, promotion pending): LLD Layer-spelling split + 3 header dialects · lowercase tkt- cites in prose · ADR numbering gap 0108 · skill-dial completeness (2 fixed this phase) | docs-grammar.test.ts HYGIENE tier |
| F10 | 0 | No CI workflows exist — gates are npm scripts; the campaign's checks wire into `npm test`, not CI | calibration log |
| F11 | 4 | 7 live docs cited the FROZEN archived charter README as their traceability home | RESOLVED (WP1 M1, `3753db6`) |
| F12 | 4 | ADR-0088/89/90/97/98 accepted with unfilled "pending Kim" Ratified-by placeholders (landed accepted-at-birth in the 96a0778 batch) | RESOLVED (WP1 M2 — evidence-backed fills, Kim-ratified via the manifest) |
| F13 | 4 | drafts/container-family-design.md — dead orphan (scope shipped without citing it) | RESOLVED (WP1 M3 — archived; drafts/ dissolved) |
| F14 | 4 | scripts/harness_wiring_check.py BROKEN since the 2026-07-01 skill renames (probed dead dirs) | RESOLVED (WP2 M5 — forge-cache probe, declared-or-absent; 19/19 exit 0; surfaced the forge D9 'composer' registry gap → accepted-divergence + upstream ask queued) |
| F15 | 4 | component-builder.md + process gated on the RETIRED repo component-reviewer seat | RESOLVED naming (WP2 M6 → ui:component-reviewer); the grades-against-which-rubric verification queued |
| F16 | 5 | The exit criteria are standing law: S5 (archive-as-history-only) · S6 (TKT case) · S7 (dials) · S8 (ADR contiguity vs KNOWN_GAPS) promoted/added; hygiene slims to H1 (the LLD dialect split — follow-up queue) | `f93ad6f` |
