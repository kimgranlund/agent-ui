---
id: T-0384
title: "packages/agent-ui/a2ui/src/agent/prompts/grammar.md:37 still says..."
type: idea            # feature | bug | chore | spike | idea
status: claimed        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-20
claimed_by: claude:a8ce3b21 2026-10-21
from: T-0196
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
One or two sentences: the outcome, not the method.

## Context
Follow-up from T-0196 (verifier notes):

packages/agent-ui/a2ui/src/agent/prompts/grammar.md:37 still says an ask gets "EXACTLY ONE commit Button", while booking-flow scene 2 (site/agent-content/workflows/booking-flow/WORKFLOW.md:12) teaches an ask with no Button node, the AmountPicker's own `actionName` committing. No runtime check counts Button nodes on an ask (produce.ts:1199 is hint prose; feed-catalog.ts:118-121 admits the picker's own commit), so it is a wording tension, not a wrong shape; a grammar clause naming a control's own commit would close it. The handoff makes the live chat:probe the conductor's job.

## Constraints
What must not change. "None" if none.
