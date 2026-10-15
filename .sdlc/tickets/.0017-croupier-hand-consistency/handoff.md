---
id: T-0017
title: "Croupier hands and totals must not disagree: data-driven hands, a persona semantic check hook, sharper teaching (GH #1795 evidence)"
type: bug             # feature | bug | chore | spike | idea
status: done     # proposed | ready | blocked | done | dropped (build progress lives in /board)
size: L              # S | M | L | XL
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-06
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
The bug is fixed and a test that failed before the fix passes after it.

## Repro
1. Exact command or steps, from a clean checkout.

## Expected

## Actual
Paste the output or error verbatim.

## Context
Where it was found (file:line, story id, session). Suspected cause, marked as a guess.

## Constraints
The failing test lands before or with the fix, never after.

## Acceptance criteria
Built by the solo lane (tier L) on branch `fix/croupier-hand-consistency` in worktree
`/Users/kimgranlund/Projects/nonoun/agent-ui/.claude/worktrees/wave-croupier2`, commits `60bc4df6`
(teaching), `05881488` (hook + Croupier check), `d786160c` (ADR-0238 proposed + records), `d9abe181` (fixture precondition), on top of
`origin/main` `d8417cf1`. Evidence payload: `evidence-dealer-17.jsonl` in this folder.

1. Data-driven hands are taught: `packages/agent-ui/a2ui/src/agent/prompts/mini-skills/card-layout.md`
   teaches each hand as a list at `/dealerHand` or `/playerHand` drawn by one templated Row, and
   "Compute each total from the cards you list"; `game-table-chrome.md` binds each zone total to
   `/dealerTotal` or `/playerTotal`, stating the total only; the Croupier preset in
   `site/pages/agent-admin-presets.ts` says the same. Both modules stay within the 200-token budget;
   catalog rows and enums are unchanged.
2. A templated-hand Croupier surface renders in jsdom with one `ui-playing-card` per list item
   (`src/catalog/personas/croupier/templated-hand.test.ts`).
3. Generic, opt-in hook: a persona declares `semanticChecks` on its `PersonaCatalogManifest`;
   `produce()` runs them after `validateA2ui` and FEED_SCOPE; a finding feeds the existing repair round
   with its sentence, bounded by `maxRounds`; at the bound the valid payload ships tallied
   `SEMANTIC_UNCORRECTED` (never a halt); no new wire format. Both hosts resolve checks for the SELECTED
   catalog (`semanticChecksDeps`).
4. The evidence passes structural validation on top of its (reconstructed) deal turn and FAILS the
   Croupier check with one finding `HAND_TOTAL at table-3:dealerTotal` naming 17 against cards 6, 5, 3
   totalling 14; a corrected payload passes (`src/catalog/personas/croupier/checks.test.ts`).
5. A scripted-provider `produce()` run (round 1 evidence, round 2 corrected) shows exactly one repair
   round, streams the corrected payload, and reports `trace.rounds === 2`; with no checks the evidence
   ships on round 1 (`src/live-agent/produce-semantic-checks.test.ts`).
6. A persona without checks is byte-identical: absent, empty and always-passing checks give identical
   lines and provider requests; the prompt baseline moved only the `miniSkills` entries for
   `card-layout` and `game-table-chrome` (deliberate recapture).
7. The croupier agent manifest `seedDigest` is refreshed by its writer; `seedVersion` stays 6 (no store
   migration: existing users get the teaching through the server-composed mini-skills and the check).
8. ADR-0238 is `proposed` (never ratified here); SPEC `a2ui-live-agent` v0.21, SPEC
   `persona-catalog-composition` v0.5, the live-agent LLD (LLD-C15), `agent-model.md`, skills
   `a2ui-jsonl-mcp`, `a2ui-multi-catalog`, `a2ui-prompt-authoring`, and `packages/agent-ui/a2ui/AGENTS.md`
   are repaired; the sitemap ADR index is regenerated; no em dashes added outside the ADR H1 format.
9. Gates by exit code: `npm run check`, `npx vitest run --project packages packages/agent-ui/a2ui/src`,
   `npx vitest run --project tools packages/agent-ui/a2ui/tools`, `npm run eval:agent-behavior -- selftest`,
   and `npm test` all exit 0.

## Closed

2026-10-06: Merged to main in #1832
