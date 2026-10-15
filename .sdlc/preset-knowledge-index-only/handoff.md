---
id: T-0231
title: "The Concierge cannot see the hours, policies and booking flow its own resources and playbooks hold"
type: bug             # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
branch: fix/lane-h-agent-behavior
worktree: .claude/worktrees/wave-lh
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
The Concierge answers the hours, policies and tour days its own `property-knowledge-base` and `curated-local-guides` resources hold, and follows its `booking-flow` playbook, without the guest having to name either.

## Repro
1. Read `.sdlc/evals/rounds/2026-10-15-r2-presets/runs/concierge-facilities-then-tour-sonnet-1/report.json` turn 1, or `turn-1.png`.
2. Compare `site/pages/agent-admin-presets.ts` (the concierge preset's `property-knowledge-base`: "Pool (25m, heated) and gym open 06:00-22:00; spa 09:00-20:00").

## Expected
"What are the opening hours of the pool, gym and spa?" is answered from the resource: 06:00 to 22:00, spa 09:00 to 20:00 (a ServiceCard per facility, T-0200).

## Actual
Both models say they lack the facts: "I don't have the current opening hours for the pool, gym, or spa" (Haiku, `2026-10-15.jsonl:66`), "I don't have the confirmed opening hours ... You can also tag /facility-info-card" (Sonnet, :171), and the same for late check-out (:67, :172) and pool and gym hours (:60, :165). Haiku 5.5 also never follows the booking flow: it reviews a spa booking in prose with no surface (:58), then refuses to confirm, "I don't have a live spa booking system connected, so nothing has been reserved" (:59). Pinned: `scripts/e2e-admin/probe/replays/concierge-haiku-spa-prose.test.mjs`.

## Context
By design (ADR-0190 rev.2, GH #891 and #1030, `packages/agent-ui/app/src/controls/agent-admin/entries.ts` `CAPABILITY_INDEX_TEACHING`), skills, playbooks and resources reach the prompt as one index line each; full text loads only when the user names or tags the entry. The Croupier works because a game's name ("Let's play Omaha.") auto-attaches that rules resource. A guest never names `property-knowledge-base`. The same index-only rule hides the game presets' composite teaching (`word-tiles`, `board-grid`, `battle-rounds`, `round-loop`), which T-0208 sidesteps with data-driven checks. Options: move the facts a preset must always know into a `prompt-section` (the ruled escape hatch), add a per-entry "always loaded" availability under a byte budget, or let the model request an entry. Found by T-0225 (`.sdlc/evals/rounds/2026-10-15-r2-presets/report.md`); the round 3 Concierge scenarios name the resource on hours questions so the composite measurement can run meanwhile.

## Constraints
The prompt budget (`src/agent/prompt-budget.ts`) is never raised just to get green. No em dashes.

## Acceptance criteria
- A decision line in this ticket naming the option taken.
- A unit test on the composed concierge prompt shows the pool, gym and spa hours present without a tag.
- `npm run check` exits 0.
