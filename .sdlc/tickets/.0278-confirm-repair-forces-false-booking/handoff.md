---
id: T-0278
title: "SURFACE_MISSING and FLOW_END_MISSING on a confirm turn demand a BookingConfirmation the booking cannot have, and Haiku and Opus then claim it is booked"
type: bug             # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P1         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
A confirm turn that cannot confirm (a required field is blank) is not sent back for a BookingConfirmation, and no repair pushes the model to claim a booking that was not made.

## Repro
`npx vitest run scripts/e2e-admin/probe/replays/concierge-haiku-confirm-no-treatment.test.mjs` (keyless, pinned). Live: `.sdlc/evals/rounds/2026-10-15-r4-fixes/`traces :8, :79, :112, :115, :216.

## Expected
When the guest says "confirm" but the form's treatment is blank, the right answer asks for the treatment, and it passes in round 1.

## Actual
FLOW_END_MISSING then SURFACE_MISSING (`intent:confirm`, "Call render_surface with a createSurface holding a BookingConfirmation") send the refusal back. FLOW_END_MISSING fired on 8 turns and was saved once. Two repairs bent to it: Haiku :112 ("I accidentally removed the Confirm button ... the booking hasn't been submitted yet") then shipped a BookingConfirmation and "is booked"; an Opus round at :216 wrote "Your 60-minute massage is booked" with `flowEnd` before the final round reverted it. Each such turn spends two extra rounds.

## Context
`packages/agent-ui/a2ui/src/catalog/personas/concierge/checks.ts:21` (the confirm moment) and the FLOW_END check. A follow-up to T-0262 and T-0265. Found by T-0275.

## Done when
- A concierge checks test: a confirm say turn whose reply asks for a missing required field, or whose open BookingForm has a blank required field, raises neither SURFACE_MISSING nor FLOW_END_MISSING; a confirm turn on a complete form still does.
- The replay is recaptured; `npx vitest run scripts/e2e-admin/probe` and `npm run check` exit 0.

## Reverify note (conductor, 2026-10-16)
After the rebase onto T-0286, T-0278's `openSurfaceViews` was folded into T-0286's `sessionSurfaceViews` (one `SemanticCheckInput.open` on every say turn). Reverify this ticket's criteria against the rebased tree (commit e0c59e8c and HEAD).

## Outcome

2026-10-15 · lane: full L2 · verdict: closed by reason (Merged in #2044 (round 4 scenario and check defects); verifier L2 pass) · verifier: none · base: none
- Changed: see commits
- Commits: none
