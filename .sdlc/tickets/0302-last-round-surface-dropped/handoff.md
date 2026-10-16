---
id: T-0302
title: "The last repair round halts with SURFACE_DROPPED and ships nothing (round 6 :170)"
type: bug             # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-16
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
A Concierge turn whose last repair round loses the surface ships the best earlier valid surface (or a graceful degraded form) instead of halting with nothing.

## Context
Round 6 cluster D (`.sdlc/evals/rounds/2026-10-15-r6-matrix/report.md`) :170, Haiku: BOOKING_FORM_MISSING, then PARSE, then a SURFACE_DROPPED halt. T-0299 (closed) fixed the FEED_SCOPE last-round path and made missing-composite findings binding, but not this halt. Kim 2026-10-16: file it.

## Scope
`packages/agent-ui/a2ui/src/agent/produce.ts` last-round handling: when the final round fails to parse or drops a surface an earlier round built, ship the last valid surface tallied (a code that says so) rather than halting, unless a binding finding forbids it; never ship a surface that failed schema.

## Done when
- A keyless replay or produce test built from :170 (BOOKING_FORM_MISSING, PARSE, then the drop) ships a surface with a tally code and no SURFACE_DROPPED halt; red at the base.
- The live-agent, concierge and probe suites and `npm run check` exit 0.

## Lane bundle
- T-0301: A forced render_surface repair round turns thinking off so the forced tool reaches the model (`.sdlc/tickets/0301-forced-repair-thinking-off`)
- T-0302: The last repair round halts with SURFACE_DROPPED and ships nothing (`.sdlc/tickets/0302-last-round-surface-dropped`)

## Acceptance criteria
verifier: L3

Reading of "unless a binding finding forbids it": the Done-when's own :170 case has only one earlier valid round and it carries the binding BOOKING_FORM_MISSING finding, yet must ship a surface, so a semantic finding (binding or not) never forbids the fallback; it ships tallied SEMANTIC_UNCORRECTED, as any last round with a finding does. Only a schema-valid round (validator green, no surface dropped) is ever a fallback source. The fallback also covers a last round whose payload fails schema (the same exit path).

- (red) `npx vitest run --project scripts scripts/e2e-admin/probe/replays/concierge-haiku-last-round-drop.test.mjs` exits 0: the :169-:170 replay ships turn 2 with no error line, trace `{rounds: 3, failureCodes: ['SURFACE_DROPPED', 'SEMANTIC_UNCORRECTED', 'EARLIER_ROUND_SHIPPED']}`, round 1's `createSurface` ask-1 with its DescriptionList card, its ask `{surfaceId: 'ask-1'}` and its note.
- `npx vitest run packages/agent-ui/a2ui/src/live-agent packages/agent-ui/a2ui/src/agent packages/agent-ui/a2ui/src/catalog/personas/concierge` exits 0.
- `npx vitest run --project scripts scripts/e2e-admin/probe` exits 0.
- `npm run check` exits 0.
