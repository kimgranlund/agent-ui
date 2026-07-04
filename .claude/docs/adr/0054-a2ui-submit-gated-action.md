# ADR-0054 — the submit-gated action: a client-side `submit` flag on the action shape + a generic `submitGate` factory mark

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-02
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-02 |
> | **Proposed by** | planner (design seat — the NEXT.md item-4 examples intake) |
> | **Ratified by** | orchestration (the coordinator seat) — 2026-07-02, on the green wave gate; fork confirmed by Kim |
> | **Repairs** | `a2ui-catalog.spec.md` §5.1 (the `WidgetFactory` contract gains `submitGate`; the action-shape note gains the `submit` flag) · `catalog/types.ts` + `catalog/registry.ts` (the mark + the derived gate selector) · `renderer/renderer.ts` `#wireAction` (the gate branch) · ADR-0011 (gains the two-way extension link) — all edited at build time, gated on this ADR's ratification |
> | **Supersedes / Superseded by** | None. **Extends ADR-0011** (the canonical action shape — adds one optional, client-consumed key; the wire message is untouched). **Relates ADR-0050** (`ui-form-provider.submit()` — the gate being invoked) · **ADR-0019** (the two-way binds that make the data model the aggregate) · **ADR-0053** (the `FormProvider` row whose factory carries the mark) |

## Context

A2UI gives a form exactly one outbound trigger: a `Button.action` wired click→`emitAction`. G7's
`ui-form-provider` owns the submit semantics we want — `submit()` refuses an invalid aggregate and runs
first-invalid `reportValidity` (native focus + announce) — but nothing in the catalog contract can invoke
it: the provider is attribute-less, action wiring fires unconditionally on click, and action `context` is
emitted verbatim (no `collectContext` resolution is shipped), so the aggregate cannot ride the context
either. Without a seam, the flagship form example would emit actions from invalid forms — worse than what
the provider gives plain-markup consumers.

## Decision

We will gate actions on the provider through two small, generic extensions:

1. **The action shape gains an optional `submit: true` key** (extends ADR-0011; Postel-read, ignored when
   absent). It is CLIENT-consumed only — the emitted `action` wire message is byte-identical; the open
   PropDef object schema already tolerates the key, so existing catalogs/validators need no change.
2. **`WidgetFactory` gains an optional `submitGate: true` mark**; the registry derives a gate SELECTOR from
   the marked factories' tags. A `submitGate` factory's control MUST expose `submit(): boolean` (a
   structural contract recorded in SPEC §5.1). The renderer stays name-free — no `ui-form-provider` literal
   — and a project catalog can mark its own gate (the two-tier doctrine).
3. **`#wireAction` gate branch:** on click of a `submit`-flagged action, resolve `el.closest(gateSelector)`.
   Gate found and `submit()` returns `false` → NO action is emitted (the provider already ran
   first-invalid `reportValidity`). Returns `true` → emit as today. No gate ancestor → emit normally.
4. **The typed aggregate rides the data model:** inputs two-way-bind under a form subtree and
   `createSurface.sendDataModel` puts the live typed aggregate on the valid submit's `action` message. The
   provider's `FormSubmitDetail` `change` event still fires for page/app IDL consumers but is NOT merged
   into `context` (`FormValue` admits `File`/`FormData` — not JSON-wire-safe; the data model is the
   protocol-native aggregate).

## Consequences

- **A new client-side semantic key lives inside the action object.** It is invisible on the wire but part
  of the payload contract an agent must learn; the catalog SPEC's action-shape note is now the single place
  documenting both ADR-0011's shape and this flag — drift there misleads agents (the Repairs discipline
  bites here).
- **Validity gating is opt-in per Button.** A non-flagged Button inside a provider keeps firing
  unconditionally (a "Cancel" must not trigger validation) — the right default, but an agent that forgets
  the flag gets an ungated submit; the examples teach the flag prominently.
- **The gate walks the DOM (`closest`), not the component tree** — correct today because the renderer
  mounts children inside their parent element; if a future control ever reparents renderer children out of
  its subtree (top-layer panels hosting actions), the gate misses — re-evaluate then (recorded trigger).
- **`submit()` runs synchronously on click**; a gate control whose `submit()` is slow blocks the handler —
  acceptable for the shipped provider (signal reads), a constraint on future gate implementers.
- **Stale → re-verify:** SPEC §5.1 · ADR-0011 (the extension back-link) · `catalog/types.ts`/`registry.ts`
  · `renderer.ts` + `renderer.test.ts`/`action.test.ts` (zero-drift for un-flagged actions).

## Acceptance

- jsdom: click on a `submit:true` Button inside an INVALID provider emits NO action and calls
  `reportValidity` on the first invalid member (registration order); the SAME payload valid emits exactly
  ONE action whose `dataModel` (under `sendDataModel`) carries the typed aggregate.
- `submit:true` with no gate ancestor emits normally; an un-flagged action inside a provider is
  byte-identical to today (the existing action suite stays green untouched).
- Negative control: a registered catalog with no `submitGate` factory yields an empty selector and the
  gate lookup is a provable no-op.

## Alternatives considered

- **FormProvider as an action SOURCE** (an `action` prop on the provider + a factory `actionEvent:'change'`
  mark, target-guarded against member bubbles) — rejected: it still needs a separate trigger to call
  `submit()` in the first place, so it adds a second seam (configurable action events) without removing the
  first; strictly more machinery for the same flow.
- **Implicit gating — every Button action inside a provider submits** — rejected: it changes the semantics
  of already-valid payloads and makes a non-submit Button (Cancel, "add row") inside a form impossible
  without a new escape hatch; explicit opt-in is the smaller contract.
- **No seam: Button `checks` auto-disable as the only validity gate** (shipped, ADR-0029) — rejected as
  the ONLY story: it duplicates every field's checks onto the Button, loses first-invalid
  `reportValidity` UX, and leaves G7's headline primitive catalog-invisible; it remains a valid pattern
  for provider-less payloads.
- **Merging `provider.values()` into the action `context`** — rejected: duplicates what `sendDataModel`
  already round-trips, and `FormValue`'s `File`/`FormData` arms are not JSON-serializable — a silent-loss
  channel on the wire.
