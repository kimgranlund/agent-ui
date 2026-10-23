---
id: T-0420
title: "packages/agent-ui/components/src/controls/card/card.css:426 the..."
type: idea            # feature | bug | chore | spike | idea
status: proposed     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-22
from: T-0418
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
One or two sentences: the outcome, not the method.

## Context
Follow-up from T-0418 (verifier notes):

`packages/agent-ui/components/src/controls/card/card.css:426` the header-title rule is not scoped to `[data-tier='widget']`, so page-tier cards (site, app) with a heading Text in a plain header also take subhead/600/1.3; at specificity (0,1,1) it also outranks text.css's `:where(ui-text[emphasis])` block, so `emphasis` on a CardHeader title no longer bolds to 700. Gallery and chat-surface browser tests pass as is.

## Constraints
What must not change. "None" if none.
