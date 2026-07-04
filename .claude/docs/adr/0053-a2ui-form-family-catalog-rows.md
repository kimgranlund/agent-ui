# ADR-0053 — A2UI form-family catalog rows (Field · FormProvider · Checkbox · Switch · Select · Option) + the bindable-naming law

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-02
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-02 |
> | **Proposed by** | planner (design seat — the NEXT.md item-4 examples intake) |
> | **Ratified by** | orchestration (the coordinator seat) — 2026-07-02, on the green wave gate; forks confirmed by Kim |
> | **Repairs** | `a2ui-catalog.spec.md` SPEC §5.2 (the normative row table: activates `Field`/`Checkbox`/`Switch`, ADDS `FormProvider`/`Option`, RENAMES the planned `ChoicePicker` → `Select`, widens the `TextField` row) · `catalog/default/catalog.json` + `catalog/default/factories.ts` (the rows + factories) — all edited at build time, gated on this ADR's ratification |
> | **Supersedes / Superseded by** | None. **Relates ADR-0019** (the `value:{prop,event}` two-way seam whose contract forces the naming law) · **ADR-0050/0051** (the provider/field primitives these rows expose) · **ADR-0047/0048** (the TextField reach being exposed) · **ADR-0054** (the submit seam the `FormProvider` row depends on) |

## Context

G7 shipped `ui-field` + `ui-form-provider`, completing the components dependency (PRD Assumption A-2) — but
the default catalog still exposes none of the form family: an agent payload cannot emit a labelled field, a
checkbox, a switch, a select, or a coordinated form at all, and the `TextField` row exposes 8 of the
control's 20 attributes (none of the Wave-5 type/currency/unit/step/min/max reach). SPEC §5.2's planned rows
(`Checkbox` "boolean `value`", `ChoicePicker`) predate the shipped controls and encode a live trap: the
input controller's two-way contract (input.ts, ADR-0019) requires `value.prop` to name BOTH the A2UI node
prop and the DOM commit prop — and `ui-checkbox` carries *both* a `value` prop (the submitted string, `'on'`)
*and* a `checked` prop (the bindable boolean), so a Basic-catalog-aligned `value: boolean` row would commit
the string `'on'` into a boolean data path. The naming question is therefore load-bearing, not taste.

## Decision

We will add six rows to the default catalog and pin the naming law they follow:

1. **The bindable-naming law:** a bindable catalog prop is named by the CONTROL's own prop — the shipped
   `Tabs.selected` / `Modal.open` precedent — so `Checkbox.checked`, `Switch.checked`, `Select.value`, each
   with the matching `value:{prop,event}` mark (`checked`/`change`, `checked`/`change`, `value`/`select`).
   Name alignment with A2UI's Basic catalog (SPEC-R3 "SHOULD") yields to the seam contract and to SPEC-R8's
   direct-design-system doctrine wherever the two collide.
2. **`Field` → `ui-field`** — `label`/`description` (bindable strings, 1:1 accessor props), child model
   **`child`** (the one wrapped control; single-`child` is already supported by validator + tree).
3. **`FormProvider` → `ui-form-provider`** — **zero properties** (the row mirrors the attribute-less
   coordination element faithfully), `children: ChildList`; its factory carries the ADR-0054 `submitGate`
   mark. Its aggregate reaches the wire via the data model (two-way binds + `sendDataModel`), not via a
   catalog prop.
4. **`Select` → `ui-select`** (renaming the planned `ChoicePicker`) — `value` (bindable, two-way via
   `select`), `placeholder`, `disabled`, `required`, `name`; `ChildList` of **`Option`**, a sanctioned
   primitive (`div[role=option]`, `value`→attribute, `label`→textContent — the pre-`ui-text` `Text`
   precedent, SPEC-R3 AC1). `open` is deliberately NOT declared (only one `value` mark exists per
   component; a one-way `open` would silently desync on platform light-dismiss).
5. **`Checkbox`/`Switch`** — `checked` (bindable boolean), `label` (string → textContent, bespoke factory —
   the non-identity-`mapsTo` invariant), `disabled`, `name` (+ `required` on Checkbox).
6. **TextField reach:** add `type` (the shipped 12-value enum), `currency`, `unit`, `step`, `min`, `max` —
   all 1:1 reflecting accessor props, zero factory code. `datetime-local`/`month` stay out (unshipped).

SPEC §5.2 is the owning doc for the row facts; this ADR records why the table changes.

## Consequences

- **The catalog grows agent-visible surface** — six new types + a 12-value enum are now promptable; corpus
  and eval work inherit them. The conformance validator checks primitive types only, so an out-of-enum
  `type` literal passes validation and the control falls back to its default — recorded as known-tolerant
  (`matchesPrimitive`'s do-not-over-reject stance), not fixed here.
- **The Basic-alignment SHOULD is consciously traded away** for `checked` (Basic's `CheckBox` binds
  `value`). An agent fine-tuned on Basic payloads must learn our names from the catalog document — the
  price of the seam contract staying one-name-per-round-trip.
- **`Option` children reach the panel only at first connect** — the renderer assembles children before
  root-attach so the initial payload works by construction, but a later `updateComponents` adding Options
  to a connected Select does not reach the moved panel. Documented limitation (the Tab/TabPanel class),
  revisit only on real demand.
- **Un-wired error legs stay un-wired:** a checks-failing Checkbox/Switch/Select inside a `Field` shows no
  inline field error (LLD-C9 — only text-field wires `formUserInvalid` at G7); validity still surfaces via
  the ADR-0054 submit gate's `reportValidity`. The example pages must state this, not paper over it.
- **Stale → re-verify:** SPEC §5.2 + §5.1 · `catalog.json` + `factories.ts` + their tests · NEXT.md item 4
  (host-updated when the wave lands).

## Acceptance

- A payload using each new row validates 0-`CATALOG` via the shared validator; a negative control (unknown
  prop on `Field`) still fails.
- `registry.register` of the default catalog passes (every declared type has a factory — no
  `CATALOG_FACTORY_MISSING`).
- jsdom: a bound `Checkbox.checked` round-trips a BOOLEAN through the data model (write on `change`, read
  on data write); `Select.value` round-trips the option key via `select`.
- A `TextField` node carrying `type='currency'`, `currency`, `step`, `min`, `max` renders the Wave-5
  control behavior with zero factory special-casing.

## Alternatives considered

- **Basic-catalog names (`Checkbox.value: boolean`) + a widened seam (`value:{prop, domProp?, event}`)** —
  rejected: it forks the one-name round-trip contract (input.ts would read a different prop than the
  payload binds), grows the renderer seam for naming cosmetics, and contradicts the shipped
  `Tabs.selected`/`Modal.open` precedent. Re-openable if Basic-corpus reuse becomes a measured goal.
- **`ChoicePicker` with `options: [{label,value}]` as a data prop** (the old §5.2 sketch) — rejected:
  options-as-children is structurally A2UI (the Tab/TabPanel precedent), keeps the factory prop-only, and
  leaves the door open to option-level bindings; an options-array prop would need bespoke DOM synthesis in
  `applyProp` and still hits the first-connect panel limitation.
- **A `Form` type name instead of `FormProvider`** — rejected: the fleet law is type ↔ tag bijection
  (`FormProvider` ↔ `ui-form-provider`); a friendlier alias would be the catalog's only non-derivable name.
- **Staging the TextField reach (text types now, numeric/date later)** — rejected: the mechanism is one
  enum + five accessor props either way; staging leaves shipped capability catalog-invisible (SPEC-N2
  spirit) for no cost saving.
