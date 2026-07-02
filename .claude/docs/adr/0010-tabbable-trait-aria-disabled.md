# ADR-0010 — Interactive-control focus + disabled a11y standard (the `tabbable` trait + `internals.ariaDisabled`)

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-06-27
>
> | Field | Value |
> |---|---|
> | **Status** | accepted *(ratified 2026-06-27 — orchestration-lead; native-parity disabled — removed from tab order + internals.ariaDisabled; accessible-disabled reserved for future toolbar/menu controls)* |
> | **Date** | 2026-06-27 *(authored)* |
> | **Proposed by** | planning-lead — the design seat, closing the booked G4 focus/a11y deferral |
> | **Ratified by** | orchestration-lead — 2026-06-27 |
> | **Repairs** | **NEW** `components/src/traits/tabbable.ts` (the reusable focusability trait) · `controls/button/button.ts` (invoke `tabbable` + the `ariaDisabled` effect) · `controls/button/button.md` (the aria + keyboard/focus blocks) · `component-author` (the focus+disabled a11y pattern) · `goals §G5` (the booked G4 focus/a11y deferral) |
> | **Supersedes / Superseded by** | Relates: **ADR-0009** (focusability lets the ring show) · the existing `press-activation` trait (the sibling whose discipline this mirrors) |

## Context

The G5 `ui-button` is **not keyboard-focusable**: `button.ts` sets no `tabindex` and registers no
focusability trait, and a light-DOM custom element inherits none of a native button's focus behaviour. The
wave-2 showcase had to add `tabindex="0"` itself to demonstrate keyboard focus/activation at all. It also
exposes **no disabled AX state** — `button.ts` sets `internals.role = 'button'` but never tells assistive tech
the control is disabled. These are the booked G4 focus/a11y deferrals (s16 G5 verdict) and they sink C7
(behaviour & semantics) in `.claude/docs/rubrics/component.md`.

Two facts of the existing architecture decide the shape of the fix:

- **The trait seam is `(host, opts) => release`, invoked from `connected()`** — exactly the `press-activation`
  pattern (`pressActivation(this, { disabled: () => this.disabled })`). Traits ride the host's public
  `host.effect` (scope-owned) / `host.listen` (abort-owned) helpers, so "zero residue after disconnect" is
  structural. There is **no `host.use()`** registry in `element.ts`; a trait is just a function called from
  `connected()`.
- **`UIElement.internals` is `protected`.** A trait receives `host: UIElement` and **cannot** reach
  `host.internals`. Therefore the ARIA-via-internals work (`ariaDisabled`) **must** live in the control class,
  not in a trait — alongside the existing `this.internals.role = 'button'`.

## Decision

We ship the disabled-control a11y contract as **two co-wired pieces**, split by what can reach `internals`:

**(1) `tabbable` — a reusable trait** (`components/src/traits/tabbable.ts`), a sibling of `press-activation`:

```ts
export function tabbable(host: UIElement, opts: { disabled: () => boolean }): () => void {
  let released = false
  const dispose = host.effect(() => {
    if (released) return
    if (opts.disabled()) host.removeAttribute('tabindex') // disabled → out of the tab order (native parity)
    else host.tabIndex = 0                                 // enabled  → focusable, role=button parity
  })
  return () => { if (released) return; released = true; dispose() }
}
```

- **`tabindex=0` by default** (role=button focus parity), set through a **scope-owned `host.effect`** so it
  reacts to the `disabled` prop signal and is disposed with the connection scope — leak-free, and **re-applied
  on reconnect** (`connected()` re-runs → the trait re-installs the effect).
- **Disabled removes the host from the tab order** (`removeAttribute('tabindex')` → not keyboard-focusable),
  matching native `<button disabled>` (see Open question for the deliberate alternative).
- **`release()` is idempotent** by a `released` guard (safe to call twice regardless of the kernel disposer),
  mirroring `press-activation`'s discipline. Imports only `../dom` (the one allowed `traits → dom` direction).

**(2) `ariaDisabled` — a control-level reactive effect** in `button.ts` `connected()`, alongside `role`:

```ts
this.internals.role = 'button'
tabbable(this, { disabled: () => this.disabled })
pressActivation(this, { disabled: () => this.disabled })
this.effect(() => { this.internals.ariaDisabled = this.disabled ? 'true' : null })
```

The effect reads the `disabled` prop signal, so the AX state stays in sync; it is scope-owned (disposed on
disconnect, re-run on reconnect → zero residue, C10). `ariaDisabled` (not a native `disabled`) is correct
because `ui-button` is **not** form-associated (extends `UIElement`) — it has no platform disabled state, so
the AX state rides `ElementInternals.ariaDisabled`.

**The inert-disabled standard** is then complete and three-fold: **not focusable** (`tabbable` removes the
tabindex), **not activatable** (`pressActivation`'s `disabled()` guard + `button.css`'s `pointer-events: none`),
and **announced disabled** (`internals.ariaDisabled`).

## Consequences

- **C7 clears ≥4.** The control is keyboard-focusable by default, disabled is fully inert across pointer +
  keyboard + AX, and the focus ring (ADR-0009) can finally show. The showcase drops its compensating
  `tabindex="0"` and demonstrates the *control-authored* states.
- **The pattern is reusable and split correctly.** `tabbable` is a trait any control composes (focusability is
  not button-specific); `ariaDisabled` is a one-line control-level effect any control with a `disabled` prop
  copies — documented in `component-author` as the focus+disabled a11y pattern. The split (trait vs
  control-effect) is forced by `internals` being protected, and the ADR records *why* so the next author does
  not try to push `ariaDisabled` into a trait.
- **`tabbable` uses an effect where `press-activation` uses listeners** — a deliberate difference: `tabbable`
  must *actively* change a DOM attribute when `disabled` toggles (reactive), whereas `press-activation` only
  *guards at event time* (no reactivity needed). Both are scope/abort-owned, both leak-free.
- **An author-set `tabindex` is not honoured in v1** — the trait owns the host's tab participation as part of
  the control's semantic contract. A per-instance tab-position override is a rare advanced need; if it arises,
  a later ADR adds an opt-out. (Noted so the limitation is a decision, not an oversight.)
- **Disabled controls leave the tab order** — see the Open question for the AX tradeoff this accepts.

## Resolved on ratification (2026-06-27 — orchestration-lead)

CONFIRMED — **native parity:** disabled → **removed from the tab order** + `internals.ariaDisabled = true`
(the rubric's "fully inert"). The **"accessible disabled"** alternative (keep the control focusable +
`aria-disabled` so AT users can reach and hear it, activation still inert) is **reserved for future
toolbar/menu-style controls** — not the base button. The tradeoff is on record: native-parity skips the
disabled control in the tab order, so an AT user does not encounter it; the toolbar/menu pattern reopens this
where a disabled affordance must stay perceivable.

## Alternatives considered

- **Put `tabindex`/`ariaDisabled` directly in `button.ts` with no trait** — rejected for `tabindex`:
  focusability recurs on every interactive control, so it belongs in a reusable trait (C5, no re-implementation).
  Accepted for `ariaDisabled`: it *cannot* be a trait (`internals` is protected), so it stays a control-level
  effect.
- **A single `interactive` trait bundling press + tabbable (+ aria)** — rejected: it would still need
  `internals` for the aria part (impossible from a trait), and it breaks the existing one-behaviour-per-trait
  grain (`press-activation` is its own trait). `tabbable` is a clean sibling.
- **`tabIndex = -1` when disabled** (programmatically focusable, not tab-reachable) — rejected: a disabled
  control has no reason to be programmatically focusable; removing the attribute is the cleaner native parity.
- **Set `tabindex` once in a non-reactive trait** — rejected: `disabled` toggles at runtime, so focusability
  must react; a scope-owned `host.effect` is the idiomatic signals-based seam and stays leak-free.
- **`internals.states.add('disabled')` (a `:state()` custom state) instead of `ariaDisabled`** — rejected for
  the AX channel: `:state()` is a *styling* hook, not an accessibility announcement; `ariaDisabled` is what AT
  reads. (`button.md` keeps `customStates: []` at G5.)
