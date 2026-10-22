---
id: T-0404
title: "The concierge booking request seeds and corpus record hold the BookingForm under a root wrapper, so the confirm settles with one updateComponents (grammar G2b)"
type: chore           # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-22
claimed_by: claude:a8ce3b21 2026-10-22
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
The agent-ui--hospitality booking request examples a model learns from put the BookingForm under a root wrapper (a Column), so the confirm turn settles with the one updateComponents grammar G2b teaches ("turning the root wrapper's child ... into ONE ConfirmReceipt") instead of a full surface re-create.

## Intent
- Do: move the request seeds `persona-concierge-booking` and `persona-concierge-stay-details` (packages/agent-ui/a2ui/src/examples/persona-exemplars.ts) and the model-read corpus record `domain-concierge-booking-request` (corpus/exemplar/v1_0/agent-ui--hospitality.jsonl) to a root Column holding the BookingForm; keep the confirmed seed (T-0403) consistent with them.
- Non-goals: a2ui-basic--hospitality; grammar.md; persona agent.md text; the T-0401 checks (the re-create arm stays for a root form a model still emits).
- Done when: the three request examples validate and render on agent-ui--hospitality with a root Column; the corpus record is rejudged PASS by a2ui-review-agent (rubric a2ui-corpus) and admitted through `import-seeds.ts --verdicts <file> --replace domain-concierge-booking-request`; `npm run check`, the touched folders' tests and the whole jsdom suite exit 0; the prompt-equivalence baseline moves only through the deliberate flow in skill a2ui-prompt-authoring.
- If Do needs more steps than this level allows (L1-L2 3, L3 6, L4 10, L5 15), file two tickets.

## Context
Named by the T-0403 architect (Risks) and solo (Still open). The corpus record is model-read: the debate rule applies (Opus architect, then fable plan-reviewer) before a solo applies it. T-0401's settleInPlace has a wrapped-form arm (one updateComponents) and a root-form arm (re-create); G2b assumes the wrapper.

## Constraints
grammar.md is byte-pinned. Never rewrite .sdlc/evals/rounds. No em dashes. Starts after T-0403 (PR #2201) merges: same file.
- Lane: solo because size L2 (steps.py lane); overnight goal 2026-10-21

## Debate
- Architect ask (2026-10-22): design the root-Column shape for the two request seeds and the corpus record (exact component trees, ids, data paths), confirm the confirmed seed and the T-0401 wrapped-form repair agree with it, name every pin, digest, baseline and fixture that moves, whether retrieval or selection fixtures read the corpus record, and the risks. Prototype it in a throwaway and report the gates.
- Plan-reviewer ask (2026-10-22): challenge architect-L1.md: is the bare root Column with the form at id form the right shape for G2a/G2b and the T-0401 wrapped arm; does a2ui-basic or any check, selector, retrieval or dogfood fixture break; is the corpus description sound for rubric a2ui-corpus 1.5; are all moving pins named. Replay it and report pass, replan or blocked.
- Debate outcome 2026-10-22: the architect (architect-L1.md) and the fable reviewer (plan-reviewer-L1.md, pass, replayed on 41f89f569 incl. the browser dogfood sweep) agree on the bare root Column with the form at id form for all three request examples, the corpus description, and admission through a judged --replace. The renderer non-root retype gap stays a follow-up.

## Outcome

2026-10-22 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 41f89f569b65
- Changed: The concierge booking request seeds and the domain-concierge-booking-request corpus record hold the BookingForm under a bare root Column, so the confirm settles with one updateComponents; record rejudged PASS 4 and admitted by --replace
- Commits: none
- Check: 1 The three request examples validate and render on agent-ui--hospitality with a root Column: pass
- Check: 2 The corpus record is rejudged PASS by a2ui-review-agent (rubric a2ui-corpus) and admitted through...: pass
- Check: 3 `npm run check`, the touched folders' tests and the whole jsdom suite exit 0: pass
- Check: 4 The prompt-equivalence baseline moves only through the deliberate flow: pass
