---
id: T-0127
title: "Post-shrink cleanup: four focus-timing tests red on main and the playing-card suit under the 9px floor"
type: bug             # feature | bug | chore | spike | idea
status: done
size: L2
priority: P2
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-13
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Four focus-timing browser tests have been red on main since the foundations cut (they are outside CI), and one glyph renders under the 9px type floor. Make them green and the glyph legal.

## Scope (one brief paragraph, per the Inner loop rule)
On main after #1942 (root n 5 / 6 / 7, heights 20 / 24 / 28). Run `npm run test:browser:focus-timing` (through gate_lock.py) and fix the four red tests: `packages/agent-ui/code/src/editor/editor.browser.test.ts` ("outside any region: today's geometry holds": the page root now defines `--md-sys-inset`, so editor.css never takes its font x 0.5 fallback; rewrite the test's premise to the derived inset at the root and keep a legacy leg under data-foundations="legacy" if the file has that pattern), `otp-field.browser.test.ts` (two tests) and `textarea.browser.test.ts` (find the root cause first; if a test is right and production is wrong, fix production and say so). Then `packages/agent-ui/components/src/controls/playing-card/playing-card.css:207`: the corner suit `font-size: 0.9em` renders 8.78px at the canvas; floor it at 9px (`max(9px, 0.9em)`) and re-mint only the playing-card or card-table goldens that move, after viewing them. Local gate: npm run check plus the touched folders' tests and the focus-timing shard, exit 0. Commit locally, do not push, no per-ticket verifier, no em dashes, report in one short message with root cause per test.

## Closed

2026-10-13: merged as #1943
