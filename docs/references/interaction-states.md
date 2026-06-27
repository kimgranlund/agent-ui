# Interaction states — the four-state control standard

> Canonical normative standard for agent-ui interactive-control states: **hover · active · focus · disabled**.
> Distilled 2026-06-27 from the ratified decisions [ADR-0008](../adr/0008-interaction-state-styling-standard.md)
> (per-variant hover/active styling), [ADR-0009](../adr/0009-focus-ring-token-standard.md) (the shared
> focus-ring token) and [ADR-0010](../adr/0010-tabbable-trait-aria-disabled.md) (the `tabbable` trait +
> `ariaDisabled`). Those ADRs hold the *why* and the alternatives; this doc is the resolved *how-to-apply* the
> NEXT control copies. It reuses the role ladders of [`tokens.md`](./tokens.md) and must not perturb the box
> law of [`geometry.md`](./geometry.md). First consumer: `ui-button` (G5).

## The four states (the one frame)

Beyond **idle**, an interactive control answers four states, carried by two layers — never crossed:

| state | trigger | carrier | what changes |
|---|---|---|---|
| **hover** | `:hover` | CSS (pure) | `background` → a role-ladder step |
| **active** | `:active` (pressed) | CSS (pure) | `background` → a deeper ladder step |
| **focus** | `:focus-visible` (keyboard) | CSS (pure) | an `outline` ring — layout-neutral |
| **disabled** | the `disabled` prop | control class + `tabbable` trait | inert: not focusable · not activatable · announced |

The three **visual** states (hover/active/focus) are platform pseudo-classes — **zero JS**, no `observedAttributes`,
no `[state]` attribute the control toggles. The **disabled** state is the only one with a behaviour/AX contract,
split between a reusable trait (focusability) and a control-level effect (the AX announcement), because the visual
hold falls out of the other three for free. No JS owns a visual state; no CSS owns the a11y contract.

## 1 · Hover / active — per-variant background steps from role ladders

A control reacts on `:hover` and `:active` by repointing **`background`** to a **different role step** — never a
`color-mix`. A mix ratio is a component-authored colour *opinion*, and the discipline is that components hold zero
colour opinions; all colour lives in the token layer (`tokens.md`). So a state shade is a *ladder step*, declared
as its own per-state token and consumed on the pseudo-class.

**[a] declare the state tokens** — in the control's `:where(ui-{cmp})` token block (specificity `(0,0,0)`), each
variant repoints `--ui-{cmp}-bg` (idle) and adds `--ui-{cmp}-bg-hover` / `--ui-{cmp}-bg-active` from a ladder step:

```css
:where(ui-{cmp}) {
  --ui-{cmp}-bg:        var(--c-{f});        /* idle  */
  --ui-{cmp}-bg-hover:  var(--c-{f}-dim);    /* hover */
  --ui-{cmp}-bg-active: var(--c-{f}-high);   /* active */
}
```

**[b] consume them** — in the `@scope (ui-{cmp})` styles block, on the matching pseudo-classes, reading **only**
the component's own `--ui-{cmp}-*` chain (never a role or primitive directly):

```css
:scope:hover  { background: var(--ui-{cmp}-bg-hover); }
:scope:active { background: var(--ui-{cmp}-bg-active); }
```

### Mapping a variant to a ladder

A variant picks a **channel**; the channel fixes the three steps. Reuse `tokens.md`'s two ladders — no new roles:

| channel (variant kind) | idle | hover | active | ink |
|---|---|---|---|---|
| **filled** (a solid accent fill) | `--c-{f}` | `--c-{f}-dim` | `--c-{f}-high` | `--c-{f}-on-{f}` |
| **tonal** (a soft container tint) | `--c-{f}-container-low` | `--c-{f}-container` | `--c-{f}-container-high` | `--c-{f}-on-surface` |
| **text** (transparent at idle) | `transparent` | `--c-{f}-container-low` | `--c-{f}-container` | `--c-{f}` |

The **text** channel has no idle fill to step, so its hover/active wash borrows the bottom two rungs of the
container ladder — a low tint appearing on interaction, vanishing at rest. Worked example, `ui-button`'s three
variants on the `primary` family:

