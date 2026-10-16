---
id: T-0281
title: "A FEED_SCOPE repair round passes with prose only, so the round 1 BookingForm never ships"
type: bug             # feature | bug | chore | spike | idea
status: proposed     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
A repair round may not pass with fewer surfaces than its turn's first round built: a FEED_SCOPE retry that answers in prose only is sent back again or keeps the round 1 surface.

## Repro
`npx vitest run scripts/e2e-admin/probe/replays/concierge-haiku-feed-scope-drop.test.mjs` (keyless, pinned). Live: `.sdlc/evals/rounds/2026-10-15-r4-fixes/`traces :12 and :24 (Haiku, the Vela table ask).

## Expected
The Vela table ask ships its BookingForm.

## Actual
Round 1 built a BookingForm on ask-1 and also rewrote spa-booking; FEED_SCOPE sent it back. Round 2 answered in prose only ("press Reserve table to confirm") and passed, so ask-1 never shipped (`no-surface-loss`: "created in a round but never shipped: ask-1") and the guest sees no form.

## Context
T-0264 fixed the same loss after an ACTION_NOT_APPLIED retry. FEED_SCOPE retries are still judged by their own round alone. SURFACE_MISSING does not catch it because "I'd like a table" carries no booking word (T-0282). Found by T-0275.

## Done when
- A produce test: a FEED_SCOPE retry with no surface after a round 1 that built one is not accepted as passed.
- The replay is recaptured; `npx vitest run scripts/e2e-admin/probe` and `npm run check` exit 0.
