---
id: T-0420
title: "CardHeader surface-title rule applies only on the A2UI widget tier and lets emphasis bold"
type: bug             # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-22
claimed_by: claude:a8ce3b21 2026-10-22
from: T-0418
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
The T-0418 CardHeader surface-title rule (card.css:426) applies only inside `[data-tier='widget']`, so page-tier cards on the site and app keep their prior header title look, and `emphasis` on a CardHeader title bolds to 700 again.

## Context
Follow-up from T-0418 (verifier notes):

`packages/agent-ui/components/src/controls/card/card.css:426` the header-title rule is not scoped to `[data-tier='widget']`, so page-tier cards (site, app) with a heading Text in a plain header also take subhead/600/1.3; at specificity (0,1,1) it also outranks text.css's `:where(ui-text[emphasis])` block, so `emphasis` on a CardHeader title no longer bolds to 700. Gallery and chat-surface browser tests pass as is.

## Constraints
A2UI surfaces keep the T-0418 surface title (subhead 600/1.3) and the header gap. Kim chose the widget-tier scope 2026-10-22.

## Done when
A browser test proves: a widget-tier CardHeader title is subhead 600; a page-tier one is not touched by the rule; an `emphasis` title computes weight 700 on both tiers. npm run check plus the card and catalog tests pass; the surface-headings test stays green.
- Lane: solo because size L2 (steps.py lane); overnight goal 2026-10-21

## Acceptance criteria
- A widget-tier CardHeader title computes subhead 600/1.3, a page-tier one computes like the same Text outside a card, and an `emphasis` title computes 700 on both tiers; the T-0418 header gutter applies on the widget tier only: `npx vitest run --config vitest.browser.config.ts --project packages packages/agent-ui/components/src/controls/card`
- The A2UI surface-headings and catalog browser tests stay green: `npx vitest run --config vitest.browser.config.ts --project packages-rest packages/agent-ui/a2ui/src/catalog`
- Card and catalog jsdom tests pass: `npx vitest run packages/agent-ui/components/src/controls/card packages/agent-ui/a2ui/src/catalog`
- The standing gate passes: `npm run check`

## Outcome

2026-10-22 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 056bf9475345
- Changed: CardHeader surface title and header gap apply only on the A2UI widget tier; emphasis bolds a header title to 700 on every tier
- Commits: none
- Check: 1 Widget-tier CardHeader title subhead 600/1.3, page-tier equals the same Text outside a card, emph...: pass
- Check: 2 A2UI surface-headings and catalog browser tests green: pass
- Check: 3 Card and catalog jsdom tests: pass
- Check: 4 Standing gate: pass
