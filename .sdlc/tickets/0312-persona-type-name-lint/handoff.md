---
id: T-0312
title: "Persona text type names are a modality leak: lint them and reword the Croupier persona; pin tests per ruling (P6)"
type: chore           # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-16
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
Kim 2026-10-16 (P6): catalog type names in persona text count as a modality leak. The persona lint (`site/pages/agent-admin-presets.test.ts:50-121`) flags them; the Croupier persona (`agent-admin-presets.ts:187`, `:193`) is reworded. One pin test per standing ruling in `.sdlc/notes/notes.md` that has no test yet (the T-0285 pin in `agent-admin-app.test.ts:1049-1056` is the shape). The contract-audit mapping is committed under `.sdlc/evals/fog/`; the audit stays advisory. Source: `.sdlc/work/routing-architecture-review/` (proposals, challenge and rebuttal under `.sdlc/runtime/tasks/routing-architecture-review/`).

## Done when
- The lint test fails on a persona naming a type and passes on the reworded seeds; the new pins are red when their ruling is broken; seedVersion bumped and manifests regenerated where a seed changes; `npm run check` exits 0.

## Acceptance criteria
verifier: L3
- (red) `npx vitest run --project site site/pages/agent-admin-presets.test.ts -t "names a catalog type"` exits 0: no persona section names a catalog type, single-word types counted mid-sentence and case-sensitive (red at the base on the Croupier "Deal again Button" twice).
- `npx vitest run --project site site/pages/agent-admin-presets.test.ts -t "discriminating"` exits 0: a mid-sentence "Button" or "Badge" fires; "Menu" opening a sentence and a lower-case "button" do not.
- `npx vitest run --project site site/pages/agent-admin-presets.test.ts -t "standing rulings"` exits 0: the T-0289, T-0291 and T-0296 seed pins; each goes red when its ruled sentence is reworded (shown by a planted reword in the report).
- `npx vitest run --project scripts scripts/e2e-admin/probe/scenarios/round.test.mjs` exits 0: the ruled confirm and surrender oracles expect BookingConfirmation and ResultCard.
- The Croupier surfaceStyle is reworded with seedVersion 14, its manifest refreshed: `npx vitest run --project site site/lib/agent-manifest site/pages` exits 0.
- `python3 /Users/kimgranlund/.claude/skills/context-fog-of-war/scripts/audit.py scan --root . --mapping .sdlc/evals/fog/contract-audit/mapping.json --out /private/tmp/claude-501/fog-contract-audit-t0312.json` exits 0 and reports no mapping issue: the committed mapping parses and declares the repair and tool surfaces (advisory, no gate).
- `npm run check` exits 0.
