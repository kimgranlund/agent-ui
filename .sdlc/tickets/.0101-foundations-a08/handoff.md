---
id: T-0101
title: "Foundations lane a08: migrate the a2ui package to the derived tokens (ADR-0245)"
type: chore           # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P1         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-12
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Migrate the a2ui package to the ADR-0245 derived foundations, dark launch only (no visible change on default pages). Lane a08 of the campaign in .sdlc/foundations-campaign-plan.md; Wave 0 (T-0093, tooling) is on main.

## Scope (one brief paragraph, per the Inner loop rule)
You are the only writer of these directories, and you touch nothing outside them except your own entries in scripts/foundations-allowlist.json (delete exactly the entries for files you finish, one per line) and regenerated files:
- packages/agent-ui/a2ui
Read ADR-0245 clauses 3 to 7 and 10a to 10e (strategy: each control rule reads the derived token with today's value as the fallback so default pages stay byte-identical; derived tokens exist only inside opt-in data-tier regions) and Kim's step 0 rulings (.sdlc/foundations-mockup/approval.md: pill kept for button and toggle radius, avatar 4n, icon 2n and glyph 2n - 2c boxes). Run `node scripts/foundations-codemod.mjs --dry-run <dirs>` then without the flag, fix what the codemod cannot, rename `glyph` call sites inside your folders to `symbol`, and use `ui-glyph` or the generated mark tokens where a control draws its own caret, tick or dash. Add or extend one per-control geometry test inside and outside a data-tier region (use `node scripts/foundations-probe.mjs --tags <tags>`). Leave the 66 default goldens and dimensions.test.ts byte-identical. Commit early (WIP commits), local gate only: `npm run check` plus the touched folders' tests; CI runs the full suite. No per-ticket verifier (batched at the end), no em dashes, never hand-edit generated files (regenerate with their scripts), commit locally and do not push; report in one short message with the census count before and after.

## Closed

2026-10-13: merged via the foundations campaign (#1920 to #1932, ADR-0245)
