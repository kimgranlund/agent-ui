# ADR-0081 — the family coherence gate: mechanized cross-family invariants + a judged remainder

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-05
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-05 |
> | **Proposed by** | planner — the G8 planning intake (the DoD's "coherence audit clean" line needs a concrete, evidenced definition) |
> | **Ratified by** | Kim — 2026-07-05 |
> | **Repairs** | new `controls/family-coherence.test.ts` (build-time, gated on ratification) · goals.md §G8 DoD line 2 (what "clean" means, recorded on ship) · `references/component-authoring-best-practices.md` (the invariants become citable law) |
> | **Supersedes / Superseded by** | Mechanizes laws already ratified per-control: ADR-0003 (single-file CSS, `:where` token block) · plan §9 naming/events · ADR-0019 (two-way `open`) · ADR-0042 (base ladder) · relates the existing trip-wires (contract↔props, file-set, layering, tree-shake, barrels) |

## Context

G8's DoD requires a "coherence audit clean (no API/token/lifecycle drift across the family)". Today that
coherence is enforced **per control** (each shipped through the reviewer + its own trip-wires) but no gate
looks **across** the family: nothing stops control #27 from minting a `size` enum of `small/large`, an
event named `ui-change`, or a CSS block consuming another control's tokens. A one-time audit would prove
today's fleet clean and rot tomorrow — the DoD's value is only realized if "clean" is a standing,
re-runnable definition. Meanwhile some symmetry genuinely needs judgment (keyboard-contract parity across
families, ARIA idiom uniformity) and cannot be mechanized honestly.

## Decision

"Coherence audit clean" is defined as **a standing mechanical gate PLUS a judged read-only audit**, split
by checkability:

1. **`controls/family-coherence.test.ts`** (standing, in `npm test`) asserts over the live fleet — for
   EVERY control folder:
   - **API:** descriptor `events` ⊆ `{change, input, select, open, close, toggle}` (plan §9); any `size`
     attribute's enum ≡ `[sm, md, lg]`; descriptor `extends` ∈ the sanctioned base ladder; descriptor
     present and tag↔class↔folder naming aligned (ADR-0004 conventions).
   - **Tokens:** each `{name}.css` `:where(ui-{name})` block declares only `--ui-{name}-*` custom
     properties; consumed custom properties ∈ its own set ∪ the shared allowlist (`--ui-*` ramps/geometry,
     `--md-sys-color-*`, `--md-sys-typescale-*`) — no cross-control token reach.
   - **Lifecycle/registration:** every control folder is exported from `controls/index.ts` and imported
     by `component-styles.css`; every control with an `open` attribute declares the two-way pair
     (`toggle`/`close`, ADR-0019).
   - **Each invariant ships with a synthetic-violation negative control** (string-level fixture, not a
     real control edit) proving it bites — a gate that cannot fail is decoration.
2. **The judged remainder** is a **read-only `component-reviewer` audit** (per-release, not per-commit):
   keyboard-contract symmetry across the five families, internals-only-ARIA idiom uniformity,
   `formUserInvalid` error-leg presence per form control (the recorded G7 follow-up), density/scale
   response uniformity — findings with `file:line` evidence, each filed with an owner. **Clean =** the
   standing gate green **AND** zero MAJOR judged findings open, with budgets/tree-shake evidenced by
   citing the actual `npm run size` + `tree-shake.test.ts` (+ ADR-0080 marginal) runs.

## Consequences

- Drift becomes a red test the day it is introduced, not an archaeology finding at the next release; the
  judged audit spends reviewer budget only on what genuinely needs judgment (the mechanical gate owns the
  rest — no double-checking).
- **Costs accepted:** the gate constitutionalizes today's vocabularies — a legitimate future deviation
  (e.g. a control that truly needs a fourth size) now requires an ADR + a gate edit in the same change
  (deliberate friction: that is what "law" means); CSS assertions are text-level (a parser-grade check is
  out of scope — the browser smokes remain the rendering truth); the allowlist needs maintenance when the
  shared token surface legitimately grows (same-change discipline, enforced by the gate going red).
- **Stale → re-verify:** `goals.md` §G8 DoD line 2 (its "coherence audit clean" now points at THIS
  definition — gate green + zero MAJOR judged) · `references/component-authoring-best-practices.md` (the
  cross-family invariants become citable law there in the same change).
- The per-control review bar (ADR-0004 rubric ≥ 4 both axes) is untouched — this gate is the cross-family
  complement, not a replacement.

## Acceptance

`npm test` green including the new gate; every invariant's negative control demonstrably fails when
planted; the judged audit report delivered with zero MAJOR open and evidence citations; goals.md §G8
line 2 checkable against this definition.

## Alternatives considered

- **A one-time audit report only** — rejected: proves 2026-07's fleet, protects nothing after; the next
  control re-introduces drift silently. The DoD says "no drift across the family", which is a property,
  not an event.
- **Mechanize everything (including keyboard/ARIA symmetry)** — rejected: honest keyboard-contract parity
  needs judgment across widget classes (a menu's Enter ≠ a slider's Enter); a fake-mechanized version
  would assert trivia and claim coverage.
- **Judge everything (a pure reviewer audit each release)** — rejected: burns reviewer budget on checks a
  test asserts for free, and its findings decay between releases.
- **Fold the invariants into each control's own test file** — rejected: cross-family invariants owned in
  26 places drift exactly like the code they guard; one gate, one law, one negative-control set.

## Amendment 1 — 2026-07-05 (accepted — Kim, 2026-07-05) — the A2b inverse-`[size]` invariant + the true invariant count

**Context.** The build found the Decision cl. 1 size check was HALF an invariant: A2 verifies a declared
`size` attribute's enum ≡ `[sm, md, lg]`, but nothing caught the inverse — a `{name}.css` shipping
`[size='…']` attribute selectors while the descriptor (and therefore `static props`) never declares `size`:
a dead `[size]` ramp with no API to drive it. The builder added the missing half during G8 (T6, escalated
and ratified with the wave).

**Decision.** Cl. 1's API group gains **A2b (inverse-`[size]`)**: *a `{name}.css` containing a `[size`
attribute selector REQUIRES the control's descriptor to declare a `size` attribute.* CSS comments are
stripped first (`stripCssComments`, `family-coherence.test.ts:180`) — several controls deliberately document
their absence of a `[size]` axis in prose comments ("no [size] ramp"), which would otherwise false-positive a
selector-only regex. The check is one-directional by design (CSS ⇒ attribute); the forward direction is A2.

**The count, reconciled.** The gate comprises **three groups — A (API) · B (Tokens) · C (Lifecycle) — of
nine invariants: A1 events · A2 size-enum · A2b inverse-`[size]` · A3 extends-ladder · A4 descriptor/naming ·
B tokens · C1 barrel · C2 component-styles · C3 open-pair.** The shipped gate's header comment
(`family-coherence.test.ts:15` — "Four invariant groups") is STALE against its own A/B/C listing; the
builder's code-tail corrects it to the true three-groups/nine-invariants count. This ADR's cl. 1 bullet list
reads as amended here (append-only; the base text stands).

**Repairs (this amendment):** `family-coherence.test.ts:15` header comment (builder code-tail) ·
`references/component-authoring-best-practices.md` (the inverse-`[size]` law added as citable, same change).

## Amendment 2 — 2026-07-05 (accepted — Kim, 2026-07-05) — the `click` carve-out for pure activation controls (Kim: option A)

**Context.** The build's A1 sweep surfaced the gate's own KNOWN FINDING (`family-coherence.test.ts:101-110`):
`button.md` declares `click`, outside the plan §9 six-name vocabulary — yet `click` here is native-parity
activation (`pressActivation` calls the platform `host.click()`; the control dispatches NO synthetic event of
its own, and `rubrics/component.md:20` C1 already names `click` as accepted precedent for exactly this
control). The builder refused to decide the ADR question inside the gate and shipped the real assertion
wrapped in `it.fails` — a self-alarming placeholder. **Kim chose option A: sanction native `click`.**

**Decision — the precise gate rule.** A declared event name is in-vocabulary iff it is one of the six family
names, **or** it is `click` on a **pure activation control**, defined mechanically from the descriptor alone:

- **(a)** `extends: UIElement` (not form-associated — a form control's semantics ride `change`/`input`,
  never bare `click`), **and**
- **(b)** the descriptor's `events` list contains **no name other than `click`** — `click` is the control's
  ONLY declared event. A control that declares any custom event may not also declare `click`.

Reference implementation for the A1 check (the builder's code-tail):

```ts
const isPureActivation = (d: ParsedDescriptor): boolean =>
  d.scalars.get('extends') === 'UIElement' &&
  fieldNames(d, 'events').every((n) => n === 'click')

const outOfVocabEvents = (d: ParsedDescriptor): string[] =>
  fieldNames(d, 'events').filter((n) => !(ALLOWED_EVENTS.has(n) || (n === 'click' && isPureActivation(d))))
```

The `runner = c.name === 'button' ? it.fails : it` placeholder is **deleted** — every control asserts with
plain `it`, and `button` flips to a normal pass (the placeholder's designed self-alarm: once the rule lands,
`it.fails` would report "passing test marked as failing", forcing exactly this removal). **Two negative
controls join A1:** (1) `extends: UIElement` + `events: [click, change]` ⇒ `outOfVocabEvents ≡ ['click']`
(mixed vocabulary is not pure activation); (2) `extends: UIFormElement` + `events: [click]` ⇒ `['click']`
(form-associated never qualifies). Anti-vacuous positive: the real `button.md` descriptor yields `[]`.

**Consequences.** The six-name law stays for every other control; the carve-out is fully
descriptor-mechanical (zero gate judgment). Cost accepted: any future non-form-associated control declaring
only `click` inherits the sanction automatically — deliberate, that IS the pure-activation class; a control
wanting `click` PLUS a custom event has no path (it must model its custom semantics in the six names).

**Repairs (this amendment):** `plan.md` §9 events line (the vocabulary carve-out — repaired in the same
change) · `family-coherence.test.ts` A1 + negative controls + the `it.fails` removal (builder code-tail) ·
`references/component-authoring-best-practices.md` (the carve-out as citable law, same change) · realizes
the `rubrics/component.md:20` C1 precedent in the mechanical gate.
