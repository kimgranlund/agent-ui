---
id: T-0308
title: "Drop the reference-Badge example from the shared grammar and the library text (Kim's P4 ruling)"
type: chore           # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-16
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
Kim 2026-10-16 (P4, narrowed C): remove the "#AB123" reference-Badge example from `packages/agent-ui/a2ui/src/agent/prompts/grammar.md:92-98` and `site/pages/agent-admin-libraries.ts:242`; it contradicts a shipped check. Source: `.sdlc/work/routing-architecture-review/` (proposals, challenge and rebuttal under `.sdlc/runtime/tasks/routing-architecture-review/`).

## Constraints
grammar.md is byte-pinned: recapture only through the deliberate flow in skill `a2ui-prompt-authoring`; regenerate `assets.gen.ts` with its script. No other grammar line changes.

## Done when
- A test pins that the shared grammar and the library carry no reference-Badge example; red at the base.
- The prompt-equivalence baseline is recaptured deliberately; agent-assets freshness, the live-agent tests and `npm run check` exit 0.
