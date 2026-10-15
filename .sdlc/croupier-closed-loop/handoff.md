---
id: T-0184
title: "Croupier closed-loop runs: every game, a few rounds, each model; find and file open bugs"
type: spike           # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P1         # P1 | P2 | P3
depends: [T-0172, T-0175]  # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Kim 2026-10-14: "design a few closed loop test runs for Croupier that plays all the games a few rounds using each of the models, and find any open bugs or issues." Runs after the filed Croupier bug tickets land.

## Intent
- Do:
  1. Inventory the Croupier's games from its preset and fragment (blackjack and every other game it offers), and each game's phases and actions (bet strip, hit, stand, double, split, new round, and the equivalents).
  2. Write one scenario per game with `npm run chat:probe` steps: open the game, play 3 rounds through every action at least once (including a bust, a push or tie, a natural or win, a bankroll that runs low), then a new round. Expectations per turn: no-halt, no-json-as-prose, no-surface-loss, expect-component CardTable (or the game's widget), data-model invariants (bankroll arithmetic per payout rule, totals match cards, face-down only where the rules say, actions enabled only in the right phase), render lint. Save them in the scenario home (`scripts/e2e-admin/probe/` or T-0176's format if it has landed).
  3. Run every scenario live on each model in the picker (Haiku 5.5, Sonnet 5.5, Opus 5.5) at the default effort, 2 samples each, total live spend capped at $5 (Kim's cap); priority order Haiku, Sonnet, Opus; stop at the cap and report coverage.
  4. Report: a table game x model of pass/fail per check with trace ids and screenshots in the ticket folder; every distinct failure as a finding with root-cause guess and evidence. File each real bug as its own ticket (`tickets.py new bug`, with trace id, screenshot, failing check), and turn each into a replay regression via `--from-trace`, marked `expectedFail: <ticket>` if the format supports it, else listed.
- Non-goals: fixing the bugs found (they get their own tickets); new games.
- Done when: the scenarios exist and replay keyless; the live run report (`.sdlc/croupier-closed-loop/report.md`) covers every game x model cell within the cap; each finding is a ticket or explicitly marked not-a-bug with a reason; `npm run check` exit 0.

## Context
- Tools: `npm run chat:probe` (T-0174), `npm run traces`, the T-0172 fixes (structured render_surface input, duplicate-root rule, retry surface-loss, bet strip, card face-down, action enablement, thinking display). Keys only through the dev proxy (ADR-0073). Commit off origin/main, never push. Live spend cap $5.

## Constraints
- Never print keys. No em dashes.

## Live runs (added 2026-10-14)
- This lane has no key access: write the scenarios, verify them keyless (replay or seeded), and put the exact live commands in `.sdlc/croupier-closed-loop/live-commands.sh` (one `npm run chat:probe -- ...` per scenario x model x sample, with `--out .sdlc/croupier-closed-loop/runs/<scenario>-<model>-<n>`), then report. The conductor runs them with the key and sends you the report paths; you then analyse, file bug tickets and write report.md.
- Models: claude-haiku-5-5, claude-sonnet-5-5, and Opus 5.5 if it is in the picker.

## Acceptance criteria
Phase 1 (keyless, this lane). Phase 2 (report.md, bug tickets, `--from-trace` replays) waits on the conductor's live run paths.
- `npx vitest run scripts/e2e-admin/probe/scenarios/croupier.test.mjs` exits 0: every scenario x model x sample parses as a live probe, names and outs are unique, `live-commands.sh` equals the generated script, every `GAMES_RULES` game has a scenario, every model is in the picker.
- `bash -n .sdlc/croupier-closed-loop/live-commands.sh` exits 0.
- `npm run check` exits 0.

Phase 2 (after the 16 live runs, 2026-10-15):
- `npx vitest run scripts/e2e-admin/probe/replays/` exits 0: the eight T-0184 replays (two assert their known failing check, marked expectedFail) and the earlier ones.
- `python3 /Users/kimgranlund/.claude/plugins/cache/sdlc-lite/sdlc-lite/0.23.0/scripts/tickets.py --root /Users/kimgranlund/Projects/nonoun/agent-ui/.sdlc check` exits 0: bug tickets T-0211 to T-0222 filed (minted in the main ticket store, where ids are allocated; copies committed on this branch).
- `.sdlc/croupier-closed-loop/report.md` holds the game x model table and every finding as a ticket or a not-a-bug reason.

## Plan review
- swap applied by conductor: criterion #5 pinned plugin 0.22.7; swapped to 0.23.0 per verifier-L2 For the next attempt (steps.py swap refuses a solo dir without a solo result file). Verifier evidence: 0.23.0 check rc=0, ok: 223 tickets.
