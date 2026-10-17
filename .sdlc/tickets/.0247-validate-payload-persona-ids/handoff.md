---
id: T-0247
title: "validate-payload --catalog cannot load persona catalog ids (<base>--<persona>)"
type: bug             # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
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

## Outcome

2026-10-17 · lane: full L1 · verdict: pass · verifier: verifier-L1 (opus) · base: 946d95dc5ab6
- Changed: validate-payload --catalog loads persona and domain catalog ids via the hosts' derive steps (#2077)
- Commits: 897abb4 T-0247: record lane wave-w247
- Check: 1 A test validates one payload against a `<base>--<persona>` id and one against a two-domain id; an...: pass
- Check: 2 `npm run check` exit 0: pass
- Follow-up: note: redck.py deviations printed no process deviation lines. -> notes.md
- Follow-up: note: packages/agent-ui/a2ui/tools/catalog-files.test.ts the two-domain... -> notes.md
