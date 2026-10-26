---
id: T-0457
title: "A room-booking ask reaches StepFlow in 3 of 3 live runs on the concierge"
type: bug             # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-25
claimed_by: claude:a8ce3b21 2026-10-25
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
"I'd like to book a room." on the concierge opens a StepFlow in 3 of 3 live Haiku runs (T-0451 left it at 1 of 3).

## Context
T-0451's fable review: the persona's Surface style line "a booking is ONE booking form holding the dates, the choices to make, ..." pulls against the new step-flow sentence (site/agent-content/personas/concierge/agent.md:66); runs 2 and 3 opened a BookingForm. T-0451's builder named the next lever: a StepFlow row in `catalog/composite-moments.ts`. The step-flow mini-skill sits at about 198 of its 200-token budget.

## Constraints
Model-read text follows the debate rule (Opus author, Fable review). Regenerate content and assets with their scripts and re-pin the seed digests.

## Done when
- A live 3-sample check of the room-booking ask ships StepFlow 3 of 3, under $1.
- The concierge's later BookingForm-last-scene turns still pass their smoke probe.
- `npm run check` plus the touched folders' tests, including `site/lib/agent-manifest/agent-manifest.test.ts`, pass.
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
verifier: L3
- `npx vitest run --project site site/pages/agent-admin-app.test.ts site/pages/agent-admin-seed-digests.test.ts site/lib/agent-manifest/agent-manifest.test.ts site/agent-content/registry-freshness.test.ts` exits 0: the concierge seed is v25, its digests and manifest seedDigest are re-pinned.
- `node scripts/generate-agent-content.mjs --check` exits 0.
- `node scripts/generate-agent-assets.mjs --check` exits 0.
- `npm run check` exits 0.
- The concierge Surface style keeps "that same form settles in place into one confirmed receipt" and adds the one modality-neutral sentence "A room booking that lacks its dates or guests is ONE step-by-step flow instead: its steps gather the dates and guests, and that one booking form is its last step."; the step-flow mini-skill and `catalog/composite-moments.ts` are unchanged.
- The live evidence (3 room-booking samples, StepFlow 3 of 3; the concierge booking smoke) sits under `.sdlc/runtime/tasks/0457-concierge-stepflow-pull/live/`.

## Outcome

2026-10-25 · lane: solo L2 · verdict: pass · verifier: verifier-L3 (fable) · base: 609287843e27
- Changed: A bare room-booking ask on the concierge opens a StepFlow, 3 of 3 live, through one persona Surface style sentence
- Commits: none
- Check: 1 `npx vitest run --project site site/pages/agent-admin-app.test.ts site/pages/agent-admin-seed-dig...: pass
- Check: 2 `node scripts/generate-agent-content.mjs --check` exits 0: pass
- Check: 3 `node scripts/generate-agent-assets.mjs --check` exits 0: pass
- Check: 4 `npm run check` exits 0: pass
- Check: 5 Surface style keeps "that same form settles in place into one confirmed receipt" and adds the one...: pass
- Check: 6 Live evidence (3 room-booking samples, StepFlow 3 of 3; the concierge booking smoke) under `.sdlc...: pass
- Follow-up: decide: site/agent-content/personas/concierge/agent.md:67 note: a... -> notes.md
- Follow-up: decide: .sdlc/runtime/tasks/0457-concierge-stepflow-pull/live/reach-concier... -> notes.md
- Follow-up: decide: scripts/chat-probe.mjs decide: a live fixture and report carry no... -> notes.md
