# ADR-0013 — UIFormElement, the FACE form base (form-associated participation over UIElement)

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-06-27
>
> | Field | Value |
> |---|---|
> | **Status** | accepted *(ratified 2026-06-27 — orchestration-lead/host, on gate)* |
> | **Date** | 2026-06-27 *(authored)* |
> | **Proposed by** | planning-lead — the design seat, establishing the G4 form base |
> | **Ratified by** | orchestration-lead (host) — 2026-06-27, on gate |
> | **Repairs** | `plan §5` (the `UIFormElement` section — the form-participation base) · `goals §G4` (the `UIFormElement` DoD) · **NEW** `components/src/dom/form.ts` · `references/interaction-states.md` (the form-control disabled-channel caveat this base supplies the machinery for) |
> | **Supersedes / Superseded by** | Relates: **ADR-0005** (lazy-upgrade property-wins — the `value`/defaultValue capture rides the upgrade dance) · **ADR-0010** (the non-form-control disabled a11y standard this complements for form controls) · the `props.ts` `finalize()` seam (no static-props inheritance — the `formProps`-spread workaround) · **Extended by ADR-0014** (the first consumer, `ui-text-field`) |

## Context

`ui-button` (G5) is the only control and extends `UIElement` directly — it is **not** form-associated. The next
milestone (G4 base + its G6 first consumer) needs the FACE form-participation base every value-carrying control
(`ui-text-field`, `ui-checkbox`, `ui-switch`, `ui-select`, `ui-listbox`) will extend. `plan §5` names it,
`goals §G4` books it, and the descriptor's `BASE_CLASSES` already enumerates `UIFormElement` — but `dom/` ships
only `UIElement`. This base is therefore **control-independent**: it is the seam the whole form family reuses, so
it is recorded on its own (ADR-0014 records the first consumer's control-specific choices on top of it).

Three facts of the existing architecture decide its shape:

- **`UIElement` already acquires `ElementInternals` ONCE** in its constructor (`#internals = this.attachInternals()`)
  and exposes it via a `protected get internals()`. `internals.setFormValue` / `setValidity` **throw** unless the
  element is form-associated. So `UIFormElement` reuses the inherited internals (a second `attachInternals()`
  throws) and only adds the `formAssociated` flag that activates those methods.
- **`props.ts` `finalize()` reads a class's OWN `static props`.** A subclass's `static props` **shadows** the
  base's static field — there is no prototype-chain merge. A base therefore cannot transparently contribute props
  to a subclass; it must offer a **spreadable** object the subclass folds into its own `static props`.
- **`UIElement.connectedCallback` is the lifetime seam** — it opens the connection scope + `AbortController`, runs
  the overridable no-`super` `connected()` hook, then installs the one render effect. A base that needs to install
  its *own* scope-owned effects must wrap `connectedCallback` so the subclass's `connected()` stays the clean,
  no-`super` hook every `UIElement` author already knows.

## Decision

We add **`UIFormElement` (`components/src/dom/form.ts`) `extends UIElement`** as the FACE form-associated base.
Six clauses, each a buildable acceptance (decomp slice `s1`):

1. **Form-associated, internals reused.** `static formAssociated = true`; reuse the inherited protected
   `internals` (no second `attachInternals()`).
2. **`formProps` — the no-inheritance workaround.** A spreadable
   `static formProps = { name: prop.string(), disabled: prop.boolean(reflect), required: prop.boolean(reflect) }`
   the subclass spreads into its own `static props` (`static props = { ...UIFormElement.formProps, value: …, … }`).
   The base owns those three **universal** form attributes but **NOT a typed `value`** — `value`'s type and codec
   belong to the subclass (string for text-field; a `checked` boolean + a `value` string for checkbox; …).
3. **Overridable hooks.** `formValue(): FormValue` and `validity(): ValidityResult`, where `ValidityResult` is a
   discriminated union `{ valid: true } | { valid: false; flags: ValidityStateFlags; message: string; anchor?: HTMLElement }`.
4. **Wiring (super-wrapped).** `connectedCallback()` calls `super.connectedCallback()` (scope now live) then
   installs **two scope-owned effects** — `setFormValue(this.formValue())` and `applyValidity(this.validity())` →
   `internals.setValidity` (clear when valid; `flags + message + anchor` when invalid). The subclass therefore
   keeps the clean, no-`super` `connected()` hook.
5. **Form lifecycle callbacks → overridable hooks.** `formResetCallback` → `formReset()` (default: value ←
   defaultValue) · `formDisabledCallback(d)` → a `#formDisabled` signal so **`effectiveDisabled() = own disabled || #formDisabled`** ·
   `formStateRestoreCallback(state, mode)` → `formStateRestore(state)` · `formAssociatedCallback(form)` → a no-op hook.
6. **IDL delegators.** `form` · `name` · `validity` · `validationMessage` · `willValidate` · `checkValidity()` ·
   `reportValidity()` — getters/methods delegating to `internals`.

Imports stay layer-clean: only `../reactive` + same-layer `./element.ts` / `./props.ts`.

## Consequences

- **Realized by** decomp slice `s1` (`form.ts`) + `s3` (the jsdom probes + the G4 `<form>`-round-trip browser
  proof). Every clause above is an explicit `s1` acceptance, so the build traces 1:1 to this Decision.
- **The `formProps`-spread is a small ergonomic cost** (the subclass writes the spread) accepted to **avoid
  touching `props.ts`** — a shipped G2 gate. If a future need wants true prototype-chain prop merge, that is a
  separate `props.ts` ADR, not this one.
- **The super-wrapped `connectedCallback`** keeps subclass authoring identical to a plain `UIElement` control
  (override the no-`super` `connected()` hook). The form effects install *after* the render effect — harmless
  (the first consumer's `render()` is void; ADR-0014).
- **The disabled channel diverges from ADR-0010 for form controls.** ADR-0010's `ariaDisabled` is for
  non-form-associated controls; a `UIFormElement` control has `effectiveDisabled` (own || fieldset-`formDisabled`)
  and rides a platform/editor disabled state instead — this base supplies `#formDisabled` + `effectiveDisabled`;
  ADR-0014 resolves the concrete channel for `ui-text-field`.
- **Stale → re-verify:** nothing shipped depends on `form.ts` (it is net-new). `goals §G4` moves from *booked* to
  *realized* when `s1` + `s3` land; the descriptor's `BASE_CLASSES` (which already lists `UIFormElement`) gains a
  real referent.

## Alternatives considered

- **Bake a typed string `value` into the base** — rejected: the value *type* varies per control (string / boolean
  / `File`); a base string `value` forces every non-string control to fight it. The base owns the **machinery**
  (`setFormValue` / validity / lifecycle); the subclass owns the **typed value** + the hooks.
- **Merge base props via a `finalize()` prototype-chain walk** — rejected for now: it edits `props.ts` (a shipped
  G2 gate) to serve one consumer. The `formProps`-spread is a one-line, explicit, zero-risk alternative; revisit
  if many controls later need deep prop inheritance.
- **Install the form effects in an overridden `connected()` that requires `super.connected()`** — rejected: it
  breaks the `UIElement` "override `connected()`, no `super` needed" convention every control author has learned.
  Wrapping `connectedCallback` keeps the hook clean.
- **A trait instead of a base class** — rejected: form participation needs `static formAssociated` (a class-level
  platform flag) and the platform form lifecycle callbacks (`formResetCallback` etc. are prototype methods the UA
  invokes) — neither is expressible as a `(host, opts) => release` trait. Form participation is correctly a base
  class; per-control behaviours (focusability, user-invalid timing) stay traits.
