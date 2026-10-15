---
id: T-0225
title: "Live round 2: Croupier on 3 models plus Concierge, Lexicographer and Admiral scenarios, $20 cap"
type: chore           # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P1         # P1 | P2 | P3
depends: [T-0222]          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Kim's next live round (2026-10-14, $20+ budget) has scenarios and a capped runner ready, so the conductor can run it in one go after T-0222 merges.

## Scope (phase 1, keyless, this ticket's solo)
- Croupier: add `claude-opus-5-5` to the scenario models (it is in the picker since T-0185). 8 games x 3 models, sample 1, uses `--expect-turn` from T-0222.
- New scenario modules beside `scripts/e2e-admin/probe/scenarios/croupier.ts`, same shape and test style, for Concierge, Lexicographer and Admiral: 3 multi-turn scenarios each (4 to 8 steps), Haiku 5.5 and Sonnet 5.5. Each step that should draw a registered composite carries `--expect-turn <Type>` for the composite the catalog intends (Concierge: BookingForm, BookingConfirmation or ServiceCard; Lexicographer and Admiral: read their catalog `selection.json` and preset prose). These are the T-0200 / T-0208 measurement: does the model use the composite.
- One generated `live-commands.sh` for the whole round under `.sdlc/live-round-2/`, out dirs `runs/<preset>-<scenario>-<model>-1`.
- A runner that stops at an estimated spend cap read from traces (port `/private/tmp/claude-501/run-capped.py` into `scripts/e2e-admin/probe/` as a script with a test), Haiku first, then Sonnet, then Opus.

## Phase 2 (conductor, live)
Run under a $20 cap, log every run to the test-log artifact, then a report with one ticket per new root cause.

## Done when
- Scenario tests for all four presets exit 0 (`npx vitest run scripts/e2e-admin/probe/scenarios/`), and the generated commands match.
- The capped runner has a keyless test (fake traces) that stops at the cap.
- `npm run check` exits 0. No live spend in phase 1.

## Acceptance criteria
- `npx vitest run scripts/e2e-admin/probe/scenarios/` exits 0: Croupier on 3 models (8 games), Concierge, Lexicographer and Admiral 3 scenarios each on Haiku and Sonnet 5.5, every step's `--expect-turn` type in the catalog, and `.sdlc/live-round-2/live-commands.sh` byte-equal to `roundCommandsScript()` (42 runs, Haiku then Sonnet then Opus, out dirs `runs/<preset>-<scenario>-<model>-1`).
- `npx vitest run scripts/e2e-admin/probe/run-capped.test.mjs` exits 0: fake traces, the runner stops before the run that would start at or over the cap, skips reported runs, and keeps its baseline across a restart.
- `.sdlc/croupier-closed-loop/live-commands.sh` (T-0184 record) is unchanged: `git diff --exit-code -- .sdlc/croupier-closed-loop/live-commands.sh` exits 0.
- `npm run check` exits 0.
