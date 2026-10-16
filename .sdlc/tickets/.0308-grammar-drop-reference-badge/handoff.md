---
id: T-0308
title: "Drop the reference-Badge example from the shared grammar and the library text (Kim's P4 ruling)"
type: chore           # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
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

## Acceptance criteria
verifier: L3
- (red) `npx vitest run --project packages packages/agent-ui/a2ui/src/agent/asset-source.test.ts` exits 0: the grammar pin asserts no `#AB123`-shaped reference in `grammar.md`.
- (red) `npx vitest run --project site site/pages/agent-admin-app.test.ts -t "seedVersion migration"` exits 0: the booking-flow playbook's BookingConfirmation title is "Booked" with no reference, and the Concierge seed is at version 16.
- `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent packages/agent-ui/a2ui/src/agent` exits 0 after the deliberate baseline recapture (the only baseline delta is the dropped parenthetical, in each of the four keys).
- `npx vitest run --project site site/lib/agent-manifest site/pages` exits 0 (concierge manifest seedVersion and digest refreshed).
- `npm run check` exits 0.

## Outcome

2026-10-16 · lane: full L2 · verdict: closed by reason (Merged in the guidance-rulings lane; verifier L3 pass) · verifier: none · base: none
- Changed: see commits
- Commits: none
