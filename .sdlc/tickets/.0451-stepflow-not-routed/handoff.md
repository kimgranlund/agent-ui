---
id: T-0451
title: "A bare room-booking ask opens a StepFlow"
type: bug             # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-24
claimed_by: claude:a8ce3b21 2026-10-24
from: T-0445
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
The concierge answers "I'd like to book a room." with a StepFlow, because the booking-flow workflow and the step-flow mini-skill are routed for that ask.

## Context
Round 13 cluster T in .sdlc/evals/rounds/2026-10-24-r13-pattern/report.md (round 13, T-0445): 0 of 3 (:119, :134, :148). Each loads only `product-presentation`; `booking-flow` stays index-only and `step-flow` is not routed.

## Constraints
Model-read text follows the debate rule (Opus author, fable review). Routing changes keep the prompt-equivalence baseline flow in skill `a2ui-prompt-authoring`.

## Done when
- A composed-prompt test shows `step-flow` routed for the ask.
- A live check of `reach-concierge-room-stepflow-haiku`, 3 samples, under $1.
- `npm run check` plus the a2ui agent tests pass.
- Lane: solo because size L2 (steps.py lane); overnight goal 2026-10-21

## Acceptance criteria
- `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/mini-skills.test.ts -t T-0451` exits 0: "I'd like to book a room." on `agent-ui--hospitality` selects `step-flow` and the composed prompt holds its body; the spa and table asks that name their details do not select it.
- `npx vitest run --project packages packages/agent-ui/a2ui/src/agent packages/agent-ui/a2ui/src/live-agent packages/agent-ui/a2ui/tools/registry` exits 0.
- `npm run check` exits 0.
- The baseline diff moves only the `step-flow` entry's triggers and body.

## Outcome

2026-10-24 · lane: solo L2 · verdict: pass · verifier: verifier-L3 (fable) · base: 17215d8c66e7
- Changed: The step-flow mini-skill routes on a room-booking ask, so the concierge reaches StepFlow (routing 3 of 3, StepFlow 1 of 3 live)
- Commits: none
- Check: 1 `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/mini-skills.test.ts -t T...: pass
- Check: 2 `npx vitest run --project packages packages/agent-ui/a2ui/src/agent packages/agent-ui/a2ui/src/li...: pass
- Check: 3 `npm run check` exits 0: pass
- Check: 4 The baseline diff moves only the `step-flow` entry's triggers and body: pass
- Follow-up: decide: .sdlc/runtime/tasks/0451-stepflow-not-routed/live/run-1.log... -> notes.md
- Follow-up: note: site/agent-content/personas/concierge/agent.md:66 fable review of... -> notes.md
- Follow-up: note: packages/agent-ui/a2ui/src/agent/prompts/mini-skills/step-flow.md:6... -> notes.md