| `ui-button` variant | `--ui-button-bg` | `-bg-hover` | `-bg-active` |
|---|---|---|---|
| **solid** (filled) | `--c-primary` | `--c-primary-hover` | `--c-primary-active` |
| **soft** (tonal) | `--c-primary-container-low` | `--c-primary-container` | `--c-primary-container-high` |
| **ghost** (text) | `transparent` | `--c-primary-container-low` | `--c-primary-container` |

> **When a generic ladder step collapses — dedicated `--c-{f}-hover/-active` roles (ADR-0008 amendment).** The
> filled channel's default rungs (`--c-{f}-dim`/`-high`) can resolve to the SAME step in one `light-dark()`
> branch: `--c-primary-dim` and `--c-primary-high` both land on `--c-primary-650` in light, collapsing solid
> `hover`==`active` there (distinct in dark — the wave-2 cross-engine smoke caught it). The remedy is token-layer,
> NEVER a component `color-mix`: dedicated `--c-{f}-hover/-active` roles with a real three-step ladder in BOTH
> schemes — `--c-primary-hover` = `light-dark(650, 400)`, `--c-primary-active` = `light-dark(750, 350)` (light
> 550→650→750, dark 450→400→350). The solid row above uses them; the next solid-filled control of any family
> gets its own `-hover/-active` roles the same way.

### Disabled holds at idle (no lift)

A disabled host must show **no** hover/active lift. The hold is **structural**, not a special case:

- `:scope:is([disabled])` already sets `pointer-events: none` (the inert rule, §3) — so `:hover`/`:active` can
  never match a disabled host, and neither state token is ever read.
- Keyboard focus cannot land on a disabled host (the `tabbable` trait removes it from the tab order, §3) — so no
  focus lift either.

The disabled token row repoints `--ui-{cmp}-bg` (and, for symmetry, `-bg-hover` / `-bg-active`) to the muted
neutral; the structural hold means the symmetry repoint is belt-and-suspenders, not load-bearing.

### Single-family now; the consumption seam is stable

This pass is **single-family (primary) and per-variant**. When a `family` attribute lands (`tokens.md`'s open
fleet decision — out of scope here), the per-variant×state rows refactor into `tokens.md`'s family→intermediates
form (`--_fill-*` / `--_tonal-*`); the `--ui-{cmp}-bg[-hover|-active]` **consumption seam is unchanged** by that
refactor, so the styles block never moves.

### The escalation (do not synthesize a shade)

If a ladder step reads too close to the one below it (idle ≈ hover, or hover ≈ active) in the real palette, the
fix is **token-layer dedicated state roles** (`--c-{f}-hover` / `-active`) plus an amendment to ADR-0008 — **not**
a component `color-mix`. The control's consumption seam (`--ui-{cmp}-bg-hover/-active`) does not change; only the
ladder step it points at does. This is a design change: stop and escalate, don't invent the shade in the control.

## 2 · Focus — the one shared `:focus-visible` ring

The focus indicator is a **fleet constant**, not a per-control opinion: identical on every control, keyboard-only,
forced-colors-safe, layout-neutral. It rides **three shared tokens** in `@agent-ui/shared` (the one allowed
cross-package import is `components → @agent-ui/shared`, so every control reads them with no layering violation):

| token | home | value | role |
|---|---|---|---|
| `--c-focus-ring` | `shared/src/tokens/tokens.css` | a **dedicated** accent-leaning role (`→ Highlight` under forced-colors) | the ring colour |
| `--ui-focus-ring-width` | `shared/src/tokens/dimensions.css` | `2px` | the ring width |
| `--ui-focus-ring-offset` | `shared/src/tokens/dimensions.css` | `2px` | the gap to the box edge |

`--c-focus-ring` is a **dedicated role, not `--c-primary` reused** — so a `ghost`/secondary/neutral control gets
the *same* ring, not one tinted by the primary family. The width/offset are **constants** (no `var()` over a
subtree-repointable multiplier), so they live on `:root`, not on `*` — ADR-0007's universal-selector rule covers
only *derived* tokens.

**The recipe** — every control's `@scope` block applies the identical rule, reading only the shared tokens:

```css
:scope:focus-visible {
  outline: var(--ui-focus-ring-width) solid var(--c-focus-ring);
  outline-offset: var(--ui-focus-ring-offset);
}
```

