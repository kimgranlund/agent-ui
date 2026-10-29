---
id: T-0556
title: "A2UI inert-prop and stale-reset hygiene"
type: chore           # feature | bug | chore | spike | idea
status: done
size: L2
priority: P2         # P1 | P2 | P3
depends: []
created: 2026-10-28
claimed_by: claude:a8ce3b21 2026-10-29
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
Declared catalog props that do nothing are either wired or flagged by a semantic check, and props an update stops sending are reset (the ADR-0128 reset capability).

## Intent
- Do: the Low findings below; a semantic check for L1 and L3; the reset capability for L2 in the renderer, built on T-0552's declared-props allow-list; tests for each.
- Done when: the new tests fail on base and pass after; the a2ui suites pass; `npm run check` exits 0.

## Context
From the T-0546 catalog conformance sweep (PR 2343):

### Low

- L1. Declared but inert properties: Basic `TextField.validationRegexp` (`a2ui-basic/factories.ts:294`), `ChoicePicker.displayStyle` and `filterable` (`:348-349`, `:382-383`). Each validates and renders nothing (probe: no DOM change, no accessor). Documented as v1-inert in ADR-0169. Fix: keep them for interop, but add a validator or semantic-check note so a producer is not told they work.
- L2. 31 non-identity `mapsTo` props never reset when omitted from a later `updateComponents` (`renderer/tree.ts:716`): 19 in default (for example `Stat.value -> figure`, `Progress.value -> current`, `Avatar.name -> identity`, `Swatch.value -> color`, `Button.label -> textContent`), 11 in a2ui-basic, 1 in fixture-demo. The dropped value stays on screen. This is the documented ADR-0128 limitation. Fix: an optional per-factory `resetProp` or default reader.
- L3. `ConfirmReceipt.totalLabel` with no `totalPath` is dropped silently and lands as an inert own property (`default/factories.ts:1603-1612`, by design per its doc comment; probe class EXPANDO). Fix: a semantic check that warns on `totalLabel` without `totalPath`.
- L4. Members that render the same as another member: Basic `Icon.name` `starOff` and `star` both draw `star` (`a2ui-basic/factories.ts:168`), Basic `Row`/`Column` `justify:"stretch"` equals `start` (`:195`). Both are recorded approximations. Fix: none needed beyond keeping the producer prompt honest about them.
- L5. A factory reads a property its catalog omits: Basic `Text` reuses `textFactory`, whose `href` arm the a2ui-basic catalog does not declare. Unreachable (the validator rejects an undeclared prop). Fix: none; listed for completeness.
- Proposed ticket (Low): "A2UI inert-prop and stale-reset hygiene": a semantic check for L1 and L3, and the ADR-0128 reset capability for L2.

## Constraints
No em dashes. No paid runs.

Waits on PR 2350 (T-0552) merging.
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
- L2: every shipped non-identity `mapsTo` row (31: agent-ui, a2ui-basic, fixture-demo) has a factory `resetProp` that returns the control to its pristine state, and the renderer resets a dropped one on the same element: `npx vitest run packages/agent-ui/a2ui/src/renderer/reset-mapped-props.test.ts` exits 0 (it failed on base: no hook).
- L1 and L3: `inertPropCheck` (INERT_PROP, a2ui-basic) and `receiptTotalCheck` (RECEIPT_TOTAL_PATH, ConfirmReceipt catalogs) fire on a prop state the round adds and stay quiet otherwise: `npx vitest run packages/agent-ui/a2ui/src/catalog/inert-prop-checks.test.ts` exits 0 (module absent on base).
- Both checks ship in the host assembly with pass and fail contracts: `npx vitest run packages/agent-ui/a2ui/src/live-agent/check-contracts.test.ts packages/agent-ui/a2ui/src/live-agent/chat-validation.test.ts` exits 0.
- The a2ui suite passes: `npx vitest run packages/agent-ui/a2ui` exits 0.
- `npm run check` exits 0.

## Outcome

2026-10-29 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: dbbf1fc94b60
- Changed: A2UI renderer resets dropped mapped props, and semantic checks flag inert Basic props and a receipt total label without a path
- Commits: none
- Check: 1 L2 reset hook on every non-identity mapsTo row: pass
- Check: 2 L1 and L3 checks (`inertPropCheck`, `receiptTotalCheck`): pass
- Check: 3 Both checks ship in the host assembly with pass and fail contracts: pass
- Check: 4 a2ui suite: pass
- Check: 5 `npm run check`: pass
- Follow-up: note: the Basic exemplars... -> notes.md
- Follow-up: note: no red-checkpoint deviation line was printed by redck.py deviations. -> notes.md
