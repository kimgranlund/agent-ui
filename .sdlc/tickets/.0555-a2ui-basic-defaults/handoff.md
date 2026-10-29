---
id: T-0555
title: "a2ui-basic factories honor upstream defaults on omitted props, and TextField longText is multi-line"
type: bug             # feature | bug | chore | spike | idea
status: done
size: L2
priority: P2         # P1 | P2 | P3
depends: []
created: 2026-10-28
claimed_by: claude:a8ce3b21 2026-10-28
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
The a2ui-basic catalog renders upstream defaults when a payload omits optional props (Divider axis, Button variant, Image variant, DateTimeInput type), and `TextField` with `longText` renders multi-line.

## Intent
- Do: seed the ADR-0169 default in each bespoke `create()` for the High and Medium findings below, including when an update drops the prop; add a `VariantDispatch` arm for TextField longText; a jsdom test that mounts each Basic type with no optional props and checks the default, failing on base.
- Done when: the new tests fail on base and pass after; `npm run test:a2ui-kit` and the a2ui catalog tests pass; `npm run check` exits 0.

## Context
From the T-0546 catalog conformance sweep (PR 2343):

### High

- H1. A Basic `Divider` with no `axis` renders nothing visible. `packages/agent-ui/a2ui/src/catalog/a2ui-basic/factories.ts:245-251`: `create()` only sets `role=separator`; all styling lives in the `axis` arm. ADR-0169 row 11 (`.claude/docs/adr/0169-a2ui-basic-catalog-upstream-interop.md:366`) rules `axis` default `horizontal`. Run: `{"id":"d","component":"Divider"}` validates and mounts as `<div role="separator"></div>` (no size, no background); with `axis:"horizontal"` it gets `block-size: 1px; inline-size: 100%` and the outline color. Fix: apply the horizontal arm in `create()`.
- H2. A Basic `Button` with no `variant` renders `solid` (the `primary` look), not upstream `default` (`soft`). `a2ui-basic/factories.ts:276` creates a bare `ui-button` whose own default is `solid` (`components/src/controls/button/button.props.gen.ts:7`); ADR-0169 row 13 (`0169-...md:368`) rules default `default`. Run: no `variant` gives `variant=solid`; `variant:"default"` gives `soft`. The omitted-prop reset makes it worse: dropping `variant` in a later `updateComponents` also gives `solid`, because `renderer/tree.ts:716-717` resets an identity-`mapsTo` prop with the control default, and `BUTTON_VARIANT_MAP[...] ?? value` (`a2ui-basic/factories.ts:280`) passes `solid` through. Fix: set `variant='soft'` in `create()`, and map a non-wire value back to `soft`.
- Proposed ticket (High): "a2ui-basic factories honor upstream defaults on omitted props": seed the ADR-0169 default in each bespoke `create()` (Divider, Button), plus a jsdom test that mounts each Basic type with no optional props and pins the default render.

### Medium

- M1. A Basic `DateTimeInput` with neither `enableDate` nor `enableTime` renders a plain text field. `a2ui-basic/factories.ts:419-425` computes `type` only when a flag is applied; `create()` at `:430` leaves `ui-text-field`'s default `text`. ADR-0169 row 18 (`0169-...md:373`) rules `(F,F)` gives `date`. Run: no flags gives `type=text`; `enableDate:false` gives `date`. Fix: set `type='date'` in `create()`.
- M2. A Basic `Image` with no `variant` gets none of the variant dims. `a2ui-basic/factories.ts:65-66` names `mediumFeature` the schema default, but the dims are applied only in the `variant` arm (`:100`). Run: no `variant` gives `style=null`; `mediumFeature` gives `inline-size: 100%; max-inline-size: 300px`. Fix: apply `IMAGE_VARIANT_DIMS.mediumFeature` in `create()`.
- M3. Basic `TextField.variant: "longText"` renders a one-line field. `a2ui-basic/factories.ts:287` maps `longText: 'text'` onto `ui-text-field` (`type` enum at `components/src/controls/text-field/text-field.ts:145` has no multiline member). Run: `variant:"longText"` mounts `ui-text-field` with `type=text`. Fix: route `longText` to the default catalog's `ui-textarea` factory through a `VariantDispatch` (the ChoicePicker GH #545 shape).
- Proposed ticket (Medium): "a2ui-basic default and longText fidelity": M1 and M2 ride the same `create()` default seeding as H1/H2 (fold into the High ticket if it lands first); M3 needs its own `VariantDispatch` arm and a test.

## Constraints
No em dashes. No paid runs.
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
- `npx vitest run --project packages packages/agent-ui/a2ui/src/catalog/a2ui-basic/defaults.test.ts` exits 0; on base fcd4ce71b the same file fails 6 tests (Divider, Button, Button update-drop, Image, DateTimeInput, longText; log `.sdlc/runtime/tasks/0555-a2ui-basic-defaults/red-on-base.log`).
- `npx vitest run --project packages packages/agent-ui/a2ui/src/catalog` exits 0.
- `npm run test:a2ui-kit` exits 0.
- `npm run check` exits 0.

## Outcome

2026-10-28 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: fcd4ce71bfda
- Changed: a2ui-basic factories honor upstream defaults on omitted props, and TextField longText is multi-line
- Commits: none
- Check: 1 defaults.test.ts exits 0 on the build and fails 6 tests on base: pass
- Check: 2 `npx vitest run --project packages packages/agent-ui/a2ui/src/catalog` exits 0: pass
- Check: 3 `npm run test:a2ui-kit` exits 0: pass
- Check: 4 `npm run check` exits 0: pass
- Follow-up: note: the diff covers H1, H2, M1, M2 and M3 as the handoff Intent asks... -> notes.md
