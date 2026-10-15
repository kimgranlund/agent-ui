---
id: T-0208
title: "Composite steering as checks: generate 'use composite X' repair findings from selection.json, not prose"
type: feature        # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L3             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P1         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
"Use composite X for moment Y" is enforced by a repair-loop check generated from data (selection.json or the domain manifest), not only by prose: when a surface hand-builds what a registered composite covers (for example a Card of rows where BookingConfirmation, ResultCard or CardTable fits), the producer gets a named finding and self-corrects. Live probes show the Concierge and Lexicographer using their composites.

## Context
Evidence: T-0205 map `.sdlc/runtime/tasks/context-archaeology/archaeologist-L1.md`. Ticket C of the five routing-stability tickets Kim approved 2026-10-14.
- The precedent that worked: `BET_TABLE_MISSING`, `catalog/personas/croupier/checks.ts:420-440` (T-0172 `1a8f6e1a`). CardTable was used only after it existed.
- T-0200 (`af0875a9`) changed only prose; Concierge, Lexicographer and Admiral still hand-build Cards.
- T-0159 gates prose names, not emitted types.
- Catalog SPEC CA-R9 (selection edges, per-domain moment checks): `.claude/docs/spec/a2ui-catalog-architecture.spec.md`. Build the generator so each persona does not hand-write its own check.
- Semantic check seam: `catalog/semantic-check.ts`.

## Done when
- Unit tests: a hand-built surface for each covered moment yields the finding; the composite surface yields none.
- One live probe per affected preset (Concierge, Lexicographer, Admiral) on Haiku 5.5 shows the composite emitted. Spend under $3.
- `npm run check` plus the touched catalog tests.

## Constraints
No em dashes. Never hand-edit generated files; rerun their scripts. Live spend only through `chat:probe` under the stated cap.

## Round 2 evidence (2026-10-15)
Live round 2 (`.sdlc/live-round-2/report.md` on main, #1998): Concierge used a composite on 1 of 24 turns, Lexicographer on 0 of 28, Admiral drew BoardGrid but never GameHud or ResultCard, on Haiku and Sonnet. The scenarios in `scripts/e2e-admin/probe/scenarios/{concierge,lexicographer,admiral}.ts` carry `--expect-turn` for the intended composite; the replays under `scripts/e2e-admin/probe/replays/` pin today's misses. A done T-0208 should flip those to the composite on a replay where the check now repairs the turn. Coordinate with T-0230 (hidden state in the data model), running in a parallel lane on fix/hidden-state-text-shape: do not edit the Lexicographer or Admiral data-model rules; only the composite moment checks.

## Outcome

2026-10-15 · lane: full L3 · verdict: closed by reason (Merged in #2002: composite moment checks generated from one table; live probe repaired Lexicographer and Admiral into BoardGrid and GameHud) · verifier: none · base: none
- Changed: see commits
- Commits: none
