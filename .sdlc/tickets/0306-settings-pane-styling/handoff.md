---
id: T-0306
title: "Agent-admin Settings pane: redundant section select, a lone-field card, and a filled overflow trigger"
type: bug             # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-16
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
The Agent tab of agent-admin's Settings pane looks like the rest of the pane (Kim 2026-10-16, design-mode screenshot of the Croupier).

## Findings
1. `ui-settings`' compact `section-select` (`packages/agent-ui/app/src/controls/settings/settings.css:79-82`, `settings.ts:231`) shows an "Agent" dropdown above the Name field although the host's Agent/Capabilities/Surface tabs and the Agent heading already navigate; it is also inset by the panel padding (not aligned with the card) and butts against the Name card with no gap.
2. The Name field sits alone in a rounded card while the Model card frames rows; frame it like the Model card (nested-card and concentric radius rules, `.claude/docs/references/geometry.md`, `dogfood-lint.md`).
3. The tabs "More tabs" overflow trigger (`packages/agent-ui/components/src/controls/tabs/tabs.ts:330`, styled in tabs.css) is a filled circle; it should be ghost: transparent idle, the low container wash only on hover and press, same square pill geometry (Kim).

## Done when
- A screenshot of the real pane at 400 and 1000px, light and dark, next to Kim's screenshot shows the three fixes (evidence cache, not the repo).
- Tests that pin each change (the section select hidden when the host navigates, or aligned with a gap; the overflow trigger's idle background transparent); red at the base.
- The settings and tabs tests, the dogfood render lint for the touched widgets, and `npm run check` exit 0.