Three deliberate choices behind it:

- **`outline`, not `box-shadow`** — `outline` is painted *outside* the box without affecting layout, so the
  geometry law (`geometry.md`) and its smoke assertions stay intact; the UA preserves `outline` under
  `forced-colors`; and `--c-focus-ring`'s `→ Highlight` mapping makes the WHCM ring **free**. (`box-shadow` is
  suppressed under forced-colors — kept on the shelf only as a fallback behind a later ADR.)
- **`:focus-visible`, not `:focus`** — the keyboard-only contract: no ring on a mouse click.
- The ring shows **only when keyboard-focused** — the `tabbable` trait (§3) supplies the `tabindex=0` a light-DOM
  custom element needs to be focusable, and removes it when disabled, so a disabled control never draws the ring.

**Cross-engine caveat:** `outline` rounding-follows-`border-radius` is engine-versioned — modern WebKit (≈16.4+)
rounds the outline to a pill, older WebKit squares it. The requirement is a *visible, keyboard-only,
forced-colors-safe* ring; perfect rounding on the pill is nice-to-have. A squared ring on an older WebKit is
acceptable (the wave-2 cross-engine smoke checks both engines).

## 3 · Disabled — the inert a11y contract (`tabbable` trait + `ariaDisabled`)

A disabled interactive control must be **three-fold inert**: **not focusable**, **not activatable**, and
**announced disabled** to assistive tech. The contract is split by *what can reach `internals`* — because
`UIElement.internals` is `protected`, a trait (which only receives `host: UIElement`) cannot set ARIA, so the AX
half must live in the control class.

**[a] `tabbable` — a reusable trait** (`components/src/traits/tabbable.ts`), a sibling of `press-activation`,
invoked from `connected()`:

```ts
export function tabbable(host: UIElement, opts: { disabled: () => boolean }): () => void
```

- **`tabindex=0` by default** (role=button focus parity — a light-DOM custom element inherits none), set through a
  **scope-owned `host.effect`** so it reacts to the `disabled` signal, is disposed with the connection scope, and
  **re-applies on reconnect** (`connected()` re-runs → the effect re-installs). Leak-free by construction.
- **Disabled → `removeAttribute('tabindex')`** — out of the tab order, matching native `<button disabled>`.
- **`release()` is idempotent** (a `released` guard), mirroring `press-activation`. Imports only `../dom` (the one
  allowed `traits → dom` direction).
- It uses an **effect** where `press-activation` uses **listeners** — deliberate: `tabbable` must *actively* change
  a DOM attribute when `disabled` toggles (reactive); `press-activation` only *guards at event time* (no
  reactivity). Both are scope/abort-owned and leak-free.

**[b] `ariaDisabled` — a control-level effect** in the control's `connected()`, alongside `role` (it **cannot** be
a trait — `internals` is protected):

```ts
this.internals.role = '{role}'
tabbable(this,       { disabled: () => this.disabled })
pressActivation(this, { disabled: () => this.disabled })
this.effect(() => { this.internals.ariaDisabled = this.disabled ? 'true' : null })
```

The effect reads the `disabled` prop signal, so the AX state stays in sync; it is scope-owned (disposed on
disconnect, re-run on reconnect → zero residue). `ariaDisabled` (not a native `disabled`) is correct because the
control extends `UIElement` and is **not** form-associated — it has no platform disabled state, so the AX state
rides `ElementInternals.ariaDisabled`.

> **Form-associated controls differ.** A `UIFormElement`-based control (`ui-text-field`, …) *is*
> form-associated and gains a platform `disabled` state — its AX-disabled may ride that platform state rather than
> `ariaDisabled`. This contract is written for non-form-associated (`UIElement`) interactive controls; confirm the
> disabled channel per family before copying it onto a form control.

**The split is the reusable lesson:** focusability recurs on every interactive control → a reusable **trait**;
`ariaDisabled` *cannot* be a trait (protected `internals`) → a one-line **control-level effect** any control with
a `disabled` prop copies. Do not try to push `ariaDisabled` into a trait.

## 4 · Motion — transition the state paint, snap the geometry, gate past first paint

