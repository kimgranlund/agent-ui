---
id: T-0402
title: "The hotel-booking-form library skill teaches the BookingForm, not a hand-built short form"
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
The `hotel-booking-form` library skill, offered to hospitality presets by the hospitality pack, teaches the same booking shape the domain does (one pre-filled BookingForm that confirms and settles in place), so adding it never contradicts "Never rebuild a booking form from primitives".

## Intent
- Do: rewrite `site/agent-content/skills/hotel-booking-form/SKILL.md` (its body, about line 12, teaches "ONE Card: a short form (a TextField type date ..., Select, Slider, Checkbox)") to teach the BookingForm, consistent with grammar.md after T-0397, the booking-flow and table-reservation workflows, and the hospitality catalog row; decide with evidence whether the skill should stay in `site/agent-content/packs/hospitality/pack.json` or be scoped so a catalog without BookingForm (a2ui-basic) still gets valid teaching. The text is model-read: the debate rule (Opus architect, fable plan-reviewer) before it is applied. Regenerate the agent content and re-pin the library digests.
- Non-goals: other skills.
- Done when: `generate-agent-content.mjs --check`, the agent-content and seed-digest tests, `npm run check` and the whole jsdom suite once exit 0.

## Context
- Raised by the T-0197 verifier (`.sdlc/notes/notes.md:636`).
- Decided by the conductor under Kim's 2026-10-21 overnight goal.

## Constraints
- Model-read text through the debate rule; P6: no catalog type names in persona prompt sections (skills are a different surface: check what the lint covers); no em dashes.
- Lane: solo because size L2 (steps.py lane); overnight goal 2026-10-21

## Debate: hotel-booking-form skill text
Ask (architect, debate rule): propose the exact new body for `site/agent-content/skills/hotel-booking-form/SKILL.md` (before text with line numbers, after text, why), consistent with grammar.md (post T-0397), the booking-flow and table-reservation workflows and the BookingForm catalog row, and decide with evidence how it behaves on a catalog without BookingForm (a2ui-basic--hospitality) and whether the hospitality pack should keep offering it. Check which lint covers skill bodies (P6 type names), list dependents (registry gens, digests, pins), measure any budget, no em dashes. Write no file except your result.

Ask (plan-reviewer, debate rule): review the architect's wording in `.sdlc/runtime/tasks/0402-hotel-booking-form-skill/architect-L1.md` as the second voice. Is the description (the field that reaches the prompt) the right carrier for the rule and within any length budget? Is the body unambiguous and consistent with grammar.md post T-0397, the booking-flow and table-reservation workflows, the BookingForm row's kinds, and a2ui-basic (no ConfirmReceipt, no submit, settles into BookingConfirmation)? Does naming catalog types in a skill body or description trip any lint (P6 covers persona prompt sections)? Keep the skill in the hospitality pack? Check dependents, digests and em dashes. Verdict pass or replan, with any exact wording fixes.
- Debate outcome 2026-10-22: the architect (architect-L1.md) and the fable reviewer (plan-reviewer-L1.md, pass) agree: the new description and body land byte-identical to the architect's text; the skill stays in the hospitality pack; only LIBRARIES_DIGEST moves.

## Outcome

2026-10-22 · lane: solo L2 · verdict: pass · verifier: verifier-L1 (opus) · base: 55d814a16507
- Changed: The hotel-booking-form library skill teaches one pre-filled BookingForm that settles in place (BookingConfirmation only on a2ui-basic); LIBRARIES_DIGEST re-pinned
- Commits: none
- Check: 1 `node scripts/generate-agent-content.mjs --check` exits 0: pass
- Check: 2 agent-content and seed-digest tests exit 0: pass
- Check: 3 `npm run check` exits 0: pass
- Check: 4 the whole jsdom suite exits 0 once: pass
- Check: 5 Intent (the skill teaches the BookingForm, the a2ui-basic fallback, no em dashes): pass
