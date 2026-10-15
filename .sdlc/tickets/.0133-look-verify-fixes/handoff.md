---
id: T-0133
title: "Look check fixes: sm avatar initials under 9px, badge and icon demos overflow at 400px, doubled search icon"
type: bug             # feature | bug | chore | spike | idea
status: done
size: L2
priority: P1
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-13
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
The batched look verifier (T-0132, .sdlc/tickets/.0132-foundations-look-verify/verifier-L2.md) failed two families on main, entry and atoms, with three defects. Fix them so a re-check of those two families passes.

## Scope (one brief paragraph, per the Inner loop rule)
(1) packages/agent-ui/components/src/controls/avatar/avatar.css:83: sm avatar initials render 8.4px (0.42 x the 20px box); hold them at the floor with the generated token, `max(var(--md-sys-type-floor, 9px), calc(var(--ui-avatar-size) * 0.42))`, the same form playing-card.css uses (the census gate accepts that fallback), and add a browser assertion that sm initials are at least 9px; re-mint only an avatar golden that moves, after viewing it (`<file> --update`, the filter before the flag). (2) At 400px site/pages/badge-demo.ts ("Count pills + the empty-label floor" row) and site/pages/icon-demo.ts ("Sizing" ramp row) spill past the content column: wrap those rows or frame them with the scrollX helper from site/lib/specimens.ts as T-0130 did, and add both pages to PAGES in site/pages/demo-overflow-400.browser.test.ts (red before, green after); 1000px must not change. (3) site/pages/text-field-demo.ts:83 slots a second leading magnifier into a type="search" field that already draws a built-in one (text-field.ts:115), which squeezes the editor to a 96px end track: first decide by reading text-field.md whether a slotted leading part on a search field is a supported case; if supported, fix the text-field grid so a slotted leading part sits beside or replaces the built-in one and the editor keeps the 1fr track, with a test; if not supported, remove the slotted icon from the demo and say so in the descriptor. Evidence: before and after screenshots of the three at 400 and 1000 in the ticket folder, viewed. Local gate: npm run check plus the touched folders' tests and browser files (through gate_lock.py), exit 0. Commit locally, do not push, no em dashes, report in one short message.

## Acceptance criteria
- `npm run check` exits 0.
- `npx vitest run --config vitest.browser.config.ts --project site site/pages/demo-overflow-400.browser.test.ts site/lib/theme-provider-build.browser.test.ts` exits 0 (badge-demo and icon-demo are in PAGES; red before the demo fix).
- `npx vitest run --config vitest.browser.config.ts --project packages packages/agent-ui/components/src/controls/avatar packages/agent-ui/components/src/controls/text-field` exits 0 (sm initials at least 9px).
- `npx vitest run packages/agent-ui/components/src/controls/avatar packages/agent-ui/components/src/controls/text-field site/pages site/lib` exits 0.
- `node scripts/generate-agent-assets.mjs --check` exits 0.
- Before and after screenshots of avatar-demo, badge-demo, icon-demo and text-field-demo at 400 and 1000 sit in `.sdlc/0133-look-verify-fixes/before` and `.sdlc/0133-look-verify-fixes/after`; 1000 is unchanged for badge-demo and icon-demo.

## Closed

2026-10-13: merged as #1950
