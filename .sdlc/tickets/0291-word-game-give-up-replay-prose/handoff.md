---
id: T-0291
title: "Haiku gives up and replays the word game in prose: the flowEnd rule says no A2UI, the check needs a target, and Play again frames no exemplar"
type: bug             # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
A Lexicographer give-up shows its ResultCard and "Play again." shows a fresh board on Haiku, or a check sends the turn back.

## Repro
Keyless: `npx vitest run scripts/e2e-admin/probe/replays/lexicographer-haiku-give-up-no-surface.test.mjs` (pinned, `// expectedFail: T-0291`). Live: `.sdlc/evals/rounds/2026-10-15-r5-fixes/` traces :91-:95, :67-:72.

## Expected
The give-up updates word-forge with one ResultCard; the replay resets it.

## Actual
:94 "I give up." answers in prose with a meta-line that declares no target. Haiku's reasoning: "the rule that flow-ending turns should emit no UI at all ... I'm deciding the flow rule wins". :72 and :95 "Play again." plan a reset and call no tool. No code fires on any of the three. The guesses before them update the board (T-0280 holds), and :66 and :71 give-ups were saved by ACTION_NOT_APPLIED because they declared word-forge.

## Context
Fog report `4095416195875afe423e60ea`, decision d3, finding f4 (T-0287). `wordMoveAppliedCheck` returns early when `target === undefined` and has no replay case (`packages/agent-ui/a2ui/src/catalog/hidden-state-checks.ts`). "Play again." frames no exemplar and no mini-skill on Haiku and Sonnet (:72, :95, :145). The flow-completion rule is `grammar.md` "Flow completion".

## Constraints
The failing test lands before or with the fix. Sonnet's passing give-up and replay (:144, :145) stay green.

## Ruling (Kim, 2026-10-16)
Fix it in the persona text and the repair messages (frame a repair as a check result, not a system notice), never in the byte-pinned shared grammar (`packages/agent-ui/a2ui/src/agent/prompts/grammar.md`), which stays unchanged for every persona.

## Acceptance criteria
- `npx vitest run scripts/e2e-admin/probe/replays/lexicographer-haiku-give-up-no-surface.test.mjs` exits 0 with turns 3 and 4 carrying ACTION_NOT_APPLIED.
- `npx vitest run packages/agent-ui/a2ui/src/catalog/hidden-state-checks.test.ts` exits 0, including the T-0291 cases (a targetless give-up, a prose Play again, and the passing shapes).
- `npx vitest run site/pages/agent-admin-presets.test.ts site/lib/agent-manifest` exits 0 (the Lexicographer foundation change, seed 5, manifest digest).
- `npm run check` exits 0.
- `git diff 91789663 -- packages/agent-ui/a2ui/src/agent/prompts/grammar.md` prints nothing.
