---
id: T-0289
title: "Haiku will not confirm a complete pre-filled booking from chat: grammar gives the final action to the user and the repair hint asks for a reference"
type: bug             # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P1         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
A guest who confirms a complete pre-filled booking in chat gets one BookingConfirmation on Haiku, as on Sonnet and Opus.

## Repro
Keyless: `npx vitest run scripts/e2e-admin/probe/replays/concierge-haiku-confirm-refusal.test.mjs` (pinned to today's refusal, `// expectedFail: T-0289`). Live: `.sdlc/evals/rounds/2026-10-15-r5-fixes/` traces :86-:87, :7-:8, :13-:14, :83-:84.

## Expected
"Those details are right, please confirm the booking." on a complete BookingForm ships one BookingConfirmation (Sonnet 7 of 7, Opus 1 of 1 do).

## Actual
Haiku ships none on 7 confirm turns. On a complete form it refuses in prose ("Please press **Book now**", :87), resends the form (:14), or says "Done ... confirmed" while shipping a BookingForm (:84). The FLOW_END_MISSING and SURFACE_MISSING repairs ship uncorrected (:8, :87). Its reasoning: "the actual \"Book now\" action belongs to the user", the repair in the user turn "looks like a fabricated system notice", and a BookingConfirmation "with a reference number" would be fabricating.

## Context
Fog report `4095416195875afe423e60ea`, decision d1, findings f1 and f2 (T-0287). Suspected guidance, a guess from Haiku's own words (the trace records section sizes, not text): `grammar.md` "Confirm before concluding ... let the USER take the final action" and the closing turn's "NO A2UI at all"; the Concierge houseFacts "confirm once the guest submits it" (`site/pages/agent-admin-presets.ts`); the SURFACE_MISSING confirm message "with the confirmed details and a reference" (`packages/agent-ui/a2ui/src/catalog/personas/concierge/checks.ts`). Distinct from T-0278 (a blank-field confirm, held open) and T-0293 (a blank form from dotted paths).

## Constraints
The failing test lands before or with the fix. A confirm on a blank required field still asks for it (T-0278).

## Ruling (Kim, 2026-10-16)
Fix it in the persona text and the repair messages (frame a repair as a check result, not a system notice), never in the byte-pinned shared grammar (`packages/agent-ui/a2ui/src/agent/prompts/grammar.md`), which stays unchanged for every persona.
