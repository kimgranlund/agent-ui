---
id: T-0165
title: "Product md: drill-demo columns specimen loads stacked (frame under the 840px line after the 42n nav pane)"
type: bug             # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P1         # P1 | P2 | P3
depends: [T-0152]    # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
The last red on `feat/root-product-md`: the site shard's `site/pages/drill-demo.browser.test.ts` fails 2 tests in both engines ("columns specimen loads 2 columns wide": data-drill-layout is `stack`, expected `columns`; and the auto-degrade test that starts from columns). Also refresh two stale generated files.

## Intent
- Do:
  - Find the root cause. Likely: T-0158 grew the docs nav pane from 252px to 42n (336px), so the content column, and with it the drill demo's `.reflow-frame`, now loads under the drill's 52.5rem / 840px columns line. Confirm by measuring, do not guess.
  - Fix at the cause: size the specimen frame (or the test viewport) so the columns specimen loads wide at the product / md root, keeping the 840px law and the auto-degrade test meaningful. If the drill's own line should derive from n instead of a fixed 52.5rem, say so in the report instead of changing it.
  - Regenerate `llms-full.txt` (`node scripts/generate-llms-full.mjs`) and the theme-provider build fixture (`npm run regen:theme-provider-fixture`), which the unit suite flagged stale.
- Done when: `site/pages/drill-demo.browser.test.ts` exit 0 in chromium and webkit (`npx vitest run --config vitest.browser.config.ts --project site site/pages/drill-demo.browser.test.ts`); `site/lib/llms.test.ts` and `site/lib/theme-provider-build-fixture.test.ts` exit 0; render lint exit 0; `npm run check` exit 0.

## Context
- Branch base `feat/root-product-md`; commit on `chore/rootmd-drill-demo`, never push. Heavy tests through `gate_lock.py run` in the foreground; never idle on a monitor.

## Constraints
- No literal px geometry (census gate). No em dashes.

## Closed

2026-10-14: merged as PR #1969
