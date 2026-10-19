---
id: T-0377
title: "A Stylist ContrastPair inside a root Card renders a card in a card (round 12 cluster L)"
type: bug             # feature | bug | chore | spike | idea
status: ready     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-18
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
A Stylist palette answer that places ContrastPairs inside a Card passes the render lint, so T-0359's token surface ships clean.

## Intent
- Do: find the root cause (the ContrastPair factory renders a `ui-card`, `packages/agent-ui/a2ui/src/catalog/personas/stylist/factories.ts:121`) and fix it at the right layer: the factory renders an unframed element, or a check or teaching keeps ContrastPair out of a Card. Prefer the factory fix if ContrastPair need not be a card.
- Non-goals: the palette check (T-0359).
- Done when: a keyless replay of r12 :3 passes the render lint (nested-card), or a stylist check test on the :3 payload fires; `npm run check` and the touched folders' tests exit 0.

## Context
Round 12 archive `.sdlc/evals/rounds/2026-10-19-r12-targeted/` (report.md "Why it failed and how to fix it", fog report 6bae5f5b20e6a9741951dd4a). Trace lines `:n` are 1-based lines of its `traces/2026-10-19.jsonl`. Kim chose to ticket this cluster on 2026-10-19. Cluster L: `smoke-stylist-palette-haiku-1` to `-3` (:3, :96, :197) each root a Card > CardContent > Column holding ContrastPairs; every run fails `nested-card: ui-card inside a ui-card`.

## Constraints
Recorded rounds are never rewritten; replays only gain authored rounds. A prompt change follows the debate rule.

## Acceptance criteria
verifier: L3
- The recorded r12 :3 components (a Card > CardContent > Column holding three ContrastPairs) yield exactly `CONTRAST_PAIR_WRAPPED` from the composite-moment checks, and the same palette rooted at its Column, or a Card of Swatches and a Ramp with no ContrastPair, yields none: `npx vitest run packages/agent-ui/a2ui/src/catalog/composite-moments.test.ts -t T-0377` exits 0.
- The new check carries a pass and a fail contract and cross-runs clean on the Stylist catalog: `npx vitest run packages/agent-ui/a2ui/src/catalog packages/agent-ui/a2ui/src/live-agent` exits 0.
- The ContrastPair factory still renders a `ui-card` (the approved mockup is unchanged): `npx vitest run packages/agent-ui/a2ui/src/catalog/personas/stylist/factories.test.ts` exits 0.
- `npm run check` exits 0.
