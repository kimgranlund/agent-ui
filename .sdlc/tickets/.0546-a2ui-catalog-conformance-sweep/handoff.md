---
id: T-0546
title: "A2UI catalog conformance sweep: catalog components and props against renderer factories"
type: chore           # feature | bug | chore | spike | idea
status: done
size: L2
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-28
claimed_by: claude:a8ce3b21 2026-10-28
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
A ranked list of mismatches between the A2UI catalogs (`packages/agent-ui/a2ui/src/catalog/**/catalog.json`, personas and domains) and the renderer factories: components the catalog offers that no factory renders, catalog properties a factory ignores, factory-read properties the catalog omits, and enum values that render nothing.

## Intent
- Do: script a comparison of each catalog component and property against its factory in `catalog/default/factories.ts` and the persona and domain factories; then read each mismatch; render a few suspect payloads with the keyless test kit (`npm run test:a2ui-kit`) to confirm a prop does nothing. Write `## Findings` to this handoff.
- Non-goals: fixing anything.
- Done when: `## Findings` exists grouped High / Medium / Low, each with file:line, evidence and a one-line fix, plus a proposed ticket per group; High findings confirmed by a run or a quoted line; `git status --short -- . ':!.sdlc'` prints nothing.

## Constraints
Read-only outside `.sdlc`. Browser runs through `scripts/gate_lock.py`. No em dashes. No paid runs.
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
- `## Findings` groups findings under High, Medium and Low, each with a file:line, evidence and a one-line fix, plus one proposed ticket per group.
- Each High finding is confirmed by a kit-mount run (probe `confirm.json`) or a quoted source line.
- `git status --short -- . ':!.sdlc'` prints nothing.

## Findings

Method. A static sweep compared every `catalog.json` (default, a2ui-basic, four personas, hospitality) with its factory table, then a jsdom probe applied every catalog property (539 property rows, every variant arm) through its real factory on a defined control and classified the effect (DOM change, accessor write, expando, nothing). Suspects were then mounted as payloads through the keyless kit's own mount (`tools/testkit/mount.ts` `createKitMount`) and read back. Probe sources and raw output: `.sdlc/runtime/tasks/0546-a2ui-catalog-conformance-sweep/probe/` (`factories.probe.ts` with `out.json`, `confirm.probe.ts` with `confirm.json`). `npm run test:a2ui-kit` exit 0 (the per-type matrix mounts every type of every catalog).

Clean classes. No catalog type lacks a factory and every factory tag defines (kit matrix green). In the default catalog no property writes a missing accessor: the only expando in 539 rows is `ConfirmReceipt.totalLabel` (L3, by design). The a2ui-basic `Icon.name` enum (59) equals `ICON_NAME_TABLE` (59) and every glyph exists in `icons/src/phosphor/icons.gen.ts`. `TEXT_VARIANT_TABLE` covers every `Text.variant` member in both bases. Every mismatch found sits in a2ui-basic, where a factory translates the upstream wire vocabulary only when the property is applied, so an omitted property never gets its upstream default.

### High

- H1. A Basic `Divider` with no `axis` renders nothing visible. `packages/agent-ui/a2ui/src/catalog/a2ui-basic/factories.ts:245-251`: `create()` only sets `role=separator`; all styling lives in the `axis` arm. ADR-0169 row 11 (`.claude/docs/adr/0169-a2ui-basic-catalog-upstream-interop.md:366`) rules `axis` default `horizontal`. Run: `{"id":"d","component":"Divider"}` validates and mounts as `<div role="separator"></div>` (no size, no background); with `axis:"horizontal"` it gets `block-size: 1px; inline-size: 100%` and the outline color. Fix: apply the horizontal arm in `create()`.
- H2. A Basic `Button` with no `variant` renders `solid` (the `primary` look), not upstream `default` (`soft`). `a2ui-basic/factories.ts:276` creates a bare `ui-button` whose own default is `solid` (`components/src/controls/button/button.props.gen.ts:7`); ADR-0169 row 13 (`0169-...md:368`) rules default `default`. Run: no `variant` gives `variant=solid`; `variant:"default"` gives `soft`. The omitted-prop reset makes it worse: dropping `variant` in a later `updateComponents` also gives `solid`, because `renderer/tree.ts:716-717` resets an identity-`mapsTo` prop with the control default, and `BUTTON_VARIANT_MAP[...] ?? value` (`a2ui-basic/factories.ts:280`) passes `solid` through. Fix: set `variant='soft'` in `create()`, and map a non-wire value back to `soft`.
- Proposed ticket (High): "a2ui-basic factories honor upstream defaults on omitted props": seed the ADR-0169 default in each bespoke `create()` (Divider, Button), plus a jsdom test that mounts each Basic type with no optional props and pins the default render.

