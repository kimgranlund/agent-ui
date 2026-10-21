---
id: T-0389
title: "Stylist ContrastPair browser test: the verdict pill glyph is clipped (red at base)"
type: bug             # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-20
claimed_by: claude:a8ce3b21 2026-10-21
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 5
---

## Goal
`packages/agent-ui/a2ui/src/catalog/personas/stylist/contrast-pair.browser.test.ts` "each verdict pill shows a glyph beside its word: a tick for Pass, a cross for Fail" passes in Chromium and WebKit. Fix the cause; do not loosen the test.

## Repro
1. `env -u NODE_OPTIONS npx vitest run --config vitest.browser.config.ts --project packages-rest packages/agent-ui/a2ui/src/catalog/personas/stylist/contrast-pair.browser.test.ts`

## Actual
"expected 'none' not to be 'none'" on the pill glyph clip, in both engines.

## Context
Found by the T-0197 step 3 builder (2026-10-20). It was already red at 17da4bcbe, before T-0197 touched anything. Kim filed it as its own ticket. A guess, not verified: a T-0374 geometry or glyph change (step 1, glyph slot; step 6, radius) altered the pill's clip.

## Constraints
The failing test is the red.
- Lane: solo because size L1 (steps.py lane); fanout 2026-10-21

## Outcome

2026-10-21 · lane: full L1 · verdict: pass · verifier: verifier-L1 (opus) · base: 4b95ae06d541
- Changed: ContrastPair browser test checks the glyph's drawn mark instead of the retired clip-path
- Commits: 5f84a38 T-0389: ContrastPair browser test reads the glyph's drawn mark, not the retired clip-path
- Check: 1 The "each verdict pill shows a glyph beside its word" test passes in Chromium and WebKit, fixing ...: pass
- Follow-up: note: there is no recorded pre-edit red run in the artifacts dir -> notes.md
