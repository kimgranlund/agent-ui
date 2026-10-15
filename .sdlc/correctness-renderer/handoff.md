---
id: T-0171
title: "Correctness: renderer bindProp untracked, ui-column align leak, conversation rail 2px test red on main"
type: bug             # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P1         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Three live correctness bugs fixed at their root, each with a test that was red first. Kim 2026-10-14: correctness batch next.

## Intent
- Do:
  1. Renderer: `bindProp` in the a2ui renderer's `widget.ts` re-applies the bound value over the guest's edit when a component reads its input there. Wrap that call in `untracked` for all components; remove the BookingForm-only workaround from T-0135 if it becomes redundant. Also fix: a hand-typed date reaches the form data one commit late (numbers already do it right). Test: a bound text field and a bound date field keep the guest's edit and publish it on the same commit.
  2. Layout primitives: `ui-row align=center` (and the same in ui-column / list) maps in Chromium to a centred `text-align` every child inherits (zig-zag rows in badge and icon demos). Fix in row.css / column.css / list.css so align positions children only; browser test in both engines that a child's text-align is untouched.
  3. `conversation` browser test "the rail is one continuous line" is red on main (connector off by 2px, app shard, since before T-0143). Find the cause (likely a non-derived offset after the geometry moves) and fix the CSS, not the tolerance.
- Done when: `npm run check` exit 0; the touched a2ui renderer tests, row/column/list browser tests and the conversation browser tests exit 0 in chromium and webkit; render lint exit 0; screenshots of the badge and icon demos viewed.

## Context
- Source: `.sdlc/notes.md` lines on bindProp (T-0135), ui-row align, conversation rail. Commit on `chore/correctness-renderer` off origin/main, never push. Heavy tests via `gate_lock.py run`, foreground; report after each item.

## Acceptance criteria
- `npm run check` exits 0.
- Renderer: `bindProp` in `packages/agent-ui/a2ui/src/renderer/widget.ts` runs `factory.applyProp` inside `untracked`; the jsdom test "a factory that reads its control inside applyProp never subscribes the bind to it (T-0171)" in `widget.test.ts` passes (it fails with the `untracked` wrapper removed).
- A typed edit in a codec field (date, number) reaches the form value on its own `change`: `ui-text-field` calls the codec's new `commit()` before emitting `change` on blur and Enter. `packages/agent-ui/a2ui/src/renderer/bind-guest-edit.browser.test.ts` passes in chromium and webkit (BookingForm number and typed locale date publish on the same commit and keep the guest's text).
- BookingForm's held date copy and its microtask `sync` are gone; the concierge jsdom and browser tests pass.
- `ui-column` and `ui-list` reset the `align` attribute's presentational `text-align` to `inherit`; the T-0171 text-align legs in `column.browser.test.ts` and `list.browser.test.ts` pass in both engines (center and end failed before the CSS change); `row.browser.test.ts` stays green.
- Conversation rail: the connector ends at the next row's marker top within 1px (measured 0 in both engines); no CSS change, the test now measures to the marker the sheet targets.
- `node scripts/dogfood-compose.mjs --gate` exits 0 and `site/pages/dogfood-render.browser.test.ts`, `badge-demo.browser.test.ts`, `icon-demo.browser.test.ts` pass.

## Constraints
- No literal px geometry. No em dashes.

## Closed

2026-10-14: merged as PR #1972