### Medium

- M1. A Basic `DateTimeInput` with neither `enableDate` nor `enableTime` renders a plain text field. `a2ui-basic/factories.ts:419-425` computes `type` only when a flag is applied; `create()` at `:430` leaves `ui-text-field`'s default `text`. ADR-0169 row 18 (`0169-...md:373`) rules `(F,F)` gives `date`. Run: no flags gives `type=text`; `enableDate:false` gives `date`. Fix: set `type='date'` in `create()`.
- M2. A Basic `Image` with no `variant` gets none of the variant dims. `a2ui-basic/factories.ts:65-66` names `mediumFeature` the schema default, but the dims are applied only in the `variant` arm (`:100`). Run: no `variant` gives `style=null`; `mediumFeature` gives `inline-size: 100%; max-inline-size: 300px`. Fix: apply `IMAGE_VARIANT_DIMS.mediumFeature` in `create()`.
- M3. Basic `TextField.variant: "longText"` renders a one-line field. `a2ui-basic/factories.ts:287` maps `longText: 'text'` onto `ui-text-field` (`type` enum at `components/src/controls/text-field/text-field.ts:145` has no multiline member). Run: `variant:"longText"` mounts `ui-text-field` with `type=text`. Fix: route `longText` to the default catalog's `ui-textarea` factory through a `VariantDispatch` (the ChoicePicker GH #545 shape).
- Proposed ticket (Medium): "a2ui-basic default and longText fidelity": M1 and M2 ride the same `create()` default seeding as H1/H2 (fold into the High ticket if it lands first); M3 needs its own `VariantDispatch` arm and a test.

### Low

- L1. Declared but inert properties: Basic `TextField.validationRegexp` (`a2ui-basic/factories.ts:294`), `ChoicePicker.displayStyle` and `filterable` (`:348-349`, `:382-383`). Each validates and renders nothing (probe: no DOM change, no accessor). Documented as v1-inert in ADR-0169. Fix: keep them for interop, but add a validator or semantic-check note so a producer is not told they work.
- L2. 31 non-identity `mapsTo` props never reset when omitted from a later `updateComponents` (`renderer/tree.ts:716`): 19 in default (for example `Stat.value -> figure`, `Progress.value -> current`, `Avatar.name -> identity`, `Swatch.value -> color`, `Button.label -> textContent`), 11 in a2ui-basic, 1 in fixture-demo. The dropped value stays on screen. This is the documented ADR-0128 limitation. Fix: an optional per-factory `resetProp` or default reader.
- L3. `ConfirmReceipt.totalLabel` with no `totalPath` is dropped silently and lands as an inert own property (`default/factories.ts:1603-1612`, by design per its doc comment; probe class EXPANDO). Fix: a semantic check that warns on `totalLabel` without `totalPath`.
- L4. Members that render the same as another member: Basic `Icon.name` `starOff` and `star` both draw `star` (`a2ui-basic/factories.ts:168`), Basic `Row`/`Column` `justify:"stretch"` equals `start` (`:195`). Both are recorded approximations. Fix: none needed beyond keeping the producer prompt honest about them.
- L5. A factory reads a property its catalog omits: Basic `Text` reuses `textFactory`, whose `href` arm the a2ui-basic catalog does not declare. Unreachable (the validator rejects an undeclared prop). Fix: none; listed for completeness.
- Proposed ticket (Low): "A2UI inert-prop and stale-reset hygiene": a semantic check for L1 and L3, and the ADR-0128 reset capability for L2.

## Outcome

2026-10-28 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 28364f644b58
- Changed: A2UI catalog conformance sweep: a2ui-basic default and fidelity mismatches with proposed tickets; default, persona and hospitality catalogs clean
- Commits: none
- Check: 1 `## Findings` groups findings under High, Medium and Low, each with a file:line, evidence and a o...: pass
- Check: 2 Each High finding is confirmed by a kit-mount run (probe `confirm.json`) or a quoted source line: pass
- Check: 3 `git status --short -- . ':!.sdlc'` prints nothing: pass
- Follow-up: note: the handoff does not record the exact npm run test:a2ui-kit exit... -> notes.md
