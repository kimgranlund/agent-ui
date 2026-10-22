---
id: T-0409
title: "The board-less game gate stops firing game composite checks on non-game surfaces (a travel adventure, a storefront, a receipt)"
type: bug             # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-22
claimed_by: claude:a8ce3b21 2026-10-22
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 5
---

## Goal
The game composite-moment checks (Timeline, ResultCard, GameHud rows in packages/agent-ui/a2ui/src/catalog/composite-moments.ts) and the hidden-state ACTION_NOT_APPLIED gate (packages/agent-ui/a2ui/src/catalog/hidden-state-checks.ts:542) stop misfiring on non-game surfaces whose text happens to hold a GAME_WORDS word, now that hospitality and commerce turns run on the same agent-ui catalog: a concierge "Your Iceland adventure" travel journal gets TIMELINE_MISSING with a Dungeon Master repair; a receipt or podcast card that mentions "game" gets RESULT_CARD_MISSING; a storefront "Board games and puzzles" or a "Game settings" page gets ACTION_NOT_APPLIED.

## Intent
- Do: design the narrowest root fix for the gate (for example a turn-level game signal such as the persona's foundation, the selected domains, or a game action, instead of free-text word matches on any surface; or a non-game veto), then implement it with tests: every misfire above becomes a quiet negative test that is red on main; the existing positive game tests stay green; run the false-positive and false-negative sweep over the recorded rounds the earlier tickets used (T-0358, T-0364 sweeps: .sdlc/evals/rounds and the probe replays) and report base vs built counts.
- Non-goals: repair wording (model-read text, debate rule); grammar.md and the prompt stack; new composite rows.
- Done when: the new negatives fail on main and pass after; the sweep shows no new misses on recorded game rounds; `npm run check`, `npx vitest run packages/agent-ui/a2ui/src/catalog packages/agent-ui/a2ui/src/live-agent`, the probe project (`npx vitest run --project scripts scripts/e2e-admin/probe`) exit 0; prompt-equivalence baseline unchanged.

## Context
Notes .sdlc/notes/notes.md :425, :442, :462 (verifier findings on T-0358, T-0364). GAME_WORDS at composite-moments.ts:174, HUD_GAME_WORDS :177, the boardless gate :293. Hospitality is a domain on agent-ui since T-0197; concierge, restaurant, travel and commerce turns run beside the game personas. Never rewrite .sdlc/evals/rounds.

## Constraints
No em dashes. ADRs frozen. Prompt stack byte-pinned.
- Lane: solo because size L1 (steps.py lane); overnight goal 2026-10-21

## Acceptance criteria
1. The five misfires are quiet negatives, red on 813d70124 before the fix and green after: `npx vitest run packages/agent-ui/a2ui/src/catalog/composite-moments.test.ts -t T-0409` and `npx vitest run packages/agent-ui/a2ui/src/catalog/hidden-state-checks.test.ts -t "stays quiet with no update"` exit 0; the T-0409 guard test proves each composite negative fires with the game gate opened.
2. The existing positive game tests stay green: `npx vitest run packages/agent-ui/a2ui/src/catalog packages/agent-ui/a2ui/src/live-agent` exits 0.
3. The probe replays keep their verdicts: `npx vitest run --project scripts scripts/e2e-admin/probe` exits 0.
4. `npm run check` exits 0, and the prompt-equivalence baseline is untouched: `git diff --quiet -- packages/agent-ui/a2ui/src/live-agent/prompt-equivalence.baseline.json` exits 0.
5. Sweep of every tracked .json/.jsonl holding updateComponents (each batch alone and accumulated per surface in file order), base against built: GAME_HUD_MISSING, RESULT_CARD_MISSING and TIMELINE_MISSING lose no hit; the ACTION_NOT_APPLIED game gate (a synthetic prose move at each recorded surface as its declared target, no update) loses no surface.

## Outcome

2026-10-22 · lane: solo L1 · verdict: pass · verifier: verifier-L3 (fable) · base: 813d70124fe0
- Changed: GAME_WORDS drops game, games and adventure; the ACTION_NOT_APPLIED gate also reads game in the model's own ids and action names; five non-game misfires quiet, no recorded game hit lost
- Commits: none
- Check: 1 The five misfires are quiet negatives, red on 813d70124 before the fix and green after; the T-040...: pass
- Check: 2 The existing positive game tests stay green, `npx vitest run packages/agent-ui/a2ui/src/catalog p...: pass
- Check: 3 The probe replays keep their verdicts, `npx vitest run --project scripts scripts/e2e-admin/probe`...: pass
- Check: 4 `npm run check` exits 0 and the prompt-equivalence baseline is untouched: pass
- Check: 5 Sweep of every tracked .json/.jsonl holding updateComponents, base against built, the three compo...: pass