State changes (hover/active, and a JS-driven variant/colour change) **animate**; the first render and every
geometry change **snap**. Three fleet-wide rules:

**[a] Transition the state-PAINT properties only — never geometry, never `all`.** Enumerate
`background-color` / `color` / `border-color` (add `box-shadow` / `opacity`, or a caret `transform`, if the
control uses them). A `[scale]` / `[size]` / `[density]` change must be **instant** — the geometry ramp
(`geometry.md`) is never in the transition list; animating it fights the sizing law and reads as jank. The
keyboard focus ring stays instant too (omit `outline`): keyboard users want immediate, unambiguous feedback.
Durations/easings are **tokens** (`--ui-motion-fast`, `--ui-ease-standard` in `dimensions.css`) — constants on
`:root` like the focus-ring geometry, not magic numbers.

**[b] Gate the transition behind a post-first-paint `:state(ready)`.** A custom element paints once on upgrade
(UA defaults) before `@scope` styling applies; if `transition` is already declared, that first change animates —
the flash. So declare **no** transition until the control has settled, via an `ElementInternals` **custom state**
(not a host attribute), flipped one frame past first paint:

```ts
// connected(), after the role/trait/effect wiring:
requestAnimationFrame(() => this.internals.states?.add('ready'))
```
```css
:scope:state(ready) {
  transition: background-color var(--ui-motion-fast) var(--ui-ease-standard),
              color            var(--ui-motion-fast) var(--ui-ease-standard),
              border-color     var(--ui-motion-fast) var(--ui-ease-standard);
}
```

`requestAnimationFrame` (not `updateComplete`, a microtask *before* paint) clears the first paint; adding `ready`
afterward grants the *capability* without changing any transitioned value at that instant, so only **subsequent**
state changes animate. It also covers token/CSS-load races (ready flips only after the frame), and is idempotent
(a Set) so reconnect is safe. The fleet motion tokens are read DIRECTLY in `@scope` (like the focus-ring
constants) — a fleet token, not a per-control opinion.

**[c] Honour `prefers-reduced-motion: reduce` — zero the transitions (non-negotiable).**

```css
@media (prefers-reduced-motion: reduce) {
  :scope:state(ready) { transition: none; }
}
```

## Mechanization

Each state lands with a probe (per [`process.md`](../process.md)) — a state without a probe is not enforced.
The carrier decides the harness:

- **hover / active / focus** are pure pseudo-class styling: jsdom does not evaluate them, so they are proven in
  the **cross-engine browser smoke** — the computed `background` changes idle→`:hover`→`:active`, and a
  `:focus-visible` `outline` is present (not `none`) and survives `forced-colors`.
- **tabbable / ariaDisabled** are DOM/AX state: proven in **jsdom unit tests** — `tabIndex === 0` while enabled,
  no `tabindex` attribute while disabled (and re-applied on reconnect); `internals.ariaDisabled` toggles
  `'true'`/`null` with the `disabled` prop, with **zero residue** after disconnect.
- **motion** is gated CSS + a one-line JS state flip: the `:state(ready)` transition rule (state-paint only, no
  geometry, no `all`) and the reduced-motion zero are pinned by the **jsdom CSS-text probe**; that the first
  paint does NOT animate and a subsequent hover DOES is the **cross-engine smoke**'s (jsdom has no
  `CustomStateSet`, so the `:state(ready)` behaviour can't be computed there).

## Decisions (source)

This doc carries no decisions of its own; it applies these ratified ADRs. Consult them for rationale, alternatives
and open questions:

- [**ADR-0008**](../adr/0008-interaction-state-styling-standard.md) — per-variant hover/active background steps
  from role ladders (no `color-mix`); the disabled hold.
- [**ADR-0009**](../adr/0009-focus-ring-token-standard.md) — the shared `--c-focus-ring` role + the
  `--ui-focus-ring-width/-offset` constants, consumed via a `:focus-visible` `outline`.
- [**ADR-0010**](../adr/0010-tabbable-trait-aria-disabled.md) — the `tabbable` trait (focusable by default, out of
  the tab order when disabled) + the control-level `ariaDisabled` effect.

Colour ladders: [`tokens.md`](./tokens.md). Box law the ring must not perturb: [`geometry.md`](./geometry.md).
