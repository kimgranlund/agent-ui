---
id: T-0183
title: "A2UI spec upserts: canvas register widget / md, [scale]/[density] retired, server-side turn trace, preset prose gate, model migration note"
type: chore           # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
The A2UI specs state what shipped this week, so agents reading them get current rules.

## Intent
- Do:
  1. `spec/a2ui-runtime.spec.md` and `lld/a2ui-renderer.lld.md`: the canvas register (the renderer sets `data-tier="widget" data-scale="md"` on the surface root when absent, `renderer.ts` about :869-876; a payload never names it; 20 / 24 / 28 controls), `[scale]` / `[density]` retired in favour of `data-tier` / `data-scale`; point to `.claude/docs/references/geometry-sizing-spec.md`.
  2. `spec/a2ui-live-agent.spec.md` (and its LLD): a server-side turn trace subsection (`.agent-traces/YYYY-MM-DD.jsonl`, line format version, redaction, dev-only fence: `apply: 'serve'`, never in the Worker; `npm run traces`; relation to the browser-held TurnTrace, T-0151); the preset prose-vs-catalog gate (T-0159); default model note (Sonnet 5.5 with the retired-id migration if T-0180 has merged, else planned).
  3. `spec/response-type-selection.spec.md`: a planned section for duplicate-root semantics and retry surface-loss (T-0172), written as planned; T-0172 updates it when it lands.
  4. Decisions cite tickets, never new ADR clauses. Do not change status lines (Kim's).
- Done when: doc_lint exit 0 on touched docs; `npm run check` exit 0; sitemap or index regeneration plus its test if any generated index changes.

## Context
- Spec audit 2026-10-14. Commit off origin/main, never push. Docs-only gate.

## Constraints
- No em dashes.

## Closed

2026-10-14: merged as PR #1980
