---
id: T-0229
title: "Haiku's text-shape turn shows a trailing meta-line and an unparsed wire line as chat prose"
type: bug             # feature | bug | chore | spike | idea
status: proposed     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P1         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
A turn the model answers in the text shape (prose, a meta-line, then wire lines) shows only the prose in chat: no `{"a2uiMeta"` line and no A2UI line that failed to parse.

## Repro
1. `npx vitest run scripts/e2e-admin/probe/replays/croupier-draw-haiku-meta-tail.test.mjs` (pinned to today's failures `no-json-as-prose:1`, `no-internal-leak:1`).
2. Or open `.sdlc/live-round-2/runs/croupier-five-card-draw-haiku-1/turn-2.png` (git-ignored; in the wave-r2 worktree).

## Expected
Turn 1's chat reads "You check, and the dealer checks behind you, ... Stand pat to keep all five." The meta-line's `target` still applies; when the round has both prose and a meta-line `note`, the prose is the reply (the note is the fallback for an empty text channel, T-0194).

## Actual
The reply is the prose plus `{"a2uiMeta":{"note":"You check, the dealer checks, ...","target":{"surfaceId":"table-1"}}}`, shown raw in chat (trace `2026-10-15.jsonl:42` in the wave-r2 worktree). Haiku 5.5 skipped `render_surface` on 28 of 103 turns in live round 2 and wrote this shape instead; all 12 leaking replies are this shape (or, at :85, prose then a meta-line with no wire line), all Haiku: :2, :8, :11, :12, :42, :44, :53, :54, :56 (Croupier, 4 of 8 games), :63 (Concierge), :84, :85 (Lexicographer). In :12 the reply also carries an `updateComponents` line that is not valid JSON (`"children":["again"]},"again":null}}`); it fails heal, so it stays in the reply as prose with no finding.

## Context
Guess: `peelMetaLine` (`packages/agent-ui/a2ui/src/agent/produce.ts`) peels only the first non-empty line, so a meta-line after prose is never peeled, and the reply split keeps every line `isWireLine` rejects. T-0213 covered the reply that is itself a meta-line. Two fixes, one place: peel a meta-line wherever it sits in the prose, and send an unparseable `{"version"` line to the repair round (or drop it) instead of the reply. Found by T-0225 (`.sdlc/live-round-2/report.md`).

## Constraints
The failing test lands before or with the fix, never after. No em dashes.

## Acceptance criteria
- (red) `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/produce-response-type.test.ts` exits 0: prose, then a meta-line, then wire lines ships the prose as the reply and applies the meta-line's target; an unparseable A2UI line never reaches the reply.
- `npx vitest run scripts/e2e-admin/probe/replays/croupier-draw-haiku-meta-tail.test.mjs` exits 0 with its expectation flipped to `toEqual([])`.
- `npm run check` exits 0.
