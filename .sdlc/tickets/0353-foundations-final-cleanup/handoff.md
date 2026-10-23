---
id: T-0353
title: "ADR-0245 W7 cleanup after the first published release: drop the glyph alias, old-name bridge, [scale], [density] and the legacy opt-out (GH #1937)"
type: chore           # feature | bug | chore | spike | idea
status: blocked     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L3             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-17
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
After the first published release, the ADR-0245 deprecations are gone: the ui-icon `glyph` alias, the old names in `foundations-bridge.gen.css`, the `[scale]` and `[density]` axes, and the `data-foundations=legacy` opt-out.

## Intent
- Do: remove those four; rewrite the descriptor geometry lines that still say "inside an opt-in [data-tier] region else X"; delete the census ALIAS set and the foundations-alias line marker (`scripts/foundations-census.mjs` around :161).
- Non-goals: any new geometry.
- Done when: the census gate passes with the alias set gone, `npm run check` plus the touched folders' tests exit 0.
- If Do needs more steps than this level allows (L1-L2 3, L3 6, L4 10, L5 15), file two tickets.

## Context
GH #1937 (closed into this ticket). ADR-0245 clause 10b W7. Blocked: Kim ruled 2026-10-17 to keep the gate; the workspace manifests stay 0.0.0 and private, but `scripts/publish/publish-packages.mjs` published @agent-ui-kit/* through 0.1.0 (tag v0.1.0, 2026-08-26), before ADR-0245 shipped. Unblock when the next release (the first carrying the ADR-0245 deprecations) is published; a 0.2.0 dry run packed all 8 packages clean on 2026-10-23 and Kim deferred the publish.

## Constraints
Do not start before a published release.
