---
id: T-0247
title: "validate-payload --catalog cannot load persona catalog ids (<base>--<persona>)"
type: bug             # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
`node --experimental-strip-types packages/agent-ui/a2ui/tools/harness/validate-payload.ts --catalog <base>--<persona>` loads the derived persona catalog, using `splitCatalogId` from T-0210.

## Context
Found during T-0240: the payload validator only knows the base catalog ids, so a seed authored for a persona catalog cannot be validated against it.

## Done when
- A test validates one payload against a `<base>--<persona>` id and one against a two-domain id; an unknown id still fails loudly.
- `npm run check` exit 0.
