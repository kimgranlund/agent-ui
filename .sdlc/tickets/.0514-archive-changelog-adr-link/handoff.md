---
id: T-0514
title: "The archived changelog's ADR-0242 link resolves, so docs_check passes on main"
type: bug             # feature | bug | chore | spike | idea
status: done
size: L1
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-28
claimed_by: claude:a8ce3b21 2026-10-28
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 5
---

## Goal
`.claude/docs/archive/changelog-to-2026-10-15.md` links ADR-0242 with a path that resolves from the archive folder, so docs_check stops failing on main.

## Intent
- Do: the changelog link at line 1027 is already fixed in this lane. Also fix every other broken relative link the docs link report lists under `.claude/docs/` (about 46: archive/reports/roadmap-wave-2026-08-05/inv-5-saas.md, archive/tickets/tkt-00xx, the column-chart.md and gauge.md descriptors, and the rest), each by correcting its relative path to the existing target; for a link whose target no longer exists anywhere, point it at the nearest successor if one is obvious, else leave it and list it in the report.
- Non-goals: rewording any doc; generated files such as `.sdlc/tickets/roadmap.md` (regenerated, not hand-edited).
- Done when: `verify_scope.py` and `docs_check.py` report no broken link under `.claude/docs/` and descriptors (any unfixable link listed with its reason); `npm run check` exits 0.

## Context
Found by the T-0508 solo (its verify_scope.py run failed docs_check on this pre-existing link).

## Constraints
Link paths only, across any file under `.claude/docs/` and control descriptors. No em dashes.
- Lane: solo because size L1 (steps.py lane)

## Plan review
- conductor: verifier L1 failed on a plan defect (Done when could not pass with the fix limited to one file); scope widened to every broken link under .claude/docs and descriptors.

## Outcome

2026-10-28 · lane: solo L1 · verdict: pass · verifier: verifier-L1 (opus) · base: 833bd7dd69a1
- Changed: Every broken relative link under .claude/docs and the chart descriptors resolves, so docs_check passes on main
- Commits: none
- Check: 1 verify_scope.py and docs_check.py report no broken link under .claude/docs/ and descriptors (unfi...: pass
- Check: 2 npm run check exits 0: pass
- Check: 3 Constraint link paths only: pass
- Follow-up: note: docs_check.py is exit 0 at base 833bd7dd6 too; the broken-link... -> notes.md
