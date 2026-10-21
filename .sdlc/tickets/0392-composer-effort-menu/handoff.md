---
id: T-0392
title: "Composer effort menu: one selection idiom, aligned rows, Phosphor check, separator, contained focus ring"
type: bug             # feature | bug | chore | spike | idea
status: claimed        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-21
claimed_by: claude:a8ce3b21 2026-10-21
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
The chat composer's effort menu (Low, Medium, High, X-High, Thinking off, Show reasoning) reads as one aligned menu with one selection idiom, and matches the geometry system.

## Intent
- Do:
  1. Replace the clip-path checkmark (`packages/agent-ui/components/src/controls/menu/menu.css:340`) with the curated Phosphor `check` glyph through the icon pack (ADR-0066).
  2. Make the effort group `menuitemradio` rows with the same check slot as the toggle rows, so all labels align (today the toggles reserve a check slot at `menu.css:322-325` and the effort rows are plain `menuitem`s at `packages/agent-ui/app/src/controls/conversation/conversation-composer.ts:1000`), and drop the bg plus blue-ink `data-selected` swap for the selected effort.
  3. Add a separator between the effort group and the toggles.
  4. Keep the focus ring of the last row (Show reasoning) inside the panel's bottom edge.
- Non-goals: the menu's items or their behaviour; other menus beyond what the shared `ui-menu` change carries.
- Done when: a visual browser test (screenshot) of the open effort menu shows aligned labels, the Phosphor check on the selected effort and on a set toggle, a separator, and the last row's focus ring inside the panel; row radius and insets agree with the geometry rules (`.claude/docs/references/geometry.md`, the ADR-0245 ramp); `npm run check` plus the menu and conversation tests exit 0.
- If Do needs more steps than this level allows (L1-L2 3, L3 6, L4 10, L5 15), file two tickets.

## Context
- Reported by Kim as visually off; findings relayed by the sdlc-lite-author session 2026-10-21 (five points above).
- The shared `ui-menu` styles in `components/src/controls/menu/menu.css` serve every menu, so a check-glyph or check-slot change reaches other menus: check them in the same change.

## Constraints
- ARIA via `ElementInternals` and roles, no native form elements, no em dashes, the library ramp (no one-off heights).
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
verifier: L3
- The check mark is the library `ui-glyph` `check` (ADR-0245 cl.5, geometry.md "Icon and glyph"), not the Phosphor pack check the Intent names: repo law keeps the pack check for pictorial use. `menu.css` has no `clip-path` checkmark; `menu.ts` prepends `[data-part="check"]` to every menuitemradio/menuitemcheckbox row.
- The Effort picker renders its levels as `menuitemradio` rows with `aria-checked` (no `data-selected`), a `role="separator"` before the toggles; the Models, Provider and Mode pickers keep `menuitem` plus `data-selected`.
- Menu rows draw an inset focus ring (offset minus the ring width), so the last row's ring stays inside the panel.
- `env -u NODE_OPTIONS npm run check` exits 0.
- `env -u NODE_OPTIONS npx vitest run packages/agent-ui/components/src/controls/menu packages/agent-ui/app/src/controls/conversation` exits 0.
- `env -u NODE_OPTIONS npx vitest run --config vitest.browser.config.ts --project packages packages/agent-ui/components/src/controls/menu packages/agent-ui/app/src/controls/conversation/conversation-composer.browser.test.ts` exits 0.
- `env -u NODE_OPTIONS npx vitest run --config vitest.browser.config.ts --project visual packages/agent-ui/app/src/controls/conversation/conversation-composer.visual.browser.test.ts` exits 0: the T-0392 case asserts one label edge across all six rows, the check shown on Medium and Show reasoning only, the separator between X-High and Thinking off, the last row's ring inside the panel's inner bottom edge, and matches the baseline `conversation-composer-effort-menu-open-chromium-darwin.png`.
- Conductor 2026-10-21: the check mark is the library `ui-glyph` `check`, not the Phosphor pack check this ticket first named. The Phosphor wording came from a relayed report; ADR-0245 cl.5 and geometry.md "Icon and glyph" make a functional check the glyph, so the solo's deviation is accepted. The 4 `conversation.browser.test.ts` reds are inherited at base (T-0383), not this change.
