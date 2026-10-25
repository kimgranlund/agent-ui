---
id: T-0454
title: "The welcome surface's option cards render at 150 to 250px tall with a full-height media column and uneven heights"
type: bug             # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P1         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-25
claimed_by: claude:a8ce3b21 2026-10-25
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
An option list of icon-led choices on a GenUI surface renders compact, even-height rows at the widget register (an icon tile at control size beside a title and one line of text), not tall cards with a full-height media column.

## Repro
1. Open ui.nonoun.io (deployed 2026-10-25 from aeb08930c), the GenUI render demo, "Use agent-ui components" on.
2. Prompt "welcome screen" (Claude Sonnet 5.5, Medium).

## Expected
Each choice (Explore, Set up my profile, Get help) is one compact row about the height of its two text lines plus padding, all rows the same height, the icon at the control ramp for `data-tier="widget" data-scale="md"`.

## Actual
Kim, screenshot at .sdlc/runtime/tasks/0454-genui-option-cards-oversized/kim-screenshot.png: "cards are massive". Each choice is a card with a checkered media column (about 160px wide) holding a large circled icon; rows are about 160px, 250px and 200px+ tall (uneven), so three choices overflow a tall render pane.

## Context
Found live by Kim on 2026-10-25. Guess, unconfirmed: either the catalog component the producer picked (a card with a media slot) gives an icon the image-media treatment and lets the media column stretch to the row height, or the producer chose a media card where an icon-led option row fits. Find which component rendered it (the trace or a replay of the "welcome screen" ask) before changing anything.

## Constraints
The failing test lands before or with the fix, never after. A style fix carries a screenshot of the real widget before and after (AGENTS.md Inner loop). No one-off heights: use the library ramp. If the fix is prompt or catalog teaching (model-read text), say so: that needs a Fable review.

## Done when
- The "welcome screen" surface (live once, or a replay from its trace) renders the three choices as even, compact rows; before and after screenshots in the artifacts dir.
- A test that fails before the fix pins the cause (component geometry or producer choice).
- `npm run check` plus the touched folders' tests pass.
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
- The one-column ui-option-deck row is a compact list row: a tone tile at the register's control height (`--md-sys-height`) with the icon at `--md-sys-icon-box`, every row the same height, and a definite block size on the host never stretches the rows; pinned by the T-0454 block in `option-deck.browser.test.ts` (red before the CSS change in Chromium and WebKit): `npx vitest run --config vitest.browser.config.ts --project packages packages/agent-ui/components/src/controls/option-deck` exits 0.
- The 400px visual golden is re-baselined deliberately and the visual project passes: `npx vitest run --config vitest.browser.config.ts --project visual packages/agent-ui/components/src/controls/option-deck` exits 0.
- Generated and fixture files are fresh and the render lint has no stale allowlist entry: `npx vitest run --config vitest.browser.config.ts --project site site/pages/dogfood-render.browser.test.ts` exits 0, and `npx vitest run packages/agent-ui/components/src/controls/option-deck packages/agent-ui/components/src/controls/sandbox-frame site/lib/theme-provider-build-fixture.test.ts` exits 0.
- `npm run check` exits 0.
- Before and after screenshots sit in the artifacts dir (`before-*.png`, `after-*.png`).

## Outcome

2026-10-25 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: aeb08930c73a
- Changed: Option deck rows are compact, even-height tiles at control size and no longer stretch to fill a taller host
- Commits: none
- Check: 1 Compact one-column row, pinned by the T-0454 block (red before in Chromium and WebKit): pass
- Check: 2 400px golden re-baselined and the visual project passes: pass
- Check: 3 Generated and fixture files fresh, render lint has no stale allowlist entry: pass
- Check: 4 `npm run check` exits 0: pass
- Check: 5 Before and after screenshots in the artifacts dir: pass
- Follow-up: note: the dogfood GenUI frame sets no data-tier, so decks render at the... -> notes.md
- Follow-up: note: Kim's exact "welcome screen" HTML was not replayed no trace or key... -> notes.md
