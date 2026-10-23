# T-0418 heading audit (phase 1)

Measured 2026-10-22 in Chromium (Playwright), each slot rendered by the real A2UI renderer on its canvas register (every surface stamped `data-tier="widget" data-scale="md"`), catalog `agent-ui` (BookingForm: `agent-ui--hospitality`). Light and dark computed the same size, weight and line height; only the color changes. Body text at this register is 13px.

## Current

| Slot | Source today | Size | Weight | Line height | Color (light / dark) |
| --- | --- | --- | --- | --- | --- |
| OptionDeck heading | `--md-sys-type-heading`, 700 | 21px | 700 | 30.0px | on-surface / on-surface |
| OptionDeck subheading | body, muted | 13px | 400 | 18.6px | on-surface-variant |
| OptionDeck card title | row layout `--md-sys-type-title`, 700 | 14px | 700 | 20.0px | on-surface |
| OptionCompare heading | `--md-sys-type-title`, 600 | 14px | 600 | 20.0px | on-surface |
| OptionCompare option title | label size, 600 | 12px | 600 | 17.1px | on-surface |
| Card title, Text h3 in CardHeader | ui-text title lg | 16px | 400 | 20.4px | on-surface |
| Ask card title, Text h4 in CardHeader | ui-text title md | 14px | 500 | 21.0px | on-surface |
| List title, Text h4 over a List | ui-text title md | 14px | 500 | 21.0px | on-surface |
| Text h1 | headline md | 21px | 400 | 27.0px | on-surface |
| Text h2 | headline sm | 19px | 400 | 25.3px | on-surface |
| Text h3 | title lg | 16px | 400 | 20.4px | on-surface |
| Text h4 | title md | 14px | 500 | 21.0px | on-surface |
| Text h5 | title sm | 12px | 500 | 17.1px | on-surface |
| DescriptionList term | label medium, muted | 11px | 400 | 14.7px | on-surface-variant |
| ConfirmReceipt title | `--md-sys-type-subhead`, 600 | 17px | 600 | 24.3px | on-surface |
| BookingForm title | ui-text title md (h4) | 14px | 500 | 21.0px | on-surface |

On-surface is oklch(0.177 0.002 106.6) light and oklch(1 0 89.9) dark; on-surface-variant is oklch(0.379 0.009 88.7) light and oklch(0.824 0.007 88.7) dark.

Findings:
- One surface title renders at five different settings: 21/700 (OptionDeck), 17/600 (ConfirmReceipt), 16/400 (Card h3), 14/600 (OptionCompare), 14/500 (ask card, BookingForm).
- The OptionDeck heading sits on the heading role (21px, 1.6x body), the size of a Text h1.
- The Card h3 title is weight 400 (title-large's weight), so it reads thin next to body text; the ask card title is only 1px over body.
- Every title computes on-surface. The grey in before-ask-title.png is not the type role: it comes from the feed's answered-ask treatment around the surface, outside this ticket.

## Proposed roles

| Role | Token | Widget md value | Applies to |
| --- | --- | --- | --- |
| Surface title | `--md-sys-type-subhead`, weight 600, line height 1.3 | 17px / 600 / 22.1px | OptionDeck heading, OptionCompare heading, the title Text inside CardHeader (h3 or h4), ConfirmReceipt title, BookingForm title |
| Section title | `--md-sys-type-title`, weight 600, line height 1.4 | 14px / 600 / 19.6px | a Text h3 or h4 outside a CardHeader (List titles, section heads in a surface), OptionDeck card titles |

Both are existing foundations type roles (`--md-sys-type-*`, ADR-0245), so they move with the register. ConfirmReceipt already uses the surface-title setting, the one title in the set that read right. Unchanged: subheadings, body, DescriptionList terms, OptionCompare option titles (cell labels, not titles).

Mockup: mockup-light.png and mockup-dark.png in this folder, current on the left and proposed on the right. The proposed column applies the two roles as scoped overrides; no product CSS changed. Harness (git-ignored): `.sdlc/runtime/tasks/0418-surface-heading-scale/audit/` (`node drive.mjs` renders and measures).
