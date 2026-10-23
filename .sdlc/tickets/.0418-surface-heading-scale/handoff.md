---
id: T-0418
title: "One heading scale for surface titles: OptionDeck, OptionCompare, Card, ask and list titles read at the same role"
type: chore           # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L3             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-22
claimed_by: claude:a8ce3b21 2026-10-22
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 60
---

## Goal
Titles inside A2UI surfaces read at one consistent heading role at the widget register: today the OptionDeck heading is very large (before-optiondeck-heading.png), while a Card title over a DescriptionList (before-card-title.png) and an ask Card title (before-ask-title.png) are small and grey. Kim 2026-10-22: "titles/elements in cards are way too big, or way too small".

## Intent
- Do (phase 1, stop for Kim): measure the computed font size, weight, line height and color of every surface title slot at data-tier widget, data-scale md: OptionDeck heading, OptionCompare heading, Card/CardHeader title, Text variants the producer uses as titles (h3, h4, title), ask titles in the feed, DescriptionList and List titles, ConfirmReceipt and BookingForm titles. Write a table to the ticket folder, propose ONE heading role for a surface title and one for a section title (from the md.sys typescale, ADR-0078 naming), and render a mockup page showing the current and proposed states side by side, light and dark, saved to the ticket folder. Stop and report for Kim's approval; change no product CSS in phase 1.
- Do (phase 2, after approval): apply the chosen roles in each control's CSS, with browser tests that pin computed sizes per slot, and screenshots.
- Non-goals: body text sizes; the DescriptionList grid (T-0417); grammar.
- Done when (phase 2): every listed slot computes to the approved role (tests); `npm run check`, the touched control folders' tests and the dogfood-render sweep exit 0; after screenshots match the approved mockup.

## Context
Screenshots in this folder. Typescale tokens: packages/agent-ui/shared/src/tokens/; the widget register is root AGENTS.md (Inner loop: an A2UI surface sits at data-tier="widget" data-scale="md"). Skills component-standards, mathematical-design-system (consumer), dogfood lint .claude/docs/references/dogfood-lint.md.

## Constraints
No em dashes. Phase 2 waits for Kim's mockup approval.
- Lane: full because size L3 (steps.py lane); overnight goal 2026-10-21
- Kim 2026-10-22 (AskUserQuestion): approved the mockup as proposed (surface title: --md-sys-type-subhead 600 / 1.3; section title: --md-sys-type-title 600 / 1.4) and asked phase 2 to also tighten the CardHeader-to-content gap to the foundations spacing role, pinned by a test.

## Outcome

2026-10-22 · lane: full L3 · verdict: pass · verifier: verifier-L3 (fable) · base: 07a5c2afaa9d
- Changed: Surface titles share subhead 600/1.3 and section titles title 600/1.4 across OptionDeck, OptionCompare, ConfirmReceipt, CardHeader and widget h3/h4, with the CardHeader title gap
- Commits: none
- Check: 1 every listed slot computes to the approved role (tests): pass
- Check: 2 `npm run check` exit 0: pass
- Check: 3 the touched control folders' tests exit 0: pass
- Check: 4 the dogfood-render sweep exits 0: pass
- Check: 5 after screenshots match the approved mockup: pass
- Check: 6 CardHeader-to-content gap at the foundations spacing role, pinned by a test: pass
- Follow-up: decide: packages/agent-ui/components/src/controls/card/card.css:426 the... -> T-0420
- Follow-up: decide: packages/agent-ui/a2ui/src/catalog/domains/hospitality/factories.ts... -> notes.md
- Follow-up: note: packages/agent-ui/components/src/controls/text/text.md carries no... -> notes.md
